import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getOwnerSession = vi.fn();
const workspaceApplyCorrections = vi.fn();
const updateGlucoseCorrections = vi.fn();

vi.mock('@/lib/auth', () => ({
  getOwnerSession
}));

vi.mock('@/lib/glucose/dashboard-workspace', () => ({
  dashboardGlucoseWorkspace: {
    applyCorrections: workspaceApplyCorrections
  }
}));

vi.mock('@/lib/veno-api/glucose', () => ({
  updateGlucoseCorrections
}));

describe('dashboard glucose corrections route', () => {
  beforeEach(() => {
    getOwnerSession.mockReset();
    workspaceApplyCorrections.mockReset();
    updateGlucoseCorrections.mockReset();
    getOwnerSession.mockResolvedValue({ user: { email: 'owner@example.com' } });
  });

  test('passes correction payloads through the workspace boundary', async () => {
    const payload = {
      items: [
        {
          source: 'official',
          readingId: 'reading-1',
          valueMmolL: 5.2,
          reason: 'Compression low'
        }
      ]
    };
    workspaceApplyCorrections.mockResolvedValue({
      updated: 1,
      cleared: 0
    });

    const { PUT } = await import('@/app/api/dashboard/glucose/corrections/route');
    const response = await PUT(
      new NextRequest('http://localhost/api/dashboard/glucose/corrections', {
        method: 'PUT',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(workspaceApplyCorrections).toHaveBeenCalledWith(payload);
    expect(updateGlucoseCorrections).not.toHaveBeenCalled();
    expect(json).toEqual({
      updated: 1,
      cleared: 0
    });
  });
});
