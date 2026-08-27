import fs from 'fs';
import path from 'path';
import type { Page } from 'playwright';
import { ensureDir, reportsDir } from './browser';

/**
 * Reconocimiento de la página que el usuario tiene abierta.
 *
 * NO asume selectores ni URLs: mira lo que hay y reporta qué es aprovechable.
 * Su único objetivo es contestar, con evidencia, las preguntas que deciden si
 * el proyecto es viable:
 *
 *   1. ¿Hay verificación/challenge al entrar con la sesión guardada?
 *   2. ¿El teléfono está como texto en el DOM, o dentro de un documento
 *      embebido (PDF/imagen) que exigiría OCR?
 *   3. ¿Qué selectores estables existen para lista y detalle?
 */

/** Móviles colombianos: 10 dígitos empezando por 3, con o sin +57 y separadores. */
const CO_PHONE_RE = /(?:\+?57[\s.\-]?)?3\d{2}[\s.\-]?\d{3}[\s.\-]?\d{4}/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * El usuario avisó que la palabra "teléfono" no aparece en todas las hojas de
 * vida, así que el patrón numérico manda y la etiqueta es solo información
 * complementaria: sirve para saber si conviene buscar por etiqueta o no.
 */
const PHONE_LABEL_RE = /\b(tel[ée]fono|tel|celular|m[óo]vil|contacto|whatsapp)\b/i;

const CHALLENGE_RE =
  /(captcha|recaptcha|hcaptcha|turnstile|verificaci[óo]n|verify your|unusual activity|actividad inusual|no eres un robot|not a robot|acceso denegado|access denied|just a moment|un momento|checking your browser|comprobando tu navegador)/i;

/**
 * Cloudflare no siempre deja rastro en el texto: a veces el único indicio es el
 * token del challenge en la URL o un título tipo "Just a moment...". Mirar solo
 * el cuerpo daba falsos negativos —el caso real que motivó esto— y un detector
 * que no ve el bloqueo es peor que no tenerlo.
 */
const CF_URL_RE = /[?&](__cf_chl|__cf_chl_rt_tk|__cf_chl_jschl_tk|cf_chl_)/i;
const CF_HOST_RE = /challenges\.cloudflare\.com/i;

export interface PageReport {
  fecha: string;
  url: string;
  titulo: string;
  challenge: {
    sospecha: boolean;
    coincidencias: string[];
    iframesDeCaptcha: string[];
    /** Cloudflare detectado por token en la URL o por su script de challenge. */
    cloudflare: boolean;
  };
  telefono: {
    enTextoPlano: string[];
    hayEtiqueta: boolean;
    /** Si es true, el dato probablemente vive en un PDF/imagen → haría falta OCR. */
    posibleDocumentoEmbebido: boolean;
  };
  emails: string[];
  documentosEmbebidos: { tag: string; src: string; visible: boolean }[];
  selectoresEstables: { selector: string; cantidad: number; ejemplo: string }[];
  estructurasRepetidas: { selector: string; cantidad: number; muestra: string }[];
  longitudTexto: number;
}

