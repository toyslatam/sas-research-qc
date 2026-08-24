-- ============================================================
-- SAS RESEARCH — QC-12
-- Seguimiento Encuestadores: reclutamiento de campo por municipio (ADITIVO)
-- Requiere: qc_0_1 … qc_11
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- Municipios (demanda/cobertura)
-- ============================================================
CREATE TABLE IF NOT EXISTS qc_recruit_municipios (
  id            BIGSERIAL PRIMARY KEY,
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  departamento  TEXT NOT NULL DEFAULT '',
  zona          TEXT NOT NULL DEFAULT '',
  prioridad     TEXT NOT NULL DEFAULT 'media'
                CHECK (prioridad IN ('alta', 'media', 'baja')),
  meta          INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, nombre)
);

CREATE INDEX IF NOT EXISTS idx_qc_recruit_municipios_org ON qc_recruit_municipios(org_id);

-- ============================================================
-- Candidatos (BD Encuestadores — CRM de reclutamiento)
-- ============================================================
CREATE TABLE IF NOT EXISTS qc_recruit_candidates (
  id            BIGSERIAL PRIMARY KEY,
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  celular       TEXT NOT NULL,
  email         TEXT NOT NULL DEFAULT '',
  municipio_id  BIGINT REFERENCES qc_recruit_municipios(id) ON DELETE SET NULL,
  fuente        TEXT NOT NULL DEFAULT 'otro'
                CHECK (fuente IN ('indeed', 'computrabajo', 'referido', 'otro')),
  etapa         TEXT NOT NULL DEFAULT 'nuevo'
                CHECK (etapa IN ('nuevo', 'contactado', 'interesado', 'en_activacion', 'activo', 'inactivo')),
  notas         TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, celular)
);

CREATE INDEX IF NOT EXISTS idx_qc_recruit_candidates_org ON qc_recruit_candidates(org_id, etapa);
CREATE INDEX IF NOT EXISTS idx_qc_recruit_candidates_municipio ON qc_recruit_candidates(municipio_id);

