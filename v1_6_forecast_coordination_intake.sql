-- V1.6 WEB — RUN ONCE after previous installed Tracker migrations, BEFORE deploying the web code.
-- Back up Supabase first. This changes only the placeholder-work-item INSERT trigger.
-- Forecast inserts explicitly mark new projects tracker_status='delivering'; such
-- projects have no pre-layout tasks. Tracker-created projects still start in Queue.
-- Existing projects / statuses / work items / forecasts are not modified.
BEGIN;
CREATE OR REPLACE FUNCTION public.tracker_initialize_work_item()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  IF NEW.tracker_status = 'delivering' AND NEW.tracker_phase IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.tracker_work_items(project_id,task,status)
  VALUES (NEW.id,'Assign task','queue');
  RETURN NEW;
END;
$$;
COMMIT;
-- Confirm installed (read-only):
-- SELECT pg_get_functiondef('public.tracker_initialize_work_item()'::regprocedure);
