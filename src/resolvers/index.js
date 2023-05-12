const user = require("./user");
const listing = require("./listing");
const deal = require("./deal");
const library = require("./library");
const revshare = require("./revshare");
const files = require("./files");
const announcements = require("./announcements");
const forum = require("./forum");
const launch = require("./launch");
const chat = require("./chat");
const revshareRelationships = require("./revshareRelationships");
const { GraphQLUpload } = require("graphql-upload");

module.exports = {
  Upload: GraphQLUpload,
  Query: {
    ...user.Query,
    ...listing.Query,
    ...deal.Query,
    ...library.Query,
    ...revshare.Query,
    ...files.Query,
    ...announcements.Query,
    ...forum.Query,
    ...revshareRelationships.Query,
    ...chat.Query,
  },
  Mutation: {
    ...user.Mutation,
    ...listing.Mutation,
    ...deal.Mutation,
    ...library.Mutation,
    ...revshare.Mutation,
    ...files.Mutation,
    ...announcements.Mutation,
    ...forum.Mutation,
    ...launch.Mutation,
    ...revshareRelationships.Mutation,
    ...chat.Mutation,
  },
};
