import { type ReactNode, useEffect, useRef, useState } from "react";

export type AdminTone = "blue" | "green" | "amber" | "red" | "slate" | "purple";

export function AdminPageShell({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="admin-moderation admin-feature-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="admin-page-header__actions">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function SectionHeader({ kicker, title, meta }: { kicker: string; title: string; meta?: ReactNode }) {
  return (
    <div className="admin-panel__header">
      <div>
        <p className="admin-panel__kicker">{kicker}</p>
        <h3>{title}</h3>
      </div>
      {meta && <span className="admin-panel__meta">{meta}</span>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "slate",
  loading = false,
}: {
  label: string;
  value?: ReactNode;
  hint?: string;
  tone?: AdminTone;
  loading?: boolean;
}) {
  return (
    <article className={`admin-stat-card admin-stat-card--${tone === "amber" ? "warning" : tone === "red" ? "danger" : tone}`}>
      <span className="admin-stat-card__label">{label}</span>
      {loading ? <span className="admin-skeleton admin-skeleton--number" aria-label="Loading" /> : <strong>{value ?? "Not available"}</strong>}
      {hint && <span className="admin-stat-card__hint">{hint}</span>}
    </article>
  );
}

export function StatusBadge({ label, tone = "slate" }: { label: string; tone?: AdminTone }) {
  return <span className={`admin-status-pill admin-status-pill--${toneToPill(tone)}`}>{label}</span>;
}

export function RiskBadge({ risk }: { risk: "low" | "medium" | "high" | "critical" | "unknown" }) {
  const tone = risk === "critical" || risk === "high" ? "red" : risk === "medium" ? "amber" : risk === "low" ? "green" : "slate";
  return <StatusBadge label={risk === "unknown" ? "Unknown risk" : `${capitalize(risk)} risk`} tone={tone} />;
}

export function AdminDataTable({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="admin-table-wrap" role="region" aria-label={label}>
      <table className="admin-table">{children}</table>
    </div>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="admin-empty-state admin-empty-state--compact">
      <div className="admin-empty-state__mark" aria-hidden="true"><span /></div>
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}

export function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div className="admin-skeleton-list" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="admin-skeleton-row" key={index}>
          <span className="admin-skeleton admin-skeleton--avatar" />
          <span className="admin-skeleton-row__copy">
            <span className="admin-skeleton admin-skeleton--line" />
            <span className="admin-skeleton admin-skeleton--line admin-skeleton--short" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <section className="admin-error-state" role="alert">
      <div>
        <h3>{title}</h3>
        <p>{message}</p>
      </div>
      {onRetry && (
        <button type="button" className="admin-btn admin-btn--secondary" onClick={onRetry}>
          Retry
        </button>
      )}
    </section>
  );
}

export function AdminNotice({ title, message, tone = "blue" }: { title: string; message: string; tone?: AdminTone }) {
  return (
    <section className={`admin-notice admin-notice--${tone}`}>
      <strong>{title}</strong>
      <span>{message}</span>
    </section>
  );
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  busy = false,
  tone = "red",
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  tone?: AdminTone;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div className="admin-confirmation" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onCancel()}>
      <section ref={dialogRef} className="admin-confirmation__dialog" role="dialog" aria-modal="true" tabIndex={-1}>
        <p className="admin-eyebrow">Confirmation required</p>
        <h3>{title}</h3>
        <p className="admin-muted">{message}</p>
        <div className="admin-confirmation__actions">
          <button type="button" className="admin-btn admin-btn--ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={`admin-btn ${tone === "red" ? "admin-btn--danger" : "admin-btn--primary"}`} onClick={onConfirm} disabled={busy}>
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function Drawer({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="admin-drawer" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <aside className="admin-drawer__panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="admin-drawer__header">
          <div>
            <p className="admin-eyebrow">Details</p>
            <h3>{title}</h3>
          </div>
          <button type="button" className="admin-drawer__close" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

export function Timeline({ items }: { items: Array<{ id: string; title: string; detail?: string; time?: string | null }> }) {
  if (items.length === 0) return <EmptyState title="No timeline yet" message="Events will appear here when they are recorded." />;

  return (
    <ol className="admin-history-list">
      {items.map((item) => (
        <li key={item.id}>
          <span>
            <strong>{item.title}</strong>
            {item.time && <small><RelativeTime value={item.time} /></small>}
          </span>
          {item.detail && <p>{item.detail}</p>}
        </li>
      ))}
    </ol>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className="admin-copy-btn" aria-label={label} onClick={() => void copy()}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function RelativeTime({ value }: { value?: string | null }) {
  if (!value) return <>Not available</>;
  const deltaMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(deltaMs / 60000));
  if (minutes < 1) return <>Just now</>;
  if (minutes < 60) return <>{minutes}m ago</>;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return <>{hours}h ago</>;
  return <>{Math.round(hours / 24)}d ago</>;
}

function toneToPill(tone: AdminTone) {
  if (tone === "green") return "green";
  if (tone === "amber") return "warning";
  if (tone === "red") return "danger";
  return "neutral";
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
