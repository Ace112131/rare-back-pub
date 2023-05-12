module.exports = {
  UserError: (msg = "An error occurred. Please try again later.") => {
    const error = Error(msg);
    error.name = "UserError";
    error.code = 400;
    return error;
  },
};
