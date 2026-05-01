import { NextRequest, NextResponse } from 'next/server';
import { getOwnerSession } from '@/lib/auth';
import {
  PulseApiClientError,
  saveDashboardPreferences,
  type DashboardPreferencesRecord
} from '@/lib/pulse-api/client';

export async function PUT(request: NextRequest) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const preferences = (await request.json()) as DashboardPreferencesRecord;

  try {
    const response = await saveDashboardPreferences(preferences);
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const status = error instanceof PulseApiClientError ? error.status : 502;
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to save dashboard preferences' } },
      { status },
    );
  }
}
