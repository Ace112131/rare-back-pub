const { getS3Url } = require("./utils");
const axios = require("axios").default;

const url = `https://${process.env.COMET_APP_ID}.api-${process.env.COMET_API_REGION}.cometchat.io/v3`;
const options = {
  headers: {
    apiKey: process.env.COMET_API_KEY,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
};

const getUser = async (user) => {
  return new Promise((resolve) => {
    axios
      .request({
        ...options,
        method: "GET",
        url: `${url}/users/${user.public_id}`,
      })
      .then((response) => {
        resolve(response.data.data || null);
      })
      .catch((error) => {
        resolve(null);
      });
  });
};

const updateUser = async (user) => {
  return new Promise((resolve) => {
    axios
      .request({
        ...options,
        method: "PUT",
        url: `${url}/users/${user.public_id}`,
        data: {
          name: user.name,
          metadata: {
            "@private": {
              email: user.email,
              contactNumber: user.phone_number,
            },
          },
        },
      })
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        resolve(null);
      });
  });
};

const createUser = async (user) => {
  return new Promise((resolve) => {
    axios
      .request({
        ...options,
        method: "POST",
        url: `${url}/users`,
        data: {
          uid: user.public_id,
          name: user.name,
          metadata: {
            "@private": {
              email: user.email,
              contactNumber: user.phone_number,
            },
          },
        },
      })
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        resolve(null);
      });
  });
};

const deleteUser = async (user) => {
  return new Promise((resolve) => {
    axios
      .request({
        ...options,
        method: "DELETE",
        url: `${url}/users/${user.public_id}`,
        data: {
          permanent: true,
        },
      })
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        resolve(error);
      });
  });
};

const getGroupMembers = async (groupId) => {
  return new Promise((resolve) => {
    axios
      .request({
        ...options,
        method: "GET",
        url: `${url}/groups/${groupId}/members`,
      })
      .then((response) => {
        resolve(response.data || null);
      })
      .catch((error) => {
        resolve(null);
      });
  });
};
module.exports = {
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getGroupMembers,
};
