# Automation worker — captura de candidatos

Worker de automatización de navegador para Indeed / Computrabajo.
**Corre siempre en la máquina local. Nunca en Vercel ni en Railway.**

## Estado: FASE 1 — spike de reconocimiento

Todavía **no** hay adapters, ni escritura en Supabase, ni scoring. Lo único que
existe es un script de reconocimiento que mira las páginas y reporta qué es
aprovechable, para no escribir selectores inventados.

## Qué contesta el spike

1. **¿La sesión guardada sobrevive entre corridas?** Si no, no hay desatendido posible.
2. **¿Aparece verificación al reabrir?**
3. **¿El teléfono es texto del DOM o vive dentro de un PDF/imagen?** Si es lo
   segundo, hace falta OCR y eso es otra fase entera.
4. **¿Qué selectores estables hay?** (`data-testid`, `aria-label`, `role`…)

## Uso

```bash
npm run probe:computrabajo -w automation
```

```bash
npm run probe:indeed -w automation
```

**Primera corrida:** se abre el navegador. Inicias sesión **a mano**. Si aparece
una verificación, la resuelves tú. El script no automatiza el login ni resuelve
challenges — a propósito.

**Después:** navegas a la lista de candidatos o al detalle de uno, vuelves a la
terminal y pulsas ENTER. El script analiza lo que tengas en pantalla y guarda un
reporte en `reports/`. Puedes analizar varias páginas seguidas. `fin` + ENTER cierra.

**Segunda corrida (la importante):** vuelve a lanzarlo otro día. Si abre ya
autenticado y sin pedirte nada, lo desatendido es viable. Si te vuelve a pedir
login, hay que replantear el diseño.

## Qué NO hace, y no es un descuido

- No automatiza el inicio de sesión
- No resuelve CAPTCHAs
- No falsifica fingerprint, user-agent ni IP
- No navega solo ni descarga nada
- No guarda candidatos en la base

Si aparece un mecanismo de seguridad, el flujo se detiene y lo atiende una persona.

## Datos sensibles

`.sessions/` guarda las cookies de tu cuenta de empleador y `reports/` puede
contener datos de candidatos reales. Los dos están en `.gitignore` y **no deben
salir de tu máquina**.
