-- ============================================================
-- SAS RESEARCH — QC-4
-- Motor de reglas configurable (ADITIVO)
-- Requiere: qc_0_1 + qc_2 + qc_3
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS qc_rules (
  id            BIGSERIAL PRIMARY KEY,
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id    BIGINT REFERENCES qc_projects(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  stage_type    TEXT NOT NULL DEFAULT 'any'
                CHECK (stage_type IN ('any', 'ubicacion', 'contenido', 'telefono')),
  field_key     TEXT NOT NULL,
  operator      TEXT NOT NULL
                CHECK (operator IN (
                  'required', 'is_empty', 'is_not_empty',
                  'equals', 'not_equals', 'contains', 'not_contains',
                  'regex', 'gt', 'gte', 'lt', 'lte',
                  'coords_present'
                )),
  value_text    TEXT NOT NULL DEFAULT '',
  severity      TEXT NOT NULL DEFAULT 'warning'
                CHECK (severity IN ('info', 'warning', 'error', 'block')),
  action        TEXT NOT NULL DEFAULT 'flag'
                CHECK (action IN ('flag', 'auto_observacion', 'auto_rechazar')),
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_rules_org ON qc_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_qc_rules_project ON qc_rules(project_id);
CREATE INDEX IF NOT EXISTS idx_qc_rules_enabled ON qc_rules(org_id, enabled);

ALTER TABLE qc_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qc_rules_select" ON qc_rules;
CREATE POLICY "qc_rules_select" ON qc_rules
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.qc_user_org_ids()));

DROP POLICY IF EXISTS "qc_rules_write" ON qc_rules;
CREATE POLICY "qc_rules_write" ON qc_rules
  FOR ALL TO authenticated
  USING (public.qc_user_has_permission(org_id, 'qc:rules:manage'))
  WITH CHECK (public.qc_user_has_permission(org_id, 'qc:rules:manage'));
