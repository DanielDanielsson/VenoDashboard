import { NextRequest, NextResponse } from 'next/server';
import { dashboardGlucoseService } from '@/lib/glucose/dashboard-service';
import { dashboardGlucoseWorkspace } from '@/lib/glucose/dashboard-workspace';
import { applyRateLimit, createRateLimitResponse, getClientIp } from '@/lib/security/rate-limit';
import type { TimeRange } from '@/lib/glucose/time-ranges';

export const dynamic = 'force-dynamic';

const CUSTOM_HISTORY_MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000;

function parseLimit(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

function parseIsoMs(value: string): number | null {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function validateCustomWindow(from: string, to: string): string | null {
  const fromMs = parseIsoMs(from);
  const toMs = parseIsoMs(to);

  if (fromMs == null || toMs == null) {
    return 'Custom glucose history ranges must use valid from and to dates.';
  }

  if (toMs < fromMs) {
    return 'Custom glucose history range end must be after the start.';
  }

  if (toMs - fromMs > CUSTOM_HISTORY_MAX_RANGE_MS) {
    return 'Custom glucose history ranges are limited to 90 days.';
  }

  return null;
}

export async function GET(request: NextRequest) {
  const rateLimit = applyRateLimit({
    key: `glucose-history:${getClientIp(request)}`,
    limit: 120,
    windowMs: 60 * 1000
  });
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit, 'Too many glucose history requests. Try again soon.');
  }

  const params = request.nextUrl.searchParams;
  const now = new Date();
  const range = params.get('range');
  const from = params.get('from');
  const to = params.get('to');
  const limit = parseLimit(params.get('limit'));

  try {
    if (from && to) {
      const validationError = validateCustomWindow(from, to);
      if (validationError) {
        return NextResponse.json(
          { error: { message: validationError } },
          {
            status: 400,
            headers: {
              'Cache-Control': 'no-store'
            }
          }
        );
      }
    }

    if (range) {
      const session = await dashboardGlucoseWorkspace.open({
        range: range as TimeRange,
        now
      });

      return NextResponse.json(session.snapshot, {
        headers: {
          'Cache-Control': 'no-store'
        }
      });
    }

    if (from && to && limit == null) {
      const session = await dashboardGlucoseWorkspace.open({
        window: {
          from,
          to
        },
        now
      });

      return NextResponse.json(session.snapshot, {
        headers: {
          'Cache-Control': 'no-store'
        }
      });
    }

    const response = await dashboardGlucoseService.getHistory({
      range,
      from,
      to,
      limit,
      now
    });

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to load glucose data' } },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  }
}
