import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { AuthSession } from '@/contexts/auth-context';

type HealthProfileSetupContextValue = {
  /** Session captured right after SSO login succeeds, awaiting profile creation before signIn() finalizes it. */
  pendingSession: AuthSession | null;
  beginSetup: (session: AuthSession) => void;
  clearPendingSession: () => void;
};

const HealthProfileSetupContext = createContext<HealthProfileSetupContextValue | null>(null);

export function HealthProfileSetupProvider({ children }: { children: ReactNode }) {
  const [pendingSession, setPendingSession] = useState<AuthSession | null>(null);

  const beginSetup = useCallback((session: AuthSession) => {
    setPendingSession(session);
  }, []);

  const clearPendingSession = useCallback(() => {
    setPendingSession(null);
  }, []);

  const value = useMemo(
    () => ({ pendingSession, beginSetup, clearPendingSession }),
    [pendingSession, beginSetup, clearPendingSession]
  );

  return <HealthProfileSetupContext.Provider value={value}>{children}</HealthProfileSetupContext.Provider>;
}

export function useHealthProfileSetup(): HealthProfileSetupContextValue {
  const ctx = useContext(HealthProfileSetupContext);
  if (!ctx) {
    throw new Error('useHealthProfileSetup must be used within a HealthProfileSetupProvider');
  }
  return ctx;
}
