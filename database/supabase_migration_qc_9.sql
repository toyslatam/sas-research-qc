-- ============================================================
-- SAS RESEARCH — QC-9
-- Auto-acciones de reglas + webhooks de notificación
-- ADITIVO — no toca Whispper ni managed_projects
-- Requiere: qc_0_1 … qc_8
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS qc_webhooks (
  id                     BIGSERIAL PRIMARY KEY,
  org_id                 UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  url                    TEXT NOT NULL,
  secret                 TEXT NOT NULL DEFAULT '',
  events                 TEXT[] NOT NULL DEFAULT ARRAY['rules.applied']::TEXT[],
  enabled                BOOLEAN NOT NULL DEFAULT TRUE,
  last_delivery_at       TIMESTAMPTZ,
  last_delivery_status   TEXT NOT NULL DEFAULT '',
  last_delivery_message  TEXT NOT NULL DEFAULT '',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_webhooks_org ON qc_webhooks(org_id);

ALTER TABLE qc_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qc_webhooks_select" ON qc_webhooks;
CREATE POLICY "qc_webhooks_select" ON qc_webhooks
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.qc_user_org_ids()));

DROP POLICY IF EXISTS "qc_webhooks_write" ON qc_webhooks;
CREATE POLICY "qc_webhooks_write" ON qc_webhooks
  FOR ALL TO authenticated
  USING (public.qc_user_has_permission(org_id, 'qc:integrations:manage'))
  WITH CHECK (public.qc_user_has_permission(org_id, 'qc:integrations:manage'));
