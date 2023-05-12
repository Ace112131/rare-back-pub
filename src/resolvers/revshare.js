const { query } = require("../db/mysql");
const sql = require("sql-template-strings");
const dal = require("../dal");

module.exports = {
  Query: {
    getRevshare: async (parent, args, { user }) => {
      let { userId } = args;
      if (!["super_admin", "admin"].includes(user.role)) userId = user.id;

      const getAgentReferralData = async ({
        userId,
        tier = 0,
        parentUserId,
      }) => {
        if (!userId) return null;
        const user = await dal.users.getUser({ userId });
        parentUserId = tier === 0 ? user.id : parentUserId;
        const revshareOverview = await dal.revshare.getRevshareOverview({
          id: user.id,
        });

        const agentReferrals = await dal.revshare.getAgentReferrals({
          referringAgentId: user.id,
        });

        const referrals = await Promise.all(
          agentReferrals.map((agentReferral) => {
            const userId = agentReferral.agent_referred_id;
            return getAgentReferralData({
              userId,
              tier: tier + 1,
              parentUserId,
            });
          })
        );

        const referralCommission = await (async () => {
          if (tier === 0) return null;
          if (!parentUserId) return null;
          return dal.revshare.getReferralCommission({
            referringAgentId: parentUserId,
            agentReferredId: user.id,
          });
        })();

        return {
          id: `${parentUserId}-${user.id}`,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            picture: user.picture,
            thumbnail: user.thumbnail,
            created: user.created_at,
          },
          monthly:
            tier === 0
              ? revshareOverview?.current_period_commission
              : referralCommission?.current_period_commission,
          annual:
            tier === 0
              ? revshareOverview?.yearly_commission
              : referralCommission?.yearly_commission,
          total:
            tier === 0
              ? revshareOverview?.total_commission
              : referralCommission?.total_commission,
          referrals,
        };
      };

      if (userId) {
        const currAgent = await getAgentReferralData({ userId });
        return currAgent.referrals;
      }

      const users = await dal.users.getUser({});
      const allUsersRevshare = await Promise.all(
        users.map(async (user) => {
          return getAgentReferralData({ userId: user.id });
        })
      );

      return allUsersRevshare;
    },

    getRevshareOverview: async (parent, args, { user }) => {
      let { userId } = args;
      if (!["super_admin", "admin"].includes(user.role)) userId = user.id;

      const revshareOverview = await dal.revshare.getRevshareOverview({
        id: userId,
      });
      return {
        monthly: revshareOverview?.current_period_commission,
        annual: revshareOverview?.yearly_commission,
        total: revshareOverview?.total_commission,
      };
    },
  },

  Mutation: {},
};
