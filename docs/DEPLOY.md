# Deploy — SAS RESEARCH QC

## Qué es cada URL

| URL | Qué es | Qué verás |
|-----|--------|-----------|
| Railway / `powerbiresearch.online` | **Solo API** (Express) | `/` → JSON · `/api/health` → ok |
| `*.vercel.app` | **Web** (Next.js) | Login + Control de Calidad |

---

## Vercel (web) — configuración crítica

**Root Directory debe ser exactamente `web`.**  
Settings → General → Root Directory → `web` → Save.

Si en Build Logs ves esto, está mal configurado (está buildando el API):
```
> backend@1.0.0 build
> tsc
```

Lo correcto es ver algo como:
```
> web@1.0.0 build
> next build
```

**Build** (ya viene en `web/vercel.json`):
- Install: `cd .. && npm install`
- Build: `cd .. && npm run build -w shared && npm run build -w web`

> Importante: con Root = `web`, el monorepo está en `..` (un nivel).  
> El API **no** se despliega en Vercel — va en Railway.

### Variables (Production + Preview)

| Variable | Valor |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://powerbiresearch.online` o tu Railway (sin `/` final) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |

Después de cambiar vars → **Deployments → … → Redeploy** (ideal: *Clear cache and redeploy*).

### Si sigue `FUNCTION_INVOCATION_FAILED`

1. Vercel → Deployments → último deploy → **Function Logs** / **Build Logs**
2. Confirma que el Root Directory es exactamente `web`
3. Confirma que las 3 vars están en **Production** (no solo Development)
4. En Supabase Auth → URL Configuration, agrega:
   - Site URL: `https://tu-app.vercel.app`
   - Redirect: `https://tu-app.vercel.app/auth/callback`
   - Redirect: `https://tu-app.vercel.app/reset-password`

## Railway (API)

| Variable | Valor |
|----------|--------|
| `SUPABASE_URL` | mismo proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | service role |
| `SUPABASE_ANON_KEY` | anon |
| `NODE_ENV` | `production` |

## Comprobar

1. API: `https://powerbiresearch.online/api/health` → `{ "status": "ok", ... }`
2. Web: `https://tu-app.vercel.app` → pantalla de login (no 500)
