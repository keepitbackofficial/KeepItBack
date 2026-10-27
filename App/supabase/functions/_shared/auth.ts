import { createClient } from 'npm:@supabase/supabase-js@2';

/** Verify a Supabase Auth bearer token with the Auth server and return its user. */
export async function getAuthenticatedUser(req: Request) {
  const authorization = req.headers.get('Authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY')
    ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
    ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!token || !url || !key) return null;

  const authClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await authClient.auth.getUser(token);
  return error ? null : data.user;
}
