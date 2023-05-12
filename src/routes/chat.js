const express = require("express");
const { uniq } = require("lodash");
const { getGroupMembers } = require("../helpers/cometchat");
const twilio = require("../helpers/twilio");
const chat = express.Router();
const textTemplates = require("../helpers/templates/texts");
const dal = require("../dal");

chat.post(
  "/new-message",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const message = JSON.parse(req.body.toString());
    const {
      receiver: groupChatId,
      receiverType: chatType,
      data,
    } = message.data;

    const { sender, receiver } = data.entities;

    if (chatType === "group") {
      const { data: recipients } = await getGroupMembers(groupChatId);

      const mutes = await dal.chat.getChatMuteByPublicId({
        data: {
          mute: groupChatId,
          publicIds: recipients.map((r) => r.uid),
        },
      });

      const mutedPublicIds = mutes.map((mute) => mute.public_id);

      const recipientNumbers = recipients
        .filter((r) => !mutedPublicIds.includes(r.uid))
        .reduce((sum, recipient) => {
          if (recipient.metadata && recipient.metadata["@private"]) {
            sum.push(recipient.metadata["@private"].contactNumber);
          }
          return sum;
        }, []);

      await Promise.all(
        uniq(recipientNumbers).map(async (recipientNumber) => {
          await twilio.sendText({
            to: recipientNumber,
            template: textTemplates.new_group_message,
            data: {
              sender: sender.entity.name,
              groupName: receiver.entity.name,
              link: `/chat/channels/${groupChatId}`,
            },
          });
        })
      );

      return res.send("Success");
    }

    if (chatType === "user") {
      const mute = await dal.chat.getChatMuteByPublicId({
        data: {
          mute: groupChatId,
          publicIds: [receiver.entity.uid],
        },
        options: { first: true },
      });

      if (mute) return res.send("Success");

      if (receiver.entity.metadata && receiver.entity.metadata["@private"]) {
        await twilio.sendText({
          to: receiver.entity.metadata["@private"].contactNumber,
          template: textTemplates.new_direct_message,
          data: {
            sender: sender.entity.name,
            link: `/chat/users/${sender.entity.uid}`,
          },
        });
      }
      return res.send("Success");
    }
  }
);

module.exports = chat;
