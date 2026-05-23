import type { OwnerSession } from '@/lib/auth';
import { fetchConsumerProfile } from '@/lib/pulse-api/client';

export interface SidebarUser {
  name: string;
  imageUrl: string | null;
}

function fallbackOwnerName(session: OwnerSession): string {
  const [name] = session.user.email.split('@');
  return name?.trim() || 'Admin';
}

export async function loadSidebarUser(session: OwnerSession | null): Promise<SidebarUser> {
  if (!session) {
    return {
      name: 'Visitor',
      imageUrl: null,
    };
  }

  try {
    const { profile } = await fetchConsumerProfile();
    const fullName = [profile.firstName, profile.lastName]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' ');
    const displayName = profile.displayName.trim();

    return {
      name: displayName || fullName || fallbackOwnerName(session),
      imageUrl: profile.profileImageDataUrl || profile.profileImageUrl,
    };
  } catch {
    return {
      name: fallbackOwnerName(session),
      imageUrl: null,
    };
  }
}
