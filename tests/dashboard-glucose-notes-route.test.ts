import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getOwnerSession = vi.fn();
const createTimelineNote = vi.fn();
const updateTimelineNote = vi.fn();
const deleteTimelineNote = vi.fn();

vi.mock('@/lib/auth', () => ({
  getOwnerSession
}));

vi.mock('@/lib/veno-api/timeline-notes', () => ({
  createTimelineNote,
  updateTimelineNote,
  deleteTimelineNote
}));

describe('dashboard glucose notes routes', () => {
  beforeEach(() => {
    getOwnerSession.mockReset();
    createTimelineNote.mockReset();
    updateTimelineNote.mockReset();
    deleteTimelineNote.mockReset();
    getOwnerSession.mockResolvedValue({ user: { email: 'owner@example.com' } });
  });

  test('creates notes using the signed in owner identity', async () => {
    const payload = {
      text: 'Stressful day',
      timezone: 'Europe/Stockholm',
      allDay: true,
      startDate: '2026-04-09',
      endDate: '2026-04-09'
    };
    createTimelineNote.mockResolvedValue({ id: 'note-1' });

    const { POST } = await import('@/app/api/dashboard/glucose/notes/route');
    const response = await POST(
      new NextRequest('http://localhost/api/dashboard/glucose/notes', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      })
    );

    expect(response.status).toBe(201);
    expect(createTimelineNote).toHaveBeenCalledWith(payload, 'owner@example.com');
  });

  test('updates notes using the signed in owner identity', async () => {
    const payload = {
      text: 'Updated text',
      timezone: 'Europe/Stockholm',
      allDay: false,
      startDate: '2026-04-09',
      endDate: '2026-04-09',
      startTime: '08:00',
      endTime: '09:00'
    };
    updateTimelineNote.mockResolvedValue({ id: 'note-1' });

    const { PUT } = await import('@/app/api/dashboard/glucose/notes/[noteId]/route');
    const response = await PUT(
      new NextRequest('http://localhost/api/dashboard/glucose/notes/note-1', {
        method: 'PUT',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      }),
      { params: Promise.resolve({ noteId: 'note-1' }) }
    );

    expect(response.status).toBe(200);
    expect(updateTimelineNote).toHaveBeenCalledWith('note-1', payload, 'owner@example.com');
  });

  test('deletes notes using the signed in owner identity', async () => {
    deleteTimelineNote.mockResolvedValue({ deleted: true, noteId: 'note-1' });

    const { DELETE } = await import('@/app/api/dashboard/glucose/notes/[noteId]/route');
    const response = await DELETE(
      new NextRequest('http://localhost/api/dashboard/glucose/notes/note-1', {
        method: 'DELETE'
      }),
      { params: Promise.resolve({ noteId: 'note-1' }) }
    );

    expect(response.status).toBe(200);
    expect(deleteTimelineNote).toHaveBeenCalledWith('note-1', 'owner@example.com');
  });
});
