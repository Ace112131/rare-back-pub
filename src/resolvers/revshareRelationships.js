const dal = require("../dal");

const revshareValues = [0.3, 0.25, 0.2, 0.15, 0.1];

const populateDownstream = async (thisAgent, agentId, tier) => {
  const downstream = await dal.revshare.getReferredAgentsWithCommissions(
    agentId
  );

  for (const agent of downstream) {
    agent.tier = tier;
    agent.revshare_commissions_raw = agent.revshare_commissions_raw
      ? JSON.parse(agent.revshare_commissions_raw)
      : [];

    // create an array for agent.revshare_commissions for created_at within the last 31 days
    const monthToDate = agent.revshare_commissions_raw
      .filter((commission) => {
        const date = new Date(commission.created_at);
        date.setDate(date.getDate() + 31);
        const today = new Date();
        return date > today;
      })
      .reduce((acc, commission) => {
        return acc + commission.commission;
      }, 0);
    // create an array for agent.revshare_commissions for created_at within year to date
    const yearToDate = agent.revshare_commissions_raw
      .filter((commission) => {
        const date = new Date(commission.created_at);
        const today = new Date();
        return date.getFullYear() === today.getFullYear();
      })
      .reduce((acc, commission) => {
        return acc + commission.commission;
      }, 0);

    const allTime = agent.revshare_commissions_raw.reduce((acc, commission) => {
      return acc + commission.commission;
    }, 0);
    agent.monthToDate = monthToDate.toFixed(2);
    agent.yearToDate = yearToDate.toFixed(2);
    agent.allTime = allTime.toFixed(2);
    agent.revshare_commissions_raw = [];
  }

  thisAgent.push(...downstream);
};

