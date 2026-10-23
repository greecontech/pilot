-- Account invitations: an administrator creates a one-time link, the invited person chooses their own password.
-- Only a SHA-256 hash of the token is stored, so a database leak cannot be turned into working links.
create table invitations (
  id          uuid primary key default gen_random_uuid(),
  token_hash  text not null unique,
  role        text not null check (role in ('operator', 'viewer')),
  email       text,
  note        text not null default '',
  created_by  uuid references users(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  used_by     uuid references users(id) on delete set null,
  revoked_at  timestamptz
);
create index invitations_created_idx on invitations (created_at desc);
