import type { CSSProperties } from 'react';
import type { DashboardLibraryItem } from '@/lib/dashboard/library';
import type { DashboardDropPosition } from '@ui/compositions/DashboardLibrary/utils';

export type PendingDirtyAction =
  | { type: 'collapse' }
  | { type: 'expand'; dashboardUid: string }
  | { type: 'navigate'; href: string };

export interface DashboardDropTarget {
  dashboardUid: string;
  position: DashboardDropPosition;
}

export interface DashboardLibraryProps {
  dashboards: DashboardLibraryItem[];
  isOwner: boolean;
}

export type DashboardRowStyle = CSSProperties & {
  viewTransitionName?: string;
  viewTransitionClass?: string;
};

export interface DashboardRowMotion {
  offset: number;
  phase: 'offset' | 'animate';
}

export type DashboardRowRefs = Map<string, HTMLLIElement>;

export type DashboardRowMeasurements = Map<string, {
  height: number;
  top: number;
}>;
