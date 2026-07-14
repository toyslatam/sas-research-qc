-- ============================================================
-- SAS RESEARCH — QC-5
-- Evidencias + auditoría (ADITIVO)
-- Requiere: qc_0_1 … qc_4
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS qc_evidences (
  id            BIGSERIAL PRIMARY KEY,
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  survey_id     BIGINT NOT NULL REFERENCES qc_surveys(id) ON DELETE CASCADE,
  stage_type    TEXT
                CHECK (stage_type IS NULL OR stage_type IN ('ubicacion', 'contenido', 'telefono')),
  evidence_type TEXT NOT NULL DEFAULT 'link'
                CHECK (evidence_type IN ('photo', 'audio', 'document', 'link', 'note')),
  title         TEXT NOT NULL DEFAULT '',
  url           TEXT NOT NULL DEFAULT '',
  notes         TEXT NOT NULL DEFAULT '',
  uploaded_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_evidences_org ON qc_evidences(org_id);
CREATE INDEX IF NOT EXISTS idx_qc_evidences_survey ON qc_evidences(survey_id);

CREATE TABLE IF NOT EXISTS qc_audit_logs (
  id            BIGSERIAL PRIMARY KEY,
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  entity_type   TEXT NOT NULL DEFAULT 'qc',
  entity_id     TEXT NOT NULL DEFAULT '',
  survey_id     BIGINT REFERENCES qc_surveys(id) ON DELETE SET NULL,
  project_id    BIGINT REFERENCES qc_projects(id) ON DELETE SET NULL,
  detail        TEXT NOT NULL DEFAULT '',
  metadata      JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_audit_org ON qc_audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_qc_audit_created ON qc_audit_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qc_audit_survey ON qc_audit_logs(survey_id);

ALTER TABLE qc_evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qc_evidences_select" ON qc_evidences;
CREATE POLICY "qc_evidences_select" ON qc_evidences
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.qc_user_org_ids()));

DROP POLICY IF EXISTS "qc_evidences_write" ON qc_evidences;
CREATE POLICY "qc_evidences_write" ON qc_evidences
  FOR ALL TO authenticated
  USING (
    public.qc_user_has_permission(org_id, 'qc:surveys:review')
    OR public.qc_user_has_permission(org_id, 'qc:projects:write')
  )
  WITH CHECK (
    public.qc_user_has_permission(org_id, 'qc:surveys:review')
    OR public.qc_user_has_permission(org_id, 'qc:projects:write')
  );

DROP POLICY IF EXISTS "qc_audit_select" ON qc_audit_logs;
CREATE POLICY "qc_audit_select" ON qc_audit_logs
  FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT public.qc_user_org_ids())
    AND (
      public.qc_user_has_permission(org_id, 'qc:audit:read')
      OR public.qc_user_has_permission(org_id, 'qc:org:manage')
    )
  );

DROP POLICY IF EXISTS "qc_audit_insert" ON qc_audit_logs;
CREATE POLICY "qc_audit_insert" ON qc_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.qc_user_org_ids()));
