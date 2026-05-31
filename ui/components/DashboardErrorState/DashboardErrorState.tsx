interface DashboardErrorStateProps {
  title: string;
  message: string;
}

export const DashboardErrorState = ({ title, message }: DashboardErrorStateProps) => {
  return (
    <section className="panel dashboard-section">
      <p className="kicker">Dashboard error</p>
      <h1 className="dashboard-section__title">{title}</h1>
      <p className="ui_helper_text mt-4 rounded-xl border border-base-error-border-dark bg-base-error-soft-dark px-4 py-3 text-base-error-dark">
        {message}
      </p>
    </section>
  );
};
