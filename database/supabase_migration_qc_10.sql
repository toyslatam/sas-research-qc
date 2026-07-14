-- ============================================================
-- SAS RESEARCH — QC-10
-- Evidencias con archivo en Supabase Storage (ADITIVO)
-- Requiere: qc_0_1 … qc_9
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE qc_evidences
  ADD COLUMN IF NOT EXISTS storage_path TEXT NOT NULL DEFAULT '';

ALTER TABLE qc_evidences
  ADD COLUMN IF NOT EXISTS file_name TEXT NOT NULL DEFAULT '';

ALTER TABLE qc_evidences
  ADD COLUMN IF NOT EXISTS mime_type TEXT NOT NULL DEFAULT '';

ALTER TABLE qc_evidences
  ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Bucket privado para evidencias QC (backend usa service role)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('qc-evidences', 'qc-evidences', false, 52428800)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit;

-- Lectura autenticada vía path org (opcional; el backend firma URLs)
DROP POLICY IF EXISTS "qc_evidences_storage_select" ON storage.objects;
CREATE POLICY "qc_evidences_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'qc-evidences'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.qc_user_org_ids())
  );

DROP POLICY IF EXISTS "qc_evidences_storage_insert" ON storage.objects;
CREATE POLICY "qc_evidences_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'qc-evidences'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.qc_user_org_ids())
  );

DROP POLICY IF EXISTS "qc_evidences_storage_delete" ON storage.objects;
CREATE POLICY "qc_evidences_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'qc-evidences'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.qc_user_org_ids())
  );
