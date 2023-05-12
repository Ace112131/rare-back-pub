const { query } = require("../db/mysql");
const sql = require("sql-template-strings");

const getUser = async ({ userId }) => {
  return query({
    query: sql`
    select 
      u.id,
      u.public_id,
      u.name,
      u.email,
      up.alternative_email,
      up.formatted_address as address,
      up.first_name,
      up.last_name,
      up.title,
      up.date_of_birth,
      up.phone_number,
      p.path as picture,
      p.thumbnail_path as thumbnail,
      u.revshare_overview_id,
      aup.treb_number,
      aup.reco_number,
      aup.reco_expiry,
      aup.sin_number,
      aup.hst_number,
      aup.alarm_code,
      aup.lock_box_number,
      u.created_at as created,
      ec.name as emergency_contact_name,
      ec.phone_number as emergency_contact_phone,
      ec.relationship as emergency_contact_relationship,
      r.name as role
    from users u
    left join (
      select
        p.*
      from pictures p
        inner join (
          SELECT picturable_id, max(updated_at) as max_updated from pictures group by picturable_id
        ) mu on p.picturable_id = mu.picturable_id and p.updated_at = mu.max_updated
    ) p on p.picturable_id = u.id
    join model_has_roles mhr on mhr.model_id = u.id
    join roles r on r.id = mhr.role_id
    join user_profiles up on up.user_id = u.id
    left join advance_user_profiles aup on aup.user_id = u.id
    left join emergency_contacts ec on ec.user_id = u.id
    where u.deleted_at is null
    and (${userId} is null or u.id = ${userId})`,
    options: { first: Boolean(userId) },
  });
};

const searchUsers = async ({
  name = null,
  email = null,
  role = null,
  first = false,
}) => {
  return query({
    query: sql`
      select
        u.id,
        u.agentnum,
        u.public_id,
        u.name,
        u.email,
        up.phone_number,
        u.created_at,
        p.path as picture,
        p.thumbnail_path as thumbnail,
        r.name as role
        from users u
        left join (
          select
            p.*
          from pictures p
            inner join (
              SELECT picturable_id, max(updated_at) as max_updated from pictures group by picturable_id
            ) mu on p.picturable_id = mu.picturable_id and p.updated_at = mu.max_updated
        ) p on p.picturable_id = u.id
        join model_has_roles mhr on mhr.model_id = u.id
        join roles r on r.id = mhr.role_id
        join user_profiles up on up.user_id = u.id
        where u.deleted_at is null
        and (${name} is null or u.name like CONCAT('%',${name},'%'))
        and (${email} is null or u.name like CONCAT('%',${email},'%'))
        and (${role} is null or r.name like ${role})
      `,
    options: { first },
  });
};

const getAgentsWhoDonotHaveReferral = async () => {
  return query({
    query: sql`
      select
      p.path as picture,
      p.thumbnail_path as thumbnail,
      r.name as role,
      u.id,
      u.agentnum,
      u.public_id,
      u.name,
      u.email,
      u.created_at from users u
      left join (
        select
          p.*
        from pictures p
          inner join (
            SELECT picturable_id, max(updated_at) as max_updated from pictures group by picturable_id
          ) mu on p.picturable_id = mu.picturable_id and p.updated_at = mu.max_updated
      ) p on p.picturable_id = u.id
      left join revshare_influence_relationships rir on u.id = rir.referred_agent_id
      join model_has_roles mhr on mhr.model_id = u.id
      join roles r on r.id = mhr.role_id
      join user_profiles up on up.user_id = u.id
      where rir.referred_agent_id is null and u.deleted_at is null`,
  });
};

const updateRecoLicense = async ({ data }) => {
  return query({
    query: sql`
      update advance_user_profiles set
      reco_number = ${data.reco_number},
      reco_expiry = ${data.reco_expiry},
      updated_at = now()
      where user_id = ${data.user_id}
    `,
  });
};

const updateUserEmail = async ({ data, connection }) => {
  await query({
    query: sql`
      update users set
      email = ${data.email},
      updated_at = now()
      where id = ${data.user_id}
    `,
    connection,
  });
  await query({
    query: sql`
      update user_profiles set
      rare_email = ${data.email},
      updated_at = now()
      where user_id = ${data.user_id}
    `,
    connection,
  });
};

const updateUser = async ({ data, connection }) => {
  return query({
    query: sql`
      update users set
      name = ${data.name},
      email = ${data.email},
      updated_at = now()
      where id = ${data.id}
    `,
    connection,
  });
};

const updateUserProfile = async ({ data, connection }) => {
  return query({
    query: sql`
      update user_profiles set
      first_name = ${data.first_name},
      last_name = ${data.last_name},
      title = ${data.title},
      formatted_address = ${data.address},
      date_of_birth = ${data.date_of_birth},
      phone_number = ${data.phone_number},
      rare_email = ${data.email},
      alternative_email = ${data.alternative_email},
      updated_at = now()
      where user_id = ${data.user_id}
    `,
    connection,
  });
};

const updateAdvanceUserProfile = async ({ data, connection }) => {
  return query({
    query: sql`
      update advance_user_profiles set
      treb_number = ${data.treb_number},
      sin_number = ${data.sin_number},
      hst_number = ${data.hst_number},
      alarm_code = ${data.alarm_code},
      lock_box_number = ${data.lock_box_number},
      updated_at = now()
      where user_id = ${data.user_id}
    `,
    connection,
  });
};

const updateEmergencyContacts = async ({ data, connection }) => {
  return query({
    query: sql`
      INSERT INTO emergency_contacts
        (user_id, name, phone_number, relationship)
      VALUES
        (${data.user_id}, ${data.name}, ${data.phone_number}, ${data.relationship})
      ON DUPLICATE KEY UPDATE
        name     = VALUES(name),
        phone_number = VALUES(phone_number),
        relationship = VALUES(relationship),
        updated_at = now()
    `,
    connection,
  });
};

const getAllUsers = async () => {
  return query({
    query: sql`
      select u.id, u.agentnum, u.name, up.phone_number, u.email, u.public_id from users u
      left join user_profiles up on u.id = up.user_id
    `,
  });
};

const getAllActiveUsers = async () => {
  return query({
    query: sql`
      select u.id, u.agentnum, u.name, up.phone_number, u.email, u.public_id from users u
      left join user_profiles up on u.id = up.user_id
      where account_status_id = 1;
    `,
  });
};

const updateAgentNum = async ({ data }) => {
  return query({
    query: sql`
      update users set agentnum = ${data.agentnum} where id = ${data.userId}
    `,
  });
};

module.exports = {
  getUser,
  searchUsers,
  updateRecoLicense,
  updateUser,
  updateUserEmail,
  updateUserProfile,
  updateAdvanceUserProfile,
  updateEmergencyContacts,
  getAllUsers,
  getAllActiveUsers,
  updateAgentNum,
  getAgentsWhoDonotHaveReferral,
};
