import { NextRequest, NextResponse } from 'next/server';
import { getOwnerSession } from '@/lib/auth';
import { buildDashboardSettingsDocument } from '@/lib/dashboard/settings';
import { loadDashboardResource } from '@/lib/dashboard/resources';
import type { DashboardDefinition } from '@/lib/dashboard/schema';
import {
  PulseApiClientError,
  createDashboard,
  deleteDashboard,
  fetchDashboardList,
  saveDashboardSettings,
  updateDashboardMetadata,
} from '@/lib/pulse-api/client';

interface RouteContext {
  params: Promise<{
    dashboardUid: string;
  }>;
}

function normalizeDashboardTitle(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function createDuplicateDashboardTitle(
  dashboardTitle: string,
  existingTitles: string[],
): string {
  const sourceTitle = normalizeDashboardTitle(dashboardTitle);
  const baseTitle = `${sourceTitle} - copy`;
  const usedTitles = new Set(existingTitles.map((title) => normalizeDashboardTitle(title).toLowerCase()));

  if (!usedTitles.has(baseTitle.toLowerCase())) {
    return baseTitle;
  }

  let suffix = 2;
  while (usedTitles.has(`${baseTitle} ${suffix}`.toLowerCase())) {
    suffix += 1;
  }

  return `${baseTitle} ${suffix}`;
}

function cloneDashboardDefinitionForDuplicate(
  input: DashboardDefinition,
  dashboardUid: string,
  dashboardTitle: string,
) {
  return buildDashboardSettingsDocument(dashboardUid, {
    dashboard: {
      ...input,
      spec: {
        ...input.spec,
        uid: dashboardUid,
        title: dashboardTitle,
      },
    },
  });
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const { dashboardUid } = await context.params;
  let createdDashboardUid: string | null = null;

  try {
    const [sourceDashboard, dashboardList] = await Promise.all([
      loadDashboardResource(dashboardUid),
      fetchDashboardList(),
    ]);
    const duplicateTitle = createDuplicateDashboardTitle(
      sourceDashboard.dashboard.spec.title,
      dashboardList.dashboards.map((dashboard) => dashboard.title),
    );
    const createdDashboardResponse = await createDashboard({
      title: duplicateTitle,
      type: sourceDashboard.type,
    });
    createdDashboardUid = createdDashboardResponse.dashboard.uid;

    const metadataResponse = await updateDashboardMetadata(createdDashboardUid, {
      title: duplicateTitle,
      description: sourceDashboard.description,
      icon: sourceDashboard.icon ?? 'dashboard-grid',
      defaultTimeRange: sourceDashboard.type === 'timeRange'
        ? sourceDashboard.defaultTimeRange ?? '3d'
        : null,
      expectedVersion: createdDashboardResponse.dashboard.version,
    });
    const duplicatedDashboard = metadataResponse.dashboard;
    createdDashboardUid = duplicatedDashboard.uid;

    const dashboard = cloneDashboardDefinitionForDuplicate(
      sourceDashboard.dashboard,
      duplicatedDashboard.uid,
      duplicatedDashboard.title,
    );
    const settingsResponse = await saveDashboardSettings(duplicatedDashboard.uid, {
      expectedVersion: null,
      dashboard,
    });

    return NextResponse.json({
      dashboard: duplicatedDashboard,
      dashboardSettings: settingsResponse.dashboardSettings,
    }, { status: 201 });
  } catch (error) {
    if (createdDashboardUid) {
      try {
        await deleteDashboard(createdDashboardUid);
      } catch {
        // Preserve the original duplicate failure.
      }
    }

    const status = error instanceof PulseApiClientError ? error.status : 502;
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to duplicate dashboard' } },
      { status },
    );
  }
}
