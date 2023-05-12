const { query, transaction, getLastInsertId } = require("../db/mysql");
const sql = require("sql-template-strings");
const auth = require("../helpers/auth");
const { UserError } = require("../helpers/errors");
const cometchat = require("../helpers/cometchat");
const dal = require("../dal");
const s3 = require("../helpers/s3");
const sharp = require("sharp");
const crypto = require("crypto");
const { sendEmail } = require("../helpers/mailersend");
const authorization = require("../helpers/authorization");
const { uuid } = require("uuidv4");

module.exports = {
  Query: {
    getUser: async (parent, args, { user }) => {
      return user;
    },

    getAgents: async (parent, args) => {
      const { search } = args;

      // Search by name
      const agents = await dal.users.searchUsers({ name: search });
      console.log(agents);
      return agents.sort((a, b) => (a.name > b.name ? 1 : -1));
    },
    getAgentsWhoDonotHaveReferral: async (parent, args) => {
      return dal.users.getAgentsWhoDonotHaveReferral();
    },
    getTokenValid: async (parent, args) => {
      const { token } = args;

      const validToken = await query({
        query: sql`
          select * from password_reset_expires where token = ${token} and expires_at > now()
        `,
        options: { first: true },
      });

      if (!validToken) {
        throw UserError("Invalid token");
      }
      return true;
    },
  },

  Mutation: {
    authenticateUser: async (parent, args, { res }) => {
      const { email, password } = args;

      // TODO: Check if password is valid
      const valid = await auth.validateLogin({ email, password });
      if (!valid) throw UserError("Invalid login");

      const user = await query({
        query: sql`select u.id, u.public_id, u.name, u.email, up.phone_number from users u join user_profiles up on u.id = up.user_id where LOWER(u.email) = LOWER(${email})`,
        options: { first: true },
      });

      const cometChatUser = await cometchat.getUser(user);
      console.log(cometChatUser);
      if (cometChatUser === null) {
        await cometchat.createUser(user);
      } else {
        console.log("UPDATE");
        await cometchat.updateUser(user);
      }

      const { accessToken, refreshToken } = auth.generateTokens({
        id: user.id,
        email: user.email,
        name: user.name,
      });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        sameSite: "None",
        secure: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        sameSite: "None",
        secure: true,
        maxAge: 30 * 60 * 1000,
      });

      return;
    },

    enterGodMode: async (parent, args, { user, res }) => {
      authorization({ user, roles: ["super_admin"] });
      const { userId } = args;

      const targetUser = await dal.users.getUser({ userId });

      const { accessToken, refreshToken } = auth.generateTokens(
        {
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
        },
        user.id
      );

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        sameSite: "None",
        secure: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        sameSite: "None",
        secure: true,
        maxAge: 30 * 60 * 1000,
      });

      return;
    },

    exitGodMode: async (parent, args, { user, res }) => {
      if (!user.godmode) throw UserError("Not in god mode");

      const targetUser = await dal.users.getUser({ userId: user.godmodeUser });

      const { accessToken, refreshToken } = auth.generateTokens({
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
      });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        sameSite: "None",
        secure: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        sameSite: "None",
        secure: true,
        maxAge: 30 * 60 * 1000,
      });

      return;
    },

    forgotPassword: async (parent, args) => {
      const { email } = args;

      const user = await query({
        query: sql`
          select * from users where LOWER(email) = LOWER(${email})`,
      });
      if (!user) throw UserError("No account found");

      const token = await (async () => {
        return new Promise((resolve) => {
          crypto.randomBytes(64, async (err, buffer) => {
            const token = buffer.toString("hex");

            await query({
              query: sql`
                insert into password_reset_expires (email, token, expires_at) values
                (${email}, ${token},  NOW() + INTERVAL 15 MINUTE);`,
            });

            resolve(token);
          });
        });
      })();

      sendEmail({
        email,
        template: "password_reset",
        data: { token },
      });
    },

    resetPassword: async (parent, args) => {
      const { password, token } = args;

      await transaction(async (connection) => {
        const validToken = await query({
          query: sql`
            select * from password_reset_expires where token = ${token} and expires_at > now();
          `,
          options: { first: true },
          connection,
        });

        if (!validToken) {
          throw UserError("Invalid token");
        }

        const user = await query({
          query: sql`
            select * from users where LOWER(email) = LOWER(${validToken.email}) and deleted_at is null;
          `,
          options: { first: true },
          connection,
        });

        if (!user) {
          throw UserError("User not found");
        }

        await auth.setPassword({ userId: user.id, password });

        // Expire token
        await query({
          query: sql`
            update password_reset_expires set expires_at = now(), updated_at = now() where id = ${validToken.id};
          `,
          connection,
        });
      });
    },

    updateEmail: async (parent, args, { user }) => {
      const { email } = args;

      await dal.users.updateUserEmail({ data: { email, user_id: user.id } });
    },

    updatePassword: async (parent, args, { user }) => {
      const { currentPassword, newPassword } = args;

      const valid = await auth.validateLogin({
        email: user.email,
        password: currentPassword,
      });
      if (!valid) throw UserError("Password is incorrect");

      await auth.setPassword({ userId: user.id, password: newPassword });
    },

    logout: async (parent, args, { res }) => {
      // TODO: Invalidate refresh token

      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");
      return;
    },
    updateRecoLicense: async (parent, args, { user }) => {
      const { reco_number, reco_expiry } = args.data;

      await dal.users.updateRecoLicense({
        data: {
          user_id: user.id,
          reco_number,
          reco_expiry,
        },
      });
    },
    updateProfile: async (parent, args, { user }) => {
      const { data } = args;

      await transaction(async (connection) => {
        await dal.users.updateUser({
          data: {
            name: `${data.first_name} ${data.last_name}`,
            email: data.email,
            id: user.id,
          },
          connection,
        });

        // If new pic
        if (data.picture && data.picture.startsWith("Temp/")) {
          let s3Object;
          try {
            s3Object = await s3
              .getObject({
                Bucket: process.env.AWS_BUCKET,
                Key: data.picture,
              })
              .promise();
          } catch (err) {
            console.error(err);
          }
          if (!s3Object) throw new Error("File not found");

          const filePath = data.picture.replace(
            `Temp/${`User_${user.id}/`}`,
            `Users/${`User_${user.id}/original_`}`
          );
          const thumbnailPath = data.picture.replace(
            `Temp/${`User_${user.id}/`}`,
            `Users/${`User_${user.id}/thumbnail_`}`
          );

          const imageThumbnail = await sharp(s3Object.Body)
            .resize({
              width: 192,
              height: 192,
              fit: "inside",
            })
            .toBuffer();

          try {
            await s3
              .putObject({
                Bucket: process.env.AWS_BUCKET,
                Key: thumbnailPath,
                Body: imageThumbnail,
                ContentType: s3Object.ContentType,
                ACL: "public-read",
              })
              .promise();

            await s3
              .copyObject({
                Bucket: process.env.AWS_BUCKET,
                CopySource: `/${process.env.AWS_BUCKET}/${data.picture}`,
                ACL: "public-read",
                Key: filePath,
              })
              .promise();
          } catch (error) {
            console.error(error);
            throw new Error("File Error");
          }

          await dal.pictures.setPicture({
            data: {
              user_id: user.id,
              path: filePath,
              thumbnail_path: thumbnailPath,
            },
            connection,
          });
        }

        await dal.users.updateUserProfile({
          data: {
            first_name: data.first_name,
            last_name: data.last_name,
            title: data.title,
            address: data.address, // TODO: Format this w/ google maps
            date_of_birth: data.date_of_birth,
            phone_number: data.phone_number,
            email: data.email,
            alternative_email: data.alternative_email,
            user_id: user.id,
          },
          connection,
        });

        await dal.users.updateAdvanceUserProfile({
          data: {
            treb_number: data.treb_number,
            sin_number: data.sin_number,
            hst_number: data.hst_number,
            alarm_code: data.alarm_code,
            lock_box_number: data.lock_box_number,
            user_id: user.id,
          },
          connection,
        });

        await dal.users.updateEmergencyContacts({
          data: {
            user_id: user.id,
            name: data.emergency_contact_name,
            phone_number: data.emergency_contact_phone,
            relationship: data.emergency_contact_relationship,
          },
          connection,
        });

        const updatedUser = await query({
          query: sql`select u.id, u.public_id, u.name, u.email, up.phone_number from users u join user_profiles up on u.id = up.user_id where LOWER(u.email) = LOWER(${email})`,
          options: { first: true },
          connection,
        });
        await cometchat.updateUser(updatedUser);
      });
    },
    sendReferral: async (parent, args, { user }) => {
      const { email } = args;

      sendEmail({
        email,
        template: "referral_link",
        data: { name: user.name },
      });
    },
    createUser: async (parent, args, { user }) => {
      authorization({ user, roles: ["super_admin"] });
      const { data } = args;

      // TODO: Generate a random password
      const password = "Qwer!234";
      const password_hash = await auth.hashPassword(password);

      return transaction(async (connection) => {
        const revshareOverviewId = await (async () => {
          const row = await query({
            query: sql`
              insert into agent_revshare_overviews (created_at, updated_at) values (now(), now())`,
            connection,
          });
          return row.insertId;
        })();

        const userRow = await query({
          query: sql`
          insert into users (public_id, name, email, password_hash, password, account_status_id, revshare_overview_id)
          values 
          (${uuid()},
          ${`${data.first_name} ${data.last_name}`},
          ${data.email},
          ${password_hash},
          ${"-"},
          ${1},
          ${revshareOverviewId})`,
          connection,
        });

        const userId = userRow.insertId;

        await query({
          query: sql`
          insert into user_profiles
          (user_id, first_name, last_name, title, date_joined,
          date_incorporated, formatted_address, date_of_birth,
          phone_number, rare_email)
          values
          (${userId},
          ${data.first_name}, 
          ${data.last_name}, 
          ${data.title || null},
          ${data.date_joined_rare || null},
          ${data.date_incorporated || null},
          ${data.address || null},
          ${data.date_of_birth || null},
          ${data.phone_number || null},
          ${data.email || null})`,
          connection,
        });

        await query({
          query: sql`
          insert into advance_user_profiles 
          (user_id, treb_number, reco_number, reco_expiry, sin_number,
          hst_number, alarm_code, lock_box_number)
          values
          (${userId},
          ${data.treb_number || null}, 
          ${data.reco_number || null}, 
          ${data.reco_expiry || null},
          ${data.sin_number || null},
          ${data.hst_number || null},
          ${data.alarm_code || null},
          ${data.lock_box_number || null})`,
          connection,
        });

        if (data.emergency_contact_name) {
          await query({
            query: sql`
              insert into emergency_contacts 
              (user_id, name, phone_number, relationship)
              values
              (${userId},
              ${data.emergency_contact_name || null}, 
              ${data.emergency_contact_phone || null}, 
              ${data.emergency_contact_relationship || null})`,
            connection,
          });
        }

        const role = data.role || 5;

        await query({
          query: sql`
          insert into model_has_roles 
          (role_id, model_id, model_type)
          values
          (${role}, ${userId}, 'App\Models\User')`,
          connection,
        });
      });
    },
    deleteUser: async (parent, args, { user }) => {
      authorization({ user, roles: ["super_admin"] });
      const { id } = args;

      await query({
        query: sql`update users set deleted_at = now() where id = ${id};`,
      });
    },
    updateUserRole: async (parent, args, { user }) => {
      authorization({ user, roles: ["super_admin"] });
      const { userId, role } = args;

      return transaction(async (connection) => {
        const userRole = await query({
          query: sql`select * from roles where name = ${role}`,
          connection,
          options: { first: true },
        });
        if (!userRole) throw UserError("Invalid role");

        await query({
          query: sql`update model_has_roles set role_id = ${userRole.id} where model_id = ${userId};`,
          connection,
        });
      });
    },
    updateAgentNum: async (parent, args, { user }) => {
      authorization({ user, roles: ["super_admin"] });

      const { userId, agentnum } = args;

      const users = await dal.users.getAllUsers();

      const exists = users.find((user) => user.agentnum === agentnum);

      if (exists) {
        throw UserError(agentnum + " already exists.");
      }

      await dal.users.updateAgentNum({ data: { userId, agentnum } });

      return true;
    },
  },
};
