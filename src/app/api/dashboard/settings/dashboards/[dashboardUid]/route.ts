import { NextRequest, NextResponse } from 'next/server';
import { getOwnerSession } from '@/lib/auth';
import { VenoApiClientError, fetchDashboardSettings, saveDashboardSettings } from '@/lib/veno-api/client';
import { buildDashboardSettingsDocument, type DashboardLayoutSaveInput } from '@/lib/dashboard/settings';
import { loadDashboardResource } from '@/lib/dashboard/resources';
import type { DashboardTimeSettingsKind, PanelKind } from '@/lib/dashboard/schema';

interface RouteContext {
  params: Promise<{
    dashboardUid: string;
  }>;
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof VenoApiClientError
    ? error.status === 404
    : typeof error === 'object' && error !== null && 'status' in error && error.status === 404;
}

async function resolveExpectedSettingsVersion(dashboardUid: string): Promise<number | null> {
  try {
    const response = await fetchDashboardSettings(dashboardUid);
    return response.dashboardSettings.version;
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const { dashboardUid } = await context.params;
  const payload = (await request.json()) as {
    expectedVersion?: number | null;
    elements?: Record<string, PanelKind>;
    panelSettings?: Record<string, Record<string, unknown>>;
    layout?: DashboardLayoutSaveInput;
    timeSettings?: DashboardTimeSettingsKind;
  };

  try {
    const currentDashboard = await loadDashboardResource(dashboardUid);
    const expectedSettingsVersion = await resolveExpectedSettingsVersion(dashboardUid);
    const dashboard = buildDashboardSettingsDocument(
      dashboardUid,
      {
        dashboard: currentDashboard.dashboard,
        elements: payload.elements,
        panelSettings: payload.panelSettings ?? {},
        layout: payload.layout,
        timeSettings: payload.timeSettings,
      },
    );
    const response = await saveDashboardSettings(dashboardUid, {
      expectedVersion: expectedSettingsVersion,
      dashboard,
    });
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const status = error instanceof VenoApiClientError ? error.status : 502;
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to save dashboard settings' } },
      { status },
    );
  }
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const { dashboardUid } = await context.params;

  try {
    const response = await fetchDashboardSettings(dashboardUid);
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const status = error instanceof VenoApiClientError ? error.status : 502;
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to load dashboard settings' } },
      { status },
    );
  }
}
