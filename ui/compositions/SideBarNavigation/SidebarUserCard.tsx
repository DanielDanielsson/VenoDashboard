import Link from 'next/link';
import { twMerge } from 'tailwind-merge';
import { Icon } from '../../base/Icon';
import type { SidebarUserCardProps } from './types';

export const SidebarUserCard = ({
  user,
  isOwner,
  layoutCollapsed,
  labelClassName,
  showNotificationDot,
}: SidebarUserCardProps) => {
  const hasProfileImage = Boolean(user.imageUrl);
  const userActionHref = isOwner ? '/dashboard/settings' : '/login';
  const userActionLabel = isOwner ? 'Open settings' : 'Sign in';
  const userActionIcon = isOwner ? 'settings' : 'auth-sign-in';

  return (
    <div className="relative flex w-full items-center gap-3 border-t border-border pt-3 text-text">
      <span
        className="relative grid h-11 w-11 flex-none place-items-center rounded-full border border-border bg-surface"
        data-sidebar-avatar
      >
        <span className="grid h-full w-full place-items-center overflow-hidden rounded-full">
          {hasProfileImage ? (
            <img
              src={user.imageUrl ?? ''}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <Icon icon="visitor-avatar" twStyles="h-6 w-6 text-text" />
          )}
        </span>
        {showNotificationDot ? (
          <span
            className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-bg bg-accent"
            data-sidebar-avatar-notification
          />
        ) : null}
      </span>
      <p className={twMerge('body_text_strong flex-1', labelClassName, layoutCollapsed && 'left-14')}>{user.name || 'Visitor'}</p>
      <Link
        href={userActionHref}
        aria-label={userActionLabel}
        title={userActionLabel}
        className={twMerge(
          'grid h-8 w-8 place-items-center rounded text-text-soft transition-colors hover:bg-nav-link-bg hover:text-text',
          layoutCollapsed && 'hidden',
        )}
      >
        <Icon icon={userActionIcon} twStyles="h-5 w-5" />
      </Link>
    </div>
  );
};
