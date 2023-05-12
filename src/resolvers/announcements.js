const dal = require("../dal");
const { convert } = require("html-to-text");
const { transaction } = require("../db/mysql");
const twilio = require("../helpers/twilio");
const textTemplates = require("../helpers/templates/texts");

module.exports = {
  Query: {
    getAnnouncements: async (parent, args, { user }) => {
      const announcements = await dal.announcements.getAnnouncements();
      return announcements.map((announcement) => {
        return {
          ...announcement,
          preview: `${convert(announcement.content).substring(0, 130)} ...`,
        };
      });
    },
  },

  Mutation: {
    createAnnouncement: async (parent, args, { user }) => {
      await transaction(async (connection) => {
        await dal.announcements.createAnnouncement({
          data: {
            userId: user.id,
            title: args.data.title,
            editorText: args.data.content,
          },
          connection,
        });
      });

      const users = await dal.users.searchUsers({ name: "" });

      const uniquePhoneNumbers = [];

      await Promise.all(
        users.map(async (user) => {
          if (!uniquePhoneNumbers.includes(user.phone_number)) {
            uniquePhoneNumbers.push(user.phone_number);

            await twilio.sendText({
              to: user.phone_number,
              template: textTemplates.new_announcement,
            });
          }
          return;
        })
      );
    },

    deleteAnnouncement: async (parent, args, { user }) => {
      await transaction(async (connection) => {
        await dal.announcements.deleteAnnouncement({
          data: {
            id: args.id,
          },
          connection,
        });
      });
    },
  },
};
