const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:8080",
  "127.0.0.1:3000",
  "https://cloud.rarerealestate.ca",
  "https://studio.apollographql.com",
];

const corsOptions = {
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error("No allowed by CORS"));
    }
  },
  optionsSuccessStatus: 200,
  credentials: true,
};

const credentials = (req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Credentials", true);
    res.header("Access-Control-Allow-Origin", true);
  }
  next();
};

module.exports = {
  corsOptions,
  credentials,
};