module.exports = {
  Query: {
    getRelationshipPyramid: async (_parent, args, _context) => {
      let referredAgents = [];
      await populateDownstream(referredAgents, args.id, 1);

      for (const agentTierOne of referredAgents) {
        // tier 2
        agentTierOne.referredAgents = [];
        await populateDownstream(
          agentTierOne.referredAgents,
          agentTierOne.referred_agent_id,
          2
        );
        for (const agentTierTwo of agentTierOne.referredAgents) {
          // tier 3
          agentTierTwo.referredAgents = [];
          await populateDownstream(
            agentTierTwo.referredAgents,
            agentTierTwo.referred_agent_id,
            3
          );
          for (const agentTierThree of agentTierTwo.referredAgents) {
            // tier 4
            agentTierThree.referredAgents = [];
            await populateDownstream(
              agentTierThree.referredAgents,
              agentTierThree.referred_agent_id,
              4
            );
            for (const agentTierFour of agentTierThree.referredAgents) {
              // tier 5
              agentTierFour.referredAgents = [];
              await populateDownstream(
                agentTierFour.referredAgents,
                agentTierFour.referred_agent_id,
                5
              );
            }
          }
        }
      }

      return referredAgents;
    },
    // get the entire tree of all people under you and the person above you
    getAllRelationships: async (_parent, args, { user }) => {
      const referringRelationship = await dal.revshare.getReferringAgentId(
        args.id
      );

      const referringAgent = referringRelationship?.length
        ? await dal.users.getUser({
            userId: referringRelationship[0].referring_agent_id,
          })
        : null;

      const referredAgentsTierOne =
        await dal.revshare.getReferredAgentsWithCommissions(args.id);

      const referredAgents = [
        { tier: 1, agents: referredAgentsTierOne },
        { tier: 2, agents: [] },
        { tier: 3, agents: [] },
        { tier: 4, agents: [] },
        { tier: 5, agents: [] },
      ];
      const myEarnings = {
        monthly: [],
        monthToDate: 0,
        yearToDate: 0,
        allTime: 0,
      };

      // myEarnings.monthly is used for the chart component, going back two years
      const currentDate = new Date();
      for (let i = 0; i < 24; i++) {
        currentDate.setMonth(currentDate.getMonth() - 2);
        myEarnings.monthly.push({
          year: currentDate.getFullYear(),
          month: currentDate.getMonth(),
          earnings: 0,
        });
      }

      for (let i = 1; i < 5; i++) {
        const thisTier = referredAgents[i - 1].agents;
        for (const j of thisTier) {
          const referredAgentsThisTier =
            await dal.revshare.getReferredAgentsWithCommissions(
              j.referred_agent_id
            );

          referredAgents[i].agents = referredAgents[i].agents.concat(
            referredAgentsThisTier
          );
        }
      }

      for (const tier of referredAgents) {
        for (const agent of tier.agents) {
          agent.revshare_commissions_raw = agent.revshare_commissions_raw
            ? JSON.parse(agent.revshare_commissions_raw)
            : [];
          // create an array for agent.revshare_commissions for created_at within the last 31 days
          const monthToDate = agent.revshare_commissions_raw
            .filter((commission) => {
              const date = new Date(commission.created_at);
              date.setDate(date.getDate() + 60);
              const today = new Date();
              return date > today;
            })
            .reduce((acc, commission) => {
              return (
                acc + commission.commission * revshareValues[tier.tier - 1]
              );
            }, 0);
          // create an array for agent.revshare_commissions for created_at within year to date
          const yearToDate = agent.revshare_commissions_raw
            .filter((commission) => {
              const date = new Date(commission.created_at);
              const today = new Date();
              return date.getFullYear() === today.getFullYear();
            })
            .reduce((acc, commission) => {
              return (
                acc + commission.commission * revshareValues[tier.tier - 1]
              );
            }, 0);
          // create an array for agent.revshare_commissions for created_at for all time
          const allTime = agent.revshare_commissions_raw.reduce(
            (acc, commission) => {
              const date = new Date(commission.created_at);
              const year = date.getFullYear();
              const month = date.getMonth();
              const monthlyEarnings = myEarnings.monthly.filter(
                (el) => el.month === month && el.year === year
              );
              if (monthlyEarnings.length) {
                monthlyEarnings[0].earnings +=
                  commission.commission * revshareValues[tier.tier - 1];
              }

              return (
                acc + commission.commission * revshareValues[tier.tier - 1]
              );
            },
            0
          );
          myEarnings.monthToDate += monthToDate;
          myEarnings.yearToDate += yearToDate;
          myEarnings.allTime += allTime;
          agent.monthToDate = monthToDate.toFixed(2);
          agent.yearToDate = yearToDate.toFixed(2);
          agent.allTime = allTime.toFixed(2);
        }
      }

      myEarnings.monthToDate = myEarnings.monthToDate.toFixed(2);
      myEarnings.yearToDate = myEarnings.yearToDate.toFixed(2);
      myEarnings.allTime = myEarnings.allTime.toFixed(2);

      return {
        myEarnings: myEarnings,
        referredBy: referringAgent,
        referred: referredAgents,
      };
    },

    // get the person above you and the people below you
    getMyRelationships: async (_parent, args, { user }) => {
      if (!user) return null;
      const referringRelationship = await dal.revshare.getReferringAgentId(
        args.id
      );

      const referredAgentsTierOne = await dal.revshare.getReferredAgents(
        args.id
      );

      return {
        id: user.id,
        referredBy: referringRelationship?.referring_agent_id || null,
        referred: referredAgentsTierOne?.map(
          (agent) => agent.referred_agent_id
        ),
      };
    },

    getAllCommissions: async (_parent, _args, _context) => {
      const commissions = await dal.revshare.getAllCommissions();
      commissions
        .sort(
          (commission1, commission2) =>
            commission1.created_at - commission2.created_at
        )
        .reverse();
      return commissions;
    },
  },
  Mutation: {
    addReferree: async (_parent, args, { user }) => {
      if (!user) return false;

      await dal.revshare.addReferree(
        args.referringAgentId,
        args.referredAgentId
      );

      return true;
    },
    deleteReferree: async (_parent, args, { user }) => {
      if (!user) return false;

      await dal.revshare.deleteReferree(
        args.referringAgentId,
        args.referredAgentId
      );

      return true;
    },
    updateCommission: async (_parent, args, _context) => {
      await dal.revshare.updateCommission(args.id, args.commission);
      return true;
    },
  },
};
