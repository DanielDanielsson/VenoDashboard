import type { ReactElement } from 'react';
import { twMerge } from 'tailwind-merge';
import { DashboardPanel } from '@ui/components/DashboardPanel';
import { DashboardGlucoseBadge } from '@ui/components/DashboardGlucoseBadge/DashboardGlucoseBadge';
import { DataFreshnessLight } from '@ui/components/DataFreshnessLight/DataFreshnessLight';
import type { LiveGlucosePanelProps, LiveGlucosePanelTheme } from './LiveGlucosePanel.types';

const THEME_CLASS: Record<LiveGlucosePanelTheme, string> = {
  light: 'theme-live-glucose-panel-light',
  dark: 'theme-live-glucose-panel-dark',
};

export const LiveGlucosePanel = ({
  latestReadingTimestamp,
  twStyles,
  theme = 'dark',
}: LiveGlucosePanelProps): ReactElement => (
  <DashboardPanel
    title="Current Glucose"
    theme={theme}
    twStyles={twMerge(THEME_CLASS[theme], twStyles)}
    headerRight={latestReadingTimestamp ? <DataFreshnessLight key={latestReadingTimestamp} timestamp={latestReadingTimestamp} /> : undefined}
  >
    <div className="flex flex-1 flex-col items-center justify-center">
      <DashboardGlucoseBadge />
    </div>
  </DashboardPanel>
);
