-- Apply after existing migrations 01–07. Uses existing tables and authorization.
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
    on conflict(class_id,teacher_id,student_id,attendance_date) do update set status=excluded.status,note=excluded.note,subject=excluded.subject,client_updated_at=excluded.client_updated_at,updated_at=now() where excluded.client_updated_at >= coalesce(classcheck_attendance_records.client_updated_at,'-infinity'::timestamptz);
    v_records:=v_records+1;
  end loop;
  for s in select * from jsonb_to_recordset(p_sessions) as x(class_id uuid,attendance_date date,session_status text,notes text,subject text,client_updated_at timestamptz) loop
    if not classcheck_private.can_access_class(s.class_id) then raise exception 'You do not have access to this class.'; end if;
    insert into public.classcheck_attendance_sessions(teacher_id,class_id,attendance_date,session_status,notes,subject,client_updated_at)
    values(v_uid,s.class_id,s.attendance_date,case when s.session_status in ('draft','completed') then s.session_status else 'completed' end,s.notes,coalesce(nullif(btrim(s.subject),''),'Advisory'),coalesce(s.client_updated_at,now()))
    on conflict(class_id,teacher_id,attendance_date) do update set session_status=excluded.session_status,notes=excluded.notes,subject=excluded.subject,client_updated_at=excluded.client_updated_at,updated_at=now() where excluded.client_updated_at >= coalesce(classcheck_attendance_sessions.client_updated_at,'-infinity'::timestamptz);
    v_sessions:=v_sessions+1;
  end loop;
  return jsonb_build_object('records',v_records,'sessions',v_sessions);
end $$;


revoke all on function public.classcheck_sync_attendance(jsonb,jsonb) from public,anon;
grant execute on function public.classcheck_sync_attendance(jsonb,jsonb) to authenticated;
