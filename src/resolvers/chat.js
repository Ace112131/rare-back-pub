const dal = require("../dal");

module.exports = {
  Query: {
    getChatMute: async (_parent, args, { user }) => {
      const mute = await dal.chat.getChatMute({
        data: {
          agentId: user.id,
          mute: args.mute,
        },
      });

      return mute;
    },
  },
  Mutation: {
    updateChatMute: async (_parent, args, { user }) => {
      const mute = await dal.chat.getChatMute({
        data: {
          agentId: user.id,
          mute: args.mute,
        },
      });

      if (mute) {
        await dal.chat.unmute({
          data: {
            agentId: user.id,
            mute: args.mute,
          },
        });
      } else {
        await dal.chat.mute({
          data: {
            agentId: user.id,
            mute: args.mute,
          },
        });
      }

      return true;
    },
  },
};
