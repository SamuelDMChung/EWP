-- EWP Management Portal V1.11 WEB — incremental Sales Requests upgrade.
-- Run after V1.10 Sales Requests SQL and (if previously applied) its hotfix.
-- Idempotent. Existing requests are preserved; legacy Spruce Codes remain NULL.
BEGIN;

ALTER TABLE public.sales_requests ADD COLUMN IF NOT EXISTS spruce_code text;
-- Existing records may not have a Spruce Code. Check non-NULL values for quality.
ALTER TABLE public.sales_requests DROP CONSTRAINT IF EXISTS sales_requests_spruce_code_format;
ALTER TABLE public.sales_requests ADD CONSTRAINT sales_requests_spruce_code_format
  CHECK (spruce_code IS NULL OR (length(btrim(spruce_code)) BETWEEN 1 AND 80));

-- Shared Tasks are stored as JSONB, not text[]; append ATS without overwriting names.
UPDATE public.tracker_settings
SET tasks=COALESCE(tasks,'[]'::jsonb) || '["ATS"]'::jsonb
WHERE id='global' AND NOT (COALESCE(tasks,'[]'::jsonb) ? 'ATS');

-- Corrects the V1.10 validation-array bug and mandates Spruce Code on all NEW submissions.
CREATE OR REPLACE FUNCTION public.sales_validate_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE opts public.tracker_settings%ROWTYPE;
BEGIN
  NEW.created_by_email:=coalesce((SELECT email FROM auth.users WHERE id=NEW.created_by),'');
  IF NEW.spruce_code IS NULL OR length(btrim(NEW.spruce_code)) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Spruce Code is mandatory (maximum 80 characters).';
  END IF;
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
COMMIT;
