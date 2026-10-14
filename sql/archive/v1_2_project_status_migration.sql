-- EWP Management Portal V1.2 — required one-time, non-destructive migration
-- Run in your EXISTING Supabase SQL Editor BEFORE deploying the V1.2 frontend.
-- Requires V1.0 Phase 2 migration already installed. Do NOT rerun prior migrations.
-- Keeps all Forecast tables, levels, materials, work items, assignments, and TC counters intact.
BEGIN;

-- One unified PROJECT status. Existing work items remain for assignment/task metadata;
-- their legacy status no longer drives the Board or Follow-up.
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS tracker_status text;

-- Reconcile historic statuses only for project rows with no explicit project status.
-- Critically: old Done means drawing tasks finished, NOT that the job is fully
-- delivered. Map all-Done projects to In Review for manual verification.
UPDATE public.projects p
SET tracker_status = CASE
  WHEN EXISTS (SELECT 1 FROM public.tracker_work_items w WHERE w.project_id=p.id AND w.status='in_progress')
    THEN 'in_progress'
  WHEN EXISTS (SELECT 1 FROM public.tracker_work_items w WHERE w.project_id=p.id)
       AND NOT EXISTS (SELECT 1 FROM public.tracker_work_items w WHERE w.project_id=p.id AND w.status <> 'done')
    THEN 'in_review'
  ELSE 'queue'
END
WHERE p.tracker_status IS NULL;

ALTER TABLE public.projects ALTER COLUMN tracker_status SET DEFAULT 'queue';
ALTER TABLE public.projects ALTER COLUMN tracker_status SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid='public.projects'::regclass AND conname='tracker_project_status_v12_check') THEN
    ALTER TABLE public.projects ADD CONSTRAINT tracker_project_status_v12_check
      CHECK (tracker_status IN ('queue','in_progress','pending','in_review','delivering','completed'));
  END IF;
END $$;

-- Transactional, version-checked status change. This updates the ONE project status,
-- not individual work-item statuses, and preserves the shared Forecast record.
CREATE OR REPLACE FUNCTION public.tracker_set_project_status(
  p_id uuid, p_status text, p_expected_version integer
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_version integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF p_status NOT IN ('queue','in_progress','pending','in_review','delivering','completed') THEN
    RAISE EXCEPTION 'Invalid project status';
  END IF;
  SELECT version INTO v_version FROM public.projects WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
  IF v_version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'This project changed in another session. Refresh and try again.';
  END IF;
  UPDATE public.projects
  SET tracker_status=p_status, version=version+1, updated_at=now()
  WHERE id=p_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.tracker_set_project_status(uuid,text,integer) TO authenticated;

COMMIT;

-- Safe verification:
-- SELECT tracker_status, count(*) FROM public.projects GROUP BY tracker_status ORDER BY tracker_status;
-- SELECT project_number,tracker_status FROM public.projects ORDER BY project_number LIMIT 25;
