const { query } = require("../db/mysql");
const sql = require("sql-template-strings");

const createReferral = async ({ data, connection }) => {
  return query({
    query: sql`
      insert into referrals
      (first_name, last_name, referral_amount, referral_percentage,
      office_name, office_email, office_address, office_phone, office_fax)
      values
      (${data.first_name},
      ${data.last_name},
      ${data.referral_amount},
      ${data.referral_percentage},
      ${data.office_name},
      ${data.office_email},
      ${data.office_address},
      ${data.office_phone},
      ${data.office_fax})`,
    connection,
  });
};

module.exports = { createReferral };
