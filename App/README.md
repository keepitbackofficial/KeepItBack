# KeepItBack 📥

**Save anything. Find everything.**

A private, searchable library for links from Instagram, TikTok, YouTube, and
the web. Built with **Expo SDK 58 · React Native 0.88 · React 19.3 · Expo
Router · Supabase Auth and PostgreSQL**. The mobile app uses the Warm Editorial
Archive design in `Ui Screens/`, with Playfair Display, Plus Jakarta Sans,
paper surfaces, and terracotta controls.

## What's implemented

| Feature | Status |
|---|---|
| Email/password sign-up and sign-in, persistent Supabase session | ✅ |
| Email confirmation, one-time email-code sign-in, password recovery | ✅ |
| Save links to Supabase, duplicate detection, honest errors | ✅ |
| YouTube / TikTok previews from their oEmbed endpoints | ✅ best effort |
| Instagram Reel/Post previews via Microlink | ✅ server proxy; availability depends on the source and free quota |
| Home / Library / Search / counts from real rows | ✅ |
| Notes, tags, and collections | ✅ RLS-protected |
| Instagram DM linking, shared collection invites, privacy endpoints | ✅ app and Edge Function code; requires server setup |
| Native share-to-app | ✅ Android and iOS development/production builds |
| Device downloads | ✅ direct permitted media links only |
| Opt-in first-party analytics | ✅ fixed event names only; no saved content |
| AI summaries / semantic search | ⛔ intentionally absent |

## 1. Install and run

```bash
npm install
npx expo start          # Expo Go / emulator; press a or i
npx tsc --noEmit        # typecheck
npx expo lint           # lint
```

Native share receiving requires a custom development or production build:

```bash
npx expo run:android
npx expo run:ios
```

## 2. Configure Supabase Auth

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Set the API URL and public anon/publishable key in `App/.env`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://api.keepitback.in
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<public-anon-or-publishable-key>
   ```
   `api.keepitback.in` is the API hostname for this deployment. If you connect
   a different Supabase project, use its configured project URL or custom domain.
   Never put the service-role key in the app environment.
3. In Supabase Dashboard → **Authentication → URL Configuration**, add the app
   callback URL `keepitback://auth/callback` to the redirect allowlist. While
   using Expo Go, also allow the `exp://<your-dev-host>:8081/--/auth/callback`
   URL emitted by `Linking.createURL('auth/callback')` for your current session.
4. In **Authentication → Sign In / Providers → Email**, enable email and
   password sign-in. Email confirmation can be enabled or disabled. If enabled,
   the app accepts both the confirmation link and a numeric code. To support
   numeric code entry, set the relevant email templates to include
   `{{ .Token }}`; links based on `{{ .ConfirmationURL }}` are also handled by
   the app callback.
5. Restart Expo after editing `.env`:
   ```bash
   npx expo start --clear
   ```

Email/password, email-code sign-in, email verification, and password recovery
all use Supabase Auth. “Other ways to log in” sends a one-time code by email;
social providers are not shown because none are configured in this app.
Supabase Auth sessions persist in AsyncStorage on native and browser storage on
web. Protected routes wait for session restoration before redirecting.

## 3. Supabase database

Run the SQL migrations manually in Supabase Dashboard → **SQL Editor**, in
timestamp order. They have not been applied by this repository workflow.

- [Baseline schema](supabase/migrations/20261026090000_keepitback_baseline.sql)
  creates profiles, saved items, tags, collections, connected accounts, and
  their row-level security policies.
- [Mobile features](supabase/migrations/20261027120000_mobile_features.sql)
  adds categories, shared collections, notification preferences, analytics,
  and account cleanup.

The schema stores user IDs as text and compares them with the authenticated
JWT `sub`, so Supabase Auth UUIDs work without a schema change. Existing Clerk
accounts are not imported: users need Supabase Auth accounts, and old rows
whose `user_id` contains a Clerk ID will not appear under a new Supabase user.
Export any existing data before retiring those accounts if it needs to be
preserved.

## 4. Edge Functions

Deploy functions after the database migrations:

```bash
npx supabase functions deploy link-code
npx supabase functions deploy link-metadata
npx supabase functions deploy instagram-webhook --no-verify-jwt
npx supabase functions deploy collection-invites
npx supabase functions deploy account-privacy
```

Authenticated app endpoints verify the Supabase access token with Supabase
Auth. The Meta webhook uses its own signature validation.

Set server-only secrets with the CLI; never add these to `.env` or the app
bundle:

```bash
npx supabase secrets set LINK_CODE_SECRET=<random-32-byte-secret>
npx supabase secrets set META_APP_SECRET=<your-meta-app-secret>
npx supabase secrets set META_VERIFY_TOKEN=<random-string-you-choose>
# optional, for confirmation replies in the DM thread:
npx supabase secrets set META_TOKEN=<ig-graph-token>
npx supabase secrets set META_IG_USER_ID=<ig-professional-account-id>
```

Instagram previews use Microlink's free endpoint for public Instagram post and
Reel links. Preview data depends on what the source exposes; an unavailable
cover or title does not prevent saving the URL. Microlink's free quota can
change, so check its [current link preview documentation](https://microlink.io/link-preview).

`collection-invites` creates hashed, one-time 16-character invite codes that
expire after seven days. `account-privacy` verifies the signed-in Supabase user,
removes KeepItBack records, and deletes the Supabase Auth user with a
server-only service-role key.

Webhook wiring: Meta App → Instagram Messaging webhooks → callback URL
`https://api.keepitback.in/functions/v1/instagram-webhook`. The
function verifies `X-Hub-Signature-256`, deduplicates messages, resolves the
sender's Instagram-scoped id to a connected account, and inserts the link with
`source='instagram_dm'` using the service role.

## Verification checklist

- [ ] Create an account with confirmation enabled and disabled
- [ ] Sign in with password and email code; restore session after restart
- [ ] Reset password from a confirmation link
- [ ] Sign out from Profile and Settings
- [ ] Save duplicate and new URLs; metadata and access remain RLS-scoped
- [ ] Export account data and delete a test account
- [ ] Shared collection invite roles enforce owner/editor/viewer behavior
- [ ] User B cannot read User A's rows

## Architecture

```
app/                     Expo Router auth, tabs, content, collections, settings
src/auth/AuthProvider.tsx Supabase Auth session context and protected routing
src/lib/supabase.ts      Supabase Auth and database client
src/lib/localStore.ts    Device-only downloads and local sync metadata
src/api/                 Profile, items, collections, accounts, privacy
src/store/useLibrary.ts  UI state fed by Supabase reads and writes
supabase/migrations/     Schema SQL (run manually)
supabase/functions/      Supabase token verification and server-only functions
```