-- ============================================================
-- Control individual de contactos (historial tipo conversación)
-- Cada cambio de etapa —o comentario suelto— queda como una entrada.
-- ============================================================
CREATE TABLE IF NOT EXISTS qc_recruit_contactos (
  id              BIGSERIAL PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  candidate_id    BIGINT NOT NULL REFERENCES qc_recruit_candidates(id) ON DELETE CASCADE,
  actor_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  etapa_anterior  TEXT,
  etapa_nueva     TEXT,
  comentario      TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_recruit_contactos_candidate
  ON qc_recruit_contactos(candidate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qc_recruit_contactos_org ON qc_recruit_contactos(org_id);

-- ============================================================
-- Páginas de publicaciones (sourcing Indeed/Computrabajo)
-- ============================================================
CREATE TABLE IF NOT EXISTS qc_recruit_publicaciones (
  id                 BIGSERIAL PRIMARY KEY,
  org_id             UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  titulo             TEXT NOT NULL,
  portal             TEXT NOT NULL DEFAULT 'indeed'
                     CHECK (portal IN ('indeed', 'computrabajo', 'otro')),
  municipio_id       BIGINT REFERENCES qc_recruit_municipios(id) ON DELETE SET NULL,
  fecha_publicacion  DATE,
  vistas             INT NOT NULL DEFAULT 0,
  postulaciones      INT NOT NULL DEFAULT 0,
  estado             TEXT NOT NULL DEFAULT 'activa'
                     CHECK (estado IN ('activa', 'pausada', 'cerrada')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_recruit_publicaciones_org ON qc_recruit_publicaciones(org_id);

-- ============================================================
-- Historial de importes (automatización de sourcing → BD)
-- Fuente inicial: CSV (export manual de Indeed/Computrabajo).
-- Un provider 'gmail' se puede sumar después sin migrar de nuevo,
-- reutilizando esta misma tabla de corridas.
-- ============================================================
CREATE TABLE IF NOT EXISTS qc_recruit_import_runs (
  id                BIGSERIAL PRIMARY KEY,
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source            TEXT NOT NULL DEFAULT 'csv'
                    CHECK (source IN ('csv', 'gmail')),
  status            TEXT NOT NULL DEFAULT 'success'
                    CHECK (status IN ('success', 'error', 'partial')),
  created_count     INT NOT NULL DEFAULT 0,
  duplicate_count   INT NOT NULL DEFAULT 0,
  error_count       INT NOT NULL DEFAULT 0,
  details           JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_recruit_import_runs_org
  ON qc_recruit_import_runs(org_id, created_at DESC);

-- ============================================================
-- Permisos QC-12
-- ============================================================
INSERT INTO qc_permissions (key, name, description, module) VALUES
  ('qc:recruit:read',   'Ver reclutamiento',      'Consultar candidatos, municipios y publicaciones', 'qc'),
  ('qc:recruit:manage', 'Gestionar reclutamiento', 'Crear/editar candidatos, cambiar etapas, importar', 'qc')
ON CONFLICT (key) DO NOTHING;

-- admin hereda todos los permisos existentes (incluye los nuevos de arriba)
INSERT INTO qc_role_permissions (role_key, permission_key)
SELECT 'admin', key FROM qc_permissions
ON CONFLICT DO NOTHING;

INSERT INTO qc_role_permissions (role_key, permission_key) VALUES
  ('supervisor',  'qc:recruit:read'),
  ('supervisor',  'qc:recruit:manage'),
  ('coordinador', 'qc:recruit:read'),
  ('coordinador', 'qc:recruit:manage')
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE qc_recruit_municipios ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_recruit_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_recruit_contactos ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_recruit_publicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_recruit_import_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qc_recruit_municipios_select" ON qc_recruit_municipios;
CREATE POLICY "qc_recruit_municipios_select" ON qc_recruit_municipios
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.qc_user_org_ids()));

DROP POLICY IF EXISTS "qc_recruit_municipios_write" ON qc_recruit_municipios;
CREATE POLICY "qc_recruit_municipios_write" ON qc_recruit_municipios
  FOR ALL TO authenticated
  USING (public.qc_user_has_permission(org_id, 'qc:recruit:manage'))
  WITH CHECK (public.qc_user_has_permission(org_id, 'qc:recruit:manage'));

DROP POLICY IF EXISTS "qc_recruit_candidates_select" ON qc_recruit_candidates;
CREATE POLICY "qc_recruit_candidates_select" ON qc_recruit_candidates
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.qc_user_org_ids()));

DROP POLICY IF EXISTS "qc_recruit_candidates_write" ON qc_recruit_candidates;
CREATE POLICY "qc_recruit_candidates_write" ON qc_recruit_candidates
  FOR ALL TO authenticated
  USING (public.qc_user_has_permission(org_id, 'qc:recruit:manage'))
  WITH CHECK (public.qc_user_has_permission(org_id, 'qc:recruit:manage'));

DROP POLICY IF EXISTS "qc_recruit_contactos_select" ON qc_recruit_contactos;
CREATE POLICY "qc_recruit_contactos_select" ON qc_recruit_contactos
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.qc_user_org_ids()));

DROP POLICY IF EXISTS "qc_recruit_contactos_write" ON qc_recruit_contactos;
CREATE POLICY "qc_recruit_contactos_write" ON qc_recruit_contactos
  FOR ALL TO authenticated
  USING (public.qc_user_has_permission(org_id, 'qc:recruit:manage'))
  WITH CHECK (public.qc_user_has_permission(org_id, 'qc:recruit:manage'));

DROP POLICY IF EXISTS "qc_recruit_publicaciones_select" ON qc_recruit_publicaciones;
CREATE POLICY "qc_recruit_publicaciones_select" ON qc_recruit_publicaciones
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.qc_user_org_ids()));

DROP POLICY IF EXISTS "qc_recruit_publicaciones_write" ON qc_recruit_publicaciones;
CREATE POLICY "qc_recruit_publicaciones_write" ON qc_recruit_publicaciones
  FOR ALL TO authenticated
  USING (public.qc_user_has_permission(org_id, 'qc:recruit:manage'))
  WITH CHECK (public.qc_user_has_permission(org_id, 'qc:recruit:manage'));

DROP POLICY IF EXISTS "qc_recruit_import_runs_select" ON qc_recruit_import_runs;
CREATE POLICY "qc_recruit_import_runs_select" ON qc_recruit_import_runs
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.qc_user_org_ids()));

DROP POLICY IF EXISTS "qc_recruit_import_runs_write" ON qc_recruit_import_runs;
CREATE POLICY "qc_recruit_import_runs_write" ON qc_recruit_import_runs
  FOR ALL TO authenticated
  USING (public.qc_user_has_permission(org_id, 'qc:recruit:manage'))
  WITH CHECK (public.qc_user_has_permission(org_id, 'qc:recruit:manage'));

-- Nota: service_role del backend bypass RLS en tablas qc_*.
-- No se tocan tablas de Whispper ni managed_projects.
