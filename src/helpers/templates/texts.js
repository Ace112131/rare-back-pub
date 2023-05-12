const { unindent } = require("../utils");
const moment = require("moment");

const ENV_URL = process.env.ENV_URL;

const endpoint = (fragment) => (data) => {
  return `${ENV_URL}/${fragment}/${data.public_id}`;
};

const listing = endpoint("listings");
const deal = endpoint("deals");

const ADMIN_NAME = "A RARE Cloud admin";

/* 
interface TemplateData {
  name: string,
  public_id: string,
  address: string | undefined
}
*/

const templates = {
  listing_comment: (data /*: TemplateData */) => {
    return unindent`
      ${data.name} commented on a listing at
      ${data.address}:

      ${listing(data)}
    `;
  },

  deal_comment: (data) => {
    return unindent`
      ${data.name} commented on a deal for
      ${data.address}:

      ${deal(data)}
    `;
  },
  listing_status_changed: (data) => {
    return unindent`
      A RARE Cloud admin has updated the status of your listing at
      ${data.address}
      to ${data.status}: 
      
      ${listing(data)}
    `;
  },
  deal_status_changed: (data) => {
    return unindent`
      A RARE Cloud admin has updated the status of your deal at
      ${data.address}
      to ${data.status}: 
      
      ${deal(data)}
    `;
  },
  listing_misc_change: (data) => {
    return unindent`
      ${data.name} has made changes to your listing at
      ${data.address}:

      ${listing(data)}
    `;
  },
  deal_misc_change: (data) => {
    return unindent`
      ${data.name} has made changes to your deal at
      ${data.address}:

      ${deal(data)}
    `;
  },
  // override name with generic admin name when admin modifies a listing/deal
  admin_listing_misc_change(data) {
    return templates.listing_misc_change({ ...data, name: ADMIN_NAME });
  },
  admin_deal_misc_change(data) {
    return templates.deal_misc_change({ ...data, name: ADMIN_NAME });
  },
  new_announcement: (data) => {
    return `A new announcement has been posted in the RARE Cloud: \n ${ENV_URL}`;
  },
  new_direct_message: (data) => {
    return unindent`
      ${data.sender} sent you a message: 
      
      ${ENV_URL}${data.link}
    `;
  },
  new_group_message: (data) => {
    return unindent`
      ${data.sender} sent a message to the group ${data.groupName}: 
      
      ${ENV_URL}${data.link}
    `;
  },
  lone_wolf: (data) => {
    const previousMonth = moment().subtract({ day: 45 }).format("MMMM");
    return unindent`
      RARE Cloud: Revenue Share for the month of ${previousMonth} has been calculated and paid out.
    `;
  },
};

module.exports = templates;
