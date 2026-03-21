import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
export const OWNER_SESSION_COOKIE = 'pulse-owner-session';

export interface OwnerSession {
  user: {
    email: string;
  };
}

function ownerEmail(): string {
  return process.env.AUTH_POC_EMAIL?.trim() || 'owner@pulseglucose.local';
}

function ownerLoginUsername(): string | null {
  return process.env.OWNER_LOGIN_USERNAME?.trim() || null;
}

function ownerLoginPassword(): string | null {
  return process.env.OWNER_LOGIN_PASSWORD?.trim() || null;
}

export function hasOwnerCredentialsConfigured(): boolean {
  return Boolean(ownerLoginUsername() && ownerLoginPassword());
}

export function validateOwnerCredentials(username: string, password: string): boolean {
  const expectedUsername = ownerLoginUsername();
  const expectedPassword = ownerLoginPassword();
  if (!expectedUsername || !expectedPassword) {
    return false;
  }

  return username.trim() === expectedUsername && password === expectedPassword;
}

export async function getOwnerSession(): Promise<OwnerSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(OWNER_SESSION_COOKIE)?.value;
  const sessionValue = ownerSessionCookieValue();
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

export function ownerSessionCookieValue(): string {
  const username = ownerLoginUsername();
  const password = ownerLoginPassword();
  if (!username || !password) {
    return '';
  }

  return `owner-session:${encodeURIComponent(username)}`;
}
