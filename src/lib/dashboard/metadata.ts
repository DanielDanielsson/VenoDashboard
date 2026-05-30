export type DashboardDescriptionBlockType = 'heading' | 'paragraph' | 'subheading';
export type DashboardDescriptionTextMark = 'bold' | 'italic' | 'underline';
export type DashboardIconName =
  | 'dashboard-grid'
  | 'home'
  | 'activity'
  | 'glucose'
  | 'timer'
  | 'clock'
  | 'calendar'
  | 'server'
  | 'lightbulb';

export const DASHBOARD_ICON_OPTIONS = [
  { value: 'dashboard-grid', label: 'Dashboard' },
  { value: 'home', label: 'Home' },
  { value: 'activity', label: 'Activity' },
  { value: 'glucose', label: 'Glucose' },
  { value: 'timer', label: 'Timer' },
  { value: 'clock', label: 'Clock' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'server', label: 'Server' },
  { value: 'lightbulb', label: 'Idea' },
] as const satisfies readonly { value: DashboardIconName; label: string }[];

export interface DashboardDescriptionTextSpan {
  text: string;
  marks?: DashboardDescriptionTextMark[];
}

export interface DashboardDescriptionBlock {
  id: string;
  type: DashboardDescriptionBlockType;
  spans: DashboardDescriptionTextSpan[];
}

export interface DashboardDescriptionDocument {
  version: 1;
  blocks: DashboardDescriptionBlock[];
}

export function getDashboardDescriptionText(description: DashboardDescriptionDocument | null): string {
  if (!description) {
    return '';
  }

  return description.blocks
    .map((block) => block.spans.map((span) => span.text).join(''))
    .join('\n')
    .trim();
}
