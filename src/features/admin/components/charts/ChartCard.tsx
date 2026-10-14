import type { ReactNode } from "react";
import { EmptyState } from "@/features/admin/components/AdminPrimitives";

export function ChartCard({
  title,
  subtitle,
  context,
  insight,
  actions,
  loading = false,
  empty = false,
  emptyTitle = "No activity yet",
  emptyMessage = "Activity will appear here after analytics events arrive.",
  className = "",
  children,
}: {
  title: string;
  subtitle: string;
  context?: Array<{ label: string; value: string }>;
  insight?: string | null;
  actions?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`admin-chart-card ${className}`.trim()}>
      <header className="admin-chart-card__header">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        {actions && <div className="admin-chart-card__actions">{actions}</div>}
      </header>
      {context?.length ? (
        <dl className="admin-chart-card__context" aria-label={`${title} reporting context`}>
          {context.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        </dl>
      ) : null}
      {insight && <p className="admin-chart-card__insight">{insight}</p>}
      {loading ? (
        <div className="admin-chart-skeleton" aria-label={`Loading ${title}`}>
          <span />
          <span />
          <span />
        </div>
      ) : empty ? (
        <EmptyState title={emptyTitle} message={emptyMessage} />
      ) : (
        children
      )}
    </section>
  );
}
