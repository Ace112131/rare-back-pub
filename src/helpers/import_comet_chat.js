require("dotenv").config();
const dal = require("../dal");
const cometchat = require("./cometchat");

const run = async () => {
  const allUsers = await dal.users.getAllActiveUsers();

  for (const user of allUsers) {
    cometchat
      .createUser(user)
      //   .deleteUser(user)
      .then((res) => console.log(res))
      .catch((err) => console.log(err));
  }
};

run();
