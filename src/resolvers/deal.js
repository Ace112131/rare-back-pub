const dal = require("../dal");
const twilio = require("../helpers/twilio");
const mailersend = require("../helpers/mailersend");
const { UserError } = require("../helpers/errors");
const sql = require("sql-template-strings");
const { transaction, getLastInsertId, query } = require("../db/mysql");
const s3 = require("../helpers/s3");
const { getFileType } = require("../helpers/utils");
const authorization = require("../helpers/authorization");
const { difference } = require("lodash");
const textTemplates = require("../helpers/templates/texts");

module.exports = {
  Query: {
    getDeals: async (parent, args, { user }) => {
      const { filters } = args;
      const userId = ["super_admin", "admin"].includes(user.role)
        ? null
        : user.id;

      const deals = await dal.deals.getDeals({
        status: filters.status,
        userId,
      });

      return deals;
    },

    getDeal: async (parent, args, { user }) => {
      const { id } = args;
      const userId = ["super_admin", "admin"].includes(user.role)
        ? null
        : user.id;

      const deal = await dal.deals.getDeals({
        dealId: id,
        userId,
      });

      return deal;
    },

    getUpcomingDeals: async (parent, args, { user }) => {
      const deals = await dal.deals.getDeals({
        upcoming: true,
        userId: user.id,
      });

      return deals;
    },
  },

  Mutation: {
    createDealComment: async (parent, args, { user }) => {
      const { dealId, message } = args;
      const userId = ["super_admin", "admin"].includes(user.role)
        ? null
        : user.id;

      const deal = await dal.deals.getDeals({
        dealId,
        userId,
      });
      // TODO: Error messages
      if (!deal) throw new Error();

      await dal.deals.createDealComment({
        dealId: deal.id,
        userId: user.id,
        message,
      });

      // Send Notifications
      if (!["super_admin", "admin"].includes(user.role)) {
        // Send email to deals@rarerealestate.ca
        await mailersend.sendEmail({
          email: process.env.DEAL_NOTIFICATION_EMAIL,
          template: "deal_comment_admin",
          data: {
            name: user.name,
            comment: message,
            public_id: deal.public_id,
          },
        });
      }

      // Send SMS to all agents except comment author
      const otherAgents = deal.agents.filter((agent) => agent.id !== user.id);

      await twilio.textAllAgents({
        agents: otherAgents,
        template: textTemplates.deal_comment,
        data: {
          name: user.name,
          comment: message,
          public_id: deal.public_id,
          address: deal.address,
        },
      });
    },

    createDeal: async (parent, args, { user }) => {
      const { data } = args;

      return transaction(async (connection) => {
        const deal_type_id = (() => {
          if (data.type === "sale") return 1;
          if (data.type === "pre-con") return 2;
          if (data.type === "lease") return 3;
          throw UserError("Invalid deal type");
        })();

        const listing = await (async () => {
          if (!data.listing_id) return null;
          const listing = await dal.listings.getListingRow({
            listingId: data.listing_id,
            connection,
          });
          return listing;
        })();

        const referral_id = await (async () => {
          if (!data.referral?.first_name) return null;
          await dal.referrals.createReferral({
            data: data.referral,
            connection,
          });
          return getLastInsertId(connection);
        })();

        const deal_commission_id = await (async () => {
          const total_precon_commission =
            (data.first_installment || 0) +
            (data.second_installment || 0) +
            (data.third_installment || 0) +
            (data.final_installment || 0);

          await dal.dealCommissions.createDealCommission({
            data: {
              listing_brokerage_commission: data.listing_brokerage_commission,
              cooperating_brokerage_commission:
                data.cooperating_brokerage_commission,
              total_commission: data.total_commission,
              first_installment: data.first_installment,
              second_installment: data.second_installment,
              third_installment: data.third_installment,
              final_installment: data.final_installment,
              total_precon_commission,
            },
            connection,
          });
          return getLastInsertId(connection);
        })();

        await dal.deals.createDeal({
          data: {
            deal_type_id,
            creator_id: user.id,
            brokerage_side:
              data.type === "pre-con" ? "coop" : data.brokerage_side, // Pre-cons are always co-ops
            listing_id: data.listing_id || null,
            property_address:
              data.property_address || listing?.property_address || "-",
            offer_date: data.offer_date || null,
            acceptance_date: data.acceptance_date || null,
            close_date: data.close_date || null,
            sale_price: data.sale_price || 0,
            lease_price: data.lease_price || null,
            deposit_amount: data.deposit_amount || null,
            second_deposit_amount: data.second_deposit_amount || null,
            brokerage: data.brokerage,
            brokerage_phone_number: data.brokerage_phone_number,
            conditional: data.conditional,
            paperwork_to_lawyer: data.paperwork_to_lawyer,
            annual_personal_deal: data.annual_personal_deal || 0,
            referral_id,
            deal_commission_id,
            special_notes: data.notes,
            deal_status_id: data.submitted ? 3 : 2, // 3 = Submitted, 2 = Draft
          },
          connection,
        });

        const dealId = await getLastInsertId(connection);

        if (data.conditional) {
          await Promise.all(
            (data.offer_conditions || []).map(async (condition) => {
              await dal.dealConditionals.createDealConditional({
                data: {
                  dealId,
                  conditionalUpon: condition.upon,
                  conditionalUntil: condition.until,
                },
                connection,
              });
            })
          );
        }

        if (data.buyer_lawyer) {
          const lawyerId = await (async () => {
            await dal.lawyerInformations.createLawyer({
              data: data.buyer_lawyer,
              connection,
            });
            return getLastInsertId(connection);
          })();
          await dal.deals.createDealLawyer({
            dealId,
            lawyerId,
            type: "buyer_lawyer",
            connection,
          });
        }

        if (data.seller_lawyer) {
          const lawyerId = await (async () => {
            await dal.lawyerInformations.createLawyer({
              data: data.buyer_lawyer,
              connection,
            });
            return getLastInsertId(connection);
          })();
          await dal.deals.createDealLawyer({
            dealId,
            lawyerId,
            type: "seller_lawyer",
            connection,
          });
        }

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
          await dal.files.createDealDocument({
            dealId,
            checklistDocumentId,
            connection,
          });
        }

        await Promise.all(
          (data.deal_agents || []).map(async (dealAgent) => {
            await dal.deals.createExternalDealAgent({
              data: {
                dealId,
                ...dealAgent,
              },
              connection,
            });
          })
        );

        await Promise.all(
          (data.agents || [user.id]).map((agentId) => {
            return dal.deals.createRareDealAgent({
              dealId,
              agentId,
              connection,
            });
          })
        );

        const deal = await dal.deals.getDealRow({
          dealId,
          connection,
        });

        if (data.submitted) {
          await mailersend.sendEmail({
            email: process.env.DEAL_NOTIFICATION_EMAIL,
            template: "new_deal_admin",
            data: {
              name: user.name,
              public_id: deal.public_id,
            },
          });
        }
      });
    },
    updateDeal: async (parent, args, { user }) => {
      const { data } = args;

      const userIsAdmin = ["super_admin", "admin"].includes(user.role);

      const userId = userIsAdmin ? null : user.id;

      const deal = await dal.deals.getDeals({
        dealId: data.id,
        userId,
      });

      if (!deal) throw UserError("Invalid Deal");

      await transaction(async (connection) => {
        if (data.listing_id) {
          await query({
            query: sql`update deals set listing_id = ${data.listing_id} where id = ${deal.id};`,
            connection,
          });
        }
        if (data.property_address) {
          await query({
            query: sql`update deals set property_address = ${data.property_address} where id = ${deal.id};`,
            connection,
          });
        }
        if (data.offer_date) {
          await query({
            query: sql`update deals set offer_date = ${new Date(
              data.offer_date
            )} where id = ${deal.id};`,
            connection,
          });
        }
        if (data.acceptance_date) {
          await query({
            query: sql`update deals set acceptance_date = ${new Date(
              data.acceptance_date
            )} where id = ${deal.id};`,
            connection,
          });
        }
        if (data.close_date) {
          await query({
            query: sql`update deals set close_date = ${new Date(
              data.close_date
            )} where id = ${deal.id};`,
            connection,
          });
        }
        if (data.sale_price) {
          await query({
            query: sql`update deals set sale_price = ${new Date(
              data.acceptance_date
            )} where id = ${deal.id};`,
            connection,
          });
        }
        if (data.lease_price) {
          await query({
            query: sql`update deals set lease_price = ${data.lease_price} where id = ${deal.id};`,
            connection,
          });
        }
        if (data.deposit_amount) {
          await query({
            query: sql`update deals set deposit_amount = ${data.deposit_amount} where id = ${deal.id};`,
            connection,
          });
        }
        if (data.second_deposit_amount) {
          await query({
            query: sql`update deals set second_deposit_amount = ${data.second_deposit_amount} where id = ${deal.id};`,
            connection,
          });
        }
        if (data.conditional) {
          await query({
            query: sql`update deals set conditional = ${data.conditional} where id = ${deal.id};`,
            connection,
          });
        }
        if (data.brokerage) {
          await query({
            query: sql`update deals set brokerage = ${data.brokerage} where id = ${deal.id};`,
            connection,
          });
        }
        if (data.brokerage_phone_number) {
          await query({
            query: sql`update deals set brokerage_phone_number = ${data.brokerage_phone_number} where id = ${deal.id};`,
            connection,
          });
        }
        if (data.notes) {
          await query({
            query: sql`update deals set special_notes = ${data.notes} where id = ${deal.id};`,
            connection,
          });
        }
        if (data.paperwork_to_lawyer) {
          await query({
            query: sql`update deals set paperwork_to_lawyer = ${data.paperwork_to_lawyer} where id = ${deal.id};`,
            connection,
          });
        }
        if (data.annual_personal_deal) {
          await query({
            query: sql`update deals set annual_personal_deal = ${data.annual_personal_deal} where id = ${deal.id};`,
            connection,
          });
        }
        if (data.admin_notes) {
          await query({
            query: sql`update deals set admin_notes = ${data.admin_notes} where id = ${deal.id};`,
            connection,
          });
        }

        if (data.deal_agents) {
          const updatedAgents = data.deal_agents.filter((a) => a.id);
          const newAgents = data.deal_agents.filter((a) => !a.id);
          const removedAgentIds = difference(
            deal.external_agents.map((a) => a.id),
            data.deal_agents.map((a) => a.id)
          );

          await Promise.all(
            updatedAgents.map(async (agent) => {
              return dal.deals.updateExternalDealAgent({
                data: agent,
                connection,
              });
            })
          );
          await Promise.all(
            newAgents.map(async (agent) => {
              return dal.deals.createExternalDealAgent({
                data: {
                  dealId: deal.id,
                  ...agent,
                },
                connection,
              });
            })
          );

          await Promise.all(
            removedAgentIds.map(async (agentId) => {
              await dal.deals.removeExternalDealAgent({
                id: agent.id,
                connection,
              });
            })
          );
        }

        if (data.agents) {
          const existingAgents = deal.agents.map((a) => {
            return a.id;
          });
          const newAgentIds = difference(data.agents, existingAgents);
          const removedAgentIds = difference(existingAgents, data.agents);

          await Promise.all(
            newAgentIds.map((agentId) => {
              return dal.deals.createRareDealAgent({
                dealId: deal.id,
                agentId,
                connection,
              });
            })
          );
          await Promise.all(
            removedAgentIds.map((agentId) => {
              return dal.deals.removeRareDealAgent({
                dealId: deal.id,
                agentId,
                connection,
              });
            })
          );
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
            await dal.files.createDealDocument({
              dealId: deal.id,
              checklistDocumentId,
              connection,
            });
          }
        }
        if (data.buyer_lawyer) {
          if (deal.buyer_lawyer) {
            await dal.lawyerInformations.updateLawyer({
              data: {
                id: deal.buyer_lawyer.id,
                ...data.buyer_lawyer,
              },
              connection,
            });
          } else {
            const lawyerId = await (async () => {
              await dal.lawyerInformations.createLawyer({
                data: data.buyer_lawyer,
                connection,
              });
              return getLastInsertId(connection);
            })();
            await dal.deals.createDealLawyer({
              dealId: deal.id,
              lawyerId,
              type: "buyer_lawyer",
              connection,
            });
          }
        }
        if (data.seller_lawyer) {
          if (deal.seller_lawyer) {
            await dal.lawyerInformations.updateLawyer({
              data: {
                id: deal.seller_lawyer.id,
                ...data.seller_lawyer,
              },
              connection,
            });
          } else {
            const lawyerId = await (async () => {
              await dal.lawyerInformations.createLawyer({
                data: data.seller_lawyer,
                connection,
              });
              return getLastInsertId(connection);
            })();
            await dal.deals.createDealLawyer({
              dealId: deal.id,
              lawyerId,
              type: "seller_lawyer",
              connection,
            });
          }
        }

        if (data.referral) {
          // TODO
        }

        if (data.listing_brokerage_commission || data.first_installment) {
          // TODO
          // Check if deal_commisions exists
          // Update or create
        }

        if (data.submitted) {
          await query({
            query: sql`update deals set deal_status_id = 3 where id = ${deal.id};`,
            connection,
          });
        }
      });

      const notifBody = {
        name: user.name,
        public_id: deal.public_id,
      };
      await mailersend.sendEmail({
        email: process.env.DEAL_NOTIFICATION_EMAIL,
        template: "new_deal_admin",
        data: notifBody,
      });

      const [agentsToText, template] = userIsAdmin
        ? [deal.agents, textTemplates.admin_deal_misc_change]
        : [
            deal.agents.filter((agent) => agent.id !== user.id),
            textTemplates.deal_misc_change,
          ];

      // if an admin modifies a deal, notify all agents
      // N.B. this is distinct from a adminUpdateDeal mutation, which is limited to status changes for now
      await twilio.textAllAgents({
        agents: agentsToText,
        template: template,
        data: {
          address: deal.address,
          ...notifBody,
        },
      });
    },

    deleteDraftDeal: async (parent, args, { user }) => {
      const { id } = args;

      const deal = await dal.deals.getDeals({
        dealId: id,
        userId: user.id,
      });
      if (!deal) throw UserError("Deal not found");

      await query({
        query: sql`update deals set deleted_at = now() where id = ${deal.id};`,
      });
    },

    adminUpdateDeal: async (parent, args, { user }) => {
      authorization({ user, roles: ["super_admin", "admin"] });
      const { data } = args;

      const deal = await dal.deals.getDeals({
        dealId: data.id,
        userId: null,
      });
      if (!deal) throw UserError("Deal not found");

      return transaction(async (connection) => {
        if (data.admin_notes) {
          await query({
            query: sql`update deals set admin_notes = ${data.admin_notes} where id = ${deal.id};`,
            connection,
          });
        }
        if (data.status && data.status !== deal.status) {
          const status = await query({
            query: sql`select * from deal_statuses where name = ${data.status}`,
            connection,
            options: { first: true },
          });
          if (!status) throw UserError("Invalid status");

          await query({
            query: sql`update deals set deal_status_id = ${status.id} where id = ${deal.id};`,
            connection,
          });

          await twilio.textAllAgents({
            agents: deal.agents,
            template: textTemplates.deal_status_changed,
            data: {
              status: status.pretty_name,
              public_id: deal.public_id,
              address: deal.address,
            },
          });
        }
      });
    },
  },
};
