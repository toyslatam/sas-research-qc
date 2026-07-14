'use client';

import { useEffect, useState } from 'react';

export function ParticipantNameCell({
  interviewId,
  value,
  onSaved,
}: {
  interviewId: number;
  value: string;
  onSaved: (interviewId: number, name: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const save = async () => {
    const trimmed = draft.trim();
    if (trimmed === value.trim()) return;
    setSaving(true);
    try {
      await onSaved(interviewId, trimmed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void save()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      disabled={saving}
      placeholder="Nombre o empresa"
      className="w-full min-w-[120px] px-2 py-1 text-sm rounded border border-slate-700 bg-slate-950 text-slate-200 placeholder:text-slate-600 focus:border-cyan-600 focus:outline-none disabled:opacity-50"
      title="Edite y pulse Enter o salga del campo para guardar"
    />
  );
}
