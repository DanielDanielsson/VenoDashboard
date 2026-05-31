import { twMerge } from 'tailwind-merge';
import { Icon } from '@ui/base/Icon';

export const DashboardLibraryBadge = ({
  children,
  icon,
  tone = 'muted',
}: {
  children: string;
  icon?: 'glucose' | 'clock';
  tone?: 'muted' | 'success';
}) => {
  const toneClass = tone === 'success'
    ? 'border-success text-success'
    : 'border-border text-text-soft';

  return (
    <span className={twMerge('ui_micro_label inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-1', toneClass)}>
      {icon ? <Icon icon={icon} twStyles="h-3.5 w-3.5" /> : null}
      {children}
    </span>
  );
};
