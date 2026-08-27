'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  addVoiceMemberByEmail,
  createVoiceOrg,
  listVoiceMembers,
  listVoiceOrgs,
  removeVoiceMember,
  type VoiceMember,
  type VoiceOrg,
} from '@/lib/voiceApi';
import { getStoredVoiceOrgId, setStoredVoiceOrgId } from '@/modules/voice/lib/activeOrg';

const inputClass =
  'rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/60 px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-violet-400';
const btnClass =
  'text-sm px-4 py-2 rounded-xl bg-violet-500/90 hover:bg-violet-500 text-white font-medium disabled:opacity-50';

export default function VoiceOrganizacionPage() {
  const [orgs, setOrgs] = useState<VoiceOrg[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<'encuestador' | 'admin'>('encuestador');
  const [members, setMembers] = useState<VoiceMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await listVoiceOrgs();
      setOrgs(list);
      const stored = getStoredVoiceOrgId();
      const pick = list.find((o) => o.id === stored) ?? list[0];
      if (pick) {
        setActiveId(pick.id);
        setStoredVoiceOrgId(pick.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las organizaciones');
    }
  }, []);

  const loadMembers = useCallback(async (orgId: string, role?: string) => {
    if (!orgId || role !== 'admin') {
      setMembers([]);
      return;
    }
    try {
      setMembers(await listVoiceMembers(orgId));
    } catch {
      setMembers([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const active = orgs.find((o) => o.id === activeId);
    loadMembers(activeId, active?.role);
  }, [activeId, orgs, loadMembers]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const org = await createVoiceOrg(newName.trim());
      setNewName('');
      setMsg(`Organización "${org.name}" creada.`);
      await load();
      setActiveId(org.id);
      setStoredVoiceOrgId(org.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddMember() {
    if (!activeId || !memberEmail.trim()) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await addVoiceMemberByEmail(activeId, memberEmail.trim(), memberRole);
      setMemberEmail('');
      setMsg('Miembro agregado.');
      await loadMembers(activeId, 'admin');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo agregar');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    setError(null);
    setMsg(null);
    try {
      await removeVoiceMember(activeId, userId);
      await loadMembers(activeId, 'admin');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo quitar');
    }
  }

  const active = orgs.find((o) => o.id === activeId);
  const isAdmin = active?.role === 'admin';

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Organización</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Las organizaciones de este módulo son independientes de las de Control de Calidad.
        </p>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}
      {msg && <p className="text-sm text-emerald-400">{msg}</p>}

      {/* Selección + creación */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/20 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Tus organizaciones</h2>
        {orgs.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Aún no perteneces a ninguna. Crea una abajo.</p>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={activeId}
              onChange={(e) => {
                setActiveId(e.target.value);
                setStoredVoiceOrgId(e.target.value);
              }}
              className={inputClass}
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.role})
                </option>
              ))}
            </select>
            {active && (
              <span className="text-xs text-[var(--text-muted)]">
                Rol: <strong>{active.role}</strong>
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-[var(--border-subtle)]">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre de nueva organización"
            className={`${inputClass} flex-1 min-w-[200px]`}
          />
          <button type="button" onClick={handleCreate} disabled={busy || !newName.trim()} className={btnClass}>
            Crear organización
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)]">Quien crea la organización queda como admin.</p>
      </div>

      {/* Miembros (solo admin) */}
      {isAdmin && (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/20 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Miembros</h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Agrega encuestadores o admins por su <strong>correo</strong>. La persona debe haberse registrado
              e iniciado sesión en la plataforma al menos una vez.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              className={`${inputClass} flex-1 min-w-[220px]`}
            />
            <select
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value as 'encuestador' | 'admin')}
              className={inputClass}
            >
              <option value="encuestador">Encuestador</option>
              <option value="admin">Admin</option>
            </select>
            <button type="button" onClick={handleAddMember} disabled={busy || !memberEmail.trim()} className={btnClass}>
              Agregar
            </button>
          </div>

          {members.length > 0 && (
            <ul className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)] pt-1">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--text-primary)] truncate">
                      {m.email ?? m.user_id}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">{m.role}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(m.user_id)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400/80 hover:text-rose-400"
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
