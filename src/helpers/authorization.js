const { UserError } = require("./errors");

module.exports = ({ user, roles, restrict = [] }) => {
  if (!user) user = {};

  if (restrict.includes(user.role)) throw UserError("No access");

  // authorize roles
  if (!roles.includes(user.role)) {
    throw UserError("No access");
  }
};
