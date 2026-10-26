# KeepItBack 📥

**Save anything. Find everything.**

A private, searchable library for content discovered online: Instagram
Reels/posts, TikTok, YouTube, and any web link. Saving takes one paste;
finding takes one search of **your own rows** — no demo data, no fake sync.

Built with **Expo SDK 58 · React Native 0.88 · React 19.3 · Expo Router ·
Clerk (identity) · Supabase PostgreSQL (data)**. Dark-first UI
(`#0B0B0F`, violet `#7C5CFC`), implemented from `KeepItBack_PRD_v2.md`.

## What's real vs. what needs configuration

| Feature | Status |
|---|---|
| Real sign-up / sign-in / session restore (Clerk) | ✅ implemented — needs your Clerk instance configured |
| Save URL → Supabase, duplicate detection, honest errors | ✅ implemented |
| Home / Library / Search / counts from real rows | ✅ implemented |
| Notes, tags, collections CRUD (RLS-protected) | ✅ implemented |
| Honest empty states, retryable errors, "Not configured" states | ✅ implemented |
| Instagram DM code linking (server contract) | ✅ implemented in app + Edge Functions — needs Meta + Edge Function setup |
| Native share-to-app (`share_extension`) | ✅ implemented for shared text/URLs on Android and iOS; requires a development/native build |
| Device downloads | ⛔ "Download unavailable for this link" — no permitted direct media source is wired |
| AI summaries / semantic search | ⛔ intentionally absent (no fabricated AI) |

## 1. Install & run

```bash
npm install
npx expo start          # Expo Go / emulator; press a or i
npx tsc --noEmit        # typecheck
npx expo lint           # lint
```

Native share receiving is not available in Expo Go. Build and install a custom
development app after adding the share-intent plugin:

```bash
npx expo run:android
npx expo run:ios
```

From Instagram, TikTok, YouTube, or another app, choose **Share → KeepItBack**.
Shared links are saved to the signed-in user's library automatically; if signed
out, sign in first and the pending link is saved afterward. Rebuild the native
app whenever the share-intent plugin or its configuration changes.

## 2. Clerk setup (identity)

1. Create an app at [dashboard.clerk.com](https://dashboard.clerk.com) (or use the
   instance referenced in `clerk.md`). Enable the sign-in methods you want —
   the app implements **email + password with email-code verification**.