export async function inspectPage(page: Page): Promise<PageReport> {
  const url = page.url();
  const titulo = await page.title();

  const datos = await page.evaluate(() => {
    const texto = document.body?.innerText ?? '';

    // Documentos embebidos: si el CV se renderiza aquí dentro, su texto NO
    // está en el DOM de la página padre y no hay forma de leerlo sin OCR.
    const embebidos: { tag: string; src: string; visible: boolean }[] = [];
    for (const el of Array.from(document.querySelectorAll('iframe, embed, object, canvas'))) {
      const rect = el.getBoundingClientRect();
      embebidos.push({
        tag: el.tagName.toLowerCase(),
        src:
          el.getAttribute('src') ??
          el.getAttribute('data') ??
          (el.tagName.toLowerCase() === 'canvas' ? '(canvas)' : ''),
        visible: rect.width > 50 && rect.height > 50,
      });
    }

    // Atributos que sobreviven a un rediseño, a diferencia de las clases
    // generadas por el bundler.
    const atributos = ['data-testid', 'data-cy', 'data-qa', 'aria-label', 'role', 'itemprop', 'name'];
    const selectores: { selector: string; cantidad: number; ejemplo: string }[] = [];
    for (const attr of atributos) {
      const nodos = Array.from(document.querySelectorAll(`[${attr}]`));
      const porValor = new Map<string, Element[]>();
      for (const n of nodos) {
        const v = n.getAttribute(attr) ?? '';
        if (!v) continue;
        const lista = porValor.get(v) ?? [];
        lista.push(n);
        porValor.set(v, lista);
      }
      for (const [valor, nodosDelValor] of porValor) {
        selectores.push({
          selector: `[${attr}="${valor}"]`,
          cantidad: nodosDelValor.length,
          ejemplo: (nodosDelValor[0].textContent ?? '').trim().slice(0, 80),
        });
      }
    }

    // Estructuras que se repiten muchas veces suelen ser la lista de candidatos.
    const repetidas: { selector: string; cantidad: number; muestra: string }[] = [];
    const porClase = new Map<string, Element[]>();
    for (const el of Array.from(document.querySelectorAll('li, article, tr, [role="listitem"], [role="row"]'))) {
      const clave = `${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[role="${el.getAttribute('role')}"]` : ''}`;
      const lista = porClase.get(clave) ?? [];
      lista.push(el);
      porClase.set(clave, lista);
    }
    for (const [clave, els] of porClase) {
      if (els.length >= 3) {
        repetidas.push({
          selector: clave,
          cantidad: els.length,
          muestra: (els[0].textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
        });
      }
    }

    const scripts = Array.from(document.querySelectorAll('script[src]'))
      .map((s) => s.getAttribute('src') ?? '')
      .filter(Boolean);

    return { texto, embebidos, selectores, repetidas, scripts };
  });

  const telefonos = Array.from(new Set(datos.texto.match(CO_PHONE_RE) ?? []));
  const emails = Array.from(new Set(datos.texto.match(EMAIL_RE) ?? []));
  const challengeMatches = Array.from(new Set(datos.texto.match(new RegExp(CHALLENGE_RE, 'gi')) ?? []));

  const iframesDeCaptcha = datos.embebidos
    .filter((e) => /captcha|challenge|turnstile/i.test(e.src))
    .map((e) => e.src);

  const cloudflare =
    CF_URL_RE.test(url) ||
    CF_HOST_RE.test(datos.scripts.join(' ')) ||
    datos.embebidos.some((e) => CF_HOST_RE.test(e.src)) ||
    /just a moment|un momento/i.test(titulo);

  const docsVisibles = datos.embebidos.filter((e) => e.visible);

  const report: PageReport = {
    fecha: new Date().toISOString(),
    url,
    titulo,
    challenge: {
      sospecha: challengeMatches.length > 0 || iframesDeCaptcha.length > 0 || cloudflare,
      coincidencias: challengeMatches,
      iframesDeCaptcha,
      cloudflare,
    },
    telefono: {
      enTextoPlano: telefonos,
      hayEtiqueta: PHONE_LABEL_RE.test(datos.texto),
      // Si no hay teléfono en el texto pero sí un documento embebido grande,
      // el dato casi seguro está dentro de ese documento.
      posibleDocumentoEmbebido: telefonos.length === 0 && docsVisibles.length > 0,
    },
    emails,
    documentosEmbebidos: datos.embebidos,
    selectoresEstables: datos.selectores.sort((a, b) => b.cantidad - a.cantidad).slice(0, 40),
    estructurasRepetidas: datos.repetidas.sort((a, b) => b.cantidad - a.cantidad).slice(0, 15),
    longitudTexto: datos.texto.length,
  };

  return report;
}

export async function saveReport(page: Page, report: PageReport, nombre: string): Promise<string> {
  const dir = reportsDir();
  ensureDir(dir);
  const base = path.join(dir, `${nombre}-${Date.now()}`);
  fs.writeFileSync(`${base}.json`, JSON.stringify(report, null, 2), 'utf8');
  await page.screenshot({ path: `${base}.png`, fullPage: false });
  return base;
}

export function printReport(report: PageReport): void {
  const linea = '─'.repeat(72);
  console.log(`\n${linea}`);
  console.log(`URL:    ${report.url}`);
  console.log(`Título: ${report.titulo}`);
  console.log(linea);

  console.log(`\n1. ¿Verificación / challenge?  ${report.challenge.sospecha ? '⚠️  SÍ' : '✅ No'}`);
  if (report.challenge.cloudflare) {
    console.log('   ⚠️  CLOUDFLARE está retando al navegador automatizado.');
    console.log('       Superar esto sería evasión de anti-bot: el flujo se detiene aquí.');
  }
  if (report.challenge.coincidencias.length > 0) {
    console.log(`   Palabras encontradas: ${report.challenge.coincidencias.join(', ')}`);
  }
  if (report.challenge.iframesDeCaptcha.length > 0) {
    console.log(`   Iframes de captcha: ${report.challenge.iframesDeCaptcha.join(', ')}`);
  }

  console.log(`\n2. Teléfono`);
  console.log(`   En texto del DOM: ${report.telefono.enTextoPlano.length > 0 ? `✅ ${report.telefono.enTextoPlano.length} encontrado(s)` : '❌ ninguno'}`);
  console.log(`   Etiqueta tipo "teléfono/celular": ${report.telefono.hayEtiqueta ? 'sí' : 'no'}`);
  if (report.telefono.posibleDocumentoEmbebido) {
    console.log(`   ⚠️  No hay teléfono en texto y sí documentos embebidos visibles.`);
    console.log(`       Probablemente está dentro del PDF/imagen → haría falta OCR.`);
  }

  console.log(`\n3. Correos en texto: ${report.emails.length}`);

  console.log(`\n4. Documentos embebidos: ${report.documentosEmbebidos.length}`);
  for (const d of report.documentosEmbebidos.filter((x) => x.visible).slice(0, 5)) {
    console.log(`   <${d.tag}> ${d.src.slice(0, 90)}`);
  }

  console.log(`\n5. Selectores estables (top 10):`);
  for (const s of report.selectoresEstables.slice(0, 10)) {
    console.log(`   ${s.cantidad.toString().padStart(3)}×  ${s.selector}`);
    if (s.ejemplo) console.log(`         "${s.ejemplo}"`);
  }

  console.log(`\n6. Estructuras repetidas (posible lista de candidatos):`);
  for (const r of report.estructurasRepetidas.slice(0, 5)) {
    console.log(`   ${r.cantidad.toString().padStart(3)}×  ${r.selector}`);
    console.log(`         "${r.muestra}"`);
  }
  console.log(`\n${linea}\n`);
}
