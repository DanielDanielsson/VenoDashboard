import { twMerge } from 'tailwind-merge';
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
  const activeClass = dashboard.isHome
    ? 'border-success text-success'
    : 'border-border text-text-soft hover:border-text-soft hover:text-text';

  return (
    <Button
      ariaLabel={label}
      aria-pressed={dashboard.isHome}
      disabled={isSaving || dashboard.isHome}
      title={label}
      twStyles={twMerge('grid h-10 w-10 shrink-0 place-items-center rounded-[5px] border transition-colors', activeClass)}
      onClick={() => onRequestHomeDashboard(dashboard)}
    >
      <Icon icon="home" twStyles="h-5 w-5" />
    </Button>
  );
};
