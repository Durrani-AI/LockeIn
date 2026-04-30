import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearBackendSession, syncBackendSession } from "@/lib/api/backend-session";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const syncSecureBackendSession = async (nextSession: Session | null) => {
    if (!nextSession?.access_token) {
      await clearBackendSession({ bestEffort: true });
      return;
    }

    try {
      await syncBackendSession(nextSession.access_token);
    } catch (error) {
      console.error("Failed to sync backend secure session", error);
    }
  };

  useEffect(() => {
    // Set up listener BEFORE getSession
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
      void syncSecureBackendSession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      void syncSecureBackendSession(data.session);
    });
    return () => sub.subscription.unsubscribe();
    // Intentionally run this once at provider mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signOut: async () => {
          await clearBackendSession({ bestEffort: true });
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
