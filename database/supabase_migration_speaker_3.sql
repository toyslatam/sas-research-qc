-- ============================================================
-- SAS RESEARCH — SPEAKER-3
-- Módulo independiente "Verificación de Voz": grabaciones de campo +
-- revisión de coincidencias de voz para QC. Organizaciones PROPIAS del
-- módulo (separadas de las de QC). ESTRICTAMENTE ADITIVO.
-- Requiere: speaker_1, speaker_2. Ejecutar en Supabase → SQL Editor.
--
-- Roles del módulo:
--   · encuestador → graba entrevistas (crea grabaciones)
--   · admin       → ve el listado y dictamina las coincidencias
-- Login: se reutiliza Supabase Auth (auth.users); las organizaciones y
-- roles son propios de este módulo (tablas speaker_org*).
-- No toca Whispper ni QC.
-- ============================================================

-- ── Organizaciones propias del módulo ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS speaker_orgs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Miembros + rol dentro de la organización del módulo ────────────────────
CREATE TABLE IF NOT EXISTS speaker_org_members (
  id          BIGSERIAL PRIMARY KEY,
  org_id      UUID NOT NULL REFERENCES speaker_orgs(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'encuestador'
              CHECK (role IN ('encuestador', 'admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_speaker_org_members_user ON speaker_org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_speaker_org_members_org ON speaker_org_members(org_id, role);

-- ── Grabaciones (una por entrevista grabada por un encuestador) ─────────────
CREATE TABLE IF NOT EXISTS speaker_recordings (
  id               BIGSERIAL PRIMARY KEY,
  org_id           UUID NOT NULL REFERENCES speaker_orgs(id) ON DELETE CASCADE,
  surveyor_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- ID OBLIGATORIO de la entrevista/encuesta que escribe el encuestador.
  interview_id     TEXT NOT NULL,
  storage_path     TEXT,             -- ruta en Supabase Storage (bucket speaker-audio)
  audio_format     TEXT,             -- formato por defecto del dispositivo (m4a/aac/…)
  duration_seconds REAL,
  -- Estado de procesamiento del embedding.
  status           TEXT NOT NULL DEFAULT 'uploaded'
                   CHECK (status IN ('uploaded', 'processing', 'embedded', 'failed')),
  -- Dictamen de QC que hace el admin sobre la grabación.
  disposition      TEXT NOT NULL DEFAULT 'pending'
                   CHECK (disposition IN ('pending', 'approved', 'duplicate', 'rejected')),
  reviewed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  review_notes     TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_speaker_recordings_org ON speaker_recordings(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_speaker_recordings_surveyor ON speaker_recordings(surveyor_id);
CREATE INDEX IF NOT EXISTS idx_speaker_recordings_disposition ON speaker_recordings(org_id, disposition);
CREATE INDEX IF NOT EXISTS idx_speaker_recordings_interview ON speaker_recordings(org_id, interview_id);

-- ── Multi-tenancy en las tablas de Fase 1 (aditivo) ────────────────────────
-- Los embeddings/matches pasan a pertenecer a una organización del módulo.
ALTER TABLE speaker_embeddings
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES speaker_orgs(id) ON DELETE CASCADE;
ALTER TABLE speaker_matches
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES speaker_orgs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_speaker_embeddings_org ON speaker_embeddings(org_id);
CREATE INDEX IF NOT EXISTS idx_speaker_matches_org ON speaker_matches(org_id);

-- ── RLS: cerrado por defecto (el backend usa service_role y bypassa RLS,
-- y valida rol/organización en el router, igual que el patrón QC). ──────────
ALTER TABLE speaker_orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE speaker_org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE speaker_recordings ENABLE ROW LEVEL SECURITY;

-- Nota: reversible borrando las tablas speaker_org*/speaker_recordings y las
-- columnas org_id añadidas. No se tocan tablas de Whispper ni de QC.
