const { query } = require("../db/mysql");
const sql = require("sql-template-strings");
const { uuid } = require("uuidv4");

const fileTypes = Object.freeze({
  checklistDocuments: "App\\Models\\MarketingFile",
  marketingFiles: "App\\Models\\MarketingFile",
  operationFile: "App\\Models\\OperationFile",
  trainingFile: "App\\Models\\TrainingFile",
  previewFile: "App\\Models\\PreviewFile",
});

const getFiles = async ({ type = "checklistDocuments" }) => {
  const fileType = fileTypes[type];
  return query({
    query: sql`
      select
        * 
      from checklist_documents cd
      join files f on f.filable_id = cd.id 
      where f.filable_type = ${fileType}
      `,
  });
};

// Root level of Library
const getRootFolders = async ({ userId }) => {
  return query({
    query: sql`
      select 
        vf.*,
        vs.name as va_section_name,
        u.name as owner_name
      from va_folders vf
      join va_sections vs on vs.id = vf.va_section_id
      join users u on u.id = vf.owner_id
      where vf.folder_level = 0 
      and (vf.is_public_accessible = 1 or (${userId} is null or vf.creator_id = ${userId}))
      and vf.deleted_at is null
      `,
  });
};

const getFolderFolders = async ({ userId, folderId }) => {
  return query({
    query: sql`
      select 
        vfc.*,
          vs.name as va_section_name,
          u.name as owner_name
      from va_folder_relationships vfr 
      join va_folders vfp on vfr.parent_folder_id = vfp.id
      join va_folders vfc on vfr.child_folder_id = vfc.id
      join va_sections vs on vs.id = vfc.va_section_id
      join users u on u.id = vfc.owner_id
      where vfp.public_id = ${folderId}
      and (vfc.is_public_accessible = 1 or (${userId} is null or vfc.creator_id = ${userId}))
      and vfc.deleted_at is null
      `,
  });
};

const getFolderDocuments = async ({ userId, folderId }) => {
  return query({
    query: sql`
      select 
        f.*,
        vff.file_name as name,
        vs.id as va_section_id,
        vs.name as va_section_name,
        vf.owner_id,
        u.name as owner_name,
        vff.file_name as name,
        CASE
          WHEN mf.id is not null THEN mf.creator_id
          WHEN opf.id is not null THEN opf.creator_id
          when tf.id is not null THEN tf.creator_id
          ELSE null
        END as creator_id
      from va_folder_files vff
      join va_folders vf on vff.va_folder_id = vf.id
      left join files f on f.filable_id = vff.filable_id and f.filable_type = vff.filable_type
      left join marketing_files mf on mf.id = vff.filable_id and vff.filable_type = 'App\\\Models\\\MarketingFile'
      left join operation_files opf on opf.id = vff.filable_id and vff.filable_type = 'App\\\Models\\\OperationFile'
      left join training_files tf on tf.id = vff.filable_id and vff.filable_type = 'App\\\Models\\\TrainingFile'
      join va_sections vs on vs.id = vf.va_section_id
      join users u on u.id = vf.owner_id
      where vf.public_id = ${folderId}
      and (vf.is_public_accessible = 1 or (${userId} is null or vf.creator_id = ${userId}))
      and vf.deleted_at is null
      `,
  });
};

const getChecklistDocumentType = ({ name, connection }) => {
  return query({
    query: sql`
      select * from checklist_document_types where name = ${name};
    `,
    options: { first: true },
    connection,
  });
};

const createChecklistDocument = ({ data, connection }) => {
  return query({
    query: sql`
        insert into checklist_documents 
        (public_id, document_type_id, name, creator_id) values
        (${uuid()}, ${data.documentTypeId}, ${data.fileName}, ${data.agentId});
    `,
    connection,
  });
};

const createListingDocument = ({
  listingId,
  checklistDocumentId,
  connection,
}) => {
  return query({
    query: sql`
      insert into listing_documents (listing_id, checklist_document_id) values (${listingId}, ${checklistDocumentId});
    `,
    connection,
  });
};

const createDealDocument = ({ dealId, checklistDocumentId, connection }) => {
  return query({
    query: sql`
      insert into deal_documents (deal_id, checklist_document_id) values (${dealId}, ${checklistDocumentId});
    `,
    connection,
  });
};

const createFile = ({ data, connection }) => {
  return query({
    query: sql`
      insert into files
      (public_id, path, thumbnail_path, file_type, file_size, filable_id, filable_type)
      values
      (${uuid()}, ${data.path},
      ${data.thumbnailPath ? data.thumbnailPath : data.path},
      ${data.fileType}, ${data.fileSize}, 
      ${data.filableId}, ${data.filableType});`,
    connection,
  });
};

module.exports = {
  getFiles,
  getRootFolders,
  getFolderFolders,
  getFolderDocuments,
  getChecklistDocumentType,
  createChecklistDocument,
  createListingDocument,
  createDealDocument,
  createFile,
};
