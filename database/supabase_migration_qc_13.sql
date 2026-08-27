-- ============================================================
-- SAS RESEARCH — QC-13
-- Seguimiento Encuestadores: conexión Gmail para sourcing (ADITIVO)
-- Requiere: qc_0_1 … qc_12
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Una conexión Gmail por organización. El refresh_token vive solo en el
-- backend (service_role bypassa RLS); nunca se expone vía API al frontend.
CREATE TABLE IF NOT EXISTS qc_recruit_gmail_connections (
  org_id         UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  email          TEXT NOT NULL,
  refresh_token  TEXT NOT NULL,
  connected_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE qc_recruit_gmail_connections ENABLE ROW LEVEL SECURITY;

-- Solo se expone el email conectado (nunca el refresh_token) vía el
-- endpoint /gmail/status del backend, que usa service_role y filtra las
-- columnas explícitamente. Aun así, RLS restringe por org por defensa en
-- profundidad si algo llegara a consultar la tabla con el cliente anon/auth.
DROP POLICY IF EXISTS "qc_recruit_gmail_connections_select" ON qc_recruit_gmail_connections;
CREATE POLICY "qc_recruit_gmail_connections_select" ON qc_recruit_gmail_connections
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.qc_user_org_ids()));

DROP POLICY IF EXISTS "qc_recruit_gmail_connections_write" ON qc_recruit_gmail_connections;
CREATE POLICY "qc_recruit_gmail_connections_write" ON qc_recruit_gmail_connections
  FOR ALL TO authenticated
  USING (public.qc_user_has_permission(org_id, 'qc:recruit:manage'))
  WITH CHECK (public.qc_user_has_permission(org_id, 'qc:recruit:manage'));

-- Nota: service_role del backend bypass RLS. No se tocan tablas de Whispper.
