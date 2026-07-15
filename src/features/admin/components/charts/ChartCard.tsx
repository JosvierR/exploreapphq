import type { ReactNode } from "react";
import { EmptyState } from "@/features/admin/components/AdminPrimitives";

export function ChartCard({
  title,
  subtitle,
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
