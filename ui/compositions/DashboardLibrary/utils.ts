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

export type DashboardDropPosition = 'before' | 'after';

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

export function getDashboardPreferencePayload(items: DashboardLibraryItem[]) {
  return {
    homeDashboardUid: items.find((dashboard) => dashboard.isHome)?.uid ?? items[0]?.uid ?? '',
    pinnedDashboardUids: items.filter((dashboard) => dashboard.isPinned).map((dashboard) => dashboard.uid),
    dashboardOrderUids: items.map((dashboard) => dashboard.uid),
  };
}

export function orderDashboardItems(
  items: DashboardLibraryItem[],
  dashboardOrderUids: string[],
): DashboardLibraryItem[] {
  const currentIndex = new Map(items.map((dashboard, index) => [dashboard.uid, index]));
  const orderIndex = new Map(dashboardOrderUids.map((dashboardUid, index) => [dashboardUid, index]));

  return [...items].sort((left, right) => {
    const leftOrderIndex = orderIndex.get(left.uid);
    const rightOrderIndex = orderIndex.get(right.uid);

    if (leftOrderIndex !== undefined || rightOrderIndex !== undefined) {
      if (leftOrderIndex === undefined) {
        return 1;
      }

      if (rightOrderIndex === undefined) {
        return -1;
      }

      return leftOrderIndex - rightOrderIndex;
    }

    return (currentIndex.get(left.uid) ?? 0) - (currentIndex.get(right.uid) ?? 0);
  });
}

export function reorderDashboardItems(
  items: DashboardLibraryItem[],
  draggedDashboardUid: string,
  targetDashboardUid: string,
  position: DashboardDropPosition,
): DashboardLibraryItem[] {
  if (draggedDashboardUid === targetDashboardUid) {
    return items;
  }

  const draggedDashboard = items.find((dashboard) => dashboard.uid === draggedDashboardUid);
  if (!draggedDashboard) {
    return items;
  }

  const nextItems = items.filter((dashboard) => dashboard.uid !== draggedDashboardUid);
  const targetIndex = nextItems.findIndex((dashboard) => dashboard.uid === targetDashboardUid);
  if (targetIndex < 0) {
    return items;
  }

  const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
  return [
    ...nextItems.slice(0, insertIndex),
    draggedDashboard,
    ...nextItems.slice(insertIndex),
  ];
}

export function moveDashboardItem(
  items: DashboardLibraryItem[],
  dashboardUid: string,
  direction: -1 | 1,
): DashboardLibraryItem[] {
  const currentIndex = items.findIndex((dashboard) => dashboard.uid === dashboardUid);
  const nextIndex = currentIndex + direction;

  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }

  const nextItems = [...items];
  const [dashboard] = nextItems.splice(currentIndex, 1);
  nextItems.splice(nextIndex, 0, dashboard);
  return nextItems;
}
