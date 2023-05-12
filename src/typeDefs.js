const { gql } = require("apollo-server-express");

module.exports = gql`
  scalar JSONB
  scalar Date
  scalar Upload

  type User {
    id: Int!
    agentnum: Int
    public_id: String
    name: String
    email: String
    alternative_email: String
    address: String
    first_name: String
    last_name: String
    title: String
    date_of_birth: Date
    phone_number: String
    picture: String
    thumbnail: String
    treb_number: String
    reco_number: String
    reco_expiry: Date
    sin_number: String
    hst_number: String
    alarm_code: String
    lock_box_number: String
    emergency_contact_name: String
    emergency_contact_phone: String
    emergency_contact_relationship: String
    role: String
    godmode: Boolean
    created: Date
  }

  type Listing {
    id: Int!
    public_id: String
    address: String
    type: String
    option: String
    status: String
    notes: String
    admin_notes: String
    created: Date
    creator_id: Int
    need_feature_sheet_and_social_media_post: Boolean
    mls_pictures_link: String
    hi_res_pictures_link: String
    agent_note: String
    additional_copy_note: String
    need_sale_sign: Boolean
    sign_installation_date: Date
    documents: [Document]
    agents: [User]
    comments: [Comment]
  }

  type Deal {
    id: Int!
    public_id: String
    brokerage_side: String
    type: String
    status: String
    sale_price: Float
    lease_price: Float
    deposit_amount: Float
    second_deposit_amount: Float
    offer_date: Date
    acceptance_date: Date
    close_date: Date
    conditional: Boolean
    conditions: [DealConditional]
    brokerage: String
    brokerage_phone_number: String
    paperwork_to_lawyer: Boolean
    annual_personal_deal: Boolean
    listing_brokerage_commission: String
    cooperating_brokerage_commission: String
    total_commission: String
    first_installment: Float
    second_installment: Float
    third_installment: Float
    final_installment: Float
    total_precon_commission: Float
    referral: DealReferral
    notes: String
    buyer_lawyer: LawyerInformation
    seller_lawyer: LawyerInformation
    creator_id: Int
    agents: [User]
    external_agents: [ExternalAgent]
    listing: Listing
    address: String
    created: Date
    documents: [Document]
    comments: [Comment]
  }

  type ExternalAgent {
    id: Int
    name: String
    email: String
    phone: String
  }

  type LawyerInformation {
    id: Int
    name: String
    address: String
    phone_number: String
    fax_number: String
    email: String
  }

  type DealConditional {
    id: Int
    upon: String
    until: Date
  }

  type DealReferral {
    id: Int
    first_name: String
    last_name: String
    referral_amount: Float
    referral_percentage: Float
    office_name: String
    office_email: String
    office_address: String
    office_phone: String
    office_fax: String
  }

  type Comment {
    id: Int!
    sender: User
    message: String
    created: Date
  }

  type Document {
    id: Int!
    public_id: String
    owner: User
    name: String
    path: String
    thumbnail: String
    type: String
    size: Int
    created: Date
    section: FolderSection
    checklist_document_type: String
  }

  type FolderSection {
    id: Int!
    name: String!
  }

  type Folder {
    id: Int!
    public_id: String
    owner: User
    name: String
    section: FolderSection
  }

  type AgentRevshare {
    id: String
    user: User
    monthly: Float
    annual: Float
    total: Float
    referrals: [AgentRevshare]
  }

  type SignedUrl {
    signedUrl: String!
    fileName: String!
    key: String!
  }

  type Announcement {
    id: Int!
    public_id: String!
    author: User!
    title: String!
    content: String!
    preview: String!
    created: Date!
  }

  type ForumTopic {
    id: Int!
    author: Int!
    author_name: String!
    topic: String!
    last_updated: Date!
  }

  type Relationships {
    referring_agent: User
    referred_agents: [User]
  }

  type MyRelationships {
    id: Int
    referredBy: Int
    referred: [Int]
  }

  type LoneWolf {
    agent_id: Int
    commission: Float
    created_at: Date
  }

  input LoneWolfSms {
    id: Int
    name: String
    phone_number: String
  }

  type Commission {
    id: Int
    commission: Float
    lonewolf_agentnum: Int
    name: String
    user_id: Int
    created_at: Date
  }

  type ChatMute {
    id: Int
    agent_id: Int
    mute: String
    created_at: Date
  }

  type Query {
    getUser: User
    getAgents(search: String): [User]
    getAgentsWhoDonotHaveReferral: [User]
    getListings(filters: ListingFilterInput): [Listing]
    getListing(id: String): Listing
    getDeals(filters: DealsFilterInput): [Deal]
    getUpcomingDeals: [Deal]
    getDeal(id: String): Deal
    getLibrary(prefix: String): JSONB
    getLibraryFolders(folderId: String, filters: LibraryFilters): [Folder]
    getLibraryDocuments(folderId: String, filters: LibraryFilters): [Document]
    getRevshare(userId: String): [AgentRevshare]
    getRevshareOverview(userId: String): AgentRevshare
    getSignedUrl(fileName: String, fileType: String): SignedUrl
    getAnnouncements: [Announcement]
    getForumTopics: [ForumTopic]
    getTokenValid(token: String!): Boolean
    getListingById(id: Int): Listing
    getAllRelationships(id: Int!): JSONB
    getRelationshipPyramid(id: Int!): JSONB
    getMyRelationships(id: Int!): MyRelationships
    getAllCommissions: [Commission]
    getChatMute(mute: String!): ChatMute
  }

  type Mutation {
    authenticateUser(email: String!, password: String!): Boolean
    enterGodMode(userId: Int!): Boolean
    exitGodMode: Boolean
    forgotPassword(email: String!): Boolean
    resetPassword(token: String!, password: String!): Boolean
    logout: Boolean
    createListingComment(listingId: String, message: String): Boolean
    createListing(data: CreateListingInput!): Boolean
    updateListing(data: UpdateListingInput!): Boolean
    adminUpdateListing(data: UpdateListingInput!): Boolean
    createDealComment(dealId: String, message: String): Boolean
    sendReferral(email: String!): Boolean
    createDeal(data: CreateDealInput!): Boolean
    updateDeal(data: UpdateDealInput!): Boolean
    adminUpdateDeal(data: UpdateDealInput!): Boolean
    updateRecoLicense(data: UpdateRecoLicenseInput!): Boolean
    updateProfile(data: UpdateProfileInput!): Boolean
    updateEmail(email: String!): Boolean
    updatePassword(currentPassword: String!, newPassword: String!): Boolean
    createForumTopic(topic: String!): Boolean
    createAnnouncement(data: AnnouncementInput!): Boolean
    deleteAnnouncement(id: Int!): Boolean
    deleteUser(id: Int!): Boolean
    updateUserRole(userId: Int!, role: String!): Boolean
    createUser(data: UpdateProfileInput!): Boolean
    triggerLaunchInvitations: Boolean
    deleteDraftDeal(id: String!): Boolean
    deleteDraftListing(id: String!): Boolean
    deleteLibraryItem(prefix: String): Boolean
    createLibraryFolder(prefix: String): Boolean
    uploadLibraryFile(prefix: String, files: [Upload!]!): Boolean
    addReferree(referringAgentId: Int!, referredAgentId: Int!): Boolean
    deleteReferree(referringAgentId: Int!, referredAgentId: Int!): Boolean
    updateCommission(id: Int!, commission: Float!): Boolean
    uploadLoneWolf(file: Upload!): [User]
    smsLoneWolf(agents: [LoneWolfSms]): Boolean
    updateChatMute(mute: String!): Boolean
    updateAgentNum(userId: Int!, agentnum: Int!): Boolean
  }

  input UpdateRecoLicenseInput {
    user_id: Int
    reco_number: String
    reco_expiry: Date
  }

  input UpdateProfileInput {
    user_id: Int
    email: String
    alternative_email: String
    address: String
    first_name: String
    last_name: String
    title: String
    date_of_birth: Date
    phone_number: String
    picture: String
    treb_number: String
    reco_number: String
    reco_expiry: Date
    sin_number: String
    hst_number: String
    alarm_code: String
    lock_box_number: String
    emergency_contact_name: String
    emergency_contact_phone: String
    emergency_contact_relationship: String
    date_joined_rare: Date
    date_incorporated: Date
    role: Int
  }

  input AnnouncementInput {
    title: String
    content: String
  }

  input LibraryFilters {
    type: String
  }

  input ListingFilterInput {
    status: String
  }

  input DealsFilterInput {
    status: String
  }

  input CreateListingInput {
    type: String!
    option: String!
    address: String
    agents: [Int]
    documents: JSONB
    notes: String
    need_feature_sheet_and_social_media_post: Boolean
    mls_pictures_link: String
    agent_note: String
    additional_copy_note: String
    need_sale_sign: Boolean
    sign_installation_date: Date
    submitted: Boolean
  }

  input UpdateListingInput {
    id: String!
    type: String
    option: String
    address: String
    agents: [Int]
    documents: JSONB
    notes: String
    need_feature_sheet_and_social_media_post: Boolean
    mls_pictures_link: String
    agent_note: String
    additional_copy_note: String
    need_sale_sign: Boolean
    sign_installation_date: Date
    admin_notes: String
    status: String
    submitted: Boolean
  }

  input CreateDealInput {
    type: String
    brokerage_side: String
    agents: [Int]
    listing_id: Int
    property_address: String
    offer_date: Date
    acceptance_date: Date
    close_date: Date
    sale_price: Float
    lease_price: Float
    deposit_amount: Float
    second_deposit_amount: Float
    conditional: Boolean
    offer_conditions: [OfferCondition]
    brokerage: String
    brokerage_phone_number: String
    deal_agents: [DealAgent]
    documents: JSONB
    notes: String
    buyer_lawyer: LawyerInformationInput
    seller_lawyer: LawyerInformationInput
    paperwork_to_lawyer: Boolean
    annual_personal_deal: Boolean
    listing_brokerage_commission: String
    cooperating_brokerage_commission: String
    total_commission: String
    referral: Referral
    first_installment: Float
    second_installment: Float
    third_installment: Float
    final_installment: Float
    submitted: Boolean
  }

  input LawyerInformationInput {
    name: String
    address: String
    phone_number: String
    fax_number: String
    email: String
  }

  input Referral {
    first_name: String
    last_name: String
    referral_amount: Float
    referral_percentage: Float
    office_name: String
    office_email: String
    office_address: String
    office_phone: String
    office_fax: String
  }

  input DealAgent {
    id: Int
    name: String
    email: String
    phone: String
  }

  input OfferCondition {
    upon: String
    until: Date
  }

  input UpdateDealInput {
    id: String!
    agents: [Int]
    listing_id: Int
    property_address: String
    offer_date: Date
    acceptance_date: Date
    close_date: Date
    sale_price: Float
    lease_price: Float
    deposit_amount: Float
    second_deposit_amount: Float
    conditional: Boolean
    brokerage: String
    brokerage_phone_number: String
    notes: String
    paperwork_to_lawyer: Boolean
    annual_personal_deal: Boolean
    admin_notes: String
    offer_conditions: [OfferCondition]
    deal_agents: [DealAgent]
    documents: JSONB
    buyer_lawyer: LawyerInformationInput
    seller_lawyer: LawyerInformationInput
    listing_brokerage_commission: String
    cooperating_brokerage_commission: String
    total_commission: String
    first_installment: Float
    second_installment: Float
    third_installment: Float
    final_installment: Float
    referral: Referral
    status: String
    submitted: Boolean
  }
`;
