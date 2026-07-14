-- ============================================================
-- SAS RESEARCH — QC-6
-- Integraciones Google Sheets / Zoho (ADITIVO)
-- Requiere: qc_0_1 … qc_5
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS qc_integrations (
  id              BIGSERIAL PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      BIGINT REFERENCES qc_projects(id) ON DELETE SET NULL,
  provider        TEXT NOT NULL
                  CHECK (provider IN ('google_sheets', 'zoho')),
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'inactive'
                  CHECK (status IN ('inactive', 'active', 'error')),
  config          JSONB NOT NULL DEFAULT '{}'::JSONB,
  last_sync_at    TIMESTAMPTZ,
  last_sync_status TEXT
                  CHECK (last_sync_status IS NULL OR last_sync_status IN (
                    'success', 'error', 'partial', 'skipped'
                  )),
  last_sync_message TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_integrations_org ON qc_integrations(org_id);
CREATE INDEX IF NOT EXISTS idx_qc_integrations_provider ON qc_integrations(org_id, provider);

CREATE TABLE IF NOT EXISTS qc_integration_runs (
  id              BIGSERIAL PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id  BIGINT NOT NULL REFERENCES qc_integrations(id) ON DELETE CASCADE,
  status          TEXT NOT NULL
                  CHECK (status IN ('success', 'error', 'partial', 'skipped')),
  imported_count  INT NOT NULL DEFAULT 0,
  skipped_count   INT NOT NULL DEFAULT 0,
  error_count     INT NOT NULL DEFAULT 0,
  message         TEXT NOT NULL DEFAULT '',
  result_payload  JSONB NOT NULL DEFAULT '{}'::JSONB,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_integration_runs_org ON qc_integration_runs(org_id);
CREATE INDEX IF NOT EXISTS idx_qc_integration_runs_int ON qc_integration_runs(integration_id);

ALTER TABLE qc_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_integration_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qc_integrations_select" ON qc_integrations;
CREATE POLICY "qc_integrations_select" ON qc_integrations
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.qc_user_org_ids()));

DROP POLICY IF EXISTS "qc_integrations_write" ON qc_integrations;
CREATE POLICY "qc_integrations_write" ON qc_integrations
  FOR ALL TO authenticated
  USING (public.qc_user_has_permission(org_id, 'qc:integrations:manage'))
  WITH CHECK (public.qc_user_has_permission(org_id, 'qc:integrations:manage'));

DROP POLICY IF EXISTS "qc_integration_runs_select" ON qc_integration_runs;
CREATE POLICY "qc_integration_runs_select" ON qc_integration_runs
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.qc_user_org_ids()));

DROP POLICY IF EXISTS "qc_integration_runs_write" ON qc_integration_runs;
CREATE POLICY "qc_integration_runs_write" ON qc_integration_runs
  FOR ALL TO authenticated
  USING (public.qc_user_has_permission(org_id, 'qc:integrations:manage'))
  WITH CHECK (public.qc_user_has_permission(org_id, 'qc:integrations:manage'));
