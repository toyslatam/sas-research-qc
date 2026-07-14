# Deploy rápido — SAS RESEARCH QC

## Local (ya configurado)

- `.env` → `PORT=4001` y `NEXT_PUBLIC_API_URL=http://localhost:4001`
- Whispper puede seguir en `4000`

```powershell
cd C:\Users\Research\Documents\TRABAJO\APP\SAS_Research_QC
npm run dev:backend
# otra terminal
npm run dev:web
```

---

## Producción: Railway (API) + Vercel (Web)

Repo: https://github.com/toyslatam/sas-research-qc  
Supabase: el **mismo** proyecto.

### A) Railway — API

1. Entra a https://railway.app → **New Project** → **Deploy from GitHub**
2. Autoriza y elige `toyslatam/sas-research-qc`
3. En el servicio, **Variables** (Settings → Variables):

| Variable | Valor |
|----------|--------|
| `SUPABASE_URL` | (igual que .env local) |
| `SUPABASE_SERVICE_ROLE_KEY` | (igual) |
| `SUPABASE_ANON_KEY` | (igual) |
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGINS` | `https://TU-PROYECTO.vercel.app` (lo actualizas cuando tengas Vercel) |
| `GOOGLE_SHEETS_ENABLED` | `false` (o true + credenciales) |

4. Settings → **Generate Domain** → copia URL, ej. `https://sas-research-qc-production.up.railway.app`
5. Prueba: `https://TU-URL.up.railway.app/api/health`

El `nixpacks.toml` / `railway.json` ya definen build + `npm run start -w backend`.

### B) Vercel — Web

1. https://vercel.com/new → Import `toyslatam/sas-research-qc`
2. **Root Directory:** `web` (Edit → `web`)
3. Framework: Next.js (auto)
4. **Environment Variables:**

| Variable | Valor |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | URL de Railway **sin** `/` final |
| `NEXT_PUBLIC_SUPABASE_URL` | mismo Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | misma anon key |
| `SUPABASE_URL` | mismo (para next.config) |
| `SUPABASE_ANON_KEY` | misma |

5. Deploy → copia dominio `https://….vercel.app`
6. Vuelve a Railway y actualiza `ALLOWED_ORIGINS` con ese dominio

### C) Supabase Auth

Authentication → URL Configuration:

- **Site URL:** `https://….vercel.app`
- **Redirect URLs:**  
  - `https://….vercel.app/auth/callback`  
  - `https://….vercel.app/reset-password`  
  - (deja también localhost para desarrollo)

---

## Orden recomendado

1. Railway primero (obtener URL API)  
2. Vercel con esa URL en `NEXT_PUBLIC_API_URL`  
3. Ajustar Auth + `ALLOWED_ORIGINS`  
4. Abrir Vercel → login → `/m/qc`