2. Copy the **Publishable key** (`pk_test_…` / `pk_live_…`) for that app into
   `.env` as `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. Use a real key from the
   dashboard, not a value copied from `.env.example`.
3. After changing `.env`, restart Expo with `npx expo start --clear` so the
   key is included in the JavaScript bundle. Never put a Clerk secret key in
   the mobile app's environment or client bundle.
4. Session persistence uses `expo-secure-store` via `@clerk/expo/token-cache`.
5. Protected routing: `app/(tabs)/*` requires an active Clerk session;
   signed-in users are bounced out of auth screens automatically.

## 3. Supabase project + Clerk ↔ Supabase trust

1. Create a project at [supabase.com](https://supabase.com). Add to `.env`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-publishable-key>
   ```
2. **Third-party auth:** Supabase Dashboard → *Authentication → Sign In /
   Providers → Third-Party Auth → Add provider → Clerk*. Activate the
   "Connect with Supabase" flow inside the Clerk dashboard (it provisions the
   integration and yields the Clerk domain to paste into that field). This
   makes every request carry a verified Clerk JWT where `auth.jwt()->>'sub'`
   equals the Clerk user id. **Do not** configure the deprecated JWT
   template; **never** share your Supabase JWT signing secret with Clerk.
3. The client uses the v2 `accessToken` callback (`src/lib/supabase.ts`) so
   each request fetches the *current* Clerk token — no token templates, no
   static auth headers.

## 4. Migration (run it yourself — the agent did not execute it)

Open Supabase Dashboard → **SQL Editor**, paste the entire contents of
[supabase/migrations/20261026090000_keepitback_baseline.sql](supabase/migrations/20261026090000_keepitback_baseline.sql),
and **Run**. It creates `profiles`, `saved_items` (+ FTS tsvector),
`tags`/`item_tags`, `collections`/`collection_items`,
`connected_accounts`, and server-only `account_link_codes` /
`webhook_events` (RLS enabled, **no policies** → only the service role can
touch them). All ownership policies compare the **text** Clerk subject:
`user_id = (select auth.jwt() ->> 'sub')` — never `auth.uid()` (which casts
to uuid). No seed rows exist.

## 5. Edge Functions (Instagram DM linking)

Deploy once Supabase is configured:

```bash
supabase functions deploy link-code
supabase functions deploy instagram-webhook --no-verify-jwt=false   # keep JWT verification ON for real Meta traffic
# Actually for Meta webhooks, deploy with --no-verify-jwt so Meta's signed
# POSTs (not Supabase JWTs) are accepted, then verify signatures in-code:
supabase functions deploy instagram-webhook --no-verify-jwt
```

Set secrets (server-side only, never in `.env`/app bundle):

```bash
supabase secrets set LINK_CODE_SECRET=$(openssl rand -hex 32)
supabase secrets set CLERK_JWKS_URL=https://<app>.clerk.accounts.dev/.well-known/jwks.json
supabase secrets set META_APP_SECRET=<your-meta-app-secret>
supabase secrets set META_VERIFY_TOKEN=<random-string-you-choose>
# optional, for confirmation replies in the DM thread:
supabase secrets set META_TOKEN=<ig-graph-token>
supabase secrets set META_IG_USER_ID=<ig-professional-account-id>
```

Because secrets are absent by default, the functions return
`503 {code:'not_configured'}` and the app shows a real "Not configured"
state — no fake codes, no fake connected badge.

Webhook wiring: Meta App → Instagram Messaging webhooks → callback URL
`https://<ref>.supabase.co/functions/v1/instagram-webhook`, verify token as
above, subscribe to **messages**. The function verifies
`X-Hub-Signature-256` (timing-safe), dedups by Meta `message.mid` in
`webhook_events`, resolves the sender's Instagram-scoped id (IGSID, never a
username) to a `connected_accounts` row, and inserts the shared URL with
`source='instagram_dm'` — only through the service role.

## 6. Verification checklist

- [ ] Sign-up works; email verification code arrives (if enabled on the instance)
- [ ] Session survives app restart (secure storage)
- [ ] First launch shows an **empty** library — no demo items anywhere
- [ ] Pasting a valid URL inserts a row in `saved_items`; invalid URL is rejected
- [ ] Saving the same link again shows the original item (duplicate path)
- [ ] Search matches titles/notes/creators/URLs/tags of **your** rows only
- [ ] Notes, tags, collections persist after restart
- [ ] Deleting an item is confirmed and reflected everywhere
- [ ] User B never sees User A's data (RLS + encrypted at rest)
- [ ] With Edge Function secrets unset, Connected Accounts says "Not configured"

## Architecture

```
app/                     Expo Router (auth)/(tabs)/content/collections/settings
src/lib/supabase.ts      Real client; Clerk token via accessToken callback
src/lib/platform.ts      URL validation, platform/content detection, canonicalization
src/api/                 profile · items · collections · accounts (all RLS-scoped)
src/store/useLibrary.ts  Display cache fed only by real writes/reads
supabase/migrations/     Baseline SQL (run manually in the SQL Editor)
supabase/functions/      link-code (verify+link) · instagram-webhook (ingest)
```

## Honest limitations

- **Native share input:** URL/text sharing is supported; sharing the actual
   video file is not. Social platforms may share a URL or text rather than media.
- **No device downloads:** platform links don't expose permitted direct file
  sources to this app; the UI states that instead of simulating progress.
- **No AI metadata:** search is real PostgreSQL substring matching on rows
  you saved; nothing "semantic" is claimed.
- **Instagram linking ≠ import:** DM linking only affects content you
  deliberately send to KeepItBack's Instagram in the future.
