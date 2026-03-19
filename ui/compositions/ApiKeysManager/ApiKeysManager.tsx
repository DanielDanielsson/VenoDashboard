'use client';

import { useState } from 'react';
import type { ApiKeySummary } from '@/lib/pulse-api/types';
import { isSystemApiKeyName } from '@/lib/pulse-api/key-visibility';

interface ApiKeysManagerProps {
  initialItems: ApiKeySummary[];
}

interface SecretState {
  id: string;
  name: string;
  apiKey: string;
  warning?: string;
}

export function ApiKeysManager({ initialItems }: ApiKeysManagerProps) {
  const [items, setItems] = useState(initialItems.filter((item) => !isSystemApiKeyName(item.name)));
  const [name, setName] = useState('');
  const [message, setMessage] = useState('Ready');
  const [messageTone, setMessageTone] = useState<'neutral' | 'error' | 'success'>('neutral');
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<SecretState | null>(null);

  async function loadItems() {
    const response = await fetch('/api/dashboard/api-keys/list', { cache: 'no-store' });
    const data = (await response.json()) as { items?: ApiKeySummary[]; error?: { message?: string } };
    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to load API keys');
    }

    setItems((data.items || []).filter((item) => !isSystemApiKeyName(item.name)));
  }

  async function createKey() {
    if (name.trim().length < 2) {
      setMessage('API key name must be at least 2 characters');
      setMessageTone('error');
      return;
    }

    setBusy(true);
    setMessage('Creating API key...');
    setMessageTone('neutral');

    try {
      const response = await fetch('/api/dashboard/api-keys/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = (await response.json()) as SecretState & { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create API key');
      }

      setName('');
      setSecret(data);
      await loadItems();
      setMessage('API key created');
      setMessageTone('success');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create API key');
      setMessageTone('error');
    } finally {
      setBusy(false);
    }
  }

  async function revokeKey(id: string) {
    setBusy(true);
    setMessage('Deleting API key...');
    setMessageTone('neutral');

    try {
      const response = await fetch('/api/dashboard/api-keys/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to delete API key');
      }

      await loadItems();
      setMessage('API key deleted');
      setMessageTone('success');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to delete API key');
      setMessageTone('error');
    } finally {
      setBusy(false);
    }
  }

  async function regenerateKey(item: ApiKeySummary) {
    setBusy(true);
    setMessage(`Regenerating ${item.name}...`);
    setMessageTone('neutral');

    try {
      const response = await fetch('/api/dashboard/api-keys/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, name: item.name })
      });
      const data = (await response.json()) as SecretState & { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to regenerate API key');
      }

      setSecret(data);
      await loadItems();
      setMessage(data.warning || 'API key regenerated');
      setMessageTone(data.warning ? 'error' : 'success');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to regenerate API key');
      setMessageTone('error');
    } finally {
      setBusy(false);
    }
  }

  async function copySecret(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setMessage(`${label} copied`);
    setMessageTone('success');
  }

  return (
    <div className="section-stack">
      <section className="panel dashboard-section">
        <div className="dashboard-section__header">
          <div>
            <p className="kicker">Owner API keys</p>
            <h1 className="dashboard-section__title">API Keys</h1>
            <p className="dashboard-section__meta">Create, revoke, and rotate consumer API keys without leaving the dashboard.</p>
          </div>
          <div className="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-dim)]">
            {items.length} active
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 md:flex-row">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Client name"
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)] outline-none"
          />
          <button type="button" onClick={createKey} className="button-primary" disabled={busy}>
            {busy ? 'Working...' : 'Create key'}
          </button>
        </div>

        {secret ? (
          <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5 text-sm text-emerald-100">
            <p className="font-medium">Copy this now. The secret is shown once.</p>
            <p className="mt-3">Name: {secret.name}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <code className="rounded-lg bg-black/20 px-3 py-2 text-xs">{secret.id}</code>
              <button type="button" onClick={() => copySecret(secret.id, 'Key id')} className="button-secondary">
                Copy ID
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <code className="rounded-lg bg-black/20 px-3 py-2 text-xs">{secret.apiKey}</code>
              <button type="button" onClick={() => copySecret(secret.apiKey, 'API key')} className="button-secondary">
                Copy API key
              </button>
            </div>
            {secret.warning ? <p className="mt-3 text-amber-100">{secret.warning}</p> : null}
          </div>
        ) : null}

        <p
          className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
            messageTone === 'error'
              ? 'border-rose-400/30 bg-rose-500/10 text-rose-200'
              : messageTone === 'success'
                ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                : 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-dim)]'
          }`}
        >
          {message}
        </p>
      </section>

      <section className="panel dashboard-section overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">
              <tr>
                <th className="px-4 py-4">Name</th>
                <th className="px-4 py-4">ID</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Created</th>
                <th className="px-4 py-4">Last used</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-dim)]">
                    No API keys created yet.
                  </td>
                </tr>
              ) : null}

              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-4 text-[var(--text)]">{item.name}</td>
                  <td className="px-4 py-4 font-[var(--font-plex-mono)] text-xs text-[var(--text-dim)]">{item.id}</td>
                  <td className="px-4 py-4 text-emerald-300">{item.status}</td>
                  <td className="px-4 py-4 text-[var(--text-dim)]">{new Date(item.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-4 text-[var(--text-dim)]">
                    {item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={() => regenerateKey(item)} className="button-secondary" disabled={busy}>
                        Regenerate
                      </button>
                      <button type="button" onClick={() => revokeKey(item.id)} className="button-secondary" disabled={busy}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
