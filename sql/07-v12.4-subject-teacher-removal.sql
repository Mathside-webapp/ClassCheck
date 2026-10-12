-- ClassCheck V12.4 (safe migration: adds adviser-only teacher-removal RPC)
-- Removes membership AND the member's own attendance only from the specified class.
CREATE OR REPLACE FUNCTION public.classcheck_remove_subject_teacher(
    p_class_id uuid, p_teacher_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_removed integer := 0;
  v_records integer := 0;
  v_sessions integer := 0;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.classcheck_classes c
     WHERE c.id=p_class_id AND c.teacher_id=(SELECT auth.uid())
  ) THEN RAISE EXCEPTION 'Only this class adviser can remove joined teachers.'; END IF;
  IF p_teacher_id = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'The class adviser cannot be removed as a subject teacher.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.classcheck_class_teachers m
     WHERE m.class_id=p_class_id AND m.teacher_id=p_teacher_id
  ) THEN RAISE EXCEPTION 'That subject teacher is not joined to this class.'; END IF;

  DELETE FROM public.classcheck_attendance_records r
    WHERE r.class_id=p_class_id AND r.teacher_id=p_teacher_id;
  GET DIAGNOSTICS v_records=ROW_COUNT;
  DELETE FROM public.classcheck_attendance_sessions s
    WHERE s.class_id=p_class_id AND s.teacher_id=p_teacher_id;
  GET DIAGNOSTICS v_sessions=ROW_COUNT;
  -- Cascades any adviser-attendance access granted to this teacher.
  DELETE FROM public.classcheck_class_teachers m
    WHERE m.class_id=p_class_id AND m.teacher_id=p_teacher_id;
  GET DIAGNOSTICS v_removed=ROW_COUNT;
  IF v_removed <> 1 THEN RAISE EXCEPTION 'Unable to remove teacher from class.'; END IF;
  RETURN jsonb_build_object('removed',true,'records_deleted',v_records,'sessions_deleted',v_sessions);
END;$$;
REVOKE ALL ON FUNCTION public.classcheck_remove_subject_teacher(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classcheck_remove_subject_teacher(uuid,uuid) TO authenticated;
