import { NextRequest, NextResponse } from 'next/server';
import { getOwnerSession } from '@/lib/auth';
import {
  VenoApiClientError,
  createDashboard,
  type DashboardCreatePayload
} from '@/lib/veno-api/client';

export async function POST(request: NextRequest) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const payload = (await request.json()) as DashboardCreatePayload;

  try {
    const response = await createDashboard(payload);
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const status = error instanceof VenoApiClientError ? error.status : 502;
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to create dashboard' } },
      { status },
    );
  }
}
