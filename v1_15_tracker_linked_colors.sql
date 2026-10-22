-- EWP Management Portal V1.15 WEB — shared linked-task ticket colors.
-- Run AFTER all required earlier migrations, including V1.13/V1.14 as applicable.
-- Does not modify existing projects, work items, inventory, or mail functions.
-- The allocation is 1..20; a slot is recycled only after a project has no
-- unfinished tasks or it leaves Queue/In Progress/partial Coordination.
-- READ THE V1.15 PORTAL_HANDOFF.md before deployment.
BEGIN;

CREATE TABLE IF NOT EXISTS public.tracker_active_colors (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  color_index smallint NOT NULL UNIQUE CHECK (color_index BETWEEN 1 AND 20),
  assigned_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tracker_active_colors_assigned_idx
  ON public.tracker_active_colors(assigned_at);

-- Team members may READ assignments. Allocation/recycling is exclusively RPC-
-- controlled; clients cannot take a color or overwrite another project's color.
ALTER TABLE public.tracker_active_colors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tracker_active_colors FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tracker_active_colors TO authenticated;
DROP POLICY IF EXISTS tracker_active_colors_team_read ON public.tracker_active_colors;
CREATE POLICY tracker_active_colors_team_read ON public.tracker_active_colors
  FOR SELECT TO authenticated USING (true);

-- Serialize each reconciliation across employees/tabs. Unlike browser-side color
-- hashing, this guarantees no two active projects use the same slot. The frontend
-- calls this before every Tracker refresh (including after status changes).
-- No triggers change the existing project status/coordination workflow.
CREATE OR REPLACE FUNCTION public.tracker_sync_active_colors()
RETURNS TABLE(project_id uuid, color_index integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_project record;
  v_available smallint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;

  PERFORM pg_advisory_xact_lock(2026, 11501);

  -- Remove only stale color reservations. Partly delivered / task-level Done
  -- projects retain their reservation until every task is Done and merged into
  -- Coordination. 1-task and Forecast-only projects never get a color.
  DELETE FROM public.tracker_active_colors AS a
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.projects AS p
    JOIN public.tracker_work_items AS w ON w.project_id = p.id
    WHERE p.id = a.project_id
      AND coalesce(p.tracker_status, 'queue') NOT IN
          ('pending', 'in_review', 'delivering', 'completed', 'coordination', 'done')
    GROUP BY p.id
    HAVING count(w.id) >= 2
       AND count(w.id) FILTER (WHERE w.status <> 'done') > 0
  );

  -- Earliest created active linked project gets the lowest free color index.
  -- Previously assigned ACTIVE projects are not recolored. Reopened projects
  -- receive the next available color (possibly a recycled index).
  FOR v_project IN
    SELECT p.id
    FROM public.projects AS p
    JOIN public.tracker_work_items AS w ON w.project_id = p.id
    WHERE coalesce(p.tracker_status, 'queue') NOT IN
          ('pending', 'in_review', 'delivering', 'completed', 'coordination', 'done')
    GROUP BY p.id, p.created_at
    HAVING count(w.id) >= 2
       AND count(w.id) FILTER (WHERE w.status <> 'done') > 0
    ORDER BY p.created_at NULLS LAST, p.id
  LOOP
    IF EXISTS (SELECT 1 FROM public.tracker_active_colors AS a
               WHERE a.project_id = v_project.id) THEN
      CONTINUE;
    END IF;

    SELECT n::smallint INTO v_available
    FROM generate_series(1,20) AS available(n)
    WHERE NOT EXISTS (SELECT 1 FROM public.tracker_active_colors AS a
                      WHERE a.color_index = n)
    ORDER BY n LIMIT 1;
    -- Preserve the 20 unique-color guarantee. If there are >20 simultaneous
    -- active linked projects, any extra projects retain a neutral border until
    -- one of the 20 slots becomes free on a subsequent refresh.
    EXIT WHEN v_available IS NULL;

    INSERT INTO public.tracker_active_colors(project_id, color_index)
      VALUES (v_project.id, v_available);
  END LOOP;

  RETURN QUERY
    SELECT a.project_id, a.color_index::integer
    FROM public.tracker_active_colors AS a
    ORDER BY a.color_index;
END;
$$;

REVOKE ALL ON FUNCTION public.tracker_sync_active_colors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tracker_sync_active_colors() TO authenticated;

COMMIT;

-- Non-destructive validation after deployment:
-- SELECT to_regclass('public.tracker_active_colors');
-- SELECT to_regprocedure('public.tracker_sync_active_colors()');
-- SELECT color_index, count(*) FROM public.tracker_active_colors
-- GROUP BY color_index HAVING count(*) > 1;   -- expects 0 rows
-- Function must be called while authenticated (e.g., from the WEB Tracker).
