-- ClassCheck V12.2 — Shared read-only attendance, adviser-only official SF2
-- Run on the separate CLASSCHECK Supabase project (NOT Mathside / EduCore).
-- Does not delete, update, or reset any student/attendance records.
-- Existing INSERT/UPDATE/DELETE policies remain unchanged.
BEGIN;
CREATE SCHEMA IF NOT EXISTS classcheck_private;
REVOKE ALL ON SCHEMA classcheck_private FROM PUBLIC;
GRANT USAGE ON SCHEMA classcheck_private TO authenticated;

-- SECURITY DEFINER avoids recursion in the memberships table's RLS policy.
CREATE OR REPLACE FUNCTION classcheck_private.can_view_shared_class(p_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classcheck_classes c
    WHERE c.id=p_class_id AND (
      c.teacher_id=(SELECT auth.uid()) OR
      EXISTS (SELECT 1 FROM public.classcheck_class_teachers m
              WHERE m.class_id=c.id AND m.teacher_id=(SELECT auth.uid()))
    )
  );
$$;
REVOKE ALL ON FUNCTION classcheck_private.can_view_shared_class(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION classcheck_private.can_view_shared_class(uuid) TO authenticated;

ALTER TABLE public.classcheck_class_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classcheck_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classcheck_attendance_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS classcheck_shared_class_memberships_read_v122 ON public.classcheck_class_teachers;
CREATE POLICY classcheck_shared_class_memberships_read_v122
ON public.classcheck_class_teachers FOR SELECT TO authenticated
USING (classcheck_private.can_view_shared_class(class_id));

DROP POLICY IF EXISTS classcheck_shared_attendance_read_v122 ON public.classcheck_attendance_records;
CREATE POLICY classcheck_shared_attendance_read_v122
ON public.classcheck_attendance_records FOR SELECT TO authenticated
USING (classcheck_private.can_view_shared_class(class_id));

DROP POLICY IF EXISTS classcheck_shared_sessions_read_v122 ON public.classcheck_attendance_sessions;
CREATE POLICY classcheck_shared_sessions_read_v122
ON public.classcheck_attendance_sessions FOR SELECT TO authenticated
USING (classcheck_private.can_view_shared_class(class_id));

GRANT SELECT ON public.classcheck_class_teachers TO authenticated;
GRANT SELECT ON public.classcheck_attendance_records TO authenticated;
GRANT SELECT ON public.classcheck_attendance_sessions TO authenticated;
COMMIT;
