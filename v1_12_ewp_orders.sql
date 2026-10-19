-- EWP Management Portal V1.12 WEB — additive SQL for existing Supabase project.
-- Prerequisite: V1.10 Sales Requests SQL. V1.11 may or may not have been applied.
-- Back up the database first. Safe to re-run; preserves historical Spruce Code values.
BEGIN;

-- V1.11 compatibility: ATS is a shared Settings task even when V1.11 was skipped.
UPDATE public.tracker_settings
SET tasks = coalesce(tasks, '[]'::jsonb) || '["ATS"]'::jsonb
WHERE id='global' AND NOT (coalesce(tasks, '[]'::jsonb) ? 'ATS');

-- Replaces either V1.10 or V1.11 validation function. Never requires Spruce Code
-- for New EWP Requests. If the V1.11 column exists, it remains nullable for history.
-- Also fixes V1.10 JSONB settings validation (tasks/sales are JSONB; phases text[]).
CREATE OR REPLACE FUNCTION public.sales_validate_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE opts public.tracker_settings%ROWTYPE;
BEGIN
  NEW.created_by_email := coalesce((SELECT email FROM auth.users WHERE id=NEW.created_by),'');
  SELECT * INTO opts FROM public.tracker_settings WHERE id='global';
  IF NOT FOUND THEN RAISE EXCEPTION 'Shared Tracking Settings are not configured.'; END IF;
  IF NOT (opts.sales ? NEW.sales) THEN RAISE EXCEPTION 'Sales is not in current Settings.'; END IF;
  IF NOT (NEW.phase=ANY(opts.phases)) THEN RAISE EXCEPTION 'Phase is not in current Settings.'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(NEW.tasks) AS selected(task_name)
    WHERE selected.task_name IS NULL OR NOT (opts.tasks ? selected.task_name)) THEN
    RAISE EXCEPTION 'One or more Tasks are not in current Settings.';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.attachments) AS a WHERE
    NOT (a ? 'path' AND a ? 'name' AND a ? 'size') OR
    (a->>'path') NOT LIKE (NEW.created_by::text || '/' || NEW.id::text || '/%')
  ) THEN RAISE EXCEPTION 'Attachment path does not match request and submitter.'; END IF;
  RETURN NEW;
END; $$;

-- EWP Order is intentionally independent of Project Tracking and Forecast.
CREATE TABLE IF NOT EXISTS public.ewp_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_by_email text NOT NULL DEFAULT '',
  layout_status text NOT NULL CHECK (layout_status IN (
    'Reviewed','Not Reviewed - Proceed with liability on Customer')),
  spruce_code text NOT NULL CHECK (length(btrim(spruce_code)) BETWEEN 1 AND 80),
  jobsite_address text NOT NULL CHECK (length(btrim(jobsite_address)) BETWEEN 1 AND 240),
  level text NOT NULL CHECK (length(btrim(level)) BETWEEN 1 AND 120),
  ship_date date NOT NULL,
  ship_time time without time zone NOT NULL CHECK (
    ship_time >= time '06:00' AND ship_time <= time '17:00'
    AND EXTRACT(minute FROM ship_time) IN (0,30)
    AND EXTRACT(second FROM ship_time) = 0),
  truck_type text NOT NULL CHECK (truck_type IN ('COS','LR HIAB','Regular HIAB','Customer Pick-up')),
  po_number text NOT NULL DEFAULT '' CHECK (length(po_number) <= 120),
  authorized_buyer text NOT NULL CHECK (length(btrim(authorized_buyer)) BETWEEN 1 AND 160),
  special_notes text NOT NULL DEFAULT '' CHECK (length(special_notes) <= 5000),
  email_status text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending','sending','sent','failed')),
  email_attempts integer NOT NULL DEFAULT 0,
  email_last_error text,
  email_provider_id text,
  email_updated_at timestamptz,
  emailed_at timestamptz
);
CREATE INDEX IF NOT EXISTS ewp_orders_created_at_idx ON public.ewp_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS ewp_orders_email_pending_idx ON public.ewp_orders(email_status) WHERE email_status <> 'sent';

CREATE OR REPLACE FUNCTION public.ewp_order_validate_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- Verified by auth.uid() in the RLS INSERT policy; never trust browser-supplied email.
  NEW.created_by_email := coalesce((SELECT email FROM auth.users WHERE id=NEW.created_by),'');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS ewp_order_insert_validate ON public.ewp_orders;
CREATE TRIGGER ewp_order_insert_validate BEFORE INSERT ON public.ewp_orders
FOR EACH ROW EXECUTE FUNCTION public.ewp_order_validate_insert();

ALTER TABLE public.ewp_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ewp_orders_team_read ON public.ewp_orders;
CREATE POLICY ewp_orders_team_read ON public.ewp_orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ewp_orders_submit ON public.ewp_orders;
CREATE POLICY ewp_orders_submit ON public.ewp_orders FOR INSERT TO authenticated
WITH CHECK (created_by=auth.uid() AND email_status='pending' AND email_attempts=0
  AND email_last_error IS NULL AND email_provider_id IS NULL AND email_updated_at IS NULL AND emailed_at IS NULL);
-- No UPDATE/DELETE policies for browser users; the Edge Function uses service role.
REVOKE ALL ON public.ewp_orders FROM anon, PUBLIC;
GRANT SELECT,INSERT ON public.ewp_orders TO authenticated;

CREATE OR REPLACE FUNCTION public.ewp_order_claim_email(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.ewp_orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
  SELECT * INTO r FROM public.ewp_orders WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF r.email_attempts >= 5 OR NOT (
    r.email_status IN ('pending','failed') OR
    (r.email_status='sending' AND r.email_updated_at < now()-interval '5 minutes')
  ) THEN RETURN false; END IF;
  UPDATE public.ewp_orders SET email_status='sending', email_attempts=email_attempts+1,
    email_updated_at=now(),email_last_error=NULL WHERE id=p_id;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.ewp_order_claim_email(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ewp_order_claim_email(uuid) TO authenticated;
COMMIT;
