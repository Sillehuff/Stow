import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from "react";

type RootErrorBoundaryState = {
  error: Error | null;
};

export class RootErrorBoundary extends Component<PropsWithChildren, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = {
    error: null
  };

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Root UI crash", error, errorInfo);
  }

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="center-shell">
        <div className="panel auth-panel">
          <h1>Stow</h1>
          <div className="banner error">The app hit an unexpected error and stopped rendering safely.</div>
          <p className="muted">
            Reload the workspace to recover. If this keeps happening, reopening the app or signing in again usually clears stale state.
          </p>
          <div className="stack">
            <button className="btn primary" onClick={() => window.location.reload()}>
              Reload App
            </button>
          </div>
        </div>
      </div>
    );
  }
}
