import { redirect } from 'next/navigation';
import { loadDashboardPreferences } from '@/lib/dashboard/preferences';

interface DashboardStatisticsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function serializeSearchParams(input: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      params.set(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
    }
  }

  return params.toString();
}

export default async function DashboardStatisticsPage({ searchParams }: DashboardStatisticsPageProps = {}) {
  const preferences = await loadDashboardPreferences();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const serializedSearchParams = serializeSearchParams(resolvedSearchParams);
  const suffix = serializedSearchParams ? `?${serializedSearchParams}` : '';

  redirect(`/dashboards/${encodeURIComponent(preferences.homeDashboardUid)}${suffix}`);
}
