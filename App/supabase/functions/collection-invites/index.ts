import { createClient } from 'npm:@supabase/supabase-js@2';
import { getAuthenticatedUser } from '../_shared/auth.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const;
const encoder = new TextEncoder();

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase server configuration is missing.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function digestCode(code: string) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(code.toUpperCase()));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const random = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(random, (byte) => alphabet[byte & 31]).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return response({ error: 'Method not allowed.' }, 405);

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return response({ code: 'unauthorized', error: 'Sign in to KeepItBack first.' }, 401);
  const userId = authUser.id;

  let body: { action?: string; collectionId?: string; code?: string; inviteId?: string; role?: 'editor' | 'viewer' };
  try { body = await req.json(); } catch { return response({ error: 'Send a JSON request body.' }, 400); }

  try {
    const db = adminClient();
    if (body.action === 'create') {
      const collectionId = body.collectionId ?? '';
      const role = body.role === 'editor' ? 'editor' : 'viewer';
      const { data: member, error: memberError } = await db.from('collection_members')
        .select('role').eq('collection_id', collectionId).eq('user_id', userId).maybeSingle();
      if (memberError || !member || !['owner', 'editor'].includes(member.role)) {
        return response({ code: 'forbidden', error: 'Only collection owners and editors can invite members.' }, 403);
      }
      if (member.role === 'editor' && role === 'editor') {
        return response({ code: 'forbidden', error: 'Editors can invite viewers. Only the owner can invite another editor.' }, 403);
      }
      const code = makeCode();
      const { data: invite, error } = await db.from('collection_invites').insert({
        collection_id: collectionId,
        code_hash: await digestCode(code),
        role,
        created_by: userId,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }).select('id, expires_at').single();
      if (error) return response({ error: 'Could not create this invitation.' }, 500);
      const { error: shareError } = await db.from('collections').update({ is_shared: true }).eq('id', collectionId);
      if (shareError) {
        await db.from('collection_invites').delete().eq('id', invite.id);
        return response({ error: 'Could not enable sharing for this collection.' }, 500);
      }
      return response({ code, inviteId: invite.id, expiresAt: invite.expires_at });
    }

    if (body.action === 'accept') {
      const code = (body.code ?? '').replace(/\s+/g, '').toUpperCase();
      if (!/^[A-HJ-NP-Z2-9]{16}$/.test(code)) return response({ code: 'invalid_invite', error: 'Enter the 16-character invite code.' }, 400);
      const { data, error } = await db.rpc('accept_collection_invite', {
        p_code_hash: await digestCode(code),
        p_user_id: userId,
      });
      if (error || !data?.[0]) return response({ code: 'invalid_invite', error: 'This invitation is invalid, expired, revoked, or already used.' }, 400);
      return response({
        ok: true,
        collectionId: data[0].collection_id,
        role: data[0].member_role,
        alreadyMember: data[0].already_member,
      });
    }

    if (body.action === 'revoke') {
      const { data: invite } = await db.from('collection_invites').select('id,collection_id').eq('id', body.inviteId ?? '').maybeSingle();
      if (!invite) return response({ error: 'Invitation not found.' }, 404);
      const { data: member } = await db.from('collection_members').select('role')
        .eq('collection_id', invite.collection_id).eq('user_id', userId).maybeSingle();
      if (!member || !['owner', 'editor'].includes(member.role)) return response({ error: 'You cannot revoke this invitation.' }, 403);
      const { error } = await db.from('collection_invites').update({ revoked_at: new Date().toISOString() }).eq('id', invite.id);
      if (error) return response({ error: 'Could not revoke this invitation.' }, 500);
      return response({ ok: true });
    }

    return response({ error: 'Unknown invitation action.' }, 400);
  } catch {
    return response({ error: 'Sharing is temporarily unavailable.' }, 500);
  }
});
