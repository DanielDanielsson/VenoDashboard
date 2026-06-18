import { DashboardErrorState } from '@ui/components/DashboardErrorState/DashboardErrorState';
import { SettingsForm } from '@ui/compositions/SettingsForm/SettingsForm';
import { requireOwnerSession } from '@/lib/auth';
import { VenoApiClientError, fetchConsumerProfile } from '@/lib/veno-api/client';

export default async function DashboardSettingsPage() {
  await requireOwnerSession();
  let profile = null;
  let message: string | null = null;

  try {
    const response = await fetchConsumerProfile();
    profile = response.profile;
  } catch (error) {
    message =
      error instanceof VenoApiClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Failed to load settings';
  }

  if (!profile) {
    return <DashboardErrorState title="Settings unavailable" message={message || 'Failed to load settings'} />;
  }

  return <SettingsForm initialProfile={profile} />;
}
