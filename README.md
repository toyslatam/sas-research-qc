# SAS RESEARCH — Control de Calidad (QC)

Aplicación **independiente** de Whispper para control de calidad de encuestas de campo.

- **Repositorio:** propio (no es el remoto de Whispper)
- **Supabase:** puede ser el **mismo proyecto** (tablas `qc_*` aditivas; no pisa interviews/projects de Research)

## Stack

- `web` — Next.js 14 (launcher + módulo `/m/qc`)
- `backend` — Express (`/api/qc`, `/api/health`)
- `shared` — tipos TypeScript
- `database/` — migraciones SQL QC (+ auth profiles si hace falta)

## Arranque local

```bash
# En la raíz de este repo
cp .env.example .env
# Completar SUPABASE_* con el mismo proyecto que Whispper (si compartes instancia)

npm install
npm run dev:backend
# otra terminal
npm run dev:web
```

- Web: http://localhost:3000  
- API: http://localhost:4000  

## Migraciones Supabase

En el SQL Editor del proyecto (mismo que Whispper si aplica), en orden:

1. `database/supabase_migration_auth_profiles.sql` (si aún no está)
2. `database/supabase_migration_qc_0_1.sql` … hasta `qc_11.sql`

Si ya corriste las migraciones QC desde Whispper_App, **no hace falta volver a ejecutarlas**.

## Módulo QC

Entrada: `/m/qc` → dashboard.

Incluye: organización, miembros, proyectos, clientes, encuestas, reglas, evidencias (Storage), integraciones, webhooks, auditoría, reportes.

## Próximos pasos

Ver [`docs/PASOS_A_SEGUIR.md`](docs/PASOS_A_SEGUIR.md) (QC-12 JWT, notificaciones, sync incremental, etc.).

## Relación con Whispper

| | Whispper_App | Este repo |
|--|--------------|-----------|
| Producto | Research Intelligence + desktop | Control de Calidad |
| GitHub | Repo Whispper | **Otro** repo |
| Supabase | Proyecto A | **Mismo A** (opcional) o proyecto nuevo |
| Tablas | interviews, projects, … | `qc_*` (+ orgs/auth compartidos) |
