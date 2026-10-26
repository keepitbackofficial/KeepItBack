/**
 * Bridges Clerk's `getToken()` into the Supabase client. The Supabase
 * client is a module singleton and cannot use the `useAuth()` hook, so the
 * root layout registers the getter here during startup.
 */
let tokenSource: (() => Promise<string | null>) | null = null;

export function setTokenSource(source: () => Promise<string | null>) {
  tokenSource = source;
}

export async function getAccessToken(): Promise<string | null> {
  if (!tokenSource) return null;
  return await tokenSource();
}
