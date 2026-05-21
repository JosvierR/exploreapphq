import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  fetchAdminWaitlist,
  previewLaunchNotify,
  sendLaunchNotify,
  type WaitlistRow,
  type EmailStatus,
  type WaitlistStats,
} from "@/lib/adminApi";
import "@/styles/admin-waitlist.css";

export function WaitlistAdminPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<WaitlistStats | null>(null);
  const [rows, setRows] = useState<WaitlistRow[]>([]);
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string[] | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminWaitlist();
      setStats(data.stats);
      setRows(data.rows);
      setSource(data.source ?? "");
      setEmailStatus(data.emailStatus ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load waitlist.");
      setStats(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handlePreview() {
    setBusy(true);
    setError(null);
    setPreview(null);
    setResult(null);
    try {
      const data = await previewLaunchNotify();
      setPreview(data.emails ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSend() {
    const count = stats?.pendingLaunch ?? 0;
    if (count === 0) {
      setError("Nobody is waiting for the launch email.");
      return;
    }
    const ok = window.confirm(
      `Send the launch email to ${count} person(s)? Already-notified addresses are skipped.`,
    );
    if (!ok) return;

    setBusy(true);
    setError(null);
    setResult(null);
    setInfo(null);
    try {
      const data = await sendLaunchNotify();
      const failed = data.failed ?? [];
      const sent = data.sent?.length ?? 0;
      if (failed.length > 0) {
        setError(failed.map((f) => `${f.email}: ${f.error}`).join("\n"));
        setResult(sent > 0 ? `Partially sent: ${sent} ok.` : null);
      } else if (sent === 0) {
        setError(null);
        setResult(null);
        setInfo((data.message as string | undefined) ?? "No emails were sent.");
      } else {
        setInfo(null);
        setResult(
          (data.message as string | undefined) ??
            `Done — ${sent} launch email(s) sent via Resend.`,
        );
      }
      await load();
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setBusy(false);
    }
  }

  const configMissing = error?.includes("FIREBASE_SERVICE_ACCOUNT_JSON");

  return (
    <div className="admin-waitlist">
      <header className="admin-waitlist__header">
        <p className="admin-waitlist__eyebrow">Early access</p>
        <h1>Waitlist</h1>
        <p className="admin-waitlist__sub">
          Signed in as <strong>{user?.email}</strong>
          {source ? ` · Data: ${source}` : ""}
        </p>
      </header>

      {emailStatus && !emailStatus.ready && (
        <div className="admin-waitlist__banner" role="alert">
          <strong>Production email not ready</strong>
          <p>{emailStatus.reason}</p>
          <p>
            From: <code>{emailStatus.from}</code>
          </p>
          <ol>
            <li>
              <a href="https://resend.com/domains" target="_blank" rel="noreferrer">
                Resend → Domains
              </a>{" "}
              → Add <strong>exploreapphq.com</strong> → copy DNS records to your DNS host
            </li>
            <li>Wait until status is <strong>Verified</strong></li>
            <li>
              Netlify → Environment variables →{" "}
              <code>SMTP_FROM=Explore &lt;onboarding@exploreapphq.com&gt;</code> (or{" "}
              <code>noreply@exploreapphq.com</code>)
            </li>
            <li>
              <strong>Trigger deploy</strong> → Refresh this page → Send launch emails
            </li>
          </ol>
        </div>
      )}

      {stats && (
        <div className="admin-waitlist__stats">
          <div className="admin-stat">
            <span className="admin-stat__value">{stats.total}</span>
            <span className="admin-stat__label">Total signups</span>
          </div>
          <div className="admin-stat admin-stat--highlight">
            <span className="admin-stat__value">{stats.pendingLaunch}</span>
            <span className="admin-stat__label">Awaiting launch email</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat__value">{stats.notified}</span>
            <span className="admin-stat__label">Already notified</span>
          </div>
        </div>
      )}

      <div className="admin-waitlist__actions">
        <button type="button" className="admin-btn admin-btn--secondary" disabled={busy} onClick={() => void load()}>
          Refresh
        </button>
        <button type="button" className="admin-btn admin-btn--secondary" disabled={busy} onClick={() => void handlePreview()}>
          Preview recipients
        </button>
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          disabled={busy || !stats?.pendingLaunch || (emailStatus != null && !emailStatus.ready)}
          onClick={() => void handleSend()}
        >
          {busy ? "Working…" : "Send launch emails"}
        </button>
      </div>

      {error && (
        <p className="admin-waitlist__error" role="alert">
          {error}
        </p>
      )}
      {configMissing && (
        <p className="admin-waitlist__warn" role="status">
          Add <code>FIREBASE_SERVICE_ACCOUNT_JSON</code> in Netlify → Environment variables (marca Secret).
          Pega el JSON de Firebase → Service accounts → Generate key. Luego <strong>Trigger deploy</strong> y Refresh.
        </p>
      )}
      {!loading && !error && rows.length === 0 && !configMissing && (
        <p className="admin-waitlist__warn" role="status">
          No signups in the panel. If you see data in Firebase Console, deploy{" "}
          <code>firestore.rules</code> and refresh. New signups:{" "}
          <a href={`${window.location.origin}/access`} target="_blank" rel="noreferrer">
            /access
          </a>
          .
        </p>
      )}
      {info && (
        <p className="admin-waitlist__warn" role="status">
          {info}
        </p>
      )}
      {result && (
        <p className="admin-waitlist__success" role="status">
          {result}
        </p>
      )}
      {preview && (
        <div className="admin-waitlist__preview">
          <p>
            <strong>{preview.length}</strong> would receive the launch email:
          </p>
          <ul>
            {preview.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="admin-waitlist__table-wrap">
        <h2>Registrations</h2>
        {loading ? (
          <p className="admin-waitlist__muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="admin-waitlist__muted">
            No signups in the panel yet. Test at{" "}
            <Link to="/access">/access</Link> or check Firestore.
          </p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Joined</th>
                <th>Storage</th>
                <th>Launch email</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.email}>
                  <td>{row.email}</td>
                  <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}</td>
                  <td>
                    <span className="admin-badge admin-badge--storage">
                      {(row as WaitlistRow & { storage?: string }).storage ?? "—"}
                    </span>
                  </td>
                  <td>
                    {row.launchNotifiedAt ? (
                      <span className="admin-badge admin-badge--ok">Sent</span>
                    ) : (
                      <span className="admin-badge admin-badge--pending">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="admin-waitlist__hint">
        <strong>Local (Mailpit):</strong> <code>npm run dev:mail</code> → <code>npm run dev:all</code> →
        open <a href="http://localhost:8025">localhost:8025</a> — all test emails appear there (no real
        inbox). <strong>Production (Netlify):</strong> use Resend with verified domain{" "}
        <a href="https://resend.com/domains" target="_blank" rel="noreferrer">
          exploreapphq.com
        </a>
        ; <code>onboarding@resend.dev</code> only delivers to your Resend account email.
      </p>
    </div>
  );
}
