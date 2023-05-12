const { query } = require("../db/mysql");
const sql = require("sql-template-strings");

const createDealCommission = async ({ data, connection }) => {
  return query({
    query: sql`
      insert into deal_commissions 
      (listing_brokerage_commission, cooperating_brokerage_commission, total_commission,
      first_installment, second_installment, third_installment, final_installment, total_precon_commission)
      values
      (${data.listing_brokerage_commission || null},
      ${data.cooperating_brokerage_commission || null},
      ${data.total_commission || null},
      ${data.first_installment || 0},
      ${data.second_installment || 0},
      ${data.third_installment || 0},
      ${data.final_installment || 0},
      ${data.total_precon_commission || null})`,
    connection,
  });
};

module.exports = { createDealCommission };
