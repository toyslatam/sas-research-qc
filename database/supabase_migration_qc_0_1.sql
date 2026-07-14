-- ============================================================
-- SAS RESEARCH — QC-0 / QC-1
-- Multi-tenant Control de Calidad (ADITIVO)
-- No modifica tablas de Whispper (projects/interviews/questions/etc.)
-- No modifica managed_projects
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Extender organizations (columnas nuevas opcionales)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS legal_name TEXT NOT NULL DEFAULT '';

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_status_check'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_status_check
      CHECK (status IN ('active', 'suspended', 'trial'));
  END IF;
END $$;

-- ============================================================
-- Catálogo de roles QC (independiente de profiles.role de Whispper)
-- ============================================================
CREATE TABLE IF NOT EXISTS qc_roles (
  key          TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  sort_order   INT NOT NULL DEFAULT 0
);

INSERT INTO qc_roles (key, name, description, sort_order) VALUES
  ('admin',        'Administrador', 'Administra la empresa y configuración QC', 10),
  ('supervisor',   'Supervisor',    'Supervisa proyectos y revisores', 20),
  ('coordinador',  'Coordinador',   'Coordina asignaciones y flujos', 30),
  ('revisor',      'Revisor',       'Ejecuta revisiones de ubicación/contenido/teléfono', 40),
  ('auditor',      'Auditor',       'Auditoría y control de calidad final', 50),
  ('cliente',      'Cliente',       'Acceso de solo lectura a resultados', 60)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Permisos QC configurables
-- ============================================================
CREATE TABLE IF NOT EXISTS qc_permissions (
  key          TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  module       TEXT NOT NULL DEFAULT 'qc'
);

INSERT INTO qc_permissions (key, name, description, module) VALUES
  ('qc:org:manage',       'Gestionar organización',     'Crear/editar empresa y settings', 'qc'),
  ('qc:members:manage',   'Gestionar miembros',         'Invitar y asignar roles', 'qc'),
  ('qc:projects:read',    'Ver proyectos QC',           'Listar proyectos de calidad', 'qc'),
  ('qc:projects:write',   'Editar proyectos QC',        'Crear/editar proyectos QC', 'qc'),
  ('qc:surveys:read',     'Ver encuestas',              'Consultar encuestas', 'qc'),
  ('qc:surveys:review',   'Revisar encuestas',          'Ejecutar etapas de revisión', 'qc'),
  ('qc:rules:manage',     'Gestionar reglas',           'Motor de reglas del proyecto', 'qc'),
  ('qc:integrations:manage','Gestionar integraciones',  'Conectores y webhooks', 'qc'),
  ('qc:audit:read',       'Ver auditoría',              'Consultar logs de auditoría', 'qc'),
  ('qc:reports:read',     'Ver reportes QC',            'Dashboards y exportaciones', 'qc')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS qc_role_permissions (
  role_key       TEXT NOT NULL REFERENCES qc_roles(key) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES qc_permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role_key, permission_key)
);

-- Seed permisos por rol
INSERT INTO qc_role_permissions (role_key, permission_key)
SELECT 'admin', key FROM qc_permissions
ON CONFLICT DO NOTHING;

INSERT INTO qc_role_permissions (role_key, permission_key) VALUES
  ('supervisor', 'qc:projects:read'),
  ('supervisor', 'qc:projects:write'),
  ('supervisor', 'qc:surveys:read'),
  ('supervisor', 'qc:surveys:review'),
  ('supervisor', 'qc:rules:manage'),
  ('supervisor', 'qc:reports:read'),
  ('supervisor', 'qc:audit:read'),
  ('coordinador', 'qc:projects:read'),
  ('coordinador', 'qc:surveys:read'),
  ('coordinador', 'qc:surveys:review'),
  ('coordinador', 'qc:reports:read'),
  ('revisor', 'qc:projects:read'),
  ('revisor', 'qc:surveys:read'),
  ('revisor', 'qc:surveys:review'),
  ('auditor', 'qc:projects:read'),
  ('auditor', 'qc:surveys:read'),
  ('auditor', 'qc:audit:read'),
  ('auditor', 'qc:reports:read'),
  ('cliente', 'qc:projects:read'),
  ('cliente', 'qc:surveys:read'),
  ('cliente', 'qc:reports:read')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Membresías usuario ↔ organización (aislamiento multiempresa)
