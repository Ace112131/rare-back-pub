const { query } = require("../db/mysql");
const sql = require("sql-template-strings");

const mute = async ({ data, connection }) => {
  return query({
    query: sql`
        insert into chat_mutes 
        (agent_id, mute)
        values (${data.agentId}, ${data.mute});`,
    connection,
  });
};

const unmute = async ({ data, connection }) => {
  return query({
    query: sql`
        delete from chat_mutes where agent_id = ${data.agentId} and mute = ${data.mute};`,
    connection,
  });
};

const getChatMute = async ({ data, connection }) => {
  return query({
    query: sql`
        select * from chat_mutes where agent_id = ${data.agentId} and mute = ${data.mute};`,
    connection,
    options: { first: true },
  });
};

const getChatMuteByPublicId = async ({ data, connection, options = {} }) => {
  return query({
    query: sql`
          select u.public_id, cm.* from chat_mutes cm
          left join users u on u.id = cm.agent_id
          where cm.mute = ${data.mute} and u.public_id in (${
      data.publicIds || []
    });`,
    connection,
    options,
  });
};

module.exports = { mute, unmute, getChatMute, getChatMuteByPublicId };
