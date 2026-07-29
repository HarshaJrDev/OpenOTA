"use client";

import * as React from "react";

const STORAGE_KEY = "openota:currentProjectId";

interface CurrentProjectContextValue {
  currentProjectId: string | null;
  setCurrentProjectId: (projectId: string | null) => void;
}

const CurrentProjectContext = React.createContext<CurrentProjectContextValue | null>(null);

/**
 * v0.1 has no orgs/teams — "current project" is just a client-side selection persisted in
 * localStorage, not a server-side concept. Every API call that needs a project still takes an
 * explicit :projectId; this only decides which one the UI points at by default.
 */
export function CurrentProjectProvider({ children }: { children: React.ReactNode }) {
  const [currentProjectId, setCurrentProjectIdState] = React.useState<string | null>(null);

  React.useEffect(() => {
    setCurrentProjectIdState(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  const setCurrentProjectId = React.useCallback((projectId: string | null) => {
    setCurrentProjectIdState(projectId);
    if (projectId) {
      window.localStorage.setItem(STORAGE_KEY, projectId);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const value = React.useMemo(() => ({ currentProjectId, setCurrentProjectId }), [currentProjectId, setCurrentProjectId]);

  return <CurrentProjectContext.Provider value={value}>{children}</CurrentProjectContext.Provider>;
}

export function useCurrentProject() {
  const ctx = React.useContext(CurrentProjectContext);
  if (!ctx) {
    throw new Error("useCurrentProject must be used within CurrentProjectProvider");
  }
  return ctx;
}
