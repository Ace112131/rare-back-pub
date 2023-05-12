const { query } = require("../db/mysql");
const sql = require("sql-template-strings");

const getAgentReferrals = async ({ referringAgentId }) => {
  return query({
    query: sql`select * from agent_referrals where referring_agent_id = ${referringAgentId}`,
  });
};

const getRevshareOverview = async ({ id, date = new Date() }) => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return query({
    query: sql`
      select 
        u.id,
        sum(case when YEAR(rt.created_at) = ${year} and MONTH(rt.created_at) = ${month} then rt.revshare_commission else 0 end) as current_period_commission,
        sum(case when YEAR(rt.created_at) = ${year} then rt.revshare_commission else 0 end) as yearly_commission,
        sum(IFNULL(rt.revshare_commission, 0)) as total_commission 
      from users u
      left join agent_referrals ar on ar.referring_agent_id = u.id
      left join revshare_transactions rt on ar.id = rt.agent_referral_id 
      where ar.deleted_at is NULL
      and rt.deleted_at is NULL
      and u.deleted_at is NULL
      and u.id = ${id}
      group by u.id`,
    options: { first: true },
  });
};

const getReferralCommission = async ({
  referringAgentId,
  agentReferredId,
  date = new Date(),
}) => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return query({
    query: sql`
      select 
        ar.id, ar.referred_date, ar.created_at, ar.updated_at,
        sum(case when YEAR(rt.created_at) = ${year} and MONTH(rt.created_at) = ${month} then rt.revshare_commission else 0 end) as current_period_commission,
        sum(case when YEAR(rt.created_at) = ${year} then rt.revshare_commission else 0 end) as yearly_commission,
        sum(IFNULL(rt.revshare_commission, 0)) as total_commission 
      from agent_referrals ar 
      left join revshare_transactions rt on ar.id = rt.agent_referral_id 
      where referring_agent_id = ${referringAgentId} and agent_referred_id = ${agentReferredId}
      and ar.deleted_at is NULL
      and rt.deleted_at is NULL
      group by ar.id`,
    options: { first: true },
  });
};

const getReferringAgentId = async (referredAgentId) => {
  return query({
    query: sql`
      SELECT id, referring_agent_id, referred_agent_id
      FROM revshare_influence_relationships
      WHERE referred_agent_id=${referredAgentId};
    `,
    options: { first: true },
  });
};

const getReferredAgents = async (referringAgentId) => {
  return query({
    query: sql`
    SELECT r.id, r.referring_agent_id, r.referred_agent_id
    FROM revshare_influence_relationships r
    WHERE r.referring_agent_id=${referringAgentId};
    `,
  });
};

const getReferredAgentsWithCommissions = async (referredAgentId) => {
  return query({
    query: sql`
    SELECT
    r.id,
    r.referring_agent_id,
    r.referred_agent_id,
    u.name,
    revshare_commissions as revshare_commissions_raw
    FROM
        revshare_influence_relationships r
        LEFT JOIN users u on u.id = r.referred_agent_id
        left join (
            select
                c.agent_id,
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'commission',
                        c.commission,
                        'updated_at',
                        c.updated_at,
                        'created_at',
                        c.created_at
                    )
                ) as revshare_commissions
            from
                revshare_commissions c
            group by
                agent_id
        ) c_sq on c_sq.agent_id = u.id
    WHERE
        r.referring_agent_id = ${referredAgentId};
 
    `,
  });
};

const addReferree = async (referringAgentId, referredAgentId) => {
  return query({
    query: sql`
      INSERT INTO revshare_influence_relationships(referring_agent_id, referred_agent_id) values (${referringAgentId}, ${referredAgentId});
    `,
  });
};

const deleteReferree = async (referringAgentId, referredAgentId) => {
  return query({
    query: sql`
      DELETE FROM revshare_influence_relationships where referring_agent_id = ${referringAgentId} and referred_agent_id = ${referredAgentId};
    `,
  });
};

const addCommission = async (vals) => {
  return query({
    query: {
      sql: `INSERT INTO revshare_commissions(agent_id, commission, created_at) values ?`,
      values: [vals],
    },
  });
};

const getAllCommissions = async () => {
  return query({
    query: sql`
      SELECT u.id as user_id, rc.id as id, u.name, rc.commission, u.agentnum as lonewolf_agentnum, rc.created_at 
      FROM revshare_commissions rc
      LEFT JOIN users u on u.id=rc.agent_id`,
  });
};

const updateCommission = async (commissionId, newCommissionVal) => {
  return query({
    query: sql`
      UPDATE revshare_commissions SET commission = ${newCommissionVal} WHERE id = ${commissionId};
    `,
  });
};

module.exports = {
  getAgentReferrals,
  getRevshareOverview,
  getReferralCommission,
  getReferringAgentId,
  getReferredAgents,
  getReferredAgentsWithCommissions,
  addReferree,
  deleteReferree,
  addCommission,
  getAllCommissions,
  updateCommission,
};
