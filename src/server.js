require("dotenv").config();
const { ApolloServer } = require("apollo-server-express");
const express = require("express");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const middlewares = require("./middlewares");
const typeDefs = require("./typeDefs");
const resolvers = require("./resolvers");
const auth = require("./helpers/auth");
const dal = require("./dal");
const http = require("http");
const forms = require("./routes/forms");
// Do not fucking upgrade unless you want to change every file to .mjs
// https://github.com/jaydenseric/graphql-upload/issues/305
const { graphqlUploadExpress } = require("graphql-upload");
const chat = require("./routes/chat");

const PORT = 8080;

const context = async ({ req, res }) => {
  console.log(req.body.operationName, ":", req.body.variables);
  if (["authenticateUser", "logout"].includes(req.body.operationName))
    return { req, res };

  const user = await (async () => {
    const { userId } = req;
    if (!userId) return null;
    const user = await dal.users.getUser({ userId });
    return { ...user, godmode: req.godmode, godmodeUser: req.godmodeUser };
  })();

  return { req, res, user };
};

const startApolloServer = async () => {
  const app = express();

  app.use(morgan("dev"));
  app.use(middlewares.credentials);
  app.use(cors(middlewares.corsOptions));
  app.use(cookieParser());
  app.use("/api/forms", forms);
  app.use("/api/chat", chat);
  app.use(express.json());

  app.get("/", async (req, res) => {
    res.send("hello world");
  });

  app.use((req, res, next) => {
    const accessToken = req.cookies?.accessToken;
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken && !accessToken) {
      return next();
    }

    try {
      const authenticatedUser = auth.verifyAccessToken(accessToken);

      req.userId = authenticatedUser.id;
      req.godmode = authenticatedUser.godmode;
      req.godmodeUser = authenticatedUser.godmodeUser;
      return next();
    } catch {
      console.log("Invalid access token");
    }

    if (!refreshToken) {
      console.log("No refresh token");
      return next();
    }

    try {
      const authenticatedUser = auth.verifyRefreshToken(refreshToken);

      // TODO: Implement refresh token validation
      req.userId = authenticatedUser.id;
      req.godmode = authenticatedUser.godmode;
      req.godmodeUser = authenticatedUser.godmodeUser;

      const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
        auth.generateTokens(authenticatedUser, req.godmodeUser);

      res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        sameSite: "None",
        secure: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.cookie("accessToken", newAccessToken, {
        httpOnly: true,
        sameSite: "None",
        secure: true,
        maxAge: 30 * 60 * 1000,
      });
      console.log("Refreshed tokens");
    } catch {
      console.log("Invalid refresh token");
    }

    next();
  });

  app.use((err, req, res, next) => {
    res.status(err.status);
    res.send({
      message: err.message,
    });
  });
  app.use(graphqlUploadExpress());

  const httpServer = http.createServer(app);

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    csrfPrevention: true,
    context,
    formatError: (err) => {
      console.log(err);
      if (err.extensions.exception.name === "UserError")
        return Error(err.message);
      return Error("An error occurred. Please try again later.");
    },
  });

  await server.start();
  server.applyMiddleware({
    app,
    path: "/graphql",
    cors: false,
  });

  await new Promise((resolve) => {
    httpServer.listen({ port: PORT }, resolve);
  });
  console.log(`Listening on port ${PORT}`);
};

startApolloServer();
