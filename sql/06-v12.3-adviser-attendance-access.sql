-- ClassCheck V12.3 — adviser-controlled READ permission for adviser attendance.
-- Run only on your CLASSCHECK Supabase project, AFTER the V12.2 SQL.
-- Existing class, learner and attendance records remain unchanged.
-- Before running, review whether you have added custom attendance SELECT policies.
-- This migration adds a RESTRICTIVE RLS gate so older permissive sharing policies
-- cannot override the adviser's choice.

BEGIN;
CREATE SCHEMA IF NOT EXISTS classcheck_private;
REVOKE ALL ON SCHEMA classcheck_private FROM PUBLIC;
GRANT USAGE ON SCHEMA classcheck_private TO authenticated;

-- Only currently joined teachers can receive a grant. Leaving the class
-- automatically removes their permissions through this composite foreign key.
CREATE TABLE IF NOT EXISTS public.classcheck_adviser_attendance_access (
  class_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id,teacher_id),
  CONSTRAINT classcheck_adviser_access_member_fk
    FOREIGN KEY (class_id,teacher_id)
    REFERENCES public.classcheck_class_teachers(class_id,teacher_id)
    ON DELETE CASCADE
);
ALTER TABLE public.classcheck_adviser_attendance_access ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION classcheck_private.is_class_participant_v123(p_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classcheck_classes c
    WHERE c.id=p_class_id AND (
      c.teacher_id=(SELECT auth.uid()) OR EXISTS (
        SELECT 1 FROM public.classcheck_class_teachers m
        WHERE m.class_id=c.id AND m.teacher_id=(SELECT auth.uid())
      )
    )
  );
$$;
REVOKE ALL ON FUNCTION classcheck_private.is_class_participant_v123(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION classcheck_private.is_class_participant_v123(uuid) TO authenticated;

-- The adviser sees all grants; each joined teacher can read only their own grant.
DROP POLICY IF EXISTS classcheck_adviser_access_read_v123 ON public.classcheck_adviser_attendance_access;
CREATE POLICY classcheck_adviser_access_read_v123
ON public.classcheck_adviser_attendance_access
FOR SELECT TO authenticated
USING (
  classcheck_private.is_class_participant_v123(class_id)
  AND (
    teacher_id=(SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.classcheck_classes c
      WHERE c.id=class_id AND c.teacher_id=(SELECT auth.uid())
    )
  )
);
REVOKE ALL ON public.classcheck_adviser_attendance_access FROM PUBLIC, anon;
GRANT SELECT ON public.classcheck_adviser_attendance_access TO authenticated;
-- No direct INSERT/UPDATE/DELETE for browser clients: use the adviser-only RPC.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.classcheck_adviser_attendance_access FROM authenticated;

CREATE OR REPLACE FUNCTION public.classcheck_set_adviser_attendance_access(
  p_class_id uuid, p_teacher_id uuid, p_allowed boolean
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Sign in to change attendance access.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.classcheck_classes c
    WHERE c.id=p_class_id AND c.teacher_id=(SELECT auth.uid())
  ) THEN RAISE EXCEPTION 'Only this class adviser can change adviser attendance access.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.classcheck_class_teachers m
    WHERE m.class_id=p_class_id AND m.teacher_id=p_teacher_id
  ) THEN RAISE EXCEPTION 'The selected teacher has not joined this class.'; END IF;

  IF COALESCE(p_allowed,false) THEN
    INSERT INTO public.classcheck_adviser_attendance_access(class_id,teacher_id)
    VALUES(p_class_id,p_teacher_id)
    ON CONFLICT (class_id,teacher_id) DO NOTHING;
  ELSE
    DELETE FROM public.classcheck_adviser_attendance_access
    WHERE class_id=p_class_id AND teacher_id=p_teacher_id;
  END IF;
  RETURN COALESCE(p_allowed,false);
END;
$$;
REVOKE ALL ON FUNCTION public.classcheck_set_adviser_attendance_access(uuid,uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classcheck_set_adviser_attendance_access(uuid,uuid,boolean) TO authenticated;

-- This function checks both the viewer's active membership and attendance author.
-- Adviser (owner) -> all class attendance.
-- Joined subject teacher -> their own plus other CURRENT joined subject teachers.
-- Joined subject teacher -> adviser attendance only with an explicit adviser grant.
CREATE OR REPLACE FUNCTION classcheck_private.can_read_attendance_v123(
  p_class_id uuid,p_author_id uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classcheck_classes c
    WHERE c.id=p_class_id AND (
      c.teacher_id=(SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.classcheck_class_teachers viewer
        WHERE viewer.class_id=c.id AND viewer.teacher_id=(SELECT auth.uid())
          AND (
            (
              p_author_id<>c.teacher_id AND EXISTS (
                SELECT 1 FROM public.classcheck_class_teachers author
                WHERE author.class_id=c.id AND author.teacher_id=p_author_id
              )
            ) OR (
              p_author_id=c.teacher_id AND EXISTS (
                SELECT 1 FROM public.classcheck_adviser_attendance_access allowed
                WHERE allowed.class_id=c.id AND allowed.teacher_id=viewer.teacher_id
              )
            )
          )
      )
    )
  );
$$;
REVOKE ALL ON FUNCTION classcheck_private.can_read_attendance_v123(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION classcheck_private.can_read_attendance_v123(uuid,uuid) TO authenticated;

ALTER TABLE public.classcheck_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classcheck_attendance_sessions ENABLE ROW LEVEL SECURITY;

-- Remove the V12.2 open-sharing read policies. Their replacement AND a
-- RESTRICTIVE gate are created below. Any older SELECT policy cannot bypass it.
DROP POLICY IF EXISTS classcheck_shared_attendance_read_v122 ON public.classcheck_attendance_records;
DROP POLICY IF EXISTS classcheck_shared_sessions_read_v122 ON public.classcheck_attendance_sessions;

DROP POLICY IF EXISTS classcheck_attendance_read_v123 ON public.classcheck_attendance_records;
CREATE POLICY classcheck_attendance_read_v123
ON public.classcheck_attendance_records AS PERMISSIVE
FOR SELECT TO authenticated
USING (classcheck_private.can_read_attendance_v123(class_id,teacher_id));
DROP POLICY IF EXISTS classcheck_attendance_gate_v123 ON public.classcheck_attendance_records;
CREATE POLICY classcheck_attendance_gate_v123
ON public.classcheck_attendance_records AS RESTRICTIVE
FOR SELECT TO authenticated
USING (classcheck_private.can_read_attendance_v123(class_id,teacher_id));

DROP POLICY IF EXISTS classcheck_sessions_read_v123 ON public.classcheck_attendance_sessions;
CREATE POLICY classcheck_sessions_read_v123
ON public.classcheck_attendance_sessions AS PERMISSIVE
FOR SELECT TO authenticated
USING (classcheck_private.can_read_attendance_v123(class_id,teacher_id));
DROP POLICY IF EXISTS classcheck_sessions_gate_v123 ON public.classcheck_attendance_sessions;
CREATE POLICY classcheck_sessions_gate_v123
ON public.classcheck_attendance_sessions AS RESTRICTIVE
FOR SELECT TO authenticated
USING (classcheck_private.can_read_attendance_v123(class_id,teacher_id));

GRANT SELECT ON public.classcheck_attendance_records TO authenticated;
GRANT SELECT ON public.classcheck_attendance_sessions TO authenticated;
COMMIT;
