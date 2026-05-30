import type { APIRequestContext } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface DashboardRecord {
  uid: string;
  title: string;
  type: 'live' | 'timeRange';
  dashboard?: {
    spec?: {
      elements?: Record<string, {
        spec?: {
          vizConfig?: {
            group?: string;
          };
        };
      }>;
    };
  };
}

export function readLocalEnvValue(key: string): string | undefined {
  const directValue = process.env[key]?.trim();
  if (directValue) {
    return directValue;
  }

  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) {
    return undefined;
  }

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  let resolvedValue: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const currentKey = trimmed.slice(0, separatorIndex).trim();
    if (currentKey !== key) {
      continue;
    }

    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    resolvedValue = rawValue.replace(/^['"]|['"]$/g, '');
  }

  return resolvedValue;
}

export function getDashboardHref(dashboard: Pick<DashboardRecord, 'uid'>): string {
  return `/dashboards/${dashboard.uid}`;
}

export async function fetchDashboardRecords(request: APIRequestContext): Promise<DashboardRecord[]> {
  const baseUrl = readLocalEnvValue('PULSE_API_BASE_URL') || 'https://api.venoplatform.com';
  const response = await request.get(`${baseUrl}/api/v1/dashboards`);

  if (!response.ok()) {
    throw new Error(`Dashboard API list request failed with ${response.status()}`);
  }

  const payload = await response.json() as { dashboards?: DashboardRecord[] };
  return payload.dashboards ?? [];
}

export function findTimeRangeDashboard(dashboards: DashboardRecord[]): DashboardRecord | undefined {
  return dashboards.find((dashboard) => dashboard.type === 'timeRange');
}

export function findDashboardWithPanelGroups(
  dashboards: DashboardRecord[],
  requiredGroups: string[],
): DashboardRecord | undefined {
  return dashboards.find((dashboard) => {
    const groups = new Set(
      Object.values(dashboard.dashboard?.spec?.elements ?? {})
        .map((element) => element.spec?.vizConfig?.group)
        .filter((group): group is string => Boolean(group)),
    );

    return requiredGroups.every((group) => groups.has(group));
  });
}
