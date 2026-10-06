-- ClassCheck V10.7 — editable learner details
-- LRN is optional. Only the class adviser may edit a learner.

begin;

create or replace function public.classcheck_update_student(
  p_class_id uuid,
  p_student_id uuid,
  p_lrn text,
  p_last_name text,
  p_first_name text,
  p_middle_name text,
  p_sex text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_lrn text := nullif(btrim(coalesce(p_lrn, '')), '');
begin
  if v_uid is null then
    raise exception 'Authentication required.';
  end if;

  if not classcheck_private.owns_class(p_class_id) then
    raise exception 'Only the class adviser can edit learners.';
  end if;

  if nullif(btrim(coalesce(p_last_name, '')), '') is null
     or nullif(btrim(coalesce(p_first_name, '')), '') is null then
    raise exception 'First name and last name are required.';
  end if;

  if p_sex not in ('Male', 'Female') then
    raise exception 'Sex must be Male or Female.';
  end if;

  if v_lrn is not null and v_lrn !~ '^[0-9]{12}$' then
    raise exception 'LRN must contain exactly 12 digits, or be left blank.';
  end if;

  if v_lrn is not null and exists (
    select 1
    from public.classcheck_students s
    where s.class_id = p_class_id
      and s.lrn = v_lrn
      and s.id <> p_student_id
  ) then
    raise exception 'That LRN is already used by another learner in this class.';
  end if;

  update public.classcheck_students
  set lrn = v_lrn,
      last_name = upper(btrim(p_last_name)),
      first_name = btrim(p_first_name),
      middle_name = nullif(btrim(coalesce(p_middle_name, '')), ''),
      sex = p_sex
  where id = p_student_id
    and class_id = p_class_id
    and teacher_id = v_uid;

  if not found then
    raise exception 'Learner not found in this class.';
  end if;

  return true;
end;
$$;

revoke all on function public.classcheck_update_student(uuid,uuid,text,text,text,text,text) from public;
revoke all on function public.classcheck_update_student(uuid,uuid,text,text,text,text,text) from anon;
grant execute on function public.classcheck_update_student(uuid,uuid,text,text,text,text,text) to authenticated;

commit;