-- ============================================================
CREATE TABLE IF NOT EXISTS qc_org_memberships (
  id          BIGSERIAL PRIMARY KEY,
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_key    TEXT NOT NULL REFERENCES qc_roles(key),
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'invited', 'suspended')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_qc_memberships_user ON qc_org_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_qc_memberships_org ON qc_org_memberships(org_id);

-- ============================================================
-- Clientes de la empresa (para futuros proyectos QC)
-- ============================================================
CREATE TABLE IF NOT EXISTS qc_clients (
  id          BIGSERIAL PRIMARY KEY,
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  code        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_qc_clients_org ON qc_clients(org_id);

-- ============================================================
-- Helpers RLS
-- ============================================================
CREATE OR REPLACE FUNCTION public.qc_user_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id
  FROM qc_org_memberships
  WHERE user_id = auth.uid()
    AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.qc_user_has_permission(p_org_id UUID, p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM qc_org_memberships m
    JOIN qc_role_permissions rp ON rp.role_key = m.role_key
    WHERE m.user_id = auth.uid()
      AND m.org_id = p_org_id
      AND m.status = 'active'
      AND rp.permission_key = p_permission
  );
$$;

-- ============================================================
-- RLS (solo tablas QC nuevas + organizations lectura restringida)
-- ============================================================
ALTER TABLE qc_org_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_role_permissions ENABLE ROW LEVEL SECURITY;

-- Catálogos legibles por usuarios autenticados
DROP POLICY IF EXISTS "qc_roles_read_auth" ON qc_roles;
CREATE POLICY "qc_roles_read_auth" ON qc_roles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "qc_permissions_read_auth" ON qc_permissions;
CREATE POLICY "qc_permissions_read_auth" ON qc_permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "qc_role_permissions_read_auth" ON qc_role_permissions;
CREATE POLICY "qc_role_permissions_read_auth" ON qc_role_permissions
  FOR SELECT TO authenticated USING (true);

-- Membresías: ver solo las de mis orgs
DROP POLICY IF EXISTS "qc_memberships_select_own_orgs" ON qc_org_memberships;
CREATE POLICY "qc_memberships_select_own_orgs" ON qc_org_memberships
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.qc_user_org_ids()));

DROP POLICY IF EXISTS "qc_memberships_manage" ON qc_org_memberships;
CREATE POLICY "qc_memberships_manage" ON qc_org_memberships
  FOR ALL TO authenticated
  USING (public.qc_user_has_permission(org_id, 'qc:members:manage'))
  WITH CHECK (public.qc_user_has_permission(org_id, 'qc:members:manage'));

-- Clientes aislados por org
DROP POLICY IF EXISTS "qc_clients_select" ON qc_clients;
CREATE POLICY "qc_clients_select" ON qc_clients
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.qc_user_org_ids()));

DROP POLICY IF EXISTS "qc_clients_write" ON qc_clients;
CREATE POLICY "qc_clients_write" ON qc_clients
  FOR ALL TO authenticated
  USING (public.qc_user_has_permission(org_id, 'qc:org:manage'))
  WITH CHECK (public.qc_user_has_permission(org_id, 'qc:org:manage'));

-- NO se activa RLS en `organizations` (tabla compartida con Whispper).
-- El aislamiento multiempresa QC se aplica en qc_org_memberships + API /api/qc.
-- Nota: service_role del backend bypass RLS en tablas qc_*.
-- Las tablas Whispper (projects/interviews/managed_projects/...) NO se tocan.
