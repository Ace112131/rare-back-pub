const { query } = require("../db/mysql");
const sql = require("sql-template-strings");
const { uuid } = require("uuidv4");

const getListings = async ({ listingId, status, userId }) => {
  const listings = await query({
    query: sql`
      select * from (
          select 
              l.id,
              l.public_id,
              l.property_address as address,
              l.listing_type as type,
              l.listing_option as 'option',
              ds.name as status,
              l.created_at as created,
              l.creator_id,
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
              l.special_notes as notes,
              l.admin_notes,
              l.need_feature_sheet_and_social_media_post,
              l.mls_pictures_link,
              l.hi_res_pictures_link,
              l.agent_note,
              l.additional_copy_note,
              l.need_sale_sign,
              l.sign_installation_date,
              ld_sq.documents,
              lc.comments
          from listings l
          left join listing_agents la on la.listing_id = l.id and la.deleted_at is null and l.creator_id != la.rare_agent_id
          join users u on la.rare_agent_id = u.id or l.creator_id = u.id
          join user_profiles up on up.user_id = u.id
          join deal_statuses ds on ds.id = l.deal_status_id

          left join (
            select 
              ld.listing_id,
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
            from listing_documents ld
            join checklist_documents cd on ld.checklist_document_id = cd.id
            join checklist_document_types cdt on cdt.id = cd.document_type_id
            join files f on f.filable_id = cd.id and f.filable_type = ${"App\\Models\\ChecklistDocument"}
            group by ld.listing_id
          ) ld_sq on ld_sq.listing_id = l.id

          left join (
            select
              lc.listing_id,
              JSON_ARRAYAGG(
                JSON_OBJECT(
                  'id', lc.id,
                  'sender', JSON_OBJECT(
                      'id', u.id, 
                        'name', u.name,
                        'email', u.email,
                        'picture', p.path,
                        'thumbnail', p.thumbnail_path
                    ),
                    'message', lc.message,
                    'created', lc.created_at
                  )
              ) as comments
            from listing_comments lc
            join users u on u.id = lc.sender_id
            left join (
                select
                  p.*
                from pictures p
                  inner join (
                    SELECT picturable_id, max(updated_at) as max_updated from pictures group by picturable_id
                  ) mu on p.picturable_id = mu.picturable_id and p.updated_at = mu.max_updated
              ) p on p.picturable_id = u.id
              where lc.deleted_at is null
              group by lc.listing_id
          ) lc on lc.listing_id = l.id

          left join (
            select
              p.*
            from pictures p
              inner join (
                SELECT picturable_id, max(updated_at) as max_updated from pictures group by picturable_id
              ) mu on p.picturable_id = mu.picturable_id and p.updated_at = mu.max_updated
          ) p on p.picturable_id = u.id
          where l.deleted_at is null
          and (${status} is null or ds.name = ${status})
          and (${listingId} is null or l.public_id = ${listingId})
          group by l.id, ds.id, lc.listing_id, ld_sq.documents
      ) listings
      WHERE (${userId} is null or JSON_CONTAINS(agents, '{"id": ${userId}}'))
      `,
    options: { first: Boolean(listingId) },
  });

  if (listingId)
    return {
      ...listings,
      need_feature_sheet_and_social_media_post: Boolean(
        listings.need_feature_sheet_and_social_media_post
      ),
      need_sale_sign: Boolean(listings.need_sale_sign),
      documents: JSON.parse(listings.documents),
      agents: JSON.parse(listings.agents),
      comments: JSON.parse(listings.comments),
    };

  return listings.map((listing) => {
    return {
      ...listing,
      need_feature_sheet_and_social_media_post: Boolean(
        listing.need_feature_sheet_and_social_media_post
      ),
      need_sale_sign: Boolean(listing.need_sale_sign),
      documents: JSON.parse(listing.documents),
      agents: JSON.parse(listing.agents),
      comments: JSON.parse(listing.comments),
    };
  });
};

const createListing = ({ data = {}, connection }) => {
  return query({
    query: sql`
      insert into listings 
      (public_id, listing_type, listing_option,
       deal_status_id, creator_id, property_address, special_notes,
       need_feature_sheet_and_social_media_post, mls_pictures_link,
       agent_note, need_sale_sign, sign_installation_date,
       additional_copy_note) 
      values
      (${uuid()}, 
      ${data.listingType},
      ${data.listingOption},
      ${data.dealStatusId},
      ${data.creatorId},
      ${data.propertyAddress},
      ${data.notes},
      ${data.need_feature_sheet_and_social_media_post},
      ${data.mls_pictures_link},
      ${data.agent_note},
      ${data.need_sale_sign},
      ${data.sign_installation_date},
      ${data.additional_copy_note});
    `,
    connection,
  });
};

const createRareListingAgent = ({ listingId, agentId, connection }) => {
  return query({
    query: sql`
      insert into listing_agents (listing_id, rare_agent_id) values (${listingId}, ${agentId});
    `,
    connection,
  });
};

const removeRareListingAgent = ({ listingId, agentId, connection }) => {
  return query({
    query: sql`
      update listing_agents set deleted_at = now() where listing_id = ${listingId} and rare_agent_id = ${agentId} and deleted_at is null;
    `,
    connection,
  });
};

const createListingComment = ({ listingId, userId, message }) => {
  return query({
    query: sql`
        insert into listing_comments (listing_id, sender_id, message, created_at, updated_at) values
        (${listingId}, ${userId}, ${message}, now(), now())
    `,
  });
};

const getListingRow = ({ listingId, connection }) => {
  return query({
    query: sql`
      select * from listings where id = ${listingId}
    `,
    options: { first: true },
    connection,
  });
};

module.exports = {
  getListings,
  createListing,
  createRareListingAgent,
  removeRareListingAgent,
  createListingComment,
  getListingRow,
};
