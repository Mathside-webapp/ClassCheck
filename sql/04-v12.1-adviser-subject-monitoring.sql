-- ClassCheck V12.1 — adviser can view joined teachers' attendance; SF2 remains adviser-only in the app.
-- Run ONCE (safe to rerun) in the dedicated ClassCheck Supabase project's SQL Editor.
-- Does not update/delete existing attendance, classes, students, or teacher memberships.
-- Requires classcheck_private.owns_class(uuid) from the existing ClassCheck setup.

begin;

-- Row-level access is deliberately READ-ONLY for the class adviser.
-- Every predicate checks the owner of the referenced class, never a user-provided role.
alter table public.classcheck_class_teachers enable row level security;
alter table public.classcheck_attendance_records enable row level security;
alter table public.classcheck_attendance_sessions enable row level security;

drop policy if exists classcheck_adviser_view_joined_teachers_v121 on public.classcheck_class_teachers;
create policy classcheck_adviser_view_joined_teachers_v121
  on public.classcheck_class_teachers for select to authenticated
  using (classcheck_private.owns_class(class_id));

drop policy if exists classcheck_adviser_view_subject_attendance_v121 on public.classcheck_attendance_records;
create policy classcheck_adviser_view_subject_attendance_v121
  on public.classcheck_attendance_records for select to authenticated
  using (classcheck_private.owns_class(class_id));

drop policy if exists classcheck_adviser_view_subject_sessions_v121 on public.classcheck_attendance_sessions;
create policy classcheck_adviser_view_subject_sessions_v121
  on public.classcheck_attendance_sessions for select to authenticated
  using (classcheck_private.owns_class(class_id));

-- SELECT privileges are still restricted by the policies above and existing policies.
grant select on public.classcheck_class_teachers to authenticated;
grant select on public.classcheck_attendance_records to authenticated;
grant select on public.classcheck_attendance_sessions to authenticated;

commit;
