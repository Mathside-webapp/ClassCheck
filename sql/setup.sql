-- ClassCheck V4 schema reference
-- The connected MathHub Supabase project has already been migrated.
-- This file is for backup / recreating ClassCheck in another Supabase project.

create extension if not exists pgcrypto;
create schema if not exists classcheck_private;
revoke all on schema classcheck_private from public;
grant usage on schema classcheck_private to authenticated;

create table if not exists public.classcheck_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '', school_name text not null default '',
  school_head_name text not null default '',
  school_id text not null default '', region text not null default '',
  division text not null default '', district text not null default '',
  position text not null default 'Teacher', school_year text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.classcheck_classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  grade_level text not null, section_name text not null,
  school_year text not null default '', adviser_name text not null default '',
  class_color text not null default '#7a1730', archived boolean not null default false,
  join_code text not null unique,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.classcheck_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classcheck_classes(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  lrn text, last_name text not null, first_name text not null, middle_name text,
  name_extension text, sex text not null check(sex in ('Male','Female')),
  enrollment_status text not null default 'Active', date_enrolled date,
  status_effective_date date, remarks text, transfer_school text,
  archived boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists classcheck_students_class_lrn_unique on public.classcheck_students(class_id,lrn) where lrn is not null and lrn<>'';

create table if not exists public.classcheck_class_teachers (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classcheck_classes(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  teacher_name text not null default 'Teacher', subject text not null,
  joined_at timestamptz not null default now(), unique(class_id,teacher_id),
  constraint classcheck_class_teachers_subject_check check(char_length(btrim(subject)) between 2 and 80)
);

create table if not exists public.classcheck_attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references public.classcheck_classes(id) on delete cascade,
  attendance_date date not null, subject text not null default 'Advisory',
  session_status text not null default 'draft' check(session_status in ('draft','completed')),
  notes text, client_updated_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(class_id,teacher_id,attendance_date)
);

create table if not exists public.classcheck_attendance_records (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.classcheck_attendance_sessions(id) on delete cascade,
  class_id uuid not null references public.classcheck_classes(id) on delete cascade,
  student_id uuid not null references public.classcheck_students(id) on delete cascade,
  attendance_date date not null, subject text not null default 'Advisory',
  status text not null default 'present' check(status in ('present','absent','late')),
  note text, client_updated_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(class_id,teacher_id,student_id,attendance_date)
);

create table if not exists public.classcheck_school_calendar (
  id uuid primary key default gen_random_uuid(), teacher_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid references public.classcheck_classes(id) on delete cascade,
  date date not null, day_type text not null default 'school_day', description text,
  created_at timestamptz not null default now(), unique(teacher_id,class_id,date)
);

alter table public.classcheck_profiles enable row level security;
alter table public.classcheck_classes enable row level security;
alter table public.classcheck_students enable row level security;
alter table public.classcheck_class_teachers enable row level security;
alter table public.classcheck_attendance_sessions enable row level security;
alter table public.classcheck_attendance_records enable row level security;
alter table public.classcheck_school_calendar enable row level security;

-- For the exact production policies and RPCs, use the migrations already applied to the connected project:
-- classcheck_independent_accounts_shared_classes
-- classcheck_adviser_only_join_code
-- classcheck_lock_shared_membership
-- classcheck_fix_join_rpc_conflict
-- They enforce: self-owned profiles, adviser-only roster changes/code access, shared roster read,
-- per-teacher attendance isolation, adviser preview, and join-by-code with teacher-selected subject.


-- V8.6 SF2 fixed first-Friday enrolment baseline
alter table public.classcheck_classes
  add column if not exists enrollment_baseline_male integer,
  add column if not exists enrollment_baseline_female integer,
  add column if not exists enrollment_baseline_set_at timestamptz;

alter table public.classcheck_classes
  drop constraint if exists classcheck_baseline_male_nonnegative,
  add constraint classcheck_baseline_male_nonnegative
    check (enrollment_baseline_male is null or enrollment_baseline_male >= 0);

alter table public.classcheck_classes
  drop constraint if exists classcheck_baseline_female_nonnegative,
  add constraint classcheck_baseline_female_nonnegative
    check (enrollment_baseline_female is null or enrollment_baseline_female >= 0);

-- V8.8 Weekday-only attendance enforcement
create schema if not exists classcheck_private;

create or replace function classcheck_private.reject_weekend_attendance()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if extract(isodow from new.attendance_date) in (6,7) then
    raise exception 'Attendance cannot be recorded on Saturday or Sunday.';
  end if;
  return new;
end;
$$;

drop trigger if exists classcheck_sessions_no_weekends on public.classcheck_attendance_sessions;
create trigger classcheck_sessions_no_weekends
before insert or update of attendance_date
on public.classcheck_attendance_sessions
for each row execute function classcheck_private.reject_weekend_attendance();

drop trigger if exists classcheck_records_no_weekends on public.classcheck_attendance_records;
create trigger classcheck_records_no_weekends
before insert or update of attendance_date
on public.classcheck_attendance_records
for each row execute function classcheck_private.reject_weekend_attendance();

grant select (
  enrollment_baseline_male,
  enrollment_baseline_female,
  enrollment_baseline_set_at
) on public.classcheck_classes to authenticated;


-- V9.1 SF2 adviser / school-head identity and corrected first-Friday baseline support
alter table public.classcheck_profiles
  add column if not exists school_head_name text not null default '';

create or replace function classcheck_private.sync_teacher_name()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  update public.classcheck_class_teachers
  set teacher_name=coalesce(nullif(btrim(new.full_name),''),'Teacher')
  where teacher_id=new.user_id;

  update public.classcheck_classes
  set adviser_name=coalesce(nullif(btrim(new.full_name),''),'Teacher')
  where teacher_id=new.user_id;

  return new;
end;
$$;
