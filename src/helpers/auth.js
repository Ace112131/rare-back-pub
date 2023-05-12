const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const dal = require("../dal");
const { query } = require("../db/mysql");
const sql = require("sql-template-strings");
const { UserError } = require("./errors");

const saltRounds = 10;

const hashPassword = (password) => {
  return new Promise((resolve) => {
    bcrypt.hash(password, saltRounds, (error, encryptedPassword) => {
      resolve(encryptedPassword);
    });
  });
};

const validateLogin = ({ email, password }) => {
  return new Promise(async (resolve) => {
    const user = await query({
      query: sql`select id, password_hash from users where LOWER(email) = LOWER(${email})`,
      options: { first: true },
    });
    if (!user) return resolve(null);

    bcrypt.compare(password, user.password_hash, (error, valid) => {
      if (error) {
        throw error;
      }
      resolve(valid);
    });
  });
};

const setPassword = ({ userId, password }) => {
  return new Promise(async (resolve) => {
    const passwordHash = await hashPassword(password);
    await query({
      query: sql`update users set password_hash = ${passwordHash}, rare_cloud_user = true where id = ${userId}`,
    });
    resolve();
  });
};

const generateTokens = (user, godmodeUser = null) => {
  const accessToken = jwt.sign(
    {
      id: user.id,
      name: user.name,
      godmode: Boolean(godmodeUser),
      godmodeUser,
    },
    process.env.JWT_ACCESS_TOKEN_KEY,
    { expiresIn: "1h" }
  );

  const refreshToken = jwt.sign(
    {
      id: user.id,
      name: user.name,
      godmode: Boolean(godmodeUser),
      godmodeUser,
    },
    process.env.JWT_REFRESH_TOKEN_KEY,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
};

const verifyAccessToken = (token) => {
  let verified;
  try {
    verified = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_KEY);
  } catch (err) {
    throw UserError("Invalid Token");
  }
  return verified;
};

const verifyRefreshToken = (token) => {
  let verified;
  try {
    verified = jwt.verify(token, process.env.JWT_REFRESH_TOKEN_KEY);
  } catch (err) {
    throw UserError("Invalid Token");
  }
  return verified;
};

module.exports = {
  hashPassword,
  validateLogin,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  setPassword,
};
