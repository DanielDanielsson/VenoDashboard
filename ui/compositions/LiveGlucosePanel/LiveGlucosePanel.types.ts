import type { Stylable, Themable } from '../../types';

export type LiveGlucosePanelTheme = 'light' | 'dark';

export type LiveGlucosePanelProps = Stylable &
  Themable<LiveGlucosePanelTheme> & {
    enableStream?: boolean;
    panelId?: string;
    latestReadingAgeMinutes?: number | null;
    latestReadingTimestamp?: string | null;
  };
