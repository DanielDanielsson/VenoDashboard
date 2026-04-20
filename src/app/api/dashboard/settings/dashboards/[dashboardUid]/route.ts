import { NextRequest, NextResponse } from 'next/server';
import { getOwnerSession } from '@/lib/auth';
import { PulseApiClientError, fetchDashboardSettings, saveDashboardSettings } from '@/lib/pulse-api/client';
import { buildDashboardSettingsDocument, type DashboardLayoutSaveInput } from '@/lib/dashboard/settings';
import type { BuiltInDashboardUid } from '@/lib/dashboard/registry';
import type { DashboardTimeSettingsKind } from '@/lib/dashboard/schema';

interface RouteContext {
  params: Promise<{
    dashboardUid: string;
  }>;
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const { dashboardUid } = await context.params;
  const payload = (await request.json()) as {
    expectedVersion?: number | null;
    panelSettings?: Record<string, Record<string, unknown>>;
    layout?: DashboardLayoutSaveInput;
    timeSettings?: DashboardTimeSettingsKind;
  };

  try {
    const dashboard = buildDashboardSettingsDocument(
      dashboardUid as BuiltInDashboardUid,
      {
        panelSettings: payload.panelSettings ?? {},
        layout: payload.layout,
        timeSettings: payload.timeSettings,
      },
    );
    const response = await saveDashboardSettings(dashboardUid, {
      expectedVersion: payload.expectedVersion ?? null,
      dashboard,
    });
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const status = error instanceof PulseApiClientError ? error.status : 502;
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
    const status = error instanceof PulseApiClientError ? error.status : 502;
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to load dashboard settings' } },
      { status },
    );
  }
}
