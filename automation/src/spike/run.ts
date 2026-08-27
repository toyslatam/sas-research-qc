import { openPersistentContext, waitForEnter, profileDir, type Platform } from '../core/browser';
import { inspectPage, printReport, saveReport } from '../core/inspect';

/**
 * SPIKE — reconocimiento. No es el adapter final ni escribe en Supabase:
 * solo mira la página que el usuario tiene delante y reporta qué es
 * aprovechable. Deliberadamente no navega solo ni asume selectores.
 *
 * Contesta las cuatro preguntas que deciden si el proyecto sigue:
 *   1. ¿La sesión guardada sobrevive entre corridas? (si no, no hay desatendido)
 *   2. ¿Aparece verificación al reabrir?
 *   3. ¿El teléfono es texto del DOM o vive en un PDF/imagen? (→ OCR)
 *   4. ¿Qué selectores estables hay para lista y detalle?
 */

const MAX_MUESTRAS = 6;

export async function runProbe(platform: Platform, inicio: string): Promise<void> {
  console.log(`\n=== SPIKE ${platform.toUpperCase()} — reconocimiento ===`);
  console.log(`Perfil: ${profileDir(platform)}`);
  console.log('Este script no guarda candidatos ni modifica nada en la plataforma.\n');

  const context = await openPersistentContext(platform);
  const page = context.pages()[0] ?? (await context.newPage());

  try {
    await page.goto(inicio, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  } catch (err) {
    console.log(`No se pudo abrir ${inicio}: ${err instanceof Error ? err.message : err}`);
  }

  // Primer chequeo, antes de que el usuario toque nada: aquí se ve si la
  // sesión guardada sirvió o si la plataforma pide login/verificación.
  const alEntrar = await inspectPage(page);
  console.log('\n### Estado al abrir (sin que toques nada) ###');
  console.log(`URL: ${alEntrar.url}`);
  console.log(`¿Parece pedir verificación?  ${alEntrar.challenge.sospecha ? '⚠️  SÍ' : '✅ No'}`);
  await saveReport(page, alEntrar, `${platform}-al-entrar`);

  let n = 0;
  for (;;) {
    const entrada = await waitForEnter(
      [
        'Navega en el navegador a lo que quieras analizar:',
        '  · la LISTA de candidatos  → para ver cómo se detecta cada fila',
        '  · el DETALLE de uno       → para ver si el teléfono es texto o PDF',
        '',
        'Vuelve aquí y pulsa ENTER para analizar la página actual.',
        'Escribe "fin" + ENTER para terminar.',
      ].join('\n'),
    );
    if (entrada === 'fin' || entrada === 'salir') break;

    n += 1;
    const report = await inspectPage(page);
    printReport(report);
    const base = await saveReport(page, report, `${platform}-pagina-${n}`);
    console.log(`Guardado: ${base}.json y ${base}.png`);

    if (n >= MAX_MUESTRAS) {
      console.log('Suficientes muestras. Cerrando.');
      break;
    }
  }

  console.log('\nCerrando navegador. La sesión queda guardada en el perfil.');
  console.log('Vuelve a correr este script: si NO te pide login, lo desatendido es viable.\n');
  await context.close();
}
