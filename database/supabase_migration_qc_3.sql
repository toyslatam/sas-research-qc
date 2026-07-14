-- ============================================================
-- SAS RESEARCH — QC-3
-- Encuestas + etapas de revisión (ubicación / contenido / teléfono)
-- ADITIVO — no toca Whispper ni managed_projects
-- Requiere: supabase_migration_qc_0_1.sql + qc_2.sql
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS qc_surveys (
  id               BIGSERIAL PRIMARY KEY,
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id       BIGINT NOT NULL REFERENCES qc_projects(id) ON DELETE CASCADE,
  external_id      TEXT NOT NULL DEFAULT '',
  respondent_code  TEXT NOT NULL DEFAULT '',
  interviewer      TEXT NOT NULL DEFAULT '',
  phone            TEXT NOT NULL DEFAULT '',
  address          TEXT NOT NULL DEFAULT '',
  latitude         DOUBLE PRECISION,
  longitude        DOUBLE PRECISION,
  collected_at     TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'pendiente'
                   CHECK (status IN (
                     'pendiente', 'en_revision', 'aprobada', 'rechazada', 'en_auditoria'
                   )),
  current_stage    TEXT NOT NULL DEFAULT 'ubicacion'
                   CHECK (current_stage IN (
                     'ubicacion', 'contenido', 'telefono', 'completada'
                   )),
  answers          JSONB NOT NULL DEFAULT '{}'::JSONB,
  metadata         JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_surveys_org ON qc_surveys(org_id);
CREATE INDEX IF NOT EXISTS idx_qc_surveys_project ON qc_surveys(project_id);
CREATE INDEX IF NOT EXISTS idx_qc_surveys_status ON qc_surveys(org_id, status);
CREATE INDEX IF NOT EXISTS idx_qc_surveys_external
  ON qc_surveys(org_id, external_id) WHERE external_id <> '';

CREATE TABLE IF NOT EXISTS qc_review_stages (
  id            BIGSERIAL PRIMARY KEY,
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  survey_id     BIGINT NOT NULL REFERENCES qc_surveys(id) ON DELETE CASCADE,
  stage_type    TEXT NOT NULL
                CHECK (stage_type IN ('ubicacion', 'contenido', 'telefono')),
  status        TEXT NOT NULL DEFAULT 'pendiente'
                CHECK (status IN ('pendiente', 'aprobada', 'rechazada', 'observacion')),
  reviewer_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes         TEXT NOT NULL DEFAULT '',
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (survey_id, stage_type)
);

CREATE INDEX IF NOT EXISTS idx_qc_review_stages_survey ON qc_review_stages(survey_id);
CREATE INDEX IF NOT EXISTS idx_qc_review_stages_org ON qc_review_stages(org_id);

CREATE TABLE IF NOT EXISTS qc_review_events (
  id            BIGSERIAL PRIMARY KEY,
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  survey_id     BIGINT NOT NULL REFERENCES qc_surveys(id) ON DELETE CASCADE,
  stage_type    TEXT NOT NULL,
  action        TEXT NOT NULL,
  actor_id      UUID,
  detail        TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_review_events_survey ON qc_review_events(survey_id);

-- RLS
ALTER TABLE qc_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_review_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_review_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qc_surveys_select" ON qc_surveys;
CREATE POLICY "qc_surveys_select" ON qc_surveys
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.qc_user_org_ids()));

DROP POLICY IF EXISTS "qc_surveys_write" ON qc_surveys;
CREATE POLICY "qc_surveys_write" ON qc_surveys
  FOR ALL TO authenticated
  USING (
    public.qc_user_has_permission(org_id, 'qc:surveys:review')
    OR public.qc_user_has_permission(org_id, 'qc:projects:write')
  )
  WITH CHECK (
    public.qc_user_has_permission(org_id, 'qc:surveys:review')
    OR public.qc_user_has_permission(org_id, 'qc:projects:write')
  );

DROP POLICY IF EXISTS "qc_review_stages_select" ON qc_review_stages;
CREATE POLICY "qc_review_stages_select" ON qc_review_stages
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.qc_user_org_ids()));

DROP POLICY IF EXISTS "qc_review_stages_write" ON qc_review_stages;
CREATE POLICY "qc_review_stages_write" ON qc_review_stages
  FOR ALL TO authenticated
  USING (public.qc_user_has_permission(org_id, 'qc:surveys:review'))
  WITH CHECK (public.qc_user_has_permission(org_id, 'qc:surveys:review'));

DROP POLICY IF EXISTS "qc_review_events_select" ON qc_review_events;
CREATE POLICY "qc_review_events_select" ON qc_review_events
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.qc_user_org_ids()));

DROP POLICY IF EXISTS "qc_review_events_insert" ON qc_review_events;
CREATE POLICY "qc_review_events_insert" ON qc_review_events
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.qc_user_org_ids()));
