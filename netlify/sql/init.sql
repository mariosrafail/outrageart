create table if not exists image_views (
  id text primary key,
  views bigint not null default 0
);

create table if not exists image_view_ips (
  id text not null,
  ip_hash text not null,
  first_seen timestamptz not null default now(),
  primary key (id, ip_hash)
);
