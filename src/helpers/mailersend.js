const Recipient = require("mailersend").Recipient;
const EmailParams = require("mailersend").EmailParams;
const Attachment = require("mailersend").Attachment;
const MailerSend = require("mailersend");
const whitelist = JSON.parse(process.env.MAILERSEND_WHITELIST) || [];
const templates = require("./templates/emails");
const { convert } = require("html-to-text");
const fs = require("fs");

const client = new MailerSend({
  api_key: process.env.MAILERSEND_API_KEY,
});

const sendEmail = ({ email, template, data }) => {
  if (template === null && data === null)
    throw Error("Please include a message");

  if (process.env.NODE_ENV === "development" && !whitelist.includes(email)) {
    return console.log(`Email -> ${email}`);
  }

  const { subject, message, html } = templates[template](data);

  return new Promise(async (resolve, reject) => {
    const recipients = [new Recipient(email, email)];
    const emailParams = new EmailParams()
      .setFrom("cloud@rarerealestate.ca")
      .setFromName("RARE Cloud")
      .setRecipients(recipients)
      .setSubject(subject)
      .setText(message || convert(html))
      .setHtml(html || message);

    if (data.attachment) {
      const attachment = [
        new Attachment(
          fs.readFileSync(data.attachment.path, { encoding: "base64" }),
          data.attachment.name
        ),
      ];
      emailParams.setAttachments(attachment);
    }

    try {
      await client.send(emailParams);
    } catch (e) {
      reject(e);
    }
    resolve();
  });
};

module.exports = { sendEmail };
