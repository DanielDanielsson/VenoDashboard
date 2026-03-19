'use client';

export function SignOutButton() {
  async function signOut() {
    await fetch('/api/auth/logout', {
      method: 'POST'
    });

    window.location.href = '/';
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className="button-secondary"
    >
      Sign out
    </button>
  );
}
