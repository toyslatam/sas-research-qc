-- ============================================================
-- SAS RESEARCH — QC-2
-- Proyectos QC + clientes (ADITIVO)
-- No modifica Whispper ni managed_projects
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Requiere: supabase_migration_qc_0_1.sql
-- ============================================================

-- Clientes: columnas extra opcionales
ALTER TABLE qc_clients
  ADD COLUMN IF NOT EXISTS contact_name TEXT NOT NULL DEFAULT '';

ALTER TABLE qc_clients
  ADD COLUMN IF NOT EXISTS contact_email TEXT NOT NULL DEFAULT '';

ALTER TABLE qc_clients
  ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

ALTER TABLE qc_clients
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================================
-- Proyectos QC (tabla propia, NO es `projects` ni `managed_projects`)
-- ============================================================
CREATE TABLE IF NOT EXISTS qc_projects (
  id            BIGSERIAL PRIMARY KEY,
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id     BIGINT REFERENCES qc_clients(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  code          TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'borrador'
                CHECK (status IN ('borrador', 'activo', 'en_pausa', 'cerrado')),
  country       TEXT NOT NULL DEFAULT '',
  methodology   TEXT NOT NULL DEFAULT '',
  start_date    DATE,
  end_date      DATE,
  settings      JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_projects_org ON qc_projects(org_id);
CREATE INDEX IF NOT EXISTS idx_qc_projects_client ON qc_projects(client_id);
CREATE INDEX IF NOT EXISTS idx_qc_projects_status ON qc_projects(org_id, status);

-- Unique code per org when code is not empty
CREATE UNIQUE INDEX IF NOT EXISTS uq_qc_projects_org_code
  ON qc_projects (org_id, code)
  WHERE code <> '';

-- ============================================================
-- RLS proyectos
-- ============================================================
ALTER TABLE qc_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qc_projects_select" ON qc_projects;
CREATE POLICY "qc_projects_select" ON qc_projects
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.qc_user_org_ids()));

DROP POLICY IF EXISTS "qc_projects_insert" ON qc_projects;
CREATE POLICY "qc_projects_insert" ON qc_projects
  FOR INSERT TO authenticated
  WITH CHECK (public.qc_user_has_permission(org_id, 'qc:projects:write'));

DROP POLICY IF EXISTS "qc_projects_update" ON qc_projects;
CREATE POLICY "qc_projects_update" ON qc_projects
  FOR UPDATE TO authenticated
  USING (public.qc_user_has_permission(org_id, 'qc:projects:write'))
  WITH CHECK (public.qc_user_has_permission(org_id, 'qc:projects:write'));

DROP POLICY IF EXISTS "qc_projects_delete" ON qc_projects;
CREATE POLICY "qc_projects_delete" ON qc_projects
  FOR DELETE TO authenticated
  USING (public.qc_user_has_permission(org_id, 'qc:projects:write'));

-- Clientes: permitir escritura también con qc:projects:write (además de org:manage)
DROP POLICY IF EXISTS "qc_clients_write" ON qc_clients;
CREATE POLICY "qc_clients_write" ON qc_clients
  FOR ALL TO authenticated
  USING (
    public.qc_user_has_permission(org_id, 'qc:org:manage')
    OR public.qc_user_has_permission(org_id, 'qc:projects:write')
  )
  WITH CHECK (
    public.qc_user_has_permission(org_id, 'qc:org:manage')
    OR public.qc_user_has_permission(org_id, 'qc:projects:write')
  );
