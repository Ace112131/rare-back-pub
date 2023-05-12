const { query } = require("../db/mysql");
const sql = require("sql-template-strings");
const { uuid } = require("uuidv4");

const getDeals = async ({
  dealId,
  status,
  userId,
  upcoming = false,
  connection,
}) => {
  const deals = await query({
    query: sql`
        select * from (
          select 
              d.id,
              d.public_id,
              d.brokerage_side,
              d.sale_price,
              d.lease_price,
              d.deposit_amount,
              d.second_deposit_amount,
              d.conditional,
              dconds.conditions,
              d.offer_date,
              d.acceptance_date,
              d.close_date,
              d.brokerage,
              d.brokerage_phone_number,
              dt.name as type,
              ds.name as status,
              d.created_at as created,
              d.creator_id,
              JSON_ARRAYAGG(
                JSON_OBJECT(
                    'id', u.id, 
                    'name', u.name,
                    'email', u.email,
                    'phone', up.phone_number,
                    'picture', p.path,
                    'thumbnail', p.thumbnail_path
                )
              ) as agents,
              d_ea.external_agents,
              d.property_address as address,
              d.special_notes as notes,
              case when l.id is not null then 
                JSON_OBJECT(
                    'id', l.id, 
                    'address', l.property_address,
                    'type', l.listing_type,
                    'option', l.listing_option
                )
                else null 
              end as listing,
              dd_sq.documents,
              comments,
              d.paperwork_to_lawyer,
              d.annual_personal_deal,
              dcomm.listing_brokerage_commission,
              dcomm.cooperating_brokerage_commission,
              dcomm.total_commission,
              dcomm.first_installment,
              dcomm.second_installment,
              dcomm.third_installment,
              dcomm.final_installment,
              dcomm.total_precon_commission,
              case when r.id is not null then 
              JSON_OBJECT(
              	'id', r.id,
			    'first_name', r.first_name,
			    'last_name', r.last_name,
			    'referral_amount', r.referral_amount,
			    'referral_percentage', r.referral_percentage,
			    'office_name', r.office_name,
			    'office_email', r.office_email,
			    'office_address', r.office_address,
			    'office_phone', r.office_phone,
			    'office_fax', r.office_fax
              ) else null end as referral,
              case when b_li.id is not null then 
              JSON_OBJECT(
              	'id', b_li.id,
			    'name', b_li.name,
			    'address', b_li.address,
			    'phone_number', b_li.phone_number,
			    'fax_number', b_li.fax_number,
			    'email', b_li.email
              ) else null end as buyer_lawyer,
              case when s_li.id is not null then 
              JSON_OBJECT(
              	'id', s_li.id,
			    'name', s_li.name,
			    'address', s_li.address,
			    'phone_number', s_li.phone_number,
			    'fax_number', s_li.fax_number,
			    'email', s_li.email
              ) else null end as seller_lawyer
              
          from deals d
          left join deal_agents da on da.deal_id = d.id and d.creator_id != da.rare_agent_id and da.deleted_at is null
          join users u on da.rare_agent_id = u.id or d.creator_id = u.id
          join user_profiles up on up.user_id = u.id
          join deal_statuses ds on ds.id = d.deal_status_id
          join deal_types dt on dt.id = d.deal_type_id
          left join deal_commissions dcomm on dcomm.id = d.deal_commission_id and dcomm.deleted_at is null
          left join referrals r on r.id = d.referral_id and r.deleted_at is null
          left join deal_lawyers b_dl on b_dl.deal_id = d.id and b_dl.lawyer_type = 'buyer_lawyer'
          left join lawyer_informations b_li on b_li.id = b_dl.lawyer_information_id
          left join deal_lawyers s_dl on s_dl.deal_id = d.id and s_dl.lawyer_type = 'seller_lawyer'
          left join lawyer_informations s_li on s_li.id = s_dl.lawyer_information_id
          
          left join (
          	select 
          	  deal_id,
              JSON_ARRAYAGG(
                JSON_OBJECT(
                    'id', id, 
                    'name', agent_name,
                    'email', agent_email,
                    'phone', agent_number
                )
              ) as external_agents
            from deal_agents
            where deleted_at is null
            and not is_rare_agent
            group by deal_id
          ) d_ea on d_ea.deal_id = d.id

          left join (
          	select 
          	  deal_id,
              JSON_ARRAYAGG(
                JSON_OBJECT(
                    'id', id, 
                    'upon', conditional_upon,
                    'until', conditional_until
                )
              ) as conditions
            from deal_conditionals
            where deleted_at is null
            group by deal_id
          ) dconds on dconds.deal_id = d.id

          left join (
            select 
              dd.deal_id,
              JSON_ARRAYAGG(
                JSON_OBJECT(
                  'id', f.id,
                  'public_id', f.public_id,
                  'name', cd.name,
                  'path', f.path,
                  'thumbnail', f.thumbnail_path,
                  'type', f.file_type,
                  'size', f.file_size,
                  'created', f.created_at,
                  'checklist_document_type', cdt.name
                  )
              ) as documents
            from deal_documents dd
            join checklist_documents cd on dd.checklist_document_id = cd.id
            join checklist_document_types cdt on cdt.id = cd.document_type_id
            join files f on f.filable_id = cd.id and f.filable_type = ${"App\\Models\\ChecklistDocument"}
            group by dd.deal_id
          ) dd_sq on dd_sq.deal_id = d.id

          left join (
            select
              dc.deal_id,
              JSON_ARRAYAGG(
                JSON_OBJECT(
                  'id', dc.id,
                  'sender', JSON_OBJECT(
                      'id', u.id, 
                        'name', u.name,
                        'email', u.email,
                        'picture', p.path,
                        'thumbnail', p.thumbnail_path
                    ),
                    'message', dc.message,
                    'created', dc.created_at
                  )
              ) as comments
            from deal_comments dc
            join users u on u.id = dc.sender_id
            left join (
                select
                  p.*
                from pictures p
                  inner join (
                    SELECT picturable_id, max(updated_at) as max_updated from pictures group by picturable_id
                  ) mu on p.picturable_id = mu.picturable_id and p.updated_at = mu.max_updated
              ) p on p.picturable_id = u.id
              where dc.deleted_at is null
              group by dc.deal_id
          ) dc on dc.deal_id = d.id
          
          left join listings l on l.id = d.listing_id
          left join (
            select
              p.*
            from pictures p
              inner join (
                SELECT picturable_id, max(updated_at) as max_updated from pictures group by picturable_id
              ) mu on p.picturable_id = mu.picturable_id and p.updated_at = mu.max_updated
          ) p on p.picturable_id = u.id
          where d.deleted_at is null
          and (${status} is null or ds.name = ${status})
          and (${dealId} is null or d.public_id = ${dealId})
          and (${upcoming} = false or d.close_date BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY))
          group by d.id, dt.id, ds.id, l.id, b_li.id, s_li.id
        ) deals
        WHERE (${userId} is null or JSON_CONTAINS(agents, '{"id": ${userId}}'))
      `,
    options: { first: Boolean(dealId) },
    connection,
  });

  if (dealId)
    return {
      ...deals,
      agents: JSON.parse(deals.agents),
      external_agents: JSON.parse(deals.external_agents),
      comments: JSON.parse(deals.comments),
      documents: JSON.parse(deals.documents),
      conditions: JSON.parse(deals.conditions),
      referral: JSON.parse(deals.referral),
      buyer_lawyer: JSON.parse(deals.buyer_lawyer),
      seller_lawyer: JSON.parse(deals.seller_lawyer),
      listing: deals.listing ? JSON.parse(deals.listing) : null,
    };

  return deals.map((deal) => {
    return {
      ...deal,
      agents: JSON.parse(deal.agents),
      external_agents: JSON.parse(deal.external_agents),
      comments: JSON.parse(deal.comments),
      documents: JSON.parse(deal.documents),
      conditions: JSON.parse(deal.conditions),
      referral: JSON.parse(deal.referral),
      buyer_lawyer: JSON.parse(deal.buyer_lawyer),
      seller_lawyer: JSON.parse(deal.seller_lawyer),
      listing: JSON.parse(deal.listing),
    };
  });
};

