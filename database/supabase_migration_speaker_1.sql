-- ============================================================
-- SAS RESEARCH — SPEAKER-1
-- Reconocimiento de hablante (detección de posibles coincidencias
-- de voz para revisión humana en QC). ESTRICTAMENTE ADITIVO.
-- Requiere: pgvector (extensión estándar en Supabase).
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- GARANTÍAS DE AISLAMIENTO:
--   · No hace ALTER sobre NINGUNA tabla existente (Whispper ni QC).
--   · No crea claves foráneas hacia tablas de Whispper: recording_id y
--     person_id son identificadores sueltos, no FK. Si estas tablas se
--     borraran enteras, Whispper seguiría igual.
--   · Todo lo nuevo lleva el prefijo `speaker_`.
-- ============================================================

-- pgvector: necesario para guardar y comparar embeddings por similitud.
-- Aditivo; no afecta a ninguna tabla existente.
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- Embeddings de voz (un vector por segmento de referencia de una grabación)
-- ============================================================
-- La dimensión 192 corresponde a ECAPA-TDNN (speechbrain/spkrec-ecapa-voxceleb),
-- el modelo previsto. Si se cambia de modelo con otra dimensión, hay que
-- migrar esta columna y regenerar los embeddings de ese modelo.
CREATE TABLE IF NOT EXISTS speaker_embeddings (
  id             BIGSERIAL PRIMARY KEY,
  -- Id de la grabación en el sistema (Whispper/otro). Sin FK a propósito.
  recording_id   TEXT NOT NULL,
  -- Etiqueta del hablante/encuestador si se conoce (histórico). Puede ser NULL.
  person_id      TEXT,
  embedding      VECTOR(192) NOT NULL,
  model_name     TEXT NOT NULL,
  duration_used  REAL NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_speaker_embeddings_recording ON speaker_embeddings(recording_id);
CREATE INDEX IF NOT EXISTS idx_speaker_embeddings_person ON speaker_embeddings(person_id);
-- Nota: el índice vectorial (ivfflat/hnsw) se añade en una fase posterior,
-- cuando haya volumen; con pocos vectores el escaneo secuencial es suficiente
-- y evita tener que fijar parámetros a ciegas.

-- ============================================================
-- Coincidencias detectadas (resultado de comparar una grabación contra el resto)
-- ============================================================
CREATE TABLE IF NOT EXISTS speaker_matches (
  id                 BIGSERIAL PRIMARY KEY,
  recording_id       TEXT NOT NULL,
  matched_person_id  TEXT,
  matched_recording_id TEXT,
  similarity_score   REAL NOT NULL,
  -- 'high' | 'medium' | 'low' | 'none' según umbrales configurables.
  confidence         TEXT NOT NULL DEFAULT 'none',
  rank               INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_speaker_matches_recording ON speaker_matches(recording_id, rank);

-- ============================================================
-- Cola/estado de procesamiento (asíncrono)
-- ============================================================
CREATE TABLE IF NOT EXISTS speaker_processing_jobs (
  id             BIGSERIAL PRIMARY KEY,
  recording_id   TEXT NOT NULL,
  job_type       TEXT NOT NULL DEFAULT 'embedding',
  status         TEXT NOT NULL DEFAULT 'queued'
                 CHECK (status IN ('queued','processing','completed','failed')),
  progress       INT NOT NULL DEFAULT 0,
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_speaker_jobs_status ON speaker_processing_jobs(status, created_at);

-- ============================================================
-- RLS: cerrado por defecto. Solo el backend (service_role, que bypassa RLS)
-- toca estas tablas. Sin políticas para anon/authenticated = sin acceso
-- desde el cliente. Defensa en profundidad, mismo criterio que las tablas QC.
-- ============================================================
ALTER TABLE speaker_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE speaker_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE speaker_processing_jobs ENABLE ROW LEVEL SECURITY;

-- Nota: no se tocan tablas de Whispper ni de QC. Esta migración es
-- reversible borrando las tres tablas speaker_* (la extensión vector
-- puede quedarse; es inocua).
