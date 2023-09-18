begin;

create or replace function on_update_timestamp()
  returns trigger as $$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
$$ language 'plpgsql';

create table if not exists users  (
  id uuid not null primary key default public.gen_random_uuid(),
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp,
  first_name text not null,
  last_name text not null,
  email text unique not null,
  password_hash bytea not null,
  account_type text default 'user'
);

create table if not exists files (
  id uuid not null primary key default public.gen_random_uuid(),
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp,
  owner_id uuid not null,
  file_name text not null,
  description text,
  file text,
  size integer,

  foreign key (owner_id) references users (id) on delete cascade
);

create table if not exists histories (
  id uuid not null primary key default public.gen_random_uuid(),
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp,
  owner_id uuid not null,
  file_id uuid not null,
  file_status text not null,

  foreign key (owner_id) references users (id) on delete cascade,
  foreign key (file_id) references files (id) on delete cascade
);


drop trigger if exists histories_updated_at on histories;
create trigger histories_updated_at before 
update on histories for each row execute procedure on_update_timestamp();

drop trigger if exists files_updated_at on files;
create trigger files_updated_at before 
update on files for each row execute procedure on_update_timestamp();

drop trigger if exists users_updated_at on users;
create trigger users_updated_at before 
update on users for each row execute procedure on_update_timestamp();

commit;