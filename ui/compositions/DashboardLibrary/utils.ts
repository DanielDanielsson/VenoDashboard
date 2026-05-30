import {
  createWysiwygDocument,
  normalizeWysiwygDocument,
  type WysiwygDocument,
} from '@ui/components/WysiwygEditor';
import {
  getDashboardDescriptionText,
  type DashboardDescriptionDocument,
} from '@/lib/dashboard/metadata';
import type { DashboardLibraryItem } from '@/lib/dashboard/library';
import type { DashboardMetadataSaveResult } from './types';

export function normalizeDashboardDescriptionDraft(
  description: DashboardDescriptionDocument | null,
): WysiwygDocument {
  return normalizeWysiwygDocument(description ?? createWysiwygDocument());
}

export function serializeDashboardDescription(
  description: WysiwygDocument,
): DashboardDescriptionDocument | null {
  const normalized = normalizeWysiwygDocument(description);
  const text = getDashboardDescriptionText(normalized);

  return text ? normalized : null;
}

function normalizeDashboardTitle(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function canonicalizeDashboardDescription(
  description: DashboardDescriptionDocument | WysiwygDocument | null,
) {
  if (!description) {
    return null;
  }

  const serialized = serializeDashboardDescription(normalizeWysiwygDocument(description));
  if (!serialized) {
    return null;
  }

  return {
    version: 1,
    blocks: serialized.blocks.map((block) => ({
      type: block.type,
      spans: block.spans.map((span) => ({
        text: span.text,
        ...(span.marks?.length ? { marks: span.marks } : {}),
      })),
    })),
  };
}

export function isDashboardMetadataDirty(input: {
  dashboard: DashboardLibraryItem;
  draftTitle: string;
  draftDescription: WysiwygDocument;
  draftIcon: DashboardLibraryItem['icon'];
  draftDefaultTimeRange: DashboardLibraryItem['defaultTimeRange'];
}): boolean {
  return normalizeDashboardTitle(input.dashboard.title) !== normalizeDashboardTitle(input.draftTitle)
    || JSON.stringify(canonicalizeDashboardDescription(input.dashboard.description))
      !== JSON.stringify(canonicalizeDashboardDescription(input.draftDescription))
    || (input.dashboard.icon ?? null) !== (input.draftIcon ?? null)
    || (input.dashboard.defaultTimeRange ?? null) !== (input.draftDefaultTimeRange ?? null);
}

export function applyDashboardMetadataSaveResult(
  currentItems: DashboardLibraryItem[],
  currentDashboardUid: string,
  payload: DashboardMetadataSaveResult,
): DashboardLibraryItem[] {
  const updatedDashboard = payload.dashboard;
  const previousUid = payload.previousUid ?? currentDashboardUid;
  const nextUid = updatedDashboard?.uid ?? currentDashboardUid;
  const pinnedDashboardUids = new Set(payload.preferences?.pinnedDashboardUids ?? []);
  const hasPinnedPreferences = Boolean(payload.preferences?.pinnedDashboardUids);
  const homeDashboardUid = payload.preferences?.homeDashboardUid;

  return currentItems.map((item) => {
    if (item.uid !== previousUid) {
      return {
        ...item,
        isHome: homeDashboardUid ? item.uid === homeDashboardUid : item.isHome,
        isPinned: hasPinnedPreferences ? pinnedDashboardUids.has(item.uid) : item.isPinned,
      };
    }

    return {
      ...item,
      uid: nextUid,
      title: updatedDashboard?.title ?? item.title,
      description: updatedDashboard?.description ?? null,
      icon: updatedDashboard && Object.hasOwn(updatedDashboard, 'icon') ? updatedDashboard.icon ?? null : item.icon,
      defaultTimeRange: updatedDashboard && Object.hasOwn(updatedDashboard, 'defaultTimeRange')
        ? updatedDashboard.defaultTimeRange ?? null
        : item.defaultTimeRange,
      version: updatedDashboard?.version ?? item.version,
      isHome: homeDashboardUid ? nextUid === homeDashboardUid : item.isHome,
      isPinned: hasPinnedPreferences ? pinnedDashboardUids.has(nextUid) : item.isPinned,
    };
  });
}
