import { GlucoseAnalysisView } from '@ui/compositions/GlucoseAnalysisView/GlucoseAnalysisView';

export const metadata = {
  title: 'Statistics'
};

export default function DashboardStatisticsPage() {
  return (
    <div className="section-stack">
      <header className="min-h-[calc(var(--spacing-dashboard-content-top)-var(--spacing-dashboard-top)-1.25rem)] flex flex-col justify-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-(--text)">
            Statistics
          </h1>
          <p className="mt-1 text-sm text-(--text-dim)">Deep dive into your glucose data</p>
        </div>
      </header>

      <GlucoseAnalysisView />
    </div>
  );
}
