-- EWP Management Portal V1.13 WEB — Purchasing receipt ledger and atomic operations.
-- Run AFTER your current V1.12 database. Back up before migration.
-- Do NOT rerun archived cumulative migrations. This migration keeps old rows intact.
BEGIN;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid,
  ADD COLUMN IF NOT EXISTS close_reason text;

ALTER TABLE public.incoming_orders
  ADD COLUMN IF NOT EXISTS cancelled_lf numeric NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.purchase_orders'::regclass AND conname='purchase_orders_status_v113') THEN
    ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_status_v113 CHECK (status IN ('active','cancelled','removed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.incoming_orders'::regclass AND conname='incoming_orders_cancelled_v113') THEN
    ALTER TABLE public.incoming_orders ADD CONSTRAINT incoming_orders_cancelled_v113 CHECK (
      cancelled_lf >= 0 AND received_lf + cancelled_lf <= quantity_lf
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.purchase_receipt_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  receipt_type text NOT NULL DEFAULT 'single' CHECK (receipt_type IN ('single','bulk'))
);
CREATE TABLE IF NOT EXISTS public.purchase_receipt_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.purchase_receipt_batches(id) ON DELETE CASCADE,
  incoming_order_id uuid REFERENCES public.incoming_orders(id) ON DELETE SET NULL,
  material_name text NOT NULL,
  quantity_lf numeric NOT NULL CHECK (quantity_lf > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz,
  reversed_by uuid,
  reverse_reason text
);
CREATE INDEX IF NOT EXISTS purchase_receipt_batches_po_idx ON public.purchase_receipt_batches(purchase_order_id,created_at DESC);
CREATE INDEX IF NOT EXISTS purchase_receipt_lines_batch_idx ON public.purchase_receipt_lines(batch_id);
CREATE INDEX IF NOT EXISTS purchase_receipt_lines_incoming_idx ON public.purchase_receipt_lines(incoming_order_id);

-- All new receipt writes MUST go through RPC. Direct writes to these tables
-- are not needed by the browser (read-only history, including after reversal).
ALTER TABLE public.purchase_receipt_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_receipt_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchase_receipt_batches_read" ON public.purchase_receipt_batches;
CREATE POLICY "purchase_receipt_batches_read" ON public.purchase_receipt_batches FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "purchase_receipt_lines_read" ON public.purchase_receipt_lines;
CREATE POLICY "purchase_receipt_lines_read" ON public.purchase_receipt_lines FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.purchase_receipt_batches, public.purchase_receipt_lines TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.purchase_receipt_batches,public.purchase_receipt_lines FROM anon,authenticated;

-- Use SECURITY DEFINER for a single trusted Postgres transaction, rather than
-- client-side sequential REST updates. Each operation verifies auth.uid().
-- search_path and schema-qualified objects prevent search_path injection.
CREATE OR REPLACE FUNCTION public.purchase_receive(
  p_incoming_id uuid DEFAULT NULL,
  p_purchase_order_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_po public.purchase_orders%ROWTYPE;
  v_row public.incoming_orders%ROWTYPE;
  v_batch uuid;
  v_qty numeric;
  v_count integer := 0;
  v_total numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF (p_incoming_id IS NULL) = (p_purchase_order_id IS NULL) THEN
    RAISE EXCEPTION 'Select exactly one incoming line or a purchase order';
  END IF;

  -- Lock PO before lines so bulk/individual operations follow same lock order.
  IF p_purchase_order_id IS NOT NULL THEN
    SELECT * INTO v_po FROM public.purchase_orders WHERE id=p_purchase_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Purchase order not found'; END IF;
  ELSE
    SELECT po.* INTO v_po FROM public.purchase_orders po
      JOIN public.incoming_orders io ON io.purchase_order_id=po.id
      WHERE io.id=p_incoming_id FOR UPDATE OF po;
  END IF;
  IF v_po.id IS NOT NULL AND v_po.status <> 'active' THEN
    RAISE EXCEPTION 'This PO is %; restore it before receiving',v_po.status;
  END IF;

  FOR v_row IN
    SELECT * FROM public.incoming_orders
    WHERE (p_purchase_order_id IS NOT NULL AND purchase_order_id=p_purchase_order_id)
       OR (p_incoming_id IS NOT NULL AND id=p_incoming_id)
    ORDER BY id FOR UPDATE
  LOOP
    v_qty := v_row.quantity_lf - v_row.received_lf - v_row.cancelled_lf;
    IF v_qty <= 0 THEN CONTINUE; END IF;
    IF v_batch IS NULL THEN
      INSERT INTO public.purchase_receipt_batches(purchase_order_id,receipt_type)
      VALUES (v_row.purchase_order_id, CASE WHEN p_purchase_order_id IS NOT NULL THEN 'bulk' ELSE 'single' END)
      RETURNING id INTO v_batch;
    END IF;
    INSERT INTO public.inventory_materials(id,material_name,on_hand_lf,lead_time_weeks,version)
      VALUES (gen_random_uuid(),v_row.material_name,v_qty,6,1)
      ON CONFLICT (lower(material_name)) DO UPDATE SET
        on_hand_lf=public.inventory_materials.on_hand_lf+EXCLUDED.on_hand_lf,
        version=public.inventory_materials.version+1,
        updated_at=now();
    UPDATE public.incoming_orders SET received_lf=received_lf+v_qty,version=version+1,updated_at=now()
      WHERE id=v_row.id;
    INSERT INTO public.purchase_receipt_lines(batch_id,incoming_order_id,material_name,quantity_lf)
      VALUES (v_batch,v_row.id,v_row.material_name,v_qty);
    v_count := v_count+1;
    v_total := v_total+v_qty;
  END LOOP;
  IF v_count=0 THEN RAISE EXCEPTION 'Nothing remains to receive'; END IF;
  RETURN jsonb_build_object('batch_id',v_batch,'line_count',v_count,'received_lf',v_total);
END $$;

CREATE OR REPLACE FUNCTION public.purchase_reverse_receipt(
  p_batch_id uuid,
  p_receipt_line_id uuid DEFAULT NULL,
  p_reason text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_batch public.purchase_receipt_batches%ROWTYPE;
  v_line public.purchase_receipt_lines%ROWTYPE;
  v_order public.incoming_orders%ROWTYPE;
  v_inv_id uuid;
  v_count int := 0;
  v_total numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF length(btrim(coalesce(p_reason,'')))<3 THEN RAISE EXCEPTION 'Enter a reason (at least 3 characters)'; END IF;
  SELECT * INTO v_batch FROM public.purchase_receipt_batches WHERE id=p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Receipt batch not found'; END IF;
  IF v_batch.purchase_order_id IS NOT NULL THEN
    PERFORM 1 FROM public.purchase_orders WHERE id=v_batch.purchase_order_id FOR UPDATE;
  END IF;
  FOR v_line IN
    SELECT * FROM public.purchase_receipt_lines
    WHERE batch_id=p_batch_id AND reversed_at IS NULL
      AND (p_receipt_line_id IS NULL OR id=p_receipt_line_id)
    ORDER BY id FOR UPDATE
  LOOP
    IF v_line.incoming_order_id IS NULL THEN
      RAISE EXCEPTION 'Original incoming line no longer exists; contact an administrator';
    END IF;
    SELECT * INTO v_order FROM public.incoming_orders WHERE id=v_line.incoming_order_id FOR UPDATE;
    IF NOT FOUND OR v_order.received_lf < v_line.quantity_lf THEN
      RAISE EXCEPTION 'Incoming receipt balance changed; cannot reverse %',v_line.material_name;
    END IF;
    UPDATE public.inventory_materials SET
      on_hand_lf=on_hand_lf-v_line.quantity_lf,version=version+1,updated_at=now()
    WHERE lower(material_name)=lower(v_line.material_name) AND on_hand_lf >= v_line.quantity_lf
    RETURNING id INTO v_inv_id;
    IF v_inv_id IS NULL THEN
      RAISE EXCEPTION 'Insufficient On Hand to reverse % (% LF). Check inventory usage/adjustments first',v_line.material_name,v_line.quantity_lf;
    END IF;
    UPDATE public.incoming_orders SET
      received_lf=received_lf-v_line.quantity_lf,
      cancelled_lf=cancelled_lf+CASE WHEN v_batch.purchase_order_id IS NOT NULL
             AND (SELECT status FROM public.purchase_orders WHERE id=v_batch.purchase_order_id)<>'active'
           THEN v_line.quantity_lf ELSE 0 END,
      version=version+1,updated_at=now()
    WHERE id=v_order.id;
    UPDATE public.purchase_receipt_lines SET reversed_at=now(),reversed_by=auth.uid(),reverse_reason=btrim(p_reason)
    WHERE id=v_line.id;
    v_count:=v_count+1;
    v_total:=v_total+v_line.quantity_lf;
    v_inv_id:=NULL;
  END LOOP;
  IF v_count=0 THEN RAISE EXCEPTION 'Receipt already reversed or not found'; END IF;
  RETURN jsonb_build_object('line_count',v_count,'reversed_lf',v_total);
END $$;

-- For receipts posted BEFORE V1.13 (there is no old batch ledger): the UI
-- permits a guarded correction, but never reverses ledger-tracked quantities.
CREATE OR REPLACE FUNCTION public.purchase_reverse_legacy(
  p_incoming_id uuid,p_quantity_lf numeric,p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_row public.incoming_orders%ROWTYPE;
  v_po_id uuid;
  v_tracked numeric;
  v_count int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF length(btrim(coalesce(p_reason,'')))<3 THEN RAISE EXCEPTION 'Enter a reason (at least 3 characters)'; END IF;
  IF p_quantity_lf IS NULL OR p_quantity_lf<=0 THEN RAISE EXCEPTION 'Positive reversal quantity required'; END IF;
  SELECT purchase_order_id INTO v_po_id FROM public.incoming_orders WHERE id=p_incoming_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Incoming line not found'; END IF;
  IF v_po_id IS NOT NULL THEN
    PERFORM 1 FROM public.purchase_orders WHERE id=v_po_id FOR UPDATE;
  END IF;
  SELECT * INTO v_row FROM public.incoming_orders WHERE id=p_incoming_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Incoming line no longer exists'; END IF;
  SELECT coalesce(sum(quantity_lf),0) INTO v_tracked FROM public.purchase_receipt_lines
    WHERE incoming_order_id=p_incoming_id AND reversed_at IS NULL;
  IF v_row.received_lf-v_tracked<p_quantity_lf THEN
    RAISE EXCEPTION 'Only % LF of this receipt predates V1.13',v_row.received_lf-v_tracked;
  END IF;
  UPDATE public.inventory_materials SET on_hand_lf=on_hand_lf-p_quantity_lf,
    version=version+1,updated_at=now()
    WHERE lower(material_name)=lower(v_row.material_name) AND on_hand_lf>=p_quantity_lf;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count=0 THEN RAISE EXCEPTION 'Insufficient On Hand for this legacy reversal'; END IF;
  UPDATE public.incoming_orders SET received_lf=received_lf-p_quantity_lf,
    cancelled_lf=cancelled_lf+CASE WHEN v_row.purchase_order_id IS NOT NULL
      AND (SELECT status FROM public.purchase_orders WHERE id=v_row.purchase_order_id)<>'active'
      THEN p_quantity_lf ELSE 0 END,
    version=version+1,updated_at=now() WHERE id=p_incoming_id;
  -- Logged in existing Activity History (with authenticated actor) inside transaction.
  INSERT INTO public.activity_log(entity_type,entity_id,action,details)
    VALUES ('incoming',p_incoming_id,'reverse_legacy_receipt',jsonb_build_object(
      'material_name',v_row.material_name,'received_lf',p_quantity_lf,'reference',v_row.reference,
      'reason',btrim(p_reason),'legacy',true));
  RETURN jsonb_build_object('reversed_lf',p_quantity_lf);
END $$;

CREATE OR REPLACE FUNCTION public.purchase_close_po(
  p_purchase_order_id uuid,p_reason text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_po public.purchase_orders%ROWTYPE;
  v_received numeric;
  v_cancelled numeric;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_po FROM public.purchase_orders WHERE id=p_purchase_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PO not found'; END IF;
  IF v_po.status<>'active' THEN RAISE EXCEPTION 'PO is already %',v_po.status; END IF;
  SELECT coalesce(sum(received_lf),0),coalesce(sum(quantity_lf-received_lf-cancelled_lf),0)
    INTO v_received,v_cancelled FROM public.incoming_orders WHERE purchase_order_id=p_purchase_order_id;
  v_status:=CASE WHEN v_received=0 THEN 'removed' ELSE 'cancelled' END;
  UPDATE public.incoming_orders SET cancelled_lf=quantity_lf-received_lf,version=version+1,updated_at=now()
    WHERE purchase_order_id=p_purchase_order_id;
  UPDATE public.purchase_orders SET status=v_status,closed_at=now(),closed_by=auth.uid(),
    close_reason=nullif(btrim(p_reason),''),version=version+1,updated_at=now() WHERE id=p_purchase_order_id;
  RETURN jsonb_build_object('status',v_status,'cancelled_lf',v_cancelled,'received_lf',v_received);
END $$;

CREATE OR REPLACE FUNCTION public.purchase_restore_po(p_purchase_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_po public.purchase_orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_po FROM public.purchase_orders WHERE id=p_purchase_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PO not found'; END IF;
  IF v_po.status='active' THEN RAISE EXCEPTION 'PO is already active'; END IF;
  UPDATE public.incoming_orders SET cancelled_lf=0,version=version+1,updated_at=now() WHERE purchase_order_id=p_purchase_order_id;
  UPDATE public.purchase_orders SET status='active',closed_at=NULL,closed_by=NULL,close_reason=NULL,
    version=version+1,updated_at=now() WHERE id=p_purchase_order_id;
  RETURN jsonb_build_object('status','active');
END $$;

-- Revoke implicit PUBLIC execution and allow only authenticated app users.
REVOKE ALL ON FUNCTION public.purchase_receive(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.purchase_reverse_receipt(uuid,uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.purchase_reverse_legacy(uuid,numeric,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.purchase_close_po(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.purchase_restore_po(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.purchase_receive(uuid,uuid),public.purchase_reverse_receipt(uuid,uuid,text),
  public.purchase_reverse_legacy(uuid,numeric,text),public.purchase_close_po(uuid,text),
  public.purchase_restore_po(uuid) TO authenticated;

COMMIT;
