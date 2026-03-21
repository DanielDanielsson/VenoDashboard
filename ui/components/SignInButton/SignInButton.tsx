'use client';

import { useState } from 'react';

interface SignInButtonProps {
  callbackUrl?: string;
}

export function SignInButton({ callbackUrl = '/dashboard' }: SignInButtonProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function signIn() {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ callbackUrl, username, password })
      });

      const data = (await response.json()) as { callbackUrl?: string; error?: { message?: string } };
      if (!response.ok) {
        throw new Error(data.error?.message || 'Sign in failed');
      }

      window.location.href = data.callbackUrl || callbackUrl;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Sign in failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="panel max-w-xl">
      <p className="kicker">Admin access</p>
      <h1 className="section-title mt-5">Sign in to manage PulseGlucose.</h1>
      <p className="section-copy mt-4">
        Demo visitors can browse the dashboard. Admin actions like settings, integrations, timers, and API keys
        require sign in.
      </p>

      <div className="mt-8 grid gap-4">
        <label className="grid gap-2 text-sm">
          <span className="text-(--text-dim)">Username</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            className="w-full rounded-lg border border-(--border) bg-(--surface-muted) px-3 py-2 text-sm text-(--text) outline-none placeholder:text-(--text-dim) focus:border-(--border-focus, var(--border))"
          />
        </label>

        <label className="grid gap-2 text-sm">
          <span className="text-(--text-dim)">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            className="w-full rounded-lg border border-(--border) bg-(--surface-muted) px-3 py-2 text-sm text-(--text) outline-none placeholder:text-(--text-dim) focus:border-(--border-focus, var(--border))"
          />
        </label>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        <button
          type="button"
          onClick={() => void signIn()}
          className="button-primary"
          disabled={isSubmitting || !username.trim() || !password}
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>
      </div>
    </div>
  );
}
