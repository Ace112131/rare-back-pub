const mysql = require("mysql");
const sql = require("sql-template-strings");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  connectionLimit: 100,
});

const query = async ({ query, options = {}, connection }) => {
  return new Promise((resolve, reject) => {
    (connection || pool).query(query, (error, results) => {
      if (error) {
        console.log(error);
        new Error(error);
      }
      if (options.first) {
        resolve(results[0]);
      }
      resolve(results);
    });
  });
};

const transaction = async (callback) => {
  return new Promise((resolve, reject) => {
    pool.getConnection((error, connection) => {
      if (error) reject(error);
      connection.beginTransaction(async (error) => {
        if (error) reject(error);
        try {
          await callback(connection);
        } catch (err) {
          return connection.rollback((error) => {
            if (error) new Error(error); //reject(error);
            connection.release();
            resolve();
          });
        }

        connection.commit((error) => {
          if (error) new Error(error); //reject(error);
          connection.release();
          resolve();
        });
      });
    });
  });
};

const getLastInsertId = (connection = pool) => {
  return new Promise((resolve, reject) => {
    connection.query(sql`select LAST_INSERT_ID() as id`, (error, results) => {
      if (error) reject(error);
      resolve(results[0].id);
    });
  });
};

module.exports = { query, transaction, getLastInsertId };
