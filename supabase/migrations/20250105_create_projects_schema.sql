-- Schema for retroplanning projects, phases, subprojects, and holidays
create extension if not exists "pgcrypto";

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'phase_type'
      and n.nspname = 'public'
  ) then
    create type phase_type as enum (
      'CONCEPTION',
      'DEVELOPMENT',
      'TESTS',
      'PUSH_TO_PROD',
      'OTHER'
    );
  end if;
end$$;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists subprojects (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  sub_project_id uuid references subprojects(id) on delete set null,
  name text,
  details text,
  start_date date not null,
  end_date date not null,
  type phase_type not null,
  created_at timestamptz not null default now(),
  constraint phase_date_range check (start_date <= end_date)
);

create table if not exists holidays (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  date date not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_subprojects_project on subprojects(project_id);
create index if not exists idx_phases_project on phases(project_id);
create index if not exists idx_phases_subproject on phases(sub_project_id);
create index if not exists idx_holidays_project on holidays(project_id);

alter table projects enable row level security;
alter table subprojects enable row level security;
alter table phases enable row level security;
alter table holidays enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'projects'
      and policyname = 'Users manage their own projects'
  ) then
    create policy "Users manage their own projects" on projects
      for all
      using (owner_id = auth.uid())
      with check (owner_id = auth.uid());
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'subprojects'
      and policyname = 'Users manage their subprojects'
  ) then
    create policy "Users manage their subprojects" on subprojects
      for all
      using (
        exists (
          select 1 from projects p
          where p.id = subprojects.project_id
            and p.owner_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from projects p
          where p.id = subprojects.project_id
            and p.owner_id = auth.uid()
        )
      );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'phases'
      and policyname = 'Users manage their phases'
  ) then
    create policy "Users manage their phases" on phases
      for all
      using (
        exists (
          select 1 from projects p
          where p.id = phases.project_id
            and p.owner_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from projects p
          where p.id = phases.project_id
            and p.owner_id = auth.uid()
        )
      );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'holidays'
      and policyname = 'Users manage their holidays'
  ) then
    create policy "Users manage their holidays" on holidays
      for all
      using (
        exists (
          select 1 from projects p
          where p.id = holidays.project_id
            and p.owner_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from projects p
          where p.id = holidays.project_id
            and p.owner_id = auth.uid()
        )
      );
  end if;
end$$;
