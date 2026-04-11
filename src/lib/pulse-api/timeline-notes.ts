import {
  type TimelineNote,
  type TimelineNoteDeleteResponse,
  type TimelineNoteListResponse,
  type TimelineNoteMutationResponse,
  type TimelineNoteWritePayload,
  type TimelineUpdatesResponse
} from '@/lib/pulse-api/types';
import { getAdminApiToken, getApiBaseUrl } from '@/lib/pulse-api/env';

function resolveUrl(path: string): string {
  return new URL(path, getApiBaseUrl()).toString();
}

export async function fetchTimelineNotes(
  from: string,
  to: string
): Promise<TimelineNote[]> {
  const url = new URL(resolveUrl('/api/v1/notes'));
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);

  const response = await fetch(url.toString(), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Timeline notes failed with status ${response.status}`);
  }

  const payload = await response.json() as TimelineNoteListResponse;
  return payload.items;
}

export async function fetchTimelineUpdatesSince(
  since: string
): Promise<TimelineUpdatesResponse['meta']> {
  const url = new URL(resolveUrl('/api/v1/timeline/updates'));
  url.searchParams.set('since', since);

  const response = await fetch(url.toString(), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Timeline updates failed with status ${response.status}`);
  }

  const payload = await response.json() as TimelineUpdatesResponse;
  return payload.meta;
}

export async function createTimelineNote(
  payload: TimelineNoteWritePayload,
  actorId: string
): Promise<TimelineNote> {
  const response = await fetch(resolveUrl('/api/admin/notes'), {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${getAdminApiToken()}`,
      'Content-Type': 'application/json',
      'x-pulse-actor-id': actorId
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Timeline note create failed with status ${response.status}`);
  }

  const json = await response.json() as TimelineNoteMutationResponse;
  return json.note;
}

export async function updateTimelineNote(
  noteId: string,
  payload: TimelineNoteWritePayload,
  actorId: string
): Promise<TimelineNote> {
  const response = await fetch(resolveUrl(`/api/admin/notes/${noteId}`), {
    method: 'PUT',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${getAdminApiToken()}`,
      'Content-Type': 'application/json',
      'x-pulse-actor-id': actorId
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Timeline note update failed with status ${response.status}`);
  }

  const json = await response.json() as TimelineNoteMutationResponse;
  return json.note;
}

export async function deleteTimelineNote(
  noteId: string,
  actorId: string
): Promise<TimelineNoteDeleteResponse> {
  const response = await fetch(resolveUrl(`/api/admin/notes/${noteId}`), {
    method: 'DELETE',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${getAdminApiToken()}`,
      'x-pulse-actor-id': actorId
    }
  });

  if (!response.ok) {
    throw new Error(`Timeline note delete failed with status ${response.status}`);
  }

  return response.json() as Promise<TimelineNoteDeleteResponse>;
}
