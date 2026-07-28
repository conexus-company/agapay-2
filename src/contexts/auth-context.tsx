import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { clearIdentity, loadIdentity, saveIdentity } from '@/lib/auth-storage';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export type AuthSession = {
  /** Citizen profile confirmed via eGov SSO. */
  profile: unknown;
  /** eVerify result confirming the identity against a completed Face Liveness session. */
  everify: unknown;
};

type AuthContextValue = {
  status: AuthStatus;
  session: AuthSession | null;
  signIn: (session: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadIdentity().then((identity) => {
      if (cancelled) return;
      if (identity) {
        setSession(identity);
        setStatus('signedIn');
      } else {
        setStatus('signedOut');
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (next: AuthSession) => {
    await saveIdentity(next);
    setSession(next);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    await clearIdentity();
    setSession(null);
    setStatus('signedOut');
  }, []);

  const value = useMemo(() => ({ status, session, signIn, signOut }), [status, session, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
