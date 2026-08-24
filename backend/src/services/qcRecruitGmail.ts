import crypto from 'crypto';
import { config } from '../config';

/**
 * OAuth + Gmail REST helpers para "Seguimiento Encuestadores → Importar".
 * Se implementa contra la REST API de Google directamente (sin el SDK
 * `googleapis`, que es mucho más pesado de lo que este flujo necesita).
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GMAIL_API_BASE = 'https://www.googleapis.com/gmail/v1/users/me';
const GMAIL_SCOPE =
  'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email';

const STATE_TTL_MS = 10 * 60 * 1000;

function stateSecret(): string {
  return config.supabase.serviceRoleKey || config.googleOAuth.clientSecret;
}

/** state=orgId:userId:expiresAt:hmac, para que el callback (sin JWT) confirme quién inició el flujo. */
export function signGmailState(orgId: string, userId: string): string {
  const payload = `${orgId}:${userId}:${Date.now() + STATE_TTL_MS}`;
  const sig = crypto.createHmac('sha256', stateSecret()).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

export function verifyGmailState(state: string): { orgId: string; userId: string } | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 4) return null;
    const [orgId, userId, expiresAtStr, sig] = parts;
    const payload = `${orgId}:${userId}:${expiresAtStr}`;
    const expected = crypto.createHmac('sha256', stateSecret()).update(payload).digest('hex');
    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
    if (Date.now() > Number(expiresAtStr)) return null;
    return { orgId, userId };
  } catch {
    return null;
  }
}

export function buildGmailAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.googleOAuth.clientId,
    redirect_uri: config.googleOAuth.redirectUri,
    response_type: 'code',
    scope: GMAIL_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export async function exchangeGmailCode(code: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.googleOAuth.clientId,
      client_secret: config.googleOAuth.clientSecret,
      redirect_uri: config.googleOAuth.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange falló: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function refreshGmailAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.googleOAuth.clientId,
      client_secret: config.googleOAuth.clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    throw new Error(`No se pudo refrescar el token de Gmail: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function getGoogleUserEmail(accessToken: string): Promise<string> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`No se pudo leer el perfil de Google: ${res.status}`);
  const data = (await res.json()) as { email?: string };
  return data.email ?? '';
}

export interface GmailMessageSummary {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  bodyText: string;
  cvUrl: string | null;
}

const CANDIDATE_SENDER_QUERY =
  '(from:indeed.com OR from:indeedemail.com OR from:computrabajo.com OR from:computrabajo.com.co) newer_than:60d';

export async function listGmailCandidateMessages(
  accessToken: string,
  maxResults = 20,
): Promise<string[]> {
  const params = new URLSearchParams({
    q: CANDIDATE_SENDER_QUERY,
    maxResults: String(maxResults),
  });
  const res = await fetch(`${GMAIL_API_BASE}/messages?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`No se pudo listar mensajes de Gmail: ${res.status}`);
  const data = (await res.json()) as { messages?: { id: string }[] };
  return (data.messages ?? []).map((m) => m.id);
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

const CV_LINK_TEXT_RE = /ver\s*cv|ver\s*postulaci[oó]n\s*completa|ver\s*perfil/i;

/**
 * Los correos de Indeed no traen el teléfono ni el CV completo en el cuerpo,
 * solo un botón "Ver CV" — y ese link pasa por el click-tracker de Indeed
 * (cts.indeed.com), que redirige con JavaScript y exige sesión de empleador
 * iniciada en el navegador. No es un enlace que el backend pueda seguir por
 * su cuenta, así que en vez de intentar leerlo se expone tal cual para que
 * el usuario lo abra con un clic y complete el celular a mano.
 */
function findCvLink(html: string): string | null {
  const anchorRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html))) {
    const text = m[2].replace(/<[^>]+>/g, ' ').trim();
    if (CV_LINK_TEXT_RE.test(text)) {
      return m[1].replace(/&amp;/g, '&');
    }
  }
  return null;
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

/**
 * Un correo puede traer el resumen en text/plain y el detalle completo
 * (CV, teléfono) solo en text/html, o repartido en varias partes. Se
 * concatena TODO el texto del árbol MIME en vez de quedarse con la primera
 * parte que aparezca, para no perder datos que vengan más abajo.
 */
function collectTextParts(part: GmailPart | undefined, out: string[], htmlOut: string[]): void {
  if (!part) return;
  if (part.mimeType === 'text/plain' && part.body?.data) {
    out.push(decodeBase64Url(part.body.data));
  } else if (part.mimeType === 'text/html' && part.body?.data) {
    const html = decodeBase64Url(part.body.data);
    htmlOut.push(html);
    out.push(
      html
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|tr|li)>/gi, '\n')
        .replace(/<[^>]+>/g, ' '),
    );
  }
  if (part.parts) {
    for (const child of part.parts) collectTextParts(child, out, htmlOut);
  }
}

export async function getGmailMessage(
  accessToken: string,
  id: string,
): Promise<GmailMessageSummary> {
  const res = await fetch(`${GMAIL_API_BASE}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`No se pudo leer el mensaje ${id}: ${res.status}`);
  const data = (await res.json()) as {
    id: string;
    snippet?: string;
    payload?: GmailPart & { headers?: { name: string; value: string }[] };
  };
  const headers = data.payload?.headers ?? [];
  const header = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
  const textParts: string[] = [];
  const htmlParts: string[] = [];
  collectTextParts(data.payload, textParts, htmlParts);

  let cvUrl: string | null = null;
  for (const html of htmlParts) {
    cvUrl = findCvLink(html);
    if (cvUrl) break;
  }

  return {
    id: data.id,
    from: header('From'),
    subject: header('Subject'),
    date: header('Date'),
    snippet: data.snippet ?? '',
    bodyText: textParts.join('\n') || data.snippet || '',
    cvUrl,
  };
}

const CO_PHONE_RE = /(?:\+?57[\s.-]?)?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}/;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const NAME_LINE_RE = /(?:nombre|name|candidato|applicant)\s*[:\-]\s*([^\n\r]{2,60})/i;
// Los asuntos de Indeed siguen el patrón "...puesto de X en Ciudad, Departamento (Ciudad)".
const SUBJECT_CITY_RE = /\ben\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ.\s]*?),\s*([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ.\s]*?)(?:\s*\(|$)/;

export interface SuggestedCandidate {
  nombre: string;
  celular: string;
  email: string;
  municipio: string;
}

export function suggestCandidateFromMessage(msg: GmailMessageSummary): SuggestedCandidate {
  const text = `${msg.subject}\n${msg.bodyText}`;
  const phoneMatch = text.match(CO_PHONE_RE);
  const emailMatch = text.match(EMAIL_RE);
  const nameMatch = text.match(NAME_LINE_RE);
  const cityMatch = msg.subject.match(SUBJECT_CITY_RE);
  return {
    nombre: nameMatch?.[1]?.trim() ?? '',
    celular: phoneMatch?.[0]?.replace(/[\s.-]/g, '') ?? '',
    email: emailMatch?.[0] ?? '',
    municipio: cityMatch?.[1]?.trim() ?? '',
  };
}
