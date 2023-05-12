const redis = require("redis");

const client = redis.createClient();

client.on("error", (err) => {
  console.error(err);
});

client.on("connect", () => {
  console.log("Redis client connected");
});

client.connect();

module.exports = client;
