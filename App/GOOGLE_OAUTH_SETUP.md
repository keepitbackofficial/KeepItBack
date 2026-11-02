# KeepItBack — Google Sign-In Configuration Guide

Verified against V4 PRD §2.3. Complete these steps once; afterwards the
"Continue with Google" buttons on the sign-in and sign-up screens produce
real Supabase sessions.

## 1. Google Cloud project

1. Go to <https://console.cloud.google.com> and create (or select) a project.
2. **APIs & Services → OAuth consent screen**
   - User type: External.
   - Add the app name (KeepItBack), a support email and the authorized domain
     of your marketing site.
   - Publish the app (or keep it in Testing and add test accounts).

## 2. OAuth client

**APIs & Services → Credentials → Create credentials → OAuth client ID**

| Setting | Value |
|---|---|
| Application type | Web application |
| Authorized JavaScript origins | *(not needed for this flow)* |
| Authorized redirect URIs | `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback` |

The `<your-supabase-project-ref>` is the subdomain of the URL stored in
`EXPO_PUBLIC_SUPABASE_URL`.

Google grants these client **ID** and **secret** to Supabase only — they
are server-side credentials and must never go into the app.

## 3. Supabase — auth provider + URLs

**Dashboard → Authentication → Providers → Google**

- Enable the Google provider.
- Paste the Client ID and Client secret from step 2.

**Dashboard → Authentication → URL Configuration**

- Site URL: your production landing page (any HTTPS URL).
- Redirect URLs: add both of these:
  - Expo Go (development): `exp://**` (Expo Go's own redirect is generated per session; the wildcard is accepted by Supabase).
  - Production build (deep link): `keepitback://auth/callback`
  - Any custom custom build variants used during dev (e.g. a mobile-device build through `npx expo run:android`) resolve to the same `keepitback://auth/callback` because `app.json` declares `"scheme": "keepitback"`.

> The app builds each flow's `redirectTo` with `expo-linking`
> (`Linking.createURL('/auth/callback')`), so these two entries cover both
> Expo Go and standalone builds. Google itself only ever sees Supabase's
> fixed callback URL from step 2; per-flow redirects don't need separate
> Google registrations, but they must be allow-listed by Supabase above.

## 4. Android / iOS specifics

- **Expo Go (development):** works out of the box — the redirect is
  `exp://.../--/auth/callback` and the PKCE code exchange completes in
  `app/auth/callback`.
- **Android dev build / production:** handled by the `keepitback://` scheme
  from `app.json` (no `SHA-1` certificate and no native Google SDK needed,
  because this is a browser-based PKCE flow, not `@react-native-google-signin`).
- **iOS:** same scheme; no Apple Settings work is required. The share
  extension iOS app group (`group.in.app.keepitback`) is unrelated to auth.

## 5. EAS builds

If you deploy through EAS, no extra secrets are required: the app reads only
`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (public
values). Never place a service-role key or the Google client secret in
`.env` for the client.

## 6. Verifying the setup

1. `npx expo start` → open in Expo Go, or `npx expo run:android` for a dev build.
2. Tap **Continue with Google**.
3. Pick an account; the browser should return to the app automatically.
4. The Home screen appears and your display name/email shows on the profile.

If the browser shows `redirect_uri not registered`, re-check step 2's exact
callback URL. If the app says “Google sign-in is not enabled for this
project”, re-check step 3's provider toggle and re-run.
