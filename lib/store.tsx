"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Post, View } from "./types";
import { SEED_POSTS } from "./data";

interface AppState {
  view: View;
  setView: (v: View) => void;
  posts: Post[];
  addPost: (p: Omit<Post, "id" | "createdAt" | "likes" | "replies">) => void;
  rsvps: Set<string>;
  toggleRsvp: (eventId: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [view, setViewState] = useState<View>("us");
  const [posts, setPosts] = useState<Post[]>(SEED_POSTS);
  const [rsvps, setRsvps] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Default to US View unless the member has chosen otherwise (persisted locally).
  useEffect(() => {
    const saved = window.localStorage.getItem("bl.view");
    if (saved === "us" || saved === "nepal" || saved === "bridge") setViewState(saved);
  }, []);

  const setView = (v: View) => {
    setViewState(v);
    try { window.localStorage.setItem("bl.view", v); } catch {}
  };

  const addPost: AppState["addPost"] = (p) => {
    setPosts((prev) => [
      { ...p, id: `local-${Date.now()}`, createdAt: "Just now", likes: 0, replies: 0 },
      ...prev,
    ]);
  };

  const toggleRsvp = (eventId: string) => {
    setRsvps((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const value = useMemo(
    () => ({ view, setView, posts, addPost, rsvps, toggleRsvp, sidebarOpen, setSidebarOpen }),
    [view, posts, rsvps, sidebarOpen]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
