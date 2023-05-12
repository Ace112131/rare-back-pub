const templates = {
  listing_comment_admin: (data) => {
    return {
      subject: "New listing comment",
      html: `${data.name} left a commented on a listing: ${process.env.ENV_URL}/listings/${data.public_id}`,
      message: `${data.name} left a commented on a listing: ${process.env.ENV_URL}/listings/${data.public_id}`,
    };
  },
  deal_comment_admin: (data) => {
    return {
      subject: "New deal comment",
      html: `${data.name} left a commented on a deal: ${process.env.ENV_URL}/deals/${data.public_id}`,
      message: `${data.name} left a commented on a deal: ${process.env.ENV_URL}/deals/${data.public_id}`,
    };
  },
  new_listing_admin: (data) => {
    return {
      subject: "New listing",
      html: `${data.name} created a new listing: ${process.env.ENV_URL}/listings/${data.public_id}`,
      message: `${data.name} created a new listing: ${process.env.ENV_URL}/listings/${data.public_id}`,
    };
  },
  updated_listing_admin: (data) => {
    return {
      subject: "Listing updated",
      html: `${data.name} updated a listing: ${process.env.ENV_URL}/listings/${data.public_id}`,
      message: `${data.name} updated a listing: ${process.env.ENV_URL}/listings/${data.public_id}`,
    };
  },
  new_deal_admin: (data) => {
    return {
      subject: "New deal",
      html: `${data.name} created a new deal: ${process.env.ENV_URL}/deals/${data.public_id}`,
      message: `${data.name} created a new deal: ${process.env.ENV_URL}/deals/${data.public_id}`,
    };
  },
  updated_deal_admin: (data) => {
    return {
      subject: "Deal updated",
      html: `${data.name} updated a deal: ${process.env.ENV_URL}/deals/${data.public_id}`,
      message: `${data.name} updated a deal: ${process.env.ENV_URL}/deals/${data.public_id}`,
    };
  },
  referral_link: (data) => {
    return {
      subject: "You have been invited to RARE Cloud",
      message:
        "You have been invited to RARE Cloud, click the link below to fill out your onboarding form.",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
        <title>RARE Cloud Referral</title>
        </head>
        <body>

        <p>${data.name} has invited you to join RARE</p>
        <p>Please click the link below to fill out your onboarding form.</p>

        <a href="https://cloud.rarerealestate.ca/referral">https://cloud.rarerealestate.ca/referral</a>

        </body>
        </html>
      `,
    };
  },
  password_reset: (data) => {
    return {
      subject: "RARE Cloud Password Reset",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
        <title>RARE Cloud Password Reset</title>
        </head>
        <body>

        <p>Hello,</p>
        <p>Please click the link below to reset your RARE Cloud password.</p>

        <a href="https://cloud.rarerealestate.ca/reset/${data.token}">https://cloud.rarerealestate.ca/reset/${data.token}</a>

        </body>
        </html>
      `,
    };
  },
  onboarding_form: (data) => {
    return {
      subject: "New Onboarding Form Submission",
      html: data.body,
    };
  },
  rare_cloud_migration: (data) => {
    return {
      subject: "Welcome to RARE Cloud",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
        <title>RARE Cloud</title>
        </head>
        <body>

        <p>Hi ${data.first_name},</p>
        <p>Welcome to RARE Cloud! Please click the link below to reset your password</p>

        <a href="https://cloud.rarerealestate.ca/reset/${data.token}">https://cloud.rarerealestate.ca/reset/${data.token}</a>

        </body>
        </html>
      `,
    };
  },
};

module.exports = templates;
