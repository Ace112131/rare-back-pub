-- Database changes
-- BELOW IS IN PRODUCTION
ALTER TABLE
  listings CHANGE created_at created_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  listings CHANGE submission_date submission_date timestamp NULL DEFAULT NOW();

ALTER TABLE
  listings CHANGE created_at created_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  deals CHANGE created_at created_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  deals CHANGE submission_date submission_date timestamp NULL DEFAULT NOW();

ALTER TABLE
  deals CHANGE created_at created_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  files CHANGE created_at created_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  files CHANGE updated_at updated_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  checklist_documents CHANGE created_at created_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  checklist_documents CHANGE updated_at updated_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  advance_user_profiles
add
  COLUMN reco_expiry TIMESTAMP
after
  reco_number;

ALTER TABLE
  pictures
ADD
  UNIQUE (picturable_id);

ALTER TABLE
  pictures CHANGE picturable_type picturable_type varchar (255) NULL DEFAULT 'App\\Models\\User';

ALTER TABLE
  pictures CHANGE created_at created_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  pictures CHANGE updated_at updated_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  emergency_contacts
ADD
  UNIQUE (user_id);

ALTER TABLE
  emergency_contacts CHANGE created_at created_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  emergency_contacts CHANGE updated_at updated_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  password_reset_expires CHANGE created_at created_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  password_reset_expires CHANGE updated_at updated_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  announcements CHANGE updated_at updated_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  announcements CHANGE created_at created_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  deal_conditionals CHANGE created_at created_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  deal_conditionals CHANGE updated_at updated_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  deal_commissions CHANGE created_at created_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  deal_commissions CHANGE updated_at updated_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  lawyer_informations CHANGE created_at created_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  lawyer_informations CHANGE updated_at updated_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  referrals CHANGE created_at created_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  referrals CHANGE updated_at updated_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  deal_commissions CHANGE created_at created_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  deal_commissions CHANGE updated_at updated_at timestamp NULL DEFAULT NOW();

insert into
  deal_statuses (id, name, pretty_name, created_at, updated_at)
values
  (7, 'closed', 'Closed', now(), now());

ALTER TABLE
  users CHANGE created_at created_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  users CHANGE updated_at updated_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  user_profiles CHANGE created_at created_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  user_profiles CHANGE updated_at updated_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  user_profiles CHANGE email_preference email_preference varchar (191) NULL DEFAULT 'rare_email';

ALTER TABLE
  advance_user_profiles CHANGE created_at created_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  advance_user_profiles CHANGE updated_at updated_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  emergency_contacts CHANGE created_at created_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  emergency_contacts CHANGE updated_at updated_at timestamp NULL DEFAULT NOW();

ALTER TABLE
  model_has_roles CHANGE model_type model_type varchar (255) NOT NULL DEFAULT 'App\\Models\\User';

ALTER TABLE
  users
add
  COLUMN rare_cloud_user BOOLEAN DEFAULT TRUE;

CREATE TABLE revshare_influence_relationships (
  id INT PRIMARY KEY AUTO_INCREMENT,
  referring_agent_id BIGINT UNSIGNED NOT NULL,
  referred_agent_id BIGINT UNSIGNED NOT NULL,
  FOREIGN KEY (referring_agent_id) REFERENCES users (id),
  FOREIGN KEY (referred_agent_id) REFERENCES users (id),
  UNIQUE (referred_agent_id)
);

CREATE TABLE revshare_commissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  agent_id BIGINT UNSIGNED NOT NULL,
  commission DOUBLE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  FOREIGN KEY (agent_id) REFERENCES users (id)
);

create table chat_mutes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  agent_id BIGINT UNSIGNED NOT NULL,
  mute VARCHAR(512),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
)

