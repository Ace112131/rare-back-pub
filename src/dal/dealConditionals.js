const { query } = require("../db/mysql");
const sql = require("sql-template-strings");

const createDealConditional = async ({ data, connection }) => {
  return query({
    query: sql`
      insert into deal_conditionals 
      (deal_id, conditional_upon, conditional_until) 
      values 
      (${data.dealId}, ${data.conditionalUpon}, ${data.conditionalUntil})
    `,
    connection,
  });
};

const deleteDealConditional = async ({ id, connection }) => {
  return query({
    query: sql`
      update deal_conditionals set deleted_at = now() where id = ${id} and deleted_at is null
    `,
    connection,
  });
};

module.exports = { createDealConditional, deleteDealConditional };
