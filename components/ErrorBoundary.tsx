"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Rendered in place of the subtree when it throws. Defaults to nothing (the
   *  widget simply disappears) so a broken part degrades quietly. */
  fallback?: ReactNode;
  /** Label for the console error, to identify which subtree failed. */
  label?: string;
}

interface State {
  hasError: boolean;
}

/**
 * A class error boundary — the only React mechanism that catches render and
 * lifecycle throws. Wrap independent widgets (e.g. the sidebar, the topbar) so a
 * fault in one degrades to a fallback + a console error instead of escalating to
 * the route/global error boundary and blanking the whole app.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Surface it for debugging — never rethrow (that would blank the app).
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.label ? " " + this.props.label : ""}]`, error, info);
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}
