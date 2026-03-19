interface DashboardErrorStateProps {
  title: string;
  message: string;
}

export function DashboardErrorState({ title, message }: DashboardErrorStateProps) {
  return (
    <section className="panel dashboard-section">
      <p className="kicker">Dashboard error</p>
      <h1 className="dashboard-section__title">{title}</h1>
      <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
        {message}
      </p>
    </section>
  );
}
