import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
export const OWNER_SESSION_COOKIE = 'pulse-owner-session';
const OWNER_SESSION_VALUE = 'poc-owner';

export interface OwnerSession {
  user: {
    email: string;
  };
}

function ownerEmail(): string {
  return process.env.AUTH_POC_EMAIL?.trim() || 'owner@pulseglucose.local';
}

export async function getOwnerSession(): Promise<OwnerSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(OWNER_SESSION_COOKIE)?.value;
  if (sessionCookie !== OWNER_SESSION_VALUE) {
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
  return OWNER_SESSION_VALUE;
}
