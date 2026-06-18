'use client';

import { useState } from 'react';
import type { ApiKeySummary } from '@/lib/veno-api/types';
import { isSystemApiKeyName } from '@/lib/veno-api/key-visibility';
import { useNotifications } from '@ui/compositions/NotificationsProvider';

interface ApiKeysManagerProps {
  initialItems: ApiKeySummary[];
}

interface SecretState {
  id: string;
  name: string;
  apiKey: string;
  warning?: string;
}

export const ApiKeysManager = ({ initialItems }: ApiKeysManagerProps) => {
  const [items, setItems] = useState(initialItems.filter((item) => !isSystemApiKeyName(item.name)));
  const [name, setName] = useState('');
  const [message, setMessage] = useState('Ready');
  const [messageTone, setMessageTone] = useState<'neutral' | 'error' | 'success'>('neutral');
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<SecretState | null>(null);
  const { notifySuccess } = useNotifications();

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
    notifySuccess(`${label} copied`);
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
          <div className="ui_caption rounded-full border border-border px-4 py-2 text-text-dim">
            {items.length} active
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 md:flex-row">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Client name"
            className="ui_input_text w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-text outline-none"
          />
          <button type="button" onClick={createKey} className="button-primary" disabled={busy}>
            {busy ? 'Working...' : 'Create key'}
          </button>
        </div>

        {secret ? (
          <div className="ui_helper_text mt-6 rounded-2xl border border-base-success-border-dark bg-base-success-soft-dark p-5 text-base-success-dark">
            <p className="body_text_emphasis">Copy this now. The secret is shown once.</p>
            <p className="body_text mt-3">Name: {secret.name}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <code className="ui_mono_text rounded-lg bg-black/20 px-3 py-2">{secret.id}</code>
              <button type="button" onClick={() => copySecret(secret.id, 'Key id')} className="button-secondary">
                Copy ID
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <code className="ui_mono_text rounded-lg bg-black/20 px-3 py-2">{secret.apiKey}</code>
              <button type="button" onClick={() => copySecret(secret.apiKey, 'API key')} className="button-secondary">
                Copy API key
              </button>
            </div>
            {secret.warning ? <p className="body_text mt-3 text-base-warning-dark">{secret.warning}</p> : null}
          </div>
        ) : null}

        <p
          className={
            messageTone === 'error'
              ? 'ui_helper_text mt-6 rounded-xl border border-base-error-border-dark bg-base-error-soft-dark px-4 py-3 text-base-error-dark'
              : messageTone === 'success'
                ? 'ui_helper_text mt-6 rounded-xl border border-base-success-border-dark bg-base-success-soft-dark px-4 py-3 text-base-success-dark'
                : 'ui_helper_text mt-6 rounded-xl border border-border bg-surface-muted px-4 py-3 text-text-dim'
          }
        >
          {message}
        </p>
      </section>

      <section className="panel dashboard-section overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ui_table_text min-w-full text-left">
            <thead className="ui_table_heading border-b border-border text-text-dim">
              <tr>
                <th className="px-4 py-4">Name</th>
                <th className="px-4 py-4">ID</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Created</th>
                <th className="px-4 py-4">Last used</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="body_text px-4 py-8 text-center text-text-dim">
                    No API keys created yet.
                  </td>
                </tr>
              ) : null}

              {items.map((item) => (
                <tr key={item.id}>
                  <td className="ui_table_text_strong px-4 py-4 text-text">{item.name}</td>
                  <td className="ui_mono_text px-4 py-4 text-text-dim">{item.id}</td>
                  <td className="ui_table_text px-4 py-4 text-base-success-dark">{item.status}</td>
                  <td className="ui_table_text px-4 py-4 text-text-dim">{new Date(item.createdAt).toLocaleString()}</td>
                  <td className="ui_table_text px-4 py-4 text-text-dim">
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
};
