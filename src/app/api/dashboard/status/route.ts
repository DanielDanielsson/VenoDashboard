import { NextResponse } from 'next/server';
import { PulseApiClientError, fetchApiStatus } from '@/lib/pulse-api/client';

export async function GET() {
  try {
    const report = await fetchApiStatus();
    return NextResponse.json(report, { status: 200 });
  } catch (error) {
    const status = error instanceof PulseApiClientError ? error.status : 502;
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to load status' } },
      { status }
    );
  }
}
