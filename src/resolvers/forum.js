const { query, transaction, getLastInsertId } = require("../db/mysql");
const dal = require("../dal");

module.exports = {
  Query: {
    getForumTopics: async (_parent, _args, { user }) => {
      const topics = await dal.forum.getForumTopics();

      return [
        ...topics.map((topic) => {
          return {
            id: topic.id,
            author: topic.author,
            author_name: topic.name,
            last_updated: topic.last_updated,
            topic: topic.topic,
          };
        }),
      ];
    },
  },
  Mutation: {
    createForumTopic: async (_parent, args, { user }) => {
      const result = await dal.forum.createForumTopic({
        userId: user.id,
        topic: args.topic,
      });

      return true;
    },
  },
};
