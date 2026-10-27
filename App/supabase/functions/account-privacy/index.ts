import { createClient } from 'npm:@supabase/supabase-js@2';
import { getAuthenticatedUser } from '../_shared/auth.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json({ code: 'not_configured', error: 'Account deletion is not configured on this server.' }, 503);
  }

  const user = await getAuthenticatedUser(req);
  if (!user) return json({ code: 'unauthorized', error: 'Sign in to KeepItBack first.' }, 401);

  let body: { action?: string };
  try { body = await req.json(); } catch { return json({ error: 'Send a JSON request body.' }, 400); }
  if (body.action !== 'delete_account') return json({ error: 'Unknown privacy action.' }, 400);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: cleanupError } = await admin.rpc('purge_keepitback_user', { p_user_id: user.id });
  if (cleanupError) return json({ error: 'KeepItBack could not remove your cloud data. Your account was not deleted.' }, 500);

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return json({ code: 'auth_delete_pending', error: 'Your KeepItBack data was removed, but Supabase could not delete the login account. Contact support to finish account deletion.' }, 500);
  }
  return json({ ok: true });
});
