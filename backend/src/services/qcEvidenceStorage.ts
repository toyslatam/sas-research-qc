import { randomUUID } from 'crypto';
import { supabase } from '../lib/supabaseClient';

export const QC_EVIDENCE_BUCKET = 'qc-evidences';

const MAX_BYTES = 50 * 1024 * 1024;

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^\w.\-()\s]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120);
}

export function guessEvidenceType(
  mime: string,
  fallback: 'photo' | 'audio' | 'document' | 'link' | 'note' = 'document',
): 'photo' | 'audio' | 'document' | 'link' | 'note' {
  if (mime.startsWith('image/')) return 'photo';
  if (mime.startsWith('audio/')) return 'audio';
  if (
    mime.includes('pdf') ||
    mime.includes('word') ||
    mime.includes('sheet') ||
    mime.includes('text') ||
    mime.includes('zip')
  ) {
    return 'document';
  }
  return fallback;
}

export async function uploadQcEvidenceFile(input: {
  orgId: string;
  surveyId: number;
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}): Promise<{
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  public_or_signed_url: string;
}> {
  if (input.buffer.length > MAX_BYTES) {
    throw new Error('Archivo supera el límite de 50 MB');
  }
  const file_name = sanitizeFileName(input.originalName || 'evidencia');
  const mime_type = input.mimeType || 'application/octet-stream';
  const storage_path = `${input.orgId}/${input.surveyId}/${randomUUID()}-${file_name}`;

  const { error } = await supabase.storage
    .from(QC_EVIDENCE_BUCKET)
    .upload(storage_path, input.buffer, {
      contentType: mime_type,
      upsert: false,
    });
  if (error) throw new Error(`Storage: ${error.message}`);

  const public_or_signed_url = await createQcEvidenceSignedUrl(storage_path);

  return {
    storage_path,
    file_name,
    mime_type,
    file_size: input.buffer.length,
    public_or_signed_url,
  };
}

export async function createQcEvidenceSignedUrl(
  storagePath: string,
  expiresIn = 60 * 60 * 24 * 7,
): Promise<string> {
  if (!storagePath) return '';
  const { data, error } = await supabase.storage
    .from(QC_EVIDENCE_BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  if (error || !data?.signedUrl) {
    console.warn('[qc.storage.sign]', error?.message);
    return '';
  }
  return data.signedUrl;
}

export async function deleteQcEvidenceFile(storagePath: string): Promise<void> {
  if (!storagePath) return;
  const { error } = await supabase.storage.from(QC_EVIDENCE_BUCKET).remove([storagePath]);
  if (error) console.warn('[qc.storage.delete]', error.message);
}
