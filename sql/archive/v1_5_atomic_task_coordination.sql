-- EWP Management Portal V1.5 WEB — run once in the EXISTING Supabase SQL Editor.
-- Requires all prior V1.2 / V1.4 migrations. Take a backup before running.
-- No new tables, columns or separate Forecast data. Replaces only the existing
-- tracker_move_work_item RPC and reconciles legacy all-Done active projects.
-- The project row is locked BEFORE the selected task to serialize concurrent moves.
BEGIN;
CREATE OR REPLACE FUNCTION public.tracker_move_work_item(p_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE
  v_project_id uuid;
  v_project_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF p_status NOT IN ('queue','in_progress','done') THEN RAISE EXCEPTION 'Invalid task status'; END IF;
  SELECT project_id INTO v_project_id
    FROM public.tracker_work_items WHERE id=p_id;
  IF v_project_id IS NULL THEN RAISE EXCEPTION 'Work item no longer exists'; END IF;
  SELECT tracker_status INTO v_project_status FROM public.projects
    WHERE id=v_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project no longer exists'; END IF;
  IF v_project_status NOT IN ('queue','in_progress') THEN
    RAISE EXCEPTION 'Project is in Coordination or Completed. Reopen the project first';
  END IF;
  PERFORM 1 FROM public.tracker_work_items
    WHERE id=p_id AND project_id=v_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Work item no longer exists'; END IF;
  UPDATE public.tracker_work_items
  SET status=p_status, updated_at=now(),
      started_at=CASE WHEN p_status='in_progress' THEN COALESCE(started_at,now()) ELSE started_at END,
      completed_at=CASE WHEN p_status='done' THEN now() ELSE NULL END
  WHERE id=p_id;
  UPDATE public.projects
  SET tracker_status = CASE
        WHEN EXISTS (SELECT 1 FROM public.tracker_work_items w WHERE w.project_id=v_project_id)
         AND NOT EXISTS (SELECT 1 FROM public.tracker_work_items w WHERE w.project_id=v_project_id AND w.status <> 'done')
          THEN 'in_review'
        WHEN EXISTS (SELECT 1 FROM public.tracker_work_items w WHERE w.project_id=v_project_id AND w.status IN ('in_progress','done'))
          THEN 'in_progress'
        ELSE 'queue'
      END,
      updated_at=now(), version=version+1
  WHERE id=v_project_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.tracker_move_work_item(uuid,text) TO authenticated;
-- V1.4 allowed every task to reach Done while the project remained active.
-- Carry those already-complete linked tasks into a single In Review card.
UPDATE public.projects p
SET tracker_status='in_review', updated_at=now(), version=version+1
WHERE p.tracker_status IN ('queue','in_progress')
  AND EXISTS (SELECT 1 FROM public.tracker_work_items w WHERE w.project_id=p.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.tracker_work_items w
    WHERE w.project_id=p.id AND w.status <> 'done'
  );
COMMIT;
-- Optional read-only review:
-- SELECT p.project_number,p.tracker_status,count(w.id) AS tasks
-- FROM public.projects p JOIN public.tracker_work_items w ON w.project_id=p.id
-- GROUP BY p.id,p.project_number,p.tracker_status ORDER BY p.project_number;
