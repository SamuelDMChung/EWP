-- V1.36 WEB: authenticated-only SharePoint file-request link configuration.
-- Execute in Supabase SQL Editor after backing up configuration. No existing rows or app settings are modified.
-- This script intentionally contains NO file-request URL: the WEB source may be hosted in a public GitHub repository.
BEGIN;
CREATE TABLE IF NOT EXISTS public.ewp_sales_file_request (
  id text PRIMARY KEY CHECK (id='new_ewp_requests'),
  upload_url text NOT NULL CHECK (upload_url ~ '^https://[A-Za-z0-9.-]+[.]sharepoint[.]com/:f:/'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ewp_sales_file_request ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ewp_sales_file_request FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ewp_sales_file_request TO authenticated;
DROP POLICY IF EXISTS ewp_sales_file_request_employee_read ON public.ewp_sales_file_request;
CREATE POLICY ewp_sales_file_request_employee_read ON public.ewp_sales_file_request
  FOR SELECT TO authenticated USING (id='new_ewp_requests');
-- No authenticated INSERT, UPDATE or DELETE policies. Set URL using the SQL Editor only.
COMMIT;
