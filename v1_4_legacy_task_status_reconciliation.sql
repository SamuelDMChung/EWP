-- EWP Management Portal V1.4 -- ONE-TIME legacy status reconciliation.
-- Apply BEFORE deploying V1.4 web to preserve V1.3 active project placement.
-- Requires the existing V1.2 tracker_status column and V1.0 tracker_work_items table.
-- No data/table deletion, no forecast tables touched, no new policies/RPCs.
--
-- Background: V1.2/V1.3 kept a unified project.status on projects while
-- legacy independent tracker_work_items.status could remain 'queue' after an
-- entire project was moved to In Progress. V1.4 displays cards by work item.
-- In projects where EVERY work item still says queue, inherit the current
-- project's In Progress state as their starting independent task statuses.
-- A project with at least one already-progressed/completed task is untouched.
-- Projects already in Coordination/Completed are untouched.
--
-- Optional preview before running:
-- SELECT p.project_number, p.tracker_status, COUNT(*) AS legacy_queued_tasks
-- FROM public.projects p JOIN public.tracker_work_items w ON w.project_id=p.id
-- WHERE p.tracker_status='in_progress'
-- GROUP BY p.id,p.project_number,p.tracker_status
-- HAVING BOOL_AND(w.status='queue');

BEGIN;
WITH legacy_projects AS (
  SELECT p.id
  FROM public.projects p
  JOIN public.tracker_work_items w ON w.project_id=p.id
  WHERE p.tracker_status='in_progress'
  GROUP BY p.id
  HAVING BOOL_AND(w.status='queue')
)
UPDATE public.tracker_work_items w
SET status='in_progress',
    started_at=COALESCE(w.started_at,NOW()),
    completed_at=NULL,
    updated_at=NOW()
FROM legacy_projects lp
WHERE w.project_id=lp.id
  AND w.status='queue';
COMMIT;

-- Check after migration:
-- SELECT p.project_number, w.task, w.status, p.tracker_status
-- FROM public.projects p JOIN public.tracker_work_items w ON w.project_id=p.id
-- ORDER BY p.project_number,w.task;
