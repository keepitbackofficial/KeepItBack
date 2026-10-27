import type { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { setActiveUser } from '../lib/authState';

type AuthContextValue = {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  user: User | null;
  session: Session | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setActiveUser(null);
      setIsLoaded(true);
      return;
    }

    const supabase = getSupabase();
    let mounted = true;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setActiveUser(nextSession?.user ?? null);
      setIsLoaded(true);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (!error) {
        setSession(data.session);
        setActiveUser(data.session?.user ?? null);
      }
      setIsLoaded(true);
    }).catch(() => {
      if (mounted) setIsLoaded(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    const refreshForAppState = (state: string | null | undefined) => {
      if (state === 'active') void supabase.auth.startAutoRefresh();
      else void supabase.auth.stopAutoRefresh();
    };
    refreshForAppState(AppState.currentState);
    const subscription = AppState.addEventListener('change', refreshForAppState);
    return () => subscription.remove();
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    isLoaded,
    isSignedIn: Boolean(session?.user),
    userId: session?.user.id ?? null,
    user: session?.user ?? null,
    session,
    signOut,
  }), [isLoaded, session, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}

/** Small compatibility helper for screens that only need the current user. */
export function useUser() {
  const { user } = useAuth();
  const metadataName = typeof user?.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name
    : typeof user?.user_metadata?.name === 'string'
      ? user.user_metadata.name
      : '';
  const email = user?.email ?? '';
  return {
    user: user ? {
      id: user.id,
      email,
      fullName: metadataName,
      firstName: metadataName.split(/\s+/)[0] ?? '',
      primaryEmailAddress: email ? { emailAddress: email } : null,
      emailAddresses: email ? [{ emailAddress: email }] : [],
    } : null,
  };
}

