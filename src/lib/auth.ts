import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
export const OWNER_SESSION_COOKIE = 'pulse-owner-session';

export interface OwnerSession {
  user: {
    email: string;
  };
}

function ownerEmail(): string {
  return `${ownerLoginUsername()}@pulseglucose.local`;
}

function ownerLoginUsername(): string {
  return process.env.OWNER_LOGIN_USERNAME?.trim() || 'admin';
}

function ownerLoginPassword(): string | null {
  return process.env.OWNER_LOGIN_PASSWORD?.trim() || null;
}

export function hasOwnerCredentialsConfigured(): boolean {
  return Boolean(ownerLoginPassword());
}

export function validateOwnerCredentials(username: string, password: string): boolean {
  const expectedUsername = ownerLoginUsername();
  const expectedPassword = ownerLoginPassword();
  if (!expectedPassword) {
    return false;
  }

  return username.trim() === expectedUsername && password === expectedPassword;
}

export async function getOwnerSession(): Promise<OwnerSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(OWNER_SESSION_COOKIE)?.value;
  const sessionValue = await ownerSessionCookieValue();
  if (!sessionValue || sessionCookie !== sessionValue) {
    return null;
  }

  return {
    user: {
      email: ownerEmail()
    }
  };
}

export async function requireOwnerSession(): Promise<OwnerSession> {
  const session = await getOwnerSession();
  if (!session) {
    redirect('/login');
  }

  return session;
}

export async function ownerSessionCookieValue(): Promise<string> {
  const password = ownerLoginPassword();
  if (!password) {
    return '';
  }

  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `owner-session:${hashHex}`;
}
