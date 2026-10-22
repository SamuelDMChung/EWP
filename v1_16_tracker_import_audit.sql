-- V1.16 WEB — audit register for the one-time Scheduling Log stress-test import.
-- Creates a rollback-safe marker for imported projects only; the project's actual
-- type uses existing tracker_project_type (no new type CHECK/constraint is needed).
-- Run after the existing Phase 2 Tracking schema. V1.15 color migration should
-- also be applied before publishing V1.16 WEB. No Forecast materials are created.
BEGIN;
CREATE TABLE IF NOT EXISTS public.tracker_bulk_import_log (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  batch_key text NOT NULL,
  source_project_type text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tracker_bulk_import_log_batch_idx
  ON public.tracker_bulk_import_log(batch_key);
ALTER TABLE public.tracker_bulk_import_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tracker_bulk_import_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tracker_bulk_import_log TO authenticated;
DROP POLICY IF EXISTS tracker_bulk_import_log_read ON public.tracker_bulk_import_log;
CREATE POLICY tracker_bulk_import_log_read ON public.tracker_bulk_import_log
  FOR SELECT TO authenticated USING (true);
COMMIT;
-- To audit the batch without altering anything:
-- SELECT p.project_number, p.tracker_project_type, p.tracker_status,
--        l.source_project_type
-- FROM public.tracker_bulk_import_log l
-- JOIN public.projects p ON p.id = l.project_id
-- WHERE l.batch_key = 'scheduling-log-2026-v116'
-- ORDER BY p.project_number;
-- To roll back ONLY if desired, inspect related records/new edits first.
-- Never delete by project-number range: other live projects may share the range.
