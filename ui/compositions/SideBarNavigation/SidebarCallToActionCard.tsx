import Link from 'next/link';
import { twMerge } from 'tailwind-merge';
import { Icon } from '../../base/Icon';
import type { SidebarCallToActionCardProps } from './types';

export function SidebarCallToActionCard({
  callToAction,
  collapsed,
}: SidebarCallToActionCardProps) {
  return (
    <div
      className="relative w-full overflow-hidden"
      data-feedback-cta-state={collapsed ? 'collapsed' : 'expanded'}
    >
      <aside
        aria-hidden={collapsed}
        aria-label={collapsed ? undefined : callToAction.title}
        className={twMerge(
          'w-[237px] rounded-[4px] border border-border bg-surface-strong p-3 text-text shadow-sm transition-transform duration-200 ease-out',
          collapsed ? 'pointer-events-none -translate-x-[calc(100%+16px)]' : 'translate-x-0',
        )}
      >
        <Icon icon={callToAction.icon ?? 'info'} twStyles="h-5 w-5 text-accent" />
        <div className="mt-3 min-w-0">
          <p className="body_text_emphasis truncate">{callToAction.title}</p>
          <p className="ui_caption mt-1 text-text-soft">{callToAction.body}</p>
        </div>
        <Link
          href={callToAction.href}
          tabIndex={collapsed ? -1 : undefined}
          className="ui_caption_strong mt-3 flex justify-center rounded-[4px] bg-accent px-3 py-2 text-bg transition-colors hover:bg-accent-strong"
        >
          {callToAction.actionLabel}
        </Link>
      </aside>
    </div>
  );
}
