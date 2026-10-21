-- EWP Management Portal V1.14 WEB - atomic PO import/re-import.
-- Run only AFTER the V1.13 Purchasing migration on the same Supabase project.
-- Preserves PO IDs, received LF, and historical receipt links. Never changes On Hand.
BEGIN;

CREATE OR REPLACE FUNCTION public.purchase_import_revision(
  p_po_number text,
  p_order_date date,
  p_expected_date date,
  p_source_file_name text,
  p_note text,
  p_items jsonb,
  p_existing_po_id uuid DEFAULT NULL,
  p_expected_po_version integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_po public.purchase_orders%ROWTYPE;
  v_old public.incoming_orders%ROWTYPE;
  v_item jsonb;
  v_id uuid;
  v_name text;
  v_key text;
  v_lf numeric;
  v_breakdown jsonb;
  v_seen_keys text[] := ARRAY[]::text[];
  v_used_ids uuid[] := ARRAY[]::uuid[];
  v_total numeric := 0;
  v_count integer := 0;
  v_added integer := 0;
  v_updated integer := 0;
  v_archived integer := 0;
  v_prior_status text := 'new';
  v_is_new boolean := (p_existing_po_id IS NULL);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  p_po_number := upper(btrim(coalesce(p_po_number,'')));
  IF p_po_number = '' THEN RAISE EXCEPTION 'PO # is required'; END IF;
  IF p_expected_date IS NULL THEN RAISE EXCEPTION 'Expected arrival date is required'; END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'PO materials must be an array';
  END IF;
  IF jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 500 THEN
    RAISE EXCEPTION 'Provide between 1 and 500 valid PO material lines';
  END IF;

  IF v_is_new THEN
    -- A unique PO# index from the original purchasing schema prevents duplicate POs.
    INSERT INTO public.purchase_orders(id,po_number,order_date,expected_date,source_file_name,note,version)
    VALUES (gen_random_uuid(),p_po_number,p_order_date,p_expected_date,
      nullif(btrim(coalesce(p_source_file_name,'')),''),nullif(btrim(coalesce(p_note,'')),''),1)
    RETURNING * INTO v_po;
  ELSE
    -- Same lock order as the V1.13 receipt/close/restore functions: header, then lines.
    SELECT * INTO v_po FROM public.purchase_orders WHERE id=p_existing_po_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PO no longer exists. Refresh and try again'; END IF;
    IF p_expected_po_version IS NULL OR v_po.version <> p_expected_po_version THEN
      RAISE EXCEPTION 'PO was changed by another user. Refresh and review before updating';
    END IF;
    IF lower(btrim(v_po.po_number)) <> lower(p_po_number) THEN
      RAISE EXCEPTION 'PO # changed. Refresh and verify that the right PO is selected';
    END IF;
    v_prior_status := v_po.status;
    -- Lock the entire old PO so its receiving balances cannot change mid-revision.
    PERFORM 1 FROM public.incoming_orders WHERE purchase_order_id=v_po.id ORDER BY id FOR UPDATE;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) AS t(value)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN RAISE EXCEPTION 'Invalid PO material entry'; END IF;
    v_name := btrim(coalesce(v_item->>'material_name',''));
    v_key := btrim(coalesce(v_item->>'material_key',''));
    IF v_name = '' OR v_key = '' OR length(v_name) > 500 THEN
      RAISE EXCEPTION 'Every PO material requires a name and unique identity';
    END IF;
    IF v_key = ANY(v_seen_keys) THEN RAISE EXCEPTION 'Duplicate material in PO: %',v_name; END IF;
    v_seen_keys := array_append(v_seen_keys,v_key);
    IF (v_item->>'quantity_lf') IS NULL THEN RAISE EXCEPTION 'Missing LF for %',v_name; END IF;
    v_lf := (v_item->>'quantity_lf')::numeric;
    IF v_lf <= 0 OR v_lf > 1000000000 THEN RAISE EXCEPTION 'Invalid LF for %',v_name; END IF;
    v_breakdown := coalesce(v_item->'length_breakdown','[]'::jsonb);
    IF jsonb_typeof(v_breakdown) <> 'array' THEN RAISE EXCEPTION 'Invalid length details for %',v_name; END IF;
    v_id := nullif(v_item->>'incoming_order_id','')::uuid;

    IF v_id IS NOT NULL THEN
      IF v_is_new OR v_id = ANY(v_used_ids) THEN RAISE EXCEPTION 'Duplicate or invalid existing PO line'; END IF;
      SELECT * INTO v_old FROM public.incoming_orders WHERE id=v_id AND purchase_order_id=v_po.id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Material line changed or was removed. Refresh and try again'; END IF;
      IF (v_item->>'expected_line_version') IS NULL OR
         v_old.version <> (v_item->>'expected_line_version')::integer THEN
        RAISE EXCEPTION 'Material % changed while the PO was being updated. Refresh and try again',v_old.material_name;
      END IF;
      IF v_lf < v_old.received_lf THEN
        RAISE EXCEPTION '% already has % LF received and cannot be reduced to % LF',v_old.material_name,v_old.received_lf,v_lf;
      END IF;
      -- Preserve original material identity where a receipt has ever been attached.
      -- Otherwise old receipts could no longer be reversed against the correct stock material.
      IF EXISTS (SELECT 1 FROM public.purchase_receipt_lines WHERE incoming_order_id=v_id) OR v_old.received_lf > 0 THEN
        v_name := v_old.material_name;
      END IF;
      UPDATE public.incoming_orders SET material_name=v_name,quantity_lf=v_lf,
        cancelled_lf=0,expected_date=p_expected_date,reference=p_po_number,
        note=nullif(btrim(coalesce(p_note,'')),''),length_breakdown=v_breakdown,
        updated_at=now(),version=version+1 WHERE id=v_id;
      v_updated := v_updated+1;
      v_used_ids := array_append(v_used_ids,v_id);
    ELSE
      INSERT INTO public.incoming_orders(id,purchase_order_id,material_name,quantity_lf,
        received_lf,cancelled_lf,expected_date,reference,note,length_breakdown,version)
      VALUES (gen_random_uuid(),v_po.id,v_name,v_lf,0,0,p_expected_date,p_po_number,
        nullif(btrim(coalesce(p_note,'')),''),v_breakdown,1)
      RETURNING id INTO v_id;
      v_added := v_added+1;
      v_used_ids := array_append(v_used_ids,v_id);
    END IF;
    v_count := v_count+1;
    v_total := v_total+v_lf;
  END LOOP;

  IF NOT v_is_new THEN
    -- Superseded rows must NOT be deleted: even reversed receipts are part of the audit trail.
    -- Cancel only unreceived LF, leaving previously received LF and inventory untouched.
    UPDATE public.incoming_orders SET cancelled_lf=quantity_lf-received_lf,
      note=CASE WHEN position('Removed from revised PO' in coalesce(note,''))>0 THEN note
        ELSE concat_ws(' · ',nullif(note,''),'Removed from revised PO') END,
      updated_at=now(),version=version+1
      WHERE purchase_order_id=v_po.id AND NOT(id=ANY(v_used_ids));
    GET DIAGNOSTICS v_archived = ROW_COUNT;
    UPDATE public.purchase_orders SET status='active',closed_at=NULL,closed_by=NULL,
      close_reason=NULL,order_date=p_order_date,expected_date=p_expected_date,
      source_file_name=nullif(btrim(coalesce(p_source_file_name,'')),''),
      note=nullif(btrim(coalesce(p_note,'')),''),updated_at=now(),version=version+1
      WHERE id=v_po.id;
  END IF;

  RETURN jsonb_build_object('po_id',v_po.id,'action',CASE WHEN v_is_new THEN 'created' ELSE 'updated' END,
    'previous_status',v_prior_status,'material_count',v_count,'total_lf',v_total,
    'items_added',v_added,'items_updated',v_updated,'items_superseded',v_archived);
END $$;

REVOKE ALL ON FUNCTION public.purchase_import_revision(text,date,date,text,text,jsonb,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.purchase_import_revision(text,date,date,text,text,jsonb,uuid,integer) TO authenticated;

COMMIT;
