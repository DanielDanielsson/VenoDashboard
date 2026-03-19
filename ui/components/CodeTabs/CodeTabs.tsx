'use client';

import { useMemo, useState } from 'react';

type TabKey = 'curl' | 'javascript' | 'python';

interface CodeTabsProps {
  curl: string;
  javascript: string;
  python: string;
}

const TAB_LABELS: Record<TabKey, string> = {
  curl: 'cURL',
  javascript: 'JavaScript',
  python: 'Python'
};

export function CodeTabs({ curl, javascript, python }: CodeTabsProps) {
  const [tab, setTab] = useState<TabKey>('curl');
  const [copied, setCopied] = useState(false);

  const currentCode = useMemo(() => {
    if (tab === 'javascript') return javascript;
    if (tab === 'python') return python;
    return curl;
  }, [curl, javascript, python, tab]);

  async function copyCode() {
    await navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1300);
  }

  return (
    <div className="code-shell overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
        <div className="flex gap-2">
          {(Object.keys(TAB_LABELS) as TabKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className={tab === key ? 'button-secondary min-h-0 px-3 py-2' : 'button-ghost min-h-0 px-3 py-2'}
              onClick={() => setTab(key)}
            >
              {TAB_LABELS[key]}
            </button>
          ))}
        </div>

        <button type="button" onClick={copyCode} className="button-secondary min-h-0 px-3 py-2">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <pre>
        <code>{currentCode}</code>
      </pre>
    </div>
  );
}
