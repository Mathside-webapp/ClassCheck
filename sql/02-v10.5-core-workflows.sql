-- ClassCheck V10.5 core workflow patch
-- Already applied to the dedicated ClassCheck Supabase project rvzuqzgktdcyzyayftks.
-- Keep this file for future/new deployments.

begin;

alter table public.classcheck_classes
  alter column join_code set default upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));

create or replace function public.classcheck_create_class(p_grade_level text,p_section_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_id uuid; v_code text; v_school_year text:=''; v_adviser text:='Teacher';
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;
  if nullif(btrim(coalesce(p_grade_level,'')),'') is null then raise exception 'Grade level is required.'; end if;
  if nullif(btrim(coalesce(p_section_name,'')),'') is null then raise exception 'Section name is required.'; end if;
  select coalesce(p.school_year,''),coalesce(nullif(btrim(p.full_name),''),'Teacher') into v_school_year,v_adviser from public.classcheck_profiles p where p.user_id=v_uid;
  if not found then select coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'),''),'Teacher') into v_adviser from auth.users u where u.id=v_uid; v_adviser:=coalesce(v_adviser,'Teacher'); end if;
  loop
    v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    begin
      insert into public.classcheck_classes(teacher_id,grade_level,section_name,school_year,adviser_name,class_color,archived,join_code)
      values(v_uid,btrim(p_grade_level),btrim(p_section_name),v_school_year,v_adviser,'#7a1730',false,v_code)
      returning id into v_id;
      exit;
    exception when unique_violation then null;
    end;
  end loop;
  return v_id;
end $$;

create or replace function public.classcheck_join_class(p_code text,p_subject text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_class uuid; v_owner uuid; v_name text; v_subject text:=btrim(coalesce(p_subject,'')); v_code text:=upper(regexp_replace(coalesce(p_code,''),'[^A-Za-z0-9]','','g'));
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;
  if char_length(v_code)<>6 then raise exception 'Enter the 6-character class code.'; end if;
  if char_length(v_subject)<2 or char_length(v_subject)>80 then raise exception 'Enter a subject name between 2 and 80 characters.'; end if;
  select c.id,c.teacher_id into v_class,v_owner from public.classcheck_classes c where upper(regexp_replace(c.join_code,'[^A-Za-z0-9]','','g'))=v_code and not c.archived limit 1;
  if v_class is null then raise exception 'Invalid class code or the class is archived.'; end if;
  if v_owner=v_uid then raise exception 'You are already the adviser of this class.'; end if;
  select nullif(btrim(p.full_name),'') into v_name from public.classcheck_profiles p where p.user_id=v_uid;
  insert into public.classcheck_class_teachers(class_id,teacher_id,teacher_name,subject)
  values(v_class,v_uid,coalesce(v_name,'Teacher'),v_subject)
  on conflict(class_id,teacher_id) do update set teacher_name=excluded.teacher_name,subject=excluded.subject;
  return v_class;
end $$;

create or replace function public.classcheck_leave_class(p_class_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_count integer:=0;
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;
  if classcheck_private.owns_class(p_class_id) then raise exception 'The class adviser cannot leave their own class. Archive or delete the class instead.'; end if;
  delete from public.classcheck_class_teachers where class_id=p_class_id and teacher_id=v_uid;
  get diagnostics v_count=row_count;
  if v_count=0 then raise exception 'You are not joined to this class.'; end if;
  return true;
end $$;

create or replace function public.classcheck_set_class_archived(p_class_id uuid,p_archived boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;
  if not classcheck_private.owns_class(p_class_id) then raise exception 'Only the class adviser can archive or restore this class.'; end if;
  update public.classcheck_classes set archived=coalesce(p_archived,false) where id=p_class_id and teacher_id=v_uid;
  if not found then raise exception 'Class not found.'; end if;
  return true;
end $$;

create or replace function public.classcheck_add_student(p_class_id uuid,p_lrn text,p_last_name text,p_first_name text,p_middle_name text,p_name_extension text,p_sex text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_id uuid; v_baseline_set boolean;
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;
  if not classcheck_private.owns_class(p_class_id) then raise exception 'Only the class adviser can add learners.'; end if;
  if nullif(btrim(coalesce(p_last_name,'')),'') is null or nullif(btrim(coalesce(p_first_name,'')),'') is null then raise exception 'First name and last name are required.'; end if;
  if p_sex not in ('Male','Female') then raise exception 'Sex must be Male or Female.'; end if;
  select (c.enrollment_baseline_male is not null and c.enrollment_baseline_female is not null) into v_baseline_set from public.classcheck_classes c where c.id=p_class_id;
  insert into public.classcheck_students(class_id,teacher_id,lrn,last_name,first_name,middle_name,name_extension,sex,enrollment_status,date_enrolled,archived)
  values(p_class_id,v_uid,nullif(btrim(coalesce(p_lrn,'')),''),upper(btrim(p_last_name)),btrim(p_first_name),nullif(btrim(coalesce(p_middle_name,'')),''),nullif(btrim(coalesce(p_name_extension,'')),''),p_sex,'Active',case when v_baseline_set then current_date else null end,false)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.classcheck_import_students(p_class_id uuid,p_students jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_count integer:=0; v_baseline_set boolean;
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;
  if not classcheck_private.owns_class(p_class_id) then raise exception 'Only the class adviser can import learners.'; end if;
  if p_students is null or jsonb_typeof(p_students)<>'array' then raise exception 'Invalid learner list.'; end if;
  select (c.enrollment_baseline_male is not null and c.enrollment_baseline_female is not null) into v_baseline_set from public.classcheck_classes c where c.id=p_class_id;
  insert into public.classcheck_students(class_id,teacher_id,lrn,last_name,first_name,middle_name,name_extension,sex,enrollment_status,date_enrolled,archived)
  select p_class_id,v_uid,nullif(btrim(coalesce(x.lrn,'')),''),upper(btrim(x.last_name)),btrim(x.first_name),nullif(btrim(coalesce(x.middle_name,'')),''),nullif(btrim(coalesce(x.name_extension,'')),''),x.sex,'Active',case when v_baseline_set then current_date else null end,false
  from jsonb_to_recordset(p_students) as x(lrn text,last_name text,first_name text,middle_name text,name_extension text,sex text)
  where nullif(btrim(coalesce(x.last_name,'')),'') is not null and nullif(btrim(coalesce(x.first_name,'')),'') is not null and x.sex in ('Male','Female')
  on conflict do nothing;
  get diagnostics v_count=row_count;
  if not v_baseline_set then
    update public.classcheck_classes c set
      enrollment_baseline_male=(select count(*) from public.classcheck_students s where s.class_id=p_class_id and not s.archived and s.sex='Male'),
      enrollment_baseline_female=(select count(*) from public.classcheck_students s where s.class_id=p_class_id and not s.archived and s.sex='Female'),
      enrollment_baseline_set_at=now()
    where c.id=p_class_id and c.teacher_id=v_uid;
  end if;
  return v_count;
end $$;

create or replace function public.classcheck_delete_students(p_class_id uuid,p_student_ids uuid[])
returns integer language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_count integer:=0;
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;
  if not classcheck_private.owns_class(p_class_id) then raise exception 'Only the class adviser can delete learners.'; end if;
  delete from public.classcheck_students where class_id=p_class_id and id=any(p_student_ids);
  get diagnostics v_count=row_count;
  return v_count;
end $$;

create or replace function public.classcheck_delete_class(p_class_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;
  if not classcheck_private.owns_class(p_class_id) then raise exception 'Only the class adviser can delete this class.'; end if;
  delete from public.classcheck_classes where id=p_class_id and teacher_id=v_uid;
  if not found then raise exception 'Class not found.'; end if;
  return true;
end $$;

create or replace function public.classcheck_set_sf2_baseline(p_class_id uuid,p_male integer,p_female integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;
  if not classcheck_private.owns_class(p_class_id) then raise exception 'Only the class adviser can change the SF2 enrolment baseline.'; end if;
  if coalesce(p_male,0)<0 or coalesce(p_female,0)<0 then raise exception 'Enrolment totals cannot be negative.'; end if;
  update public.classcheck_classes set enrollment_baseline_male=coalesce(p_male,0),enrollment_baseline_female=coalesce(p_female,0),enrollment_baseline_set_at=now() where id=p_class_id and teacher_id=v_uid;
  return true;
end $$;

create or replace function public.classcheck_sync_attendance(p_records jsonb default '[]'::jsonb,p_sessions jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); r record; s record; v_records integer:=0; v_sessions integer:=0;
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;
  if p_records is null or jsonb_typeof(p_records)<>'array' then p_records:='[]'::jsonb; end if;
  if p_sessions is null or jsonb_typeof(p_sessions)<>'array' then p_sessions:='[]'::jsonb; end if;
  for r in select * from jsonb_to_recordset(p_records) as x(class_id uuid,student_id uuid,attendance_date date,status text,note text,subject text,client_updated_at timestamptz) loop
    if not classcheck_private.can_access_class(r.class_id) then raise exception 'You do not have access to this class.'; end if;
    if not exists(select 1 from public.classcheck_students st where st.id=r.student_id and st.class_id=r.class_id and not st.archived) then raise exception 'Learner is not in this class.'; end if;
    if r.status not in ('present','absent','late') then raise exception 'Invalid attendance status.'; end if;
    insert into public.classcheck_attendance_records(teacher_id,class_id,student_id,attendance_date,status,note,subject,client_updated_at)
    values(v_uid,r.class_id,r.student_id,r.attendance_date,r.status,r.note,coalesce(nullif(btrim(r.subject),''),'Advisory'),coalesce(r.client_updated_at,now()))
    on conflict(class_id,teacher_id,student_id,attendance_date) do update set status=excluded.status,note=excluded.note,subject=excluded.subject,client_updated_at=excluded.client_updated_at,updated_at=now();
    v_records:=v_records+1;
  end loop;
  for s in select * from jsonb_to_recordset(p_sessions) as x(class_id uuid,attendance_date date,session_status text,notes text,subject text,client_updated_at timestamptz) loop
    if not classcheck_private.can_access_class(s.class_id) then raise exception 'You do not have access to this class.'; end if;
    insert into public.classcheck_attendance_sessions(teacher_id,class_id,attendance_date,session_status,notes,subject,client_updated_at)
    values(v_uid,s.class_id,s.attendance_date,case when s.session_status in ('draft','completed') then s.session_status else 'completed' end,s.notes,coalesce(nullif(btrim(s.subject),''),'Advisory'),coalesce(s.client_updated_at,now()))
    on conflict(class_id,teacher_id,attendance_date) do update set session_status=excluded.session_status,notes=excluded.notes,subject=excluded.subject,client_updated_at=excluded.client_updated_at,updated_at=now();
    v_sessions:=v_sessions+1;
  end loop;
  return jsonb_build_object('records',v_records,'sessions',v_sessions);
end $$;

revoke all on function public.classcheck_create_class(text,text) from public,anon;
revoke all on function public.classcheck_join_class(text,text) from public,anon;
revoke all on function public.classcheck_leave_class(uuid) from public,anon;
revoke all on function public.classcheck_set_class_archived(uuid,boolean) from public,anon;
revoke all on function public.classcheck_add_student(uuid,text,text,text,text,text,text) from public,anon;
revoke all on function public.classcheck_import_students(uuid,jsonb) from public,anon;
revoke all on function public.classcheck_delete_students(uuid,uuid[]) from public,anon;
revoke all on function public.classcheck_delete_class(uuid) from public,anon;
revoke all on function public.classcheck_set_sf2_baseline(uuid,integer,integer) from public,anon;
revoke all on function public.classcheck_sync_attendance(jsonb,jsonb) from public,anon;

grant execute on function public.classcheck_create_class(text,text) to authenticated;
grant execute on function public.classcheck_join_class(text,text) to authenticated;
grant execute on function public.classcheck_leave_class(uuid) to authenticated;
grant execute on function public.classcheck_set_class_archived(uuid,boolean) to authenticated;
grant execute on function public.classcheck_add_student(uuid,text,text,text,text,text,text) to authenticated;
grant execute on function public.classcheck_import_students(uuid,jsonb) to authenticated;
grant execute on function public.classcheck_delete_students(uuid,uuid[]) to authenticated;
grant execute on function public.classcheck_delete_class(uuid) to authenticated;
grant execute on function public.classcheck_set_sf2_baseline(uuid,integer,integer) to authenticated;
grant execute on function public.classcheck_sync_attendance(jsonb,jsonb) to authenticated;

commit;
