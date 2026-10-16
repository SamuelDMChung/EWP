-- V1.10 WEB: incremental Sales Request setup. Run ONCE in the existing company Supabase SQL editor.
-- Does not overwrite or delete current Tracking / Forecast data.
BEGIN;

-- Shared Phase list so Sales and Project Tracking can reuse the same options.
ALTER TABLE public.tracker_settings ADD COLUMN IF NOT EXISTS phases text[] NOT NULL DEFAULT ARRAY['Awarded','Bidding']::text[];
UPDATE public.tracker_settings SET phases=ARRAY['Awarded','Bidding']::text[] WHERE phases IS NULL OR cardinality(phases)=0;

CREATE TABLE IF NOT EXISTS public.sales_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_by_email text NOT NULL DEFAULT '',
  customer text NOT NULL CHECK (length(btrim(customer)) BETWEEN 1 AND 160),
  address text NOT NULL CHECK (length(btrim(address)) BETWEEN 1 AND 240),
  sales text NOT NULL CHECK (length(btrim(sales)) BETWEEN 1 AND 120),
  phase text NOT NULL CHECK (length(btrim(phase)) BETWEEN 1 AND 120),
  tasks text[] NOT NULL CHECK (cardinality(tasks)>0 AND cardinality(tasks)<=30),
  due_date date NOT NULL,
  instructions text NOT NULL DEFAULT '' CHECK (length(instructions)<=5000),
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(attachments)='array' AND jsonb_array_length(attachments)<=30),
  email_status text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending','sending','sent','failed')),
  email_attempts integer NOT NULL DEFAULT 0,
  email_last_error text,
  email_provider_id text,
  email_updated_at timestamptz,
  emailed_at timestamptz
);
CREATE INDEX IF NOT EXISTS sales_requests_created_at_idx ON public.sales_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS sales_requests_email_pending_idx ON public.sales_requests(email_status) WHERE email_status <> 'sent';

-- Validate selections against the same settings lists as the Tracking interface.
CREATE OR REPLACE FUNCTION public.sales_validate_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE opts public.tracker_settings%ROWTYPE;
BEGIN
  -- Always attribute the request to its actual Supabase Auth account.
  NEW.created_by_email:=coalesce((SELECT email FROM auth.users WHERE id=NEW.created_by),'');
  SELECT * INTO opts FROM public.tracker_settings WHERE id='global';
  IF NOT FOUND THEN RAISE EXCEPTION 'Shared Tracking Settings are not configured.'; END IF;
  IF NOT (opts.sales ? NEW.sales) THEN RAISE EXCEPTION 'Sales is not in current Settings.'; END IF;
  IF NOT (NEW.phase=ANY(opts.phases)) THEN RAISE EXCEPTION 'Phase is not in current Settings.'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(NEW.tasks) AS selected(task_name) WHERE selected.task_name IS NULL OR NOT (opts.tasks ? selected.task_name)) THEN
    RAISE EXCEPTION 'One or more Tasks are not in current Settings.';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.attachments) AS a WHERE
    NOT (a ? 'path' AND a ? 'name' AND a ? 'size') OR
    (a->>'path') NOT LIKE (NEW.created_by::text || '/' || NEW.id::text || '/%')
  ) THEN RAISE EXCEPTION 'Attachment path does not match request and submitter.'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS sales_request_validate_insert ON public.sales_requests;
CREATE TRIGGER sales_request_validate_insert BEFORE INSERT ON public.sales_requests
FOR EACH ROW EXECUTE FUNCTION public.sales_validate_request();

ALTER TABLE public.sales_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sales_requests_team_read ON public.sales_requests;
CREATE POLICY sales_requests_team_read ON public.sales_requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS sales_requests_submit ON public.sales_requests;
CREATE POLICY sales_requests_submit ON public.sales_requests FOR INSERT TO authenticated
WITH CHECK (created_by=auth.uid() AND email_status='pending' AND email_attempts=0 AND email_last_error IS NULL
  AND email_provider_id IS NULL AND email_updated_at IS NULL AND emailed_at IS NULL);
-- No UPDATE/DELETE policy: browser clients cannot forge an email status or erase submissions.
REVOKE ALL ON public.sales_requests FROM anon,public;
GRANT SELECT,INSERT ON public.sales_requests TO authenticated;

-- Single safe concurrent claim per ID; lock + stale-claim recovery, browser never edits email status.
CREATE OR REPLACE FUNCTION public.sales_claim_email(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.sales_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
  SELECT * INTO r FROM public.sales_requests WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF r.email_attempts>=5 OR NOT (
    r.email_status IN ('pending','failed') OR
    (r.email_status='sending' AND r.email_updated_at < now()-interval '5 minutes')
  ) THEN RETURN false; END IF;
  UPDATE public.sales_requests SET email_status='sending',email_attempts=email_attempts+1,
     email_updated_at=now(),email_last_error=NULL WHERE id=p_id;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.sales_claim_email(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sales_claim_email(uuid) TO authenticated;

-- Private storage, authenticated employees can open team requests' files via short-lived signed links.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('ewp-sales-request-files','ewp-sales-request-files',false,10485760,ARRAY['application/pdf','image/png','image/jpeg'])
ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS sales_file_team_read ON storage.objects;
CREATE POLICY sales_file_team_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='ewp-sales-request-files');
DROP POLICY IF EXISTS sales_file_own_upload ON storage.objects;
CREATE POLICY sales_file_own_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='ewp-sales-request-files' AND (storage.foldername(name))[1]=auth.uid()::text);
-- Owners can remove only files they uploaded (e.g., an interrupted form submission).
DROP POLICY IF EXISTS sales_file_own_delete ON storage.objects;
CREATE POLICY sales_file_own_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='ewp-sales-request-files' AND (storage.foldername(name))[1]=auth.uid()::text);
COMMIT;
