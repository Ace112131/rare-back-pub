const { query, transaction, getLastInsertId } = require("../db/mysql");
const sql = require("sql-template-strings");
const dal = require("../dal");
const twilio = require("../helpers/twilio");
const mailersend = require("../helpers/mailersend");
const { difference } = require("lodash");
const s3 = require("../helpers/s3");
const { getFileType } = require("../helpers/utils");
const authorization = require("../helpers/authorization");
const { UserError } = require("../helpers/errors");
const textTemplates = require("../helpers/templates/texts");
const user = require("./user");

module.exports = {
  Query: {
    getListings: async (parent, args, { user }) => {
      const { filters } = args;
      const userId = ["super_admin", "admin"].includes(user.role)
        ? null
        : user.id;

      const listings = await dal.listings.getListings({
        status: filters.status,
        userId,
      });

      return listings;
    },

    getListing: async (parent, args, { user }) => {
      const { id } = args;
      const isAdmin = ["super_admin", "admin"].includes(user.role);
      const userId = isAdmin ? null : user.id;

      const listing = await dal.listings.getListings({
        listingId: id,
        userId,
      });

      if (!isAdmin) listing.admin_notes = null;
      return listing;
    },

    getListingById: async (parent, args, { user }) => {
      const { id } = args;

      const listing = await dal.listings.getListingRow({ listingId: id });
      if (!listing) throw UserError("Listing not found");

      return {
        ...listing,
        address: listing.property_address,
        type: listing.listing_type,
        option: listing.listing_option,
      };
    },
  },

  Mutation: {
    createListingComment: async (parent, args, { user }) => {
      const { listingId, message } = args;
      const userId = ["super_admin", "admin"].includes(user.role)
        ? null
        : user.id;

      const listing = await dal.listings.getListings({
        listingId,
        userId,
      });

      // TODO: Error messages
      if (!listing) throw new Error();

      await dal.listings.createListingComment({
        listingId: listing.id,
        userId: user.id,
        message,
      });

      // Send Notifications
      if (!["super_admin", "admin"].includes(user.role)) {
        // Send email to listings@rarerealestate.ca
        await mailersend.sendEmail({
          email: process.env.LISTING_NOTIFICATION_EMAIL,
          template: "listing_comment_admin",
          data: {
            name: user.name,
            comment: message,
            public_id: listing.public_id,
          },
        });
      }
      // Send SMS to all agents except comment author
      const otherAgents = listing.agents.filter(
        (agent) => agent.id !== user.id
      );

      await twilio.textAllAgents({
        agents: otherAgents,
        template: textTemplates.listing_comment,
        data: {
          name: user.name,
          comment: message,
          address: listing.address,
          public_id: listing.public_id,
        },
      });
    },

    createListing: (parent, args, { user }) => {
      const { data } = args;
      return transaction(async (connection) => {
        // TODO: Google maps api to format/store address properly
        await dal.listings.createListing({
          data: {
            listingType: data.type,
            listingOption: data.option,
            propertyAddress: data.address,
            need_feature_sheet_and_social_media_post:
              data.need_feature_sheet_and_social_media_post,
            mls_pictures_link: data.mls_pictures_link,
            agent_note: data.agent_note,
            additional_copy_note: data.additional_copy_note,
            need_sale_sign: data.need_sale_sign,
            sign_installation_date: data.sign_installation_date,
            creatorId: user.id,
            notes: data.notes,
            dealStatusId: data.submitted ? 3 : 2, // 3 = Submitted, 2 = Draft
          },
          connection,
        });
        const listingId = await getLastInsertId(connection);
        const public_id = await (async () => {
          const listingInfo = await dal.listings.getListingRow({
            listingId,
            connection,
          });
          return listingInfo.public_id;
        })();
        await Promise.all(
          (data.agents || [user.id]).map((agentId) => {
            return dal.listings.createRareListingAgent({
              listingId,
              agentId,
              connection,
            });
          })
        );

        // Insert documents
        for (const key in data.documents) {
          const fileName = data.documents[key];
          if (!fileName) continue;
          const path = `Content/${user.name}/${fileName}`;

          let s3Object;
          try {
            s3Object = await s3
              .getObject({
                Bucket: process.env.AWS_BUCKET,
                Key: `Temp/User_${user.id}/${fileName}`,
              })
              .promise();
          } catch (err) {
            console.log(err);
          }
          if (!s3Object) throw new Error("File not found");

          try {
            await s3
              .copyObject({
                Bucket: process.env.AWS_BUCKET,
                CopySource: `/${process.env.AWS_BUCKET}/Temp/User_${user.id}/${fileName}`,
                ACL: "public-read",
                Key: path,
              })
              .promise();
          } catch (error) {
            console.log(error);
            throw new Error("File Error");
          }

          const { ContentLength, ContentType } = s3Object;

          const documentType = await dal.files.getChecklistDocumentType({
            name: key,
            connection,
          });

          await dal.files.createChecklistDocument({
            data: {
              documentTypeId: documentType.id,
              fileName,
              agentId: user.id,
            },
            connection,
          });
          const checklistDocumentId = await getLastInsertId(connection);
          // insert into files
          await dal.files.createFile({
            data: {
              path,
              fileSize: ContentLength,
              filableId: checklistDocumentId,
              fileType: getFileType(ContentType),
              filableType: "App\\Models\\ChecklistDocument",
            },
            connection,
          });

          // insert into listing_documents
          await dal.files.createListingDocument({
            listingId,
            checklistDocumentId,
            connection,
          });
        }

        if (data.submitted) {
          await mailersend.sendEmail({
            email: process.env.LISTING_NOTIFICATION_EMAIL,
            template: "new_listing_admin",
            data: {
              name: user.name,
              public_id,
            },
          });
        }
      });
    },
    updateListing: async (parent, args, { user }) => {
      const { data } = args;

      const userIsAdmin = ["super_admin", "admin"].includes(user.role);
      const userId = userIsAdmin ? null : user.id;

      const listing = await dal.listings.getListings({
        listingId: data.id,
        userId,
      });

      if (!listing) throw new Error();
      // If listing is a draft and user is not owner, throw error

      await transaction(async (connection) => {
        if (data.type) {
          await query({
            query: sql`update listings set listing_type = ${data.type} where id = ${listing.id};`,
            connection,
          });
        }
        if (data.option) {
          await query({
            query: sql`update listings set listing_option = ${data.option} where id = ${listing.id};`,
            connection,
          });
        }
        if (data.address) {
          await query({
            query: sql`update listings set property_address = ${data.address} where id = ${listing.id};`,
            connection,
          });
        }
        if (data.agents && (userId === null || userId === listing.creator_id)) {
          // Only admins or listing creator can update agents
          const existingAgents = listing.agents.map((a) => {
            return a.id;
          });
          const newAgentIds = difference(data.agents, existingAgents);
          const removedAgentIds = difference(existingAgents, data.agents);

          await Promise.all(
            newAgentIds.map((agentId) => {
              return dal.listings.createRareListingAgent({
                listingId: listing.id,
                agentId,
                connection,
              });
            })
          );
          await Promise.all(
            removedAgentIds.map((agentId) => {
              return dal.listings.removeRareListingAgent({
                listingId: listing.id,
                agentId,
                connection,
              });
            })
          );
        }
        if (data.notes) {
          await query({
            query: sql`update listings set special_notes = ${data.notes} where id = ${listing.id};`,
            connection,
          });
        }
        if (data.need_feature_sheet_and_social_media_post !== undefined) {
          await query({
            query: sql`update listings set need_feature_sheet_and_social_media_post = ${data.need_feature_sheet_and_social_media_post} where id = ${listing.id};`,
            connection,
          });
        }
        if (data.mls_pictures_link !== undefined) {
          await query({
            query: sql`update listings set mls_pictures_link = ${data.mls_pictures_link} where id = ${listing.id};`,
            connection,
          });
        }
        if (data.agent_note !== undefined) {
          await query({
            query: sql`update listings set agent_note = ${data.agent_note} where id = ${listing.id};`,
            connection,
          });
        }
        if (data.additional_copy_note !== undefined) {
          await query({
            query: sql`update listings set additional_copy_note = ${data.additional_copy_note} where id = ${listing.id};`,
            connection,
          });
        }
        if (data.need_sale_sign !== undefined) {
          await query({
            query: sql`update listings set need_sale_sign = ${data.need_sale_sign} where id = ${listing.id};`,
            connection,
          });
        }
        if (data.sign_installation_date !== undefined) {
          await query({
            query: sql`update listings set sign_installation_date = ${new Date(
              data.sign_installation_date
            )} where id = ${listing.id};`,
            connection,
          });
        }

        if (data.documents) {
          // Insert documents
          for (const key in data.documents) {
            const fileName = data.documents[key];
            if (!fileName) continue;
            const path = `Content/${user.name}/${fileName}`;

            let s3Object;
            try {
              s3Object = await s3
                .getObject({
                  Bucket: process.env.AWS_BUCKET,
                  Key: `Temp/User_${user.id}/${fileName}`,
                })
                .promise();
            } catch (err) {
              if (err.name === "NoSuchKey") continue;
              console.log(err);
            }
            if (!s3Object) continue; // Old document
            try {
              await s3
                .copyObject({
                  Bucket: process.env.AWS_BUCKET,
                  CopySource: `/${process.env.AWS_BUCKET}/Temp/User_${user.id}/${fileName}`,
                  ACL: "public-read",
                  Key: path,
                })
                .promise();
            } catch (error) {
              console.log(error);
              throw new Error("File Error");
            }

            const { ContentLength, ContentType } = s3Object;

            const documentType = await dal.files.getChecklistDocumentType({
              name: key,
              connection,
            });

            await dal.files.createChecklistDocument({
              data: {
                documentTypeId: documentType.id,
                fileName,
                agentId: user.id,
              },
              connection,
            });
            const checklistDocumentId = await getLastInsertId(connection);
            // insert into files
            await dal.files.createFile({
              data: {
                path,
                fileSize: ContentLength,
                filableId: checklistDocumentId,
                fileType: getFileType(ContentType),
                filableType: "App\\Models\\ChecklistDocument",
              },
              connection,
            });
            // insert into listing_documents
            await dal.files.createListingDocument({
              listingId: listing.id,
              checklistDocumentId,
              connection,
            });
          }
        }

        if (data.submitted) {
          await query({
            query: sql`update listings set deal_status_id = 3 where id = ${listing.id};`,
            connection,
          });
        }
      });

      const notifBody = {
        name: user.name,
        public_id: listing.public_id,
      };

      await mailersend.sendEmail({
        email: process.env.LISTING_NOTIFICATION_EMAIL,
        template: "updated_listing_admin",
        data: notifBody,
      });

      const [agentsToText, template] = userIsAdmin
        ? [listing.agents, textTemplates.admin_listing_misc_change]
        : [
            listing.agents.filter((agent) => agent.id !== user.id),
            textTemplates.listing_misc_change,
          ];

      // if an admin modifies a listing, notify all agents
      // N.B. this is distinct from a adminUpdateListing mutation, which is limited to status changes for now
      await twilio.textAllAgents({
        agents: agentsToText,
        template: template,
        data: {
          address: listing.address,
          ...notifBody,
        },
      });
    },

    deleteDraftListing: async (parent, args, { user }) => {
      const { id } = args;

      const listing = await dal.listings.getListings({
        listingId: id,
        userId: user.id,
      });
      if (!listing) throw UserError("Listing not found");

      await query({
        query: sql`update listings set deleted_at = now() where id = ${listing.id};`,
      });
    },

    adminUpdateListing: async (parent, args, { user }) => {
      authorization({ user, roles: ["super_admin", "admin"] });
      const { data } = args;

      const listing = await dal.listings.getListings({
        listingId: data.id,
        userId: null,
      });
      if (!listing) throw UserError("Listing not found");

      return transaction(async (connection) => {
        if (data.admin_notes) {
          await query({
            query: sql`update listings set admin_notes = ${data.admin_notes} where id = ${listing.id};`,
            connection,
          });
        }
        if (data.status && data.status !== listing.status) {
          const status = await query({
            query: sql`select * from deal_statuses where name = ${data.status}`,
            connection,
            options: { first: true },
          });
          if (!status) throw UserError("Invalid status");

          await query({
            query: sql`update listings set deal_status_id = ${status.id} where id = ${listing.id};`,
            connection,
          });

          await twilio.textAllAgents({
            agents: listing.agents,
            template: textTemplates.listing_status_changed,
            data: {
              status: status.pretty_name,
              public_id: listing.public_id,
              address: listing.address,
            },
          });
        }
      });
    },
  },
};