const createDealComment = ({ dealId, userId, message }) => {
  return query({
    query: sql`
        insert into deal_comments (deal_id, sender_id, message, created_at, updated_at) values
        (${dealId}, ${userId}, ${message}, now(), now())
    `,
  });
};

const getDealType = ({ name, connection }) => {
  return query({
    query: sql`
      select * from deal_types where name = ${name}
    `,
    options: { first: true },
    connection,
  });
};

const createDeal = ({ data = {}, connection }) => {
  return query({
    query: sql`
    insert into deals
    (public_id, deal_type_id, deal_status_id, creator_id, brokerage_side,
    listing_id, property_address, offer_date, acceptance_date, close_date,
    sale_price, lease_price, deposit_amount, second_deposit_amount, brokerage,
    brokerage_phone_number, conditional, paperwork_to_lawyer, annual_personal_deal,
    referral_id, deal_commission_id, special_notes)
    values
    (${uuid()},
    ${data.deal_type_id},
    ${data.deal_status_id},
    ${data.creator_id},
    ${data.brokerage_side},
    ${data.listing_id},
    ${data.property_address},
    ${data.offer_date},
    ${data.acceptance_date},
    ${data.close_date},
    ${data.sale_price},
    ${data.lease_price},
    ${data.deposit_amount},
    ${data.second_deposit_amount},
    ${data.brokerage},
    ${data.brokerage_phone_number},
    ${data.conditional},
    ${data.paperwork_to_lawyer},
    ${data.annual_personal_deal},
    ${data.referral_id},
    ${data.deal_commission_id},
    ${data.special_notes});`,
    connection,
  });
};

