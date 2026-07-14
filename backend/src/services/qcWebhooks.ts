import type { QcWebhook, QcWebhookEvent } from '@whispper/shared';
import { createHmac } from 'crypto';

export type QcWebhookPayload = {
  event: QcWebhookEvent;
  org_id: string;
  occurred_at: string;
  data: Record<string, unknown>;
};

function signBody(secret: string, body: string): string {
  if (!secret) return '';
  return createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * Entrega un webhook QC (fire-and-forget friendly).
 * No lanza: retorna status para persistir en qc_webhooks.
 */
export async function deliverQcWebhook(
  hook: Pick<QcWebhook, 'url' | 'secret' | 'name'>,
  payload: QcWebhookPayload,
): Promise<{ ok: boolean; status: string; message: string }> {
  const body = JSON.stringify(payload);
  const signature = signBody(hook.secret, body);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(hook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SAS-Research-QC-Webhook/1.0',
        'X-QC-Event': payload.event,
        ...(signature ? { 'X-QC-Signature': `sha256=${signature}` } : {}),
      },
      body,
      signal: controller.signal,
    });
    const ok = res.status >= 200 && res.status < 300;
    return {
      ok,
      status: ok ? 'success' : 'error',
      message: `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
