const twilio = require("twilio");
const templates = require("./templates/texts");
const whitelist = JSON.parse(process.env.TWILIO_WHITELIST) || [];

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const fromNumber = process.env.TWILIO_FROM_NUMBER;

const sendText = ({ to, template, data }) => {
  if (process.env.NODE_ENV === "development" && !whitelist.includes(to)) {
    return console.log(`Text -> ${to}`);
  }

  const body = template(data);

  return new Promise((resolve, reject) => {
    client.messages
      .create({ body, from: fromNumber, to })
      .then((message) => resolve(message.sid))
      .catch((err) => {
        console.log(err);
        resolve(err);
      });
  });
};

// util for sending bulk SMS messages in listing + deal resolvers
const textAllAgents = async ({ agents, template, data }) => {
  return Promise.all(
    agents.map(async (agent) => {
      await sendText({
        to: agent.phone || agent.phone_number,
        template,
        data: data ?? {},
      });
    })
  );
};

module.exports = {
  sendText,
  textAllAgents,
};