const createRareDealAgent = ({ dealId, agentId, connection }) => {
  return query({
    query: sql`
      insert into deal_agents (deal_id, rare_agent_id) values (${dealId}, ${agentId});
    `,
    connection,
  });
};

const removeRareDealAgent = ({ dealId, agentId, connection }) => {
  return query({
    query: sql`
      update deal_agents set deleted_at = now() where deal_id = ${dealId} and rare_agent_id = ${agentId} and deleted_at is null;
    `,
    connection,
  });
};

const createExternalDealAgent = ({ data, connection }) => {
  return query({
    query: sql`
      insert into deal_agents
      (deal_id, is_rare_agent, agent_name, agent_email, agent_number)
      values
      (${data.dealId},
      ${false},
      ${data.name},
      ${data.email},
      ${data.phone})`,
    connection,
  });
};

const removeExternalDealAgent = ({ id, connection }) => {
  return query({
    query: sql`
      update deal_agents
      set deleted_at = now() where id = ${id} and deleted_at is null;`,
    connection,
  });
};

const updateExternalDealAgent = ({ data, connection }) => {
  return query({
    query: sql`
      update deal_agents
      set agent_name = ${data.name},
      agent_email = ${data.email},
      agent_number = ${data.phone}
      where id = ${data.id}`,
    connection,
  });
};

const createDealLawyer = ({ dealId, lawyerId, type, connection }) => {
  if (!["seller_lawyer", "buyer_lawyer"].includes(type)) {
    throw new Error("Invalid lawyer type");
  }

  return query({
    query: sql`
      insert into deal_lawyers (deal_id, lawyer_information_id, lawyer_type)
      values (${dealId}, ${lawyerId}, ${type})`,
    connection,
  });
};

const getDealRow = ({ dealId, connection }) => {
  return query({
    query: sql`
      select * from deals where id = ${dealId}
    `,
    options: { first: true },
    connection,
  });
};

// const createDealCommission = ({ data, connection }) => {
//   return query({
//     query: sql`
//       insert into deal_commissions
//       (listing_brokerage_commission, cooperating_brokerage_commission,
//       first_installment, second_installment, third_installment, final_installment,
//       total_commission, total_precon_commission)
//       values
//       ()`,
//     connection,
//   });
// };

module.exports = {
  getDeals,
  createDealComment,
  createDeal,
  getDealType,
  createRareDealAgent,
  removeExternalDealAgent,
  updateExternalDealAgent,
  removeRareDealAgent,
  createExternalDealAgent,
  createDealLawyer,
  getDealRow,
  // createDealCommission,
};
