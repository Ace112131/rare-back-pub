const dal = require("../dal");
const s3 = require("../helpers/s3");
const csvParser = require("csv-parser");
const fs = require("fs");
const { finished } = require("stream/promises");
const { UserError } = require("../helpers/errors");
const twilio = require("../helpers/twilio");
const textTemplates = require("../helpers/templates/texts");

module.exports = {
  Query: {
    getSignedUrl: async (parent, args, { user }) => {
      const { fileName, fileType } = args;
      const key = `Temp/User_${user.id}/${fileName}`;

      const getSignedUrl = () => {
        return new Promise((resolve, reject) => {
          s3.getSignedUrl(
            "putObject",
            {
              Bucket: process.env.AWS_BUCKET,
              ContentType: fileType,
              ACL: "public-read",
              Key: key,
            },
            (err, url) => {
              if (err) return reject(err);
              resolve(url);
            }
          );
        });
      };

      const signedUrl = await getSignedUrl();

      return {
        signedUrl,
        fileName,
        key,
      };
    },
  },

  Mutation: {
    uploadLoneWolf: async (_parent, args, { user }) => {
      const { createReadStream, mimetype, encoding, filename } =
        await args.file;
      const stream = createReadStream();

      if (!filename.includes("csv")) {
        throw UserError("Lonewolf file is not csv");
      }

      try {
        const path = `./lonewolf-uploads/${filename}`;
        const out = require("fs").createWriteStream(path);
        stream.pipe(out);
        await finished(out);

        // get all users
        const allUsers = await dal.users.getAllUsers();

        const loadfile = () => {
          // const notUploaded = [];
          const toUpload = [];
          const usersToSms = [];
          return new Promise((resolve) => {
            fs.createReadStream(path)
              .pipe(csvParser())
              .on("data", (row) => {
                const user = allUsers.find(
                  (user) => user.agentnum === parseInt(row.agentnum)
                );
                if (user) {
                  usersToSms.push(user);
                  const mapped = [
                    user.id,
                    parseFloat(row.fees),
                    new Date(row.date),
                  ];
                  toUpload.push(mapped);
                }
              })
              .on("end", async () => {
                await dal.revshare.addCommission(toUpload);
                resolve(usersToSms);
              });
          });
        };

        const agentsToSms = await loadfile();

        const uniqueAgents = agentsToSms.filter((obj, index, arr) => {
          return arr.map((mapObj) => mapObj.id).indexOf(obj.id) === index;
        });

        return uniqueAgents;
      } catch (error) {
        throw UserError("Lonewolf upload failed");
      }
    },

    smsLoneWolf: async (_parent, args, { user }) => {
      const uniqueAgentsPhoneNumbers = args.agents.filter((obj, index, arr) => {
        return arr.map((mapObj) => mapObj.phone).indexOf(obj.phone) === index;
      });

      await twilio.textAllAgents({
        agents: uniqueAgentsPhoneNumbers,
        template: textTemplates.lone_wolf,
        data: {},
      });

      return true;
    },
  },
};
