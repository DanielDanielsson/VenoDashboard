import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getOwnerSession = vi.fn();
const createManualWorkout = vi.fn();
const updateManualWorkout = vi.fn();
const deleteManualWorkout = vi.fn();

vi.mock('@/lib/auth', () => ({
  getOwnerSession
}));

vi.mock('@/lib/pulse-api/workouts', () => ({
  createManualWorkout,
  updateManualWorkout,
  deleteManualWorkout
}));

describe('dashboard glucose workout routes', () => {
  beforeEach(() => {
    getOwnerSession.mockReset();
    createManualWorkout.mockReset();
    updateManualWorkout.mockReset();
    deleteManualWorkout.mockReset();
    getOwnerSession.mockResolvedValue({ user: { email: 'owner@example.com' } });
  });

  test('creates manual workouts only for the signed in owner', async () => {
    const payload = {
      startAt: '2026-04-09T08:00:00.000Z',
      endAt: '2026-04-09T09:00:00.000Z',
      workoutType: 'run',
      displayName: 'Morning run'
    };
    createManualWorkout.mockResolvedValue({ id: 'workout-1' });

    const { POST } = await import('@/app/api/dashboard/glucose/workouts/route');
    const response = await POST(
      new NextRequest('http://localhost/api/dashboard/glucose/workouts', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      })
    );

    expect(response.status).toBe(201);
    expect(createManualWorkout).toHaveBeenCalledWith(payload, 'owner@example.com');
  });

  test('updates manual workouts only for the signed in owner', async () => {
    const payload = {
      startAt: '2026-04-09T09:00:00.000Z',
      endAt: '2026-04-09T10:00:00.000Z',
      workoutType: 'strength',
      displayName: ''
    };
    updateManualWorkout.mockResolvedValue({ id: 'workout-1' });

    const { PUT } = await import('@/app/api/dashboard/glucose/workouts/[workoutId]/route');
    const response = await PUT(
      new NextRequest('http://localhost/api/dashboard/glucose/workouts/workout-1', {
        method: 'PUT',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      }),
      { params: Promise.resolve({ workoutId: 'workout-1' }) }
    );

    expect(response.status).toBe(200);
    expect(updateManualWorkout).toHaveBeenCalledWith('workout-1', payload, 'owner@example.com');
  });

  test('deletes manual workouts only for the signed in owner', async () => {
    deleteManualWorkout.mockResolvedValue({ deleted: true, workoutId: 'workout-1' });

    const { DELETE } = await import('@/app/api/dashboard/glucose/workouts/[workoutId]/route');
    const response = await DELETE(
      new NextRequest('http://localhost/api/dashboard/glucose/workouts/workout-1', {
        method: 'DELETE'
      }),
      { params: Promise.resolve({ workoutId: 'workout-1' }) }
    );

    expect(response.status).toBe(200);
    expect(deleteManualWorkout).toHaveBeenCalledWith('workout-1', 'owner@example.com');
  });

  test('rejects workout mutations for public viewers', async () => {
    getOwnerSession.mockResolvedValue(null);

    const { POST } = await import('@/app/api/dashboard/glucose/workouts/route');
    const createResponse = await POST(
      new NextRequest('http://localhost/api/dashboard/glucose/workouts', {
        method: 'POST',
        body: JSON.stringify({
          startAt: '2026-04-09T08:00:00.000Z',
          endAt: '2026-04-09T09:00:00.000Z',
          workoutType: 'run'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })
    );

    const { PUT, DELETE } = await import('@/app/api/dashboard/glucose/workouts/[workoutId]/route');
    const updateResponse = await PUT(
      new NextRequest('http://localhost/api/dashboard/glucose/workouts/workout-1', {
        method: 'PUT',
        body: JSON.stringify({
          startAt: '2026-04-09T08:00:00.000Z',
          endAt: '2026-04-09T09:00:00.000Z',
          workoutType: 'run'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }),
      { params: Promise.resolve({ workoutId: 'workout-1' }) }
    );
    const deleteResponse = await DELETE(
      new NextRequest('http://localhost/api/dashboard/glucose/workouts/workout-1', {
        method: 'DELETE'
      }),
      { params: Promise.resolve({ workoutId: 'workout-1' }) }
    );

    expect(createResponse.status).toBe(401);
    expect(updateResponse.status).toBe(401);
    expect(deleteResponse.status).toBe(401);
    expect(createManualWorkout).not.toHaveBeenCalled();
    expect(updateManualWorkout).not.toHaveBeenCalled();
    expect(deleteManualWorkout).not.toHaveBeenCalled();
  });
});
