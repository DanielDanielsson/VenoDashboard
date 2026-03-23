'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SecondaryButton } from '../SecondaryButton';

interface SignInButtonProps {
  callbackUrl?: string;
}

export function SignInButton({ callbackUrl = '/dashboard' }: SignInButtonProps) {
  const router = useRouter();
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
    <div className="panel relative max-w-sm w-full mx-4 rounded-[4px] p-6">
      <button
        type="button"
        onClick={() => router.push('/dashboard')}
        className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-[4px] text-(--text-dim) transition-colors hover:text-(--text)"
        aria-label="Close"
      >
        ✕
      </button>
      <p className="kicker">Admin access</p>
      <h1 className="section-title mt-3 text-xl">Sign in to manage PulseGlucose.</h1>
      <p className="section-copy mt-2 text-xs">
        Demo visitors can browse the dashboard. Admin actions like settings, timers, and API keys
        require sign in.
      </p>

      <div className="mt-6 grid gap-4">
        <label className="grid gap-1.5 text-sm">
          <span className="text-(--text-dim) text-xs">Username</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            className="w-full rounded-[4px] border border-secondary-button-inactive-border bg-transparent px-3 py-2 text-sm text-(--text) outline-none placeholder:text-(--text-dim) focus:border-secondary-button-active-border"
          />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="text-(--text-dim) text-xs">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            className="w-full rounded-[4px] border border-secondary-button-inactive-border bg-transparent px-3 py-2 text-sm text-(--text) outline-none placeholder:text-(--text-dim) focus:border-secondary-button-active-border"
          />
        </label>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        <SecondaryButton
          isActive
          onClick={() => void signIn()}
          disabled={isSubmitting || !username.trim() || !password}
          twStyles="w-full justify-center py-2 text-sm"
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </SecondaryButton>
      </div>
    </div>
  );
}
