# Deploy — SAS RESEARCH QC

## Qué es cada URL

| URL | Qué es | Qué verás |
|-----|--------|-----------|
| `*.up.railway.app` | **Solo API** (Express) | `/` → JSON · `/api/health` → ok |
| `*.vercel.app` | **Web** (Next.js) | Login + Control de Calidad |

`Cannot GET /` en Railway era porque no había ruta `/`. Ya responde JSON.

---

## Variables obligatorias en Vercel

Settings → Environment Variables (Production + Preview):

| Variable | Valor |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://web-production-24104.up.railway.app` (sin `/` final) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |

**Root Directory:** `web`  
Después de guardar → **Redeploy**.

## Variables en Railway

| Variable | Valor |
|----------|--------|
| `SUPABASE_URL` | mismo |
| `SUPABASE_SERVICE_ROLE_KEY` | service role |
| `SUPABASE_ANON_KEY` | anon |
| `NODE_ENV` | `production` |

## Comprobar

1. `https://web-production-24104.up.railway.app/api/health`
2. `https://TU-APP.vercel.app`
