-- EWP Portal V1.38 — staged, identity-bound TOTP enrollment/approval.
-- SAFE STAGING: adds private metadata and restricted authenticated RPCs;
-- does not alter existing RLS, user accounts, MFA factors, or enable mandatory MFA.
-- DO NOT enable enforcement until the administrator is verified, enrolled and approved.
BEGIN;
CREATE SCHEMA IF NOT EXISTS ewp_private;
REVOKE ALL ON SCHEMA ewp_private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS ewp_private.mfa_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ewp_private.mfa_enrollments (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  factor_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','revoked')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz
);
CREATE TABLE IF NOT EXISTS ewp_private.mfa_control (
  id smallint PRIMARY KEY CHECK (id=1),
  enforcement_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO ewp_private.mfa_control(id,enforcement_enabled) VALUES (1,false) ON CONFLICT DO NOTHING;
ALTER TABLE ewp_private.mfa_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE ewp_private.mfa_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ewp_private.mfa_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA ewp_private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION ewp_private.is_admin(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM ewp_private.mfa_admins a WHERE a.user_id = p_user);
$$;
CREATE OR REPLACE FUNCTION ewp_private.verified_approved() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT COALESCE((SELECT auth.jwt()->>'aal')='aal2',false)
   AND EXISTS (
     SELECT 1 FROM ewp_private.mfa_enrollments e
     JOIN auth.mfa_factors f ON f.id=e.factor_id AND f.user_id=e.user_id
     WHERE e.user_id=(SELECT auth.uid()) AND e.status='approved' AND f.status='verified' AND f.factor_type='totp'
   )
   AND (SELECT count(*) FROM auth.mfa_factors f WHERE f.user_id=(SELECT auth.uid()) AND f.status='verified')=1;
$$;
CREATE OR REPLACE FUNCTION ewp_private.access_allowed() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT COALESCE((SELECT NOT enforcement_enabled FROM ewp_private.mfa_control WHERE id=1),true)
 OR ewp_private.verified_approved();
$$;

-- Authenticated user's own status only. No admin/user list or TOTP secrets are exposed.
CREATE OR REPLACE FUNCTION public.ewp_mfa_status() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT CASE WHEN (SELECT auth.uid()) IS NULL THEN NULL ELSE jsonb_build_object(
  'is_admin', ewp_private.is_admin((SELECT auth.uid())),
  'status', COALESCE((SELECT e.status FROM ewp_private.mfa_enrollments e WHERE e.user_id=(SELECT auth.uid())),'not_enrolled'),
  'factor_id', (SELECT e.factor_id FROM ewp_private.mfa_enrollments e WHERE e.user_id=(SELECT auth.uid())),
  'enforcement_enabled', COALESCE((SELECT c.enforcement_enabled FROM ewp_private.mfa_control c WHERE c.id=1),false),
  'allowed', ewp_private.access_allowed(),
  'verified_factor_count', (SELECT count(*) FROM auth.mfa_factors f WHERE f.user_id=(SELECT auth.uid()) AND f.status='verified')
 ) END;
$$;

-- A signed-in user may request approval only for their own verified TOTP factor.
-- A previously approved factor cannot be replaced via this RPC.
CREATE OR REPLACE FUNCTION public.ewp_mfa_submit(p_factor_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller uuid := (SELECT auth.uid());
BEGIN
 IF caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 IF (SELECT count(*) FROM auth.mfa_factors f WHERE f.user_id=caller AND f.status='verified') <> 1 THEN
   RAISE EXCEPTION 'Exactly one verified authenticator is required. Contact the administrator for a reset.';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.mfa_factors f WHERE f.user_id=caller AND f.id=p_factor_id AND f.status='verified' AND f.factor_type='totp') THEN
   RAISE EXCEPTION 'The authenticator has not been verified for this user.';
 END IF;
 IF EXISTS(SELECT 1 FROM ewp_private.mfa_enrollments e WHERE e.user_id=caller AND e.status='approved') THEN
   RAISE EXCEPTION 'Your approved authenticator can only be changed through the administrator.';
 END IF;
 INSERT INTO ewp_private.mfa_enrollments(user_id,factor_id,status,submitted_at,reviewed_by,reviewed_at)
 VALUES (caller,p_factor_id,'pending',now(),NULL,NULL)
 ON CONFLICT (user_id) DO UPDATE SET factor_id=EXCLUDED.factor_id,status='pending',submitted_at=now(),reviewed_by=NULL,reviewed_at=NULL;
END; $$;

-- Administrators may only see pending factor requests after proving THEIR approved MFA.
CREATE OR REPLACE FUNCTION public.ewp_mfa_pending() RETURNS TABLE (user_id uuid, email text, factor_id uuid, submitted_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT ewp_private.is_admin((SELECT auth.uid())) OR NOT ewp_private.verified_approved()
    OR (SELECT auth.jwt()->>'aal') <> 'aal2' THEN RAISE EXCEPTION 'Administrator MFA verification is required.'; END IF;
 RETURN QUERY SELECT e.user_id,u.email::text,e.factor_id,e.submitted_at
 FROM ewp_private.mfa_enrollments e JOIN auth.users u ON u.id=e.user_id
 JOIN auth.mfa_factors f ON f.id=e.factor_id AND f.user_id=e.user_id AND f.status='verified'
 WHERE e.status='pending' ORDER BY e.submitted_at;
END; $$;
CREATE OR REPLACE FUNCTION public.ewp_mfa_decide(p_user_id uuid,p_factor_id uuid,p_approve boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller uuid := (SELECT auth.uid());
BEGIN
 IF NOT ewp_private.is_admin(caller) OR NOT ewp_private.verified_approved()
    OR (SELECT auth.jwt()->>'aal') <> 'aal2' THEN RAISE EXCEPTION 'Administrator MFA verification required.'; END IF;
 IF caller = p_user_id THEN RAISE EXCEPTION 'Self-approval is not permitted.'; END IF;
 IF p_approve AND (
   NOT EXISTS(SELECT 1 FROM auth.mfa_factors f WHERE f.id=p_factor_id AND f.user_id=p_user_id AND f.status='verified' AND f.factor_type='totp')
   OR (SELECT count(*) FROM auth.mfa_factors f WHERE f.user_id=p_user_id AND f.status='verified')<>1
 ) THEN RAISE EXCEPTION 'Requested factor no longer qualifies for approval.'; END IF;
 UPDATE ewp_private.mfa_enrollments e
 SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, reviewed_by=caller, reviewed_at=now()
 WHERE e.user_id=p_user_id AND e.factor_id=p_factor_id AND e.status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'Pending enrollment not found (request may have changed).'; END IF;
END; $$;

-- Revocation blocks protected access immediately once enforcement is enabled.
-- Removing the Supabase Auth factor itself must be performed using Supabase Auth Admin API
-- (service role server-side) or Dashboard, not by deleting directly from auth tables.
CREATE OR REPLACE FUNCTION public.ewp_mfa_admin_list() RETURNS TABLE(user_id uuid,email text,factor_id uuid,status text,submitted_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT ewp_private.is_admin((SELECT auth.uid())) OR NOT ewp_private.verified_approved() THEN RAISE EXCEPTION 'Administrator MFA verification required.'; END IF;
 RETURN QUERY SELECT e.user_id,u.email::text,e.factor_id,e.status,e.submitted_at
 FROM ewp_private.mfa_enrollments e JOIN auth.users u ON u.id=e.user_id
 WHERE e.status IN ('approved','revoked') ORDER BY u.email;
END; $$;
CREATE OR REPLACE FUNCTION public.ewp_mfa_revoke(p_user_id uuid,p_factor_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller uuid := (SELECT auth.uid());
BEGIN
 IF NOT ewp_private.is_admin(caller) OR NOT ewp_private.verified_approved() THEN RAISE EXCEPTION 'Administrator MFA verification required.'; END IF;
 IF caller=p_user_id THEN RAISE EXCEPTION 'You cannot revoke your own administrator factor here.'; END IF;
 UPDATE ewp_private.mfa_enrollments SET status='revoked',reviewed_by=caller,reviewed_at=now()
 WHERE user_id=p_user_id AND factor_id=p_factor_id AND status='approved';
 IF NOT FOUND THEN RAISE EXCEPTION 'Approved factor not found.'; END IF;
END; $$;

REVOKE ALL ON FUNCTION public.ewp_mfa_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ewp_mfa_submit(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ewp_mfa_pending() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ewp_mfa_decide(uuid,uuid,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ewp_mfa_admin_list() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ewp_mfa_revoke(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ewp_mfa_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ewp_mfa_submit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ewp_mfa_pending() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ewp_mfa_decide(uuid,uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ewp_mfa_admin_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ewp_mfa_revoke(uuid,uuid) TO authenticated;
COMMIT;
