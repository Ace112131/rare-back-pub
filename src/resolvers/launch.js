const { query, transaction, getLastInsertId } = require("../db/mysql");
const sql = require("sql-template-strings");
const crypto = require("crypto");
const authorization = require("../helpers/authorization");
const { sendEmail } = require("../helpers/mailersend");

module.exports = {
  Query: {},
  Mutation: {
    triggerLaunchInvitations: async (parent, args, { user }) => {
      authorization({ user, roles: ["super_admin"] });
      const users = await query({
        query: sql`
        select u.*, up.first_name from users u
        join user_profiles up on u.id = up.user_id
        where u.deleted_at is null and !u.rare_cloud_user`,
      });

      await Promise.all(
        users.map(async (user) => {
          const email = user.email;
          const token = await (async () => {
            return new Promise((resolve) => {
              crypto.randomBytes(64, async (err, buffer) => {
                const token = buffer.toString("hex");

                await query({
                  query: sql`
                  insert into password_reset_expires (email, token, expires_at) values
                  (${email}, ${token}, NOW() + INTERVAL 2 WEEK);`,
                });

                resolve(token);
              });
            });
          })();

          await sendEmail({
            email,
            template: "rare_cloud_migration",
            data: { token, first_name: user.first_name },
          });
        })
      );

      return;
    },
  },
};
