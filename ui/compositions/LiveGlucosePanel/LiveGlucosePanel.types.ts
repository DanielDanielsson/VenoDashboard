import type { Stylable, Themable } from '../../types';

export type LiveGlucosePanelTheme = 'light' | 'dark';

export type LiveGlucosePanelProps = Stylable &
  Themable<LiveGlucosePanelTheme> & {
    latestReadingAgeMinutes?: number | null;
    latestReadingTimestamp?: string | null;
  };
