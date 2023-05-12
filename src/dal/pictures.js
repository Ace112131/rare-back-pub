const { query } = require("../db/mysql");
const sql = require("sql-template-strings");
const { uuid } = require("uuidv4");

const getPictures = async () => {
  return query({
    query: sql`
      select
        p.*
      from pictures p
        inner join (
          SELECT picturable_id, max(updated_at) as max_updated from pictures group by picturable_id
        ) mu on p.picturable_id = mu.picturable_id and p.updated_at = mu.max_updated`,
  });
};

const setPicture = async ({ data, connection }) => {
  return query({
    query: sql`
      INSERT INTO pictures
        (public_id, path, thumbnail_path, picturable_id)
      VALUES
        (${uuid()}, ${data.path}, ${data.thumbnail_path}, ${data.user_id})
      ON DUPLICATE KEY UPDATE
        path     = VALUES(path),
        thumbnail_path = VALUES(thumbnail_path),
        updated_at = now()
    `,
    connection,
  });
};

module.exports = {
  getPictures,
  setPicture,
};
