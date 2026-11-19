import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * ErrorBoundary — turns a blank white page into a readable error card with
 * recovery actions (reload / clear broken session). Any React render error
 * surfaces here instead of silently unmounting the root.
 */
export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; componentStack: string | null }
> {
  state: { error: Error | null; componentStack: string | null } = {
    error: null,
    componentStack: null,
  };

  static getDerivedStateFromError(error: Error) {
    return { error, componentStack: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null });
    console.error("[LocalEmu] React render error:", error, info);
  }

  private handleClearAndReload = () => {
    try {
      localStorage.removeItem("localemu_active_user");
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-cabinet-950 px-5 py-10 font-sans text-vellum">
        <div className="mx-auto max-w-lg rounded-2xl border border-berry-400/40 bg-cabinet-900/90 p-6 shadow-2xl">
          <h1 className="font-display text-xl font-bold text-ember-400">
            LocalEmu could not start
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ash-300">
            This usually means the page failed to load completely (a stale
            deployment or a blocked script), not that anything is wrong with your
            games. Reload first; if it persists, clear the session and reload.
          </p>
          <pre className="mt-4 max-h-48 overflow-auto rounded-xl border border-white/10 bg-black/50 p-3 font-mono text-[11px] whitespace-pre-wrap text-berry-400">
            {this.state.error.message}
            {this.state.componentStack ? `\n${this.state.componentStack}` : ""}
          </pre>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-ember-500 px-4 py-2.5 text-xs font-bold text-cabinet-950 transition hover:bg-ember-400"
            >
              Reload page
            </button>
            <button
              type="button"
              onClick={this.handleClearAndReload}
              className="rounded-xl border border-white/15 bg-cabinet-800 px-4 py-2.5 text-xs font-semibold text-ash-200 transition hover:text-white"
            >
              Clear session &amp; reload
            </button>
          </div>
          <p className="mt-4 font-mono text-[10px] leading-relaxed text-ash-500">
            Tip: check DevTools → Console (F12) for the first red error, and
            Network → document status (should be 200 text/html, not a 404).
          </p>
        </div>
      </div>
    );
  }
}
