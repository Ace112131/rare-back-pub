const { query } = require("../db/mysql");
const sql = require("sql-template-strings");

const getForumTopics = async () => {
  return query({
    query: sql`
      select forum_post.id, forum_post.author, forum_post.last_updated, forum_post.topic, users.name from forum_post
      LEFT JOIN users ON forum_post.author=users.id;`,
  });
};

const createForumTopic = async ({ userId, topic }) => {
  return query({
    query: sql`
        insert into forum_post (author, topic) values
        (${userId}, ${topic})
    `,
  });
};

module.exports = { getForumTopics, createForumTopic };
