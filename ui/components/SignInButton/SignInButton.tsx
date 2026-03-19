'use client';

interface SignInButtonProps {
  callbackUrl?: string;
}

export function SignInButton({ callbackUrl = '/dashboard' }: SignInButtonProps) {
  async function signIn() {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ callbackUrl })
    });

    const data = (await response.json()) as { callbackUrl?: string; error?: { message?: string } };
    if (!response.ok) {
      throw new Error(data.error?.message || 'Sign in failed');
    }

    window.location.href = data.callbackUrl || callbackUrl;
  }

  return (
    <div className="panel max-w-xl">
      <p className="kicker">Owner access</p>
      <h1 className="section-title mt-5">Sign in to manage PulseGlucose.</h1>
      <p className="section-copy mt-4">
        This is a temporary POC sign-in. It sets an owner session cookie locally so you can keep building
        the dashboard without wiring a full auth provider yet.
      </p>

      <button type="button" onClick={signIn} className="button-primary mt-8">
        Sign in
      </button>
    </div>
  );
}
