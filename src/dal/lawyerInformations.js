const { query } = require("../db/mysql");
const sql = require("sql-template-strings");

const createLawyer = async ({ data, connection }) => {
  return query({
    query: sql`
        insert into lawyer_informations 
        (name, address, phone_number, fax_number, email)
        values
        (${data.name}, ${data.address}, ${data.phone_number}, ${data.fax_number}, ${data.email})
    `,
    connection,
  });
};

const getLawyer = async ({ id, connection }) => {
  return query({
    query: sql`
        select * from lawyer_informations where id = ${id} and deleted_at is null
    `,
    options: { first: true },
    connection,
  });
};

const updateLawyer = async ({ data, connection }) => {
  return query({
    query: sql`
      update lawyer_informations set
      name = ${data.name},
      address = ${data.address},
      phone_number = ${data.phone_number},
      fax_number = ${data.fax_number},
      email = ${data.email}
      where id = ${data.id}
    `,
    connection,
  });
};

module.exports = { createLawyer, getLawyer, updateLawyer };
