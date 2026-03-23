interface ContractBannerProps {
  lastUpdated: string;
  stale: boolean;
}

export function ContractBanner({ lastUpdated, stale }: ContractBannerProps) {
  return (
    <aside className="contract-banner" data-state={stale ? 'stale' : 'live'}>
      <p className="ui_micro_label text-(--text-soft)">Contract snapshot</p>
      <p className="body_text_emphasis mt-2">
        Last updated: <span className="ui_mono_text">{new Date(lastUpdated).toISOString()}</span>
      </p>
      <p className="ui_helper_text mt-1 text-[var(--text-dim)]">
        {stale
          ? 'Using bundled snapshot because remote contract fetch failed.'
          : 'Using live remote contracts with incremental revalidation.'}
      </p>
    </aside>
  );
}
