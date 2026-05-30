import { Icon } from '@ui/base/Icon';
import { Link } from '@ui/base/Link';

interface DashboardPageHeaderProps {
  dashboardUid: string;
  title: string;
  description?: string | null;
}

export function DashboardPageHeader({
  dashboardUid,
  title,
  description,
}: DashboardPageHeaderProps) {
  const settingsHref = `/dashboards?${new URLSearchParams({ settings: dashboardUid }).toString()}`;

  return (
    <header
      className="group flex flex-col"
      style={{ minHeight: 'calc(var(--spacing-dashboard-content-top) - var(--spacing-dashboard-top) - 1.25rem)' }}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="page_title text-text">{title}</h1>
          <Link
            ariaLabel={`Edit ${title} settings`}
            href={settingsHref}
            title={`Edit ${title} settings`}
            twStyles="grid h-9 w-9 place-items-center rounded-[5px] border border-border text-text-soft opacity-0 transition-colors transition-opacity hover:border-text-soft hover:text-text focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Icon icon="edit" twStyles="h-4 w-4" />
          </Link>
        </div>
        {description ? (
          <p className="page_subtitle mt-1 max-w-3xl text-text-dim">{description}</p>
        ) : null}
      </div>
    </header>
  );
}
