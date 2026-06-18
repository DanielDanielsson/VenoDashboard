import { redirect } from 'next/navigation';
import { loadDashboardPreferences } from '@/lib/dashboard/preferences';

export default async function DashboardPage() {
  const preferences = await loadDashboardPreferences();

  if (!preferences.homeDashboardUid) {
    redirect('/dashboards');
  }

  redirect(`/dashboards/${encodeURIComponent(preferences.homeDashboardUid)}`);
}
