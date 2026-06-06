import { Button } from '@ui/base/Button';
import { Icon } from '@ui/base/Icon';
import type { DashboardLibraryItem } from '@/lib/dashboard/library';

export const DashboardHomeButton = ({
  dashboard,
  isSaving,
  onRequestHomeDashboard,
}: {
  dashboard: DashboardLibraryItem;
  isSaving: boolean;
  onRequestHomeDashboard: (dashboard: DashboardLibraryItem) => void;
}) => {
  const label = dashboard.isHome
    ? `${dashboard.title} is home dashboard`
    : `Set ${dashboard.title} as home dashboard`;

  return (
    <Button
      ariaLabel={label}
      aria-disabled={dashboard.isHome}
      aria-pressed={dashboard.isHome}
      disabled={isSaving}
      title={label}
      twStyles="grid h-10 w-10 shrink-0 place-items-center rounded-[5px] border border-border text-text-soft transition-colors hover:border-text-soft hover:text-text"
      onClick={() => {
        if (!dashboard.isHome) {
          onRequestHomeDashboard(dashboard);
        }
      }}
    >
      <Icon icon={dashboard.isHome ? 'home-filled' : 'home'} twStyles="h-5 w-5" />
    </Button>
  );
};
