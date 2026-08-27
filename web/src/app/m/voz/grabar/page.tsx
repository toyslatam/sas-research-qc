'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createVoiceRecording, listVoiceOrgs, type VoiceOrg } from '@/lib/voiceApi';
import { getStoredVoiceOrgId, setStoredVoiceOrgId } from '@/modules/voice/lib/activeOrg';

const inputClass =
  'rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/60 px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-violet-400';

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function GrabarPage() {
  const [orgs, setOrgs] = useState<VoiceOrg[]>([]);
  const [orgId, setOrgId] = useState('');
  const [interviewId, setInterviewId] = useState('');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await listVoiceOrgs();
      setOrgs(list);
      const stored = getStoredVoiceOrgId();
      const pick = list.find((o) => o.id === stored) ?? list[0];
      if (pick) {
        setOrgId(pick.id);
        setStoredVoiceOrgId(pick.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las organizaciones');
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load]);

  async function startRecording() {
    setError(null);
    setResult(null);
    setBlob(null);
    if (!interviewId.trim()) {
      setError('Escribe el ID de la entrevista antes de grabar.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        setBlob(b);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError('No se pudo acceder al micrófono. Da permiso en el navegador.');
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function upload() {
    if (!blob || !orgId || !interviewId.trim()) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const ext = (blob.type.split('/')[1] || 'webm').split(';')[0];
      const rec = await createVoiceRecording(orgId, {
        interviewId: interviewId.trim(),
        file: blob,
        filename: `${interviewId.trim()}.${ext}`,
      });
      const embedMsg =
        rec.embedding_status === 'embedded'
          ? 'con huella de voz generada'
          : rec.embedding_status === 'uploaded'
            ? 'guardada (la huella de voz se generará cuando el servicio esté activo)'
            : 'guardada, pero la huella de voz falló';
      setResult(`Grabación #${rec.id} ${embedMsg}.`);
      setBlob(null);
      setInterviewId('');
      setSeconds(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir la grabación');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Grabar entrevista</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Escribe el ID de la entrevista, graba, y al detener súbela.
        </p>
      </div>

      {orgs.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          No perteneces a ninguna organización todavía. Pídele a un admin que te agregue, o crea una en la
          sección Organización.
        </p>
      ) : (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/20 p-6 space-y-5">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs text-[var(--text-muted)]">Organización</label>
            <select
              value={orgId}
              onChange={(e) => {
                setOrgId(e.target.value);
                setStoredVoiceOrgId(e.target.value);
              }}
              disabled={recording}
              className={inputClass}
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-[var(--text-muted)] block mb-1">
              ID de la entrevista <span className="text-rose-400">*</span>
            </label>
            <input
              value={interviewId}
              onChange={(e) => setInterviewId(e.target.value)}
              placeholder="Ej. INT-000245"
              disabled={recording}
              className={`${inputClass} w-full`}
            />
          </div>

          <div className="flex flex-col items-center gap-3 py-4">
            <div className={`text-4xl font-mono ${recording ? 'text-rose-400' : 'text-[var(--text-primary)]'}`}>
              {fmt(seconds)}
            </div>
            {!recording ? (
              <button
                type="button"
                onClick={startRecording}
                className="w-20 h-20 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-lg"
                aria-label="Iniciar grabación"
              >
                <span className="w-6 h-6 rounded-full bg-white" />
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="w-20 h-20 rounded-full bg-[var(--bg-app)] border-2 border-rose-500 text-rose-400 flex items-center justify-center shadow-lg animate-pulse"
                aria-label="Detener grabación"
              >
                <span className="w-6 h-6 rounded bg-rose-500" />
              </button>
            )}
            <span className="text-xs text-[var(--text-muted)]">
              {recording ? 'Grabando… pulsa para detener' : blob ? 'Grabación lista para subir' : 'Pulsa para grabar'}
            </span>
          </div>

          {blob && !recording && (
            <div className="space-y-3">
              <audio controls src={URL.createObjectURL(blob)} className="w-full" />
              <button
                type="button"
                onClick={upload}
                disabled={uploading}
                className="w-full text-sm px-4 py-3 rounded-xl bg-violet-500/90 hover:bg-violet-500 text-white font-medium disabled:opacity-50"
              >
                {uploading ? 'Subiendo…' : 'Subir grabación'}
              </button>
            </div>
          )}

          {error && <p className="text-sm text-rose-400">{error}</p>}
          {result && <p className="text-sm text-emerald-400">{result}</p>}
        </div>
      )}
    </div>
  );
}
