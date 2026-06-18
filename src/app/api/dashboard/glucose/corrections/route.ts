import { NextRequest, NextResponse } from 'next/server';
import { getOwnerSession } from '@/lib/auth';
import { dashboardGlucoseWorkspace } from '@/lib/glucose/dashboard-workspace';
import type { GlucoseCorrectionBatchPayload } from '@/lib/veno-api/types';

export async function PUT(request: NextRequest) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const payload = (await request.json()) as GlucoseCorrectionBatchPayload;

  try {
    const response = await dashboardGlucoseWorkspace.applyCorrections(payload);
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to update glucose corrections' } },
      { status: 502 }
    );
  }
}
