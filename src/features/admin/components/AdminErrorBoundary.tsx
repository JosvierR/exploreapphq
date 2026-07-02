import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  debugId: string;
};

function createDebugId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `admin-ui-${Date.now().toString(36)}`;
}

export class AdminErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    debugId: createDebugId(),
  };

  static getDerivedStateFromError(): State {
    return {
      hasError: true,
      debugId: createDebugId(),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const payload = {
      debug_id: this.state.debugId,
      message: error.message,
      component_stack: import.meta.env.DEV ? info.componentStack : undefined,
    };

    if (import.meta.env.DEV) {
      console.error("[admin-ui]", payload);
    } else {
      console.error("[admin-ui]", { debug_id: payload.debug_id, message: payload.message });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="admin-error-boundary" role="alert">
        <section className="admin-auth-card admin-auth-card--status admin-auth-card--danger">
          <p className="admin-eyebrow">Admin console error</p>
          <h1>Something went wrong in the admin UI</h1>
          <p>
            Reload the console and use the debug id below when checking browser or server logs.
            Stack traces are not shown in production.
          </p>
          <dl className="admin-auth-debug">
            <div>
              <dt>Debug ID</dt>
              <dd>{this.state.debugId}</dd>
            </div>
          </dl>
          <div className="admin-auth-actions">
            <button type="button" className="admin-btn admin-btn--primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            <a className="admin-btn admin-btn--ghost" href="/admin">
              Back to admin
            </a>
          </div>
        </section>
      </main>
    );
  }
}
