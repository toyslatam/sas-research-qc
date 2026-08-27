-- ============================================================
-- SAS RESEARCH — SPEAKER-2
-- Completa el esquema de embeddings/matches con los campos del spec.
-- ESTRICTAMENTE ADITIVO: solo ADD COLUMN sobre tablas speaker_* (nuevas).
-- No toca Whispper ni QC. Idempotente.
-- Ejecutar en: Supabase Dashboard → SQL Editor (después de speaker_1).
-- ============================================================

-- Trazabilidad del modelo: distinguir versiones para saber qué embeddings
-- regenerar si el modelo cambia (los embeddings NO se regeneran salvo cambio
-- de modelo/versión).
ALTER TABLE speaker_embeddings
  ADD COLUMN IF NOT EXISTS model_version TEXT NOT NULL DEFAULT '';

-- Offsets del segmento de referencia dentro del audio original (para poder
-- reproducir/auditar exactamente qué tramo se usó).
ALTER TABLE speaker_embeddings
  ADD COLUMN IF NOT EXISTS source_start_seconds REAL;
ALTER TABLE speaker_embeddings
  ADD COLUMN IF NOT EXISTS source_end_seconds REAL;

-- Enlace directo al embedding coincidente (además de recording_id/person_id).
ALTER TABLE speaker_matches
  ADD COLUMN IF NOT EXISTS matched_embedding_id BIGINT
    REFERENCES speaker_embeddings(id) ON DELETE SET NULL;

-- Nota: `duration_used` (speaker_1) cumple el rol de `sample_duration_seconds`
-- del spec; no se renombra para no romper lo ya creado.
