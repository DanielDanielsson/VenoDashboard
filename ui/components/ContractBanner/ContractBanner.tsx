interface ContractBannerProps {
  lastUpdated: string;
  stale: boolean;
}

export function ContractBanner({ lastUpdated, stale }: ContractBannerProps) {
  return (
    <aside className="contract-banner" data-state={stale ? 'stale' : 'live'}>
      <p className="kicker">Contract snapshot</p>
      <p className="mt-2 text-sm font-medium">
        Last updated: <span className="font-[var(--font-plex-mono)]">{new Date(lastUpdated).toISOString()}</span>
      </p>
      <p className="mt-1 text-sm text-[var(--text-dim)]">
        {stale
          ? 'Using bundled snapshot because remote contract fetch failed.'
          : 'Using live remote contracts with incremental revalidation.'}
      </p>
    </aside>
  );
}
