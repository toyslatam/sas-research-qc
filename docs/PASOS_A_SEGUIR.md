# Pasos a seguir

Documento de continuidad del producto **Control de Calidad (QC) / SAS RESEARCH**.

> **Repo:** este producto vive en **`SAS_Research_QC`** (GitHub distinto a Whispper).  
> **Supabase:** se usa el **mismo proyecto** que Whispper (tablas `qc_*` aditivas).

---

## Estado actual (hecho)

| Fase | Qué incluye |
|------|-------------|
| QC-0 / QC-1 | Multi-tenant, orgs, roles, permisos, módulo en launcher |
| QC-2 | Proyectos QC + clientes |
| QC-3 | Encuestas + etapas (ubicación / contenido / teléfono) |
| QC-4 | Motor de reglas |
| QC-5 | Evidencias (URL/nota) + auditoría |
| QC-6 | Integraciones Sheets / Zoho (conectores) |
| QC-7 | Dashboard KPIs |
| QC-8 | Sync real → crea/actualiza `qc_surveys` |
| QC-9 | Auto-acciones de reglas + webhooks |
| QC-10 | Upload de evidencias a Supabase Storage |
| QC-11 | Reportes (resumen + export CSV/JSON) |
| **Repo split** | App extraída a carpeta/repo `SAS_Research_QC` (mismo Supabase) |

Migraciones SQL (en orden): `qc_0_1` → `qc_11` en `database/supabase_migration_qc_*.sql`.

---

## Paso 0 — Validar en vivo (antes de más features)

1. Confirmar migraciones QC aplicadas en el Supabase compartido (`qc_8` … `qc_11` si faltaban).
2. En **este** repo: `npm install` → `npm run dev:backend` + `npm run dev:web`.
3. Smoke test:
   - Login → Control de Calidad
   - Org → proyecto → sync → encuestas
   - Auto-reglas → evidencia con archivo → reporte CSV
4. Whispper sigue en su repo/carpeta aparte; no debe romperse al usar el mismo Supabase.

---

## Paso 1 — Publicar en GitHub (otro remoto) — EN CURSO

- [x] Carpeta/app independiente `SAS_Research_QC`
- [x] Sin desktop / pipeline Whispper en el entrypoint API
- [x] Mismo `.env` Supabase (local; **no** commitear `.env`)
- [ ] Crear repo en GitHub y `git push -u origin main`
- [ ] README / CI según necesidad

Nombre sugerido del remoto: `sas-research-qc` (o el que elijan en la org).

---

## Paso 2 — QC-12: Seguridad API + UI por permisos (siguiente desarrollo)

Hoy el backend confía en `userId` / `actorUserId` enviados por el cliente.

- Validar **JWT de Supabase** en `/api/qc/*`
- Derivar el usuario del token (no del body)
- En UI: ocultar acciones según rol (Sync, aplicar reglas, webhooks, borrar, etc.)

---

## Paso 3 — Producto QC (después de seguridad)

| Orden | Tema | Notas |
|-------|------|--------|
| QC-13 | Notificaciones WhatsApp / email | Webhooks ya existen como gancho |
| QC-14 | Sync incremental Sheets | Cursor / `last_sync` / solo filas nuevas |
| QC-15 | Export PDF de reportes | Encima del CSV/JSON actual |
| QC-16 | Revisión masiva | Aprobar / rechazar varias encuestas |

---

## Paso 4 — Plataforma / ops

- Deploy web + backend (dominios propios, distintos a Whispper)
- En Supabase Auth: agregar Redirect URLs del dominio QC
- Backup y RLS revisados (proyecto compartido: cuidar políticas)

---

## Checklist publicación GitHub

- [x] Código QC en repo/carpeta propia
- [x] `.gitignore` excluye `.env`
- [ ] Remoto GitHub distinto a Whispper
- [ ] Push inicial
- [ ] Smoke test desde este repo
- [ ] QC-12 (JWT) antes de exponer a internet

---

*Última actualización: extracción a `SAS_Research_QC` con Supabase compartido. Siguiente: push a GitHub + QC-12.*
