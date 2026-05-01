import { redirect } from 'next/navigation';
import { loadDashboardPreferences } from '@/lib/dashboard/preferences';

export default async function HomePage() {
  const preferences = await loadDashboardPreferences();

  redirect(`/dashboards/${encodeURIComponent(preferences.homeDashboardUid)}`);
}
