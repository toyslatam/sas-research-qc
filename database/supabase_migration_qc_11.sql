-- ============================================================
-- SAS RESEARCH — QC-11
-- Historial de exportaciones de reportes QC (ADITIVO)
-- Requiere: qc_0_1 … qc_10
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS qc_report_exports (
  id            BIGSERIAL PRIMARY KEY,
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  format        TEXT NOT NULL DEFAULT 'csv'
                CHECK (format IN ('csv', 'json', 'summary')),
  filters       JSONB NOT NULL DEFAULT '{}'::JSONB,
  row_count     INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_report_exports_org
  ON qc_report_exports(org_id, created_at DESC);

ALTER TABLE qc_report_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qc_report_exports_select" ON qc_report_exports;
CREATE POLICY "qc_report_exports_select" ON qc_report_exports
  FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT public.qc_user_org_ids())
    AND (
      public.qc_user_has_permission(org_id, 'qc:reports:read')
      OR public.qc_user_has_permission(org_id, 'qc:projects:read')
    )
  );

DROP POLICY IF EXISTS "qc_report_exports_insert" ON qc_report_exports;
CREATE POLICY "qc_report_exports_insert" ON qc_report_exports
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (SELECT public.qc_user_org_ids())
    AND (
      public.qc_user_has_permission(org_id, 'qc:reports:read')
      OR public.qc_user_has_permission(org_id, 'qc:projects:read')
    )
  );
