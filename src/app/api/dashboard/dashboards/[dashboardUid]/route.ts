import { NextRequest, NextResponse } from 'next/server';
import { getOwnerSession } from '@/lib/auth';
import {
  VenoApiClientError,
  deleteDashboard,
  updateDashboardMetadata,
  type DashboardMetadataUpdatePayload
} from '@/lib/veno-api/client';

interface RouteContext {
  params: Promise<{
    dashboardUid: string;
  }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const { dashboardUid } = await context.params;
  const payload = (await request.json()) as DashboardMetadataUpdatePayload;

  try {
    const response = await updateDashboardMetadata(dashboardUid, payload);
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const status = error instanceof VenoApiClientError ? error.status : 502;
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to rename dashboard' } },
      { status },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const { dashboardUid } = await context.params;

  try {
    const response = await deleteDashboard(dashboardUid);
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const status = error instanceof VenoApiClientError ? error.status : 502;
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to delete dashboard' } },
      { status },
    );
  }
}
