const { query } = require("../db/mysql");
const { uuid } = require("uuidv4");
const sql = require("sql-template-strings");

const getAnnouncements = async () => {
  const announcements = await query({
    query: sql`
      select
        a.id,
        a.public_id,
        a.title,
        a.editor_text as content,
        a.created_at as created,
        JSON_OBJECT(
          'id', u.id, 
          'name', u.name,
          'email', u.email,
          'picture', p.path,
          'thumbnail', p.thumbnail_path
        ) as author
      from announcements a
      join users u on u.id = a.user_id
      left join (
          select
            p.*
          from pictures p
            inner join (
              SELECT picturable_id, max(updated_at) as max_updated from pictures group by picturable_id
            ) mu on p.picturable_id = mu.picturable_id and p.updated_at = mu.max_updated
        ) p on p.picturable_id = u.id
      where a.deleted_at is null order by a.created_at desc;
    `,
  });

  return announcements.map((announcement) => {
    return {
      ...announcement,
      author: JSON.parse(announcement.author),
    };
  });
};

const createAnnouncement = async ({ data, connection }) => {
  return query({
    query: sql`
      insert into announcements
      (public_id, user_id, group_id, title, editor_text, is_pinned, announcement_status_id)
      values (
        ${uuid()}, 
        ${data.userId}, 
        6, 
        ${data.title}, 
        ${data.editorText}, 
        0, 
        1);
    `,
    connection,
  });
};

const deleteAnnouncement = async ({ data, connection }) => {
  return query({
    query: sql`
      delete from announcements where id = ${data.id};
    `,
    connection,
  });
};

module.exports = {
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
};
