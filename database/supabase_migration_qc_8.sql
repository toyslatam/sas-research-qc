-- ============================================================
-- SAS RESEARCH — QC-8
-- Import real Sheets/Zoho → qc_surveys (índice único external_id)
-- ADITIVO — no toca Whispper ni managed_projects
-- Requiere: qc_0_1 … qc_6
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Evita duplicados al sincronizar por external_id (filas vacías excluidas)
CREATE UNIQUE INDEX IF NOT EXISTS uq_qc_surveys_org_external
  ON qc_surveys(org_id, external_id)
  WHERE external_id <> '';

COMMENT ON INDEX uq_qc_surveys_org_external IS
  'QC-8: upsert de importaciones por organización + external_id';
