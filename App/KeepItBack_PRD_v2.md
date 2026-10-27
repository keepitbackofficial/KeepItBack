# KeepItBack --- Production Implementation PRD v2

> **Authentication update (2026-10-28):** Supabase Auth is now the app's
> identity provider and supersedes the Clerk-specific requirements in this
> earlier brief. The mobile client and Edge Functions must use Supabase Auth.

**Purpose:** Implement the real KeepItBack application in the existing
repository. This is an implementation brief, not a request for mockups.

## Critical instructions to the coding agent

1.  Inspect the current repository, package.json, routes, components,
    auth, Supabase setup, and existing design before editing. Preserve
    compatible installed Expo/React Native versions. Do not blindly
    reinstall or downgrade dependencies.
2.  Implement working features, not just UI. Use **Clerk as the only
    authentication provider** and Supabase PostgreSQL for application
    data.
3.  **Never add dummy data.** No fake users, sample Reels, hard-coded
    counts/results, fake account connections, simulated sync, demo mode,
    or fake success states. Empty states must be real and honest.
4.  Generate a timestamped migration in `supabase/migrations/`. The
    developer will execute SQL manually. Do not run it or claim it has
    been applied.
5.  Use real backend reads/writes. If configuration is missing, show a
    clear "Not configured" or actionable error state. Do not silently
    substitute mocks.
6.  Never ask users for Instagram passwords. Never scrape private pages,
    bypass DRM, or claim an unsupported platform capability. Do not
    invent endpoints, permissions, credentials, or API results.
7.  If a genuinely essential decision cannot be determined from the
    repository or this brief, ask a concise question. Otherwise proceed
    and document blocked/configuration-dependent integrations.
8.  Deliver working code changes, migration SQL, `.env.example` with
    variable names only, README setup instructions, and a report listing
    changed files, tests, working features, and blockers.

## 1. Product

KeepItBack is a private, searchable library for content discovered
online: Instagram Reels/posts/carousels, TikTok videos, YouTube
Shorts/videos, images, articles, and web links. Core promise: **"Save
anything. Find everything."** Saving should take one action; finding
should take one search. Save references and available metadata by
default. Downloading a media file to the device is separate and
optional, and must only be offered where supported and permitted.

## 2. Stack and repository constraints

Use the existing React Native + Expo + TypeScript app and Expo Router if
already configured. Project context indicates Expo SDK 58 / Expo Router
58 / React Native 0.88 / React 19.3, plus AsyncStorage, Expo Clipboard,
Expo WebBrowser, safe-area-context, screens, and Zustand. Verify actual
files before changing dependencies. Use Clerk for identity, Supabase
PostgreSQL for durable data, Supabase Edge Functions or another
server-side runtime for privileged integrations, and local storage only
as a cache/offline layer---not as a fake backend.

## 3. Real authentication flow (must implement)

-   Implement actual Clerk sign-up, sign-in, sign-out, session
    restoration, and protected routes using the official SDK/API
    compatible with the installed package version.
-   Support the sign-in methods configured in the actual Clerk instance.
    Implement email verification/OTP only if enabled/configured; show
    real verification and error states.
-   No custom password storage, no Supabase Auth, no hard-coded
    logged-in user, no fake auth, no password logging, and no
    credentials in source control.
-   During startup, restore Clerk session; signed-out users see
    onboarding/auth routes, signed-in users enter the app. Prevent
    authenticated users from being unnecessarily trapped on sign-in
    screens.
-   Show actual name/email/avatar from Clerk when available.
    Create/upsert the application profile after real authentication,
    idempotently. Do not fabricate missing profile fields.
-   Implement accessible loading, validation, verification, network
    error, retry, and success states.

### Clerk ↔ Supabase identity

Clerk is the source of identity. Store Clerk user IDs as **text**, not
UUID. Configure Supabase to trust Clerk-issued JWTs using the supported
Clerk/Supabase third-party-auth integration for the installed versions.
RLS must compare row `user_id` to the verified JWT subject
(`auth.jwt()->>'sub'`). Do not use `auth.uid()` if it casts the Clerk
subject to UUID. Use only Supabase public/anon credentials in the mobile
client. Never include the service-role key in client code. If
third-party auth is not configured, explain the exact dashboard steps
and show an actionable error---never disable RLS or use an insecure
fallback.

## 4. Main flows

### First launch

1.  Restore the real Clerk session.
2.  If signed out, show real sign-in/sign-up.
3.  If signed in, fetch the user's actual profile and saved items from
    Supabase.
4.  Show honest empty states if no rows exist. Show retryable errors if
    requests fail. Never fill gaps with sample content.

### Save content

-   Accept pasted URLs and, where supported by the current
    project/platform, native Share-to-KeepItBack input.
-   Validate URL and normalize it conservatively; detect
    Instagram/TikTok/YouTube/web by hostname.
-   Saving a URL must work even when metadata cannot be fetched. Save
    only actual URL and metadata returned by a permitted API or
    explicitly provided by the user.
-   Store source only when true (`manual`, `share_extension`,
    `instagram_dm`, `account_import`). Native share-to-app is implemented
    for shared text/URLs through the Expo share-intent integration; verify
    cold-start and warm-app behavior on supported native builds.
-   Deduplicate per user using a reliable canonical URL when available,
    otherwise normalized original URL. Show the existing item for
    duplicates.
-   Show "Saved" only after Supabase confirms the write. If Supabase
    fails, show an error and retry action.
-   Do not scrape private pages or download media by bypassing platform
    controls.

### Home / Library

-   Query real saved items scoped to the signed-in user and order by
    `saved_at` descending.
-   Counts must be computed from actual database results.
-   Empty library explains how to save the first item. Errors have retry
    controls. Never show fake trending/recommended content.

### Search

-   Search actual user-owned rows: URL, title, description/caption,
    creator, notes, tags, and AI metadata only when actually populated
    by a real process.
-   Debounce input, paginate results, support clear query and filters
    for platform (All, Instagram, TikTok, YouTube, Web) and content type
    where stored.
-   Start with real PostgreSQL full-text/substring search; do not claim
    semantic AI search unless a real embedding pipeline is built.
-   Empty results must say no saved items match; never substitute mock
    results. Enforce user isolation with RLS and explicit user scoping
    as appropriate.

### Item details, notes, tags, collections

-   Display only real fields. Open original URL safely.
-   Persist notes, tags, and collections to Supabase.
-   Create/edit/delete collections and add/remove saved items using real
    writes and ownership checks.
-   Confirm destructive actions and show completion only after
    successful persistence. Hide or disable actions that are not
    implemented; do not make dead buttons.

### Downloads

Saving a URL and downloading media are separate actions. Implement
device downloads only when there is a permitted, supported direct media
source. Otherwise say "Download unavailable for this link" and keep the
URL saved. Do not scrape private pages, bypass DRM, or upload large
videos to Supabase by default.

## 5. Instagram connection via DM code

### Desired flow

1.  User messages the official KeepItBack Instagram professional
    account.
2.  A configured and approved Meta Instagram Messaging integration sends
    a one-time verification code.
3.  While signed into KeepItBack with Clerk, the user enters the code.
4.  Server-side verification links the Instagram-scoped sender ID to the
    authenticated Clerk user ID.
5.  When that user later sends supported Reel/post content to
    KeepItBack's Instagram account, the webhook attempts to save the
    shared URL to their library.
6.  Saved links become searchable like other items.

### Truthful boundaries

-   This is for future content deliberately sent to KeepItBack; it
    **does not import the user's existing Instagram Saved collection**.
-   Instagram OAuth or DM linking must not be represented as granting
    access to all personal Saved Reels.
-   Meta account setup, permissions, app review where required,
    webhooks, and real secrets may be needed. Inspect current official
    API docs and webhook payloads before implementing.
-   If Meta credentials/permissions are absent, implement the UI and
    server contract but show "Not configured"; do not issue a fake code
    or show a fake connected state.
-   Codes must be cryptographically random, server-generated, stored
    only as hashes, single-use, expire after 10 minutes, be
    rate-limited, and be bound to the signed-in Clerk user. Never log
    raw codes.
-   Verify webhook signatures; deduplicate event IDs; process writes
    server-side. Match users using the Instagram-scoped sender ID, not
    username/display name alone.
-   Never store provider tokens in plaintext. Add token handling only if
    the actual integration requires it, and keep secrets server-side.

## 6. Other platforms

-   Instagram: manual URL saving and supported DM share ingestion; no
    promise of existing Saved collection sync.
-   TikTok: manual URL saving and native share flow where supported. Add
    messaging/API integration only if a legitimate, approved API
    supports the intended workflow.
-   YouTube: manual URL saving and native share flow. Authorized YouTube
    API capabilities may be added only after verifying what they expose;
    do not claim access to all saved content.
-   Generic web links: save URL even when metadata is unavailable.

Use a common saved-item model and common search UI. Never show a
platform as "connected" unless a real integration completed
successfully.

## 7. Required UI

Keep the existing visual identity where possible: dark-first, background
`#0B0B0F`, surfaces `#15151B` / `#1C1C24`, border `#292933`, text
`#FFFFFF`, secondary `#A5A5B2`, violet accent `#7C5CFC` / `#A78BFA`.
Navigation: Home, Search, central Save, Library, Profile. Preserve
accessible contrast, keyboard-safe forms, touch targets, and readable
errors.

Required routes/states: splash/session restoration, sign-in, sign-up,
configured verification flow, Home, Search/results, Save URL, item
details, Library, collections, Profile, Connected Accounts/code entry,
integration status, Settings, loading, empty, offline, error/retry,
invalid URL, duplicate item, and unconfigured integration. Loading
skeletons only while real requests are in progress.

## 8. Database and migration

Generate a timestamped SQL file under `supabase/migrations/`, review
existing schema before choosing table names, and do not execute it.
Baseline entities: `profiles`, `saved_items`, `collections`,
`collection_items`, `tags`, `item_tags`, optional `content_ai`,
`connected_accounts`, server-only `account_link_codes`, and server-only
`webhook_events` if webhook processing is implemented.

Requirements: - Clerk IDs are text; no seed/demo rows. - Foreign keys,
uniqueness constraints, indexes for user+saved date, platform, canonical
URL, collections, and search fields. - RLS on every user-owned table; no
public read access to private content. - Policies compare `user_id` to
`auth.jwt()->>'sub'` after Clerk JWT trust is configured. - Do not grant
mobile clients direct access to one-time code hashes or webhook event
internals. Verification and webhook ingestion are server-side only. -
Use safe `search_path` for any `SECURITY DEFINER` function and minimum
privileges. - Do not place service-role credentials in the app bundle.

A baseline migration file is supplied alongside this PRD for review. The
implementation agent must adapt it to the actual repo and avoid
collisions before finalizing the migration.

## 9. Environment and documentation

Create/update `.env.example` with variable names only. Use names
appropriate to installed SDKs for Clerk publishable key, Supabase
URL/public key, and server-only secrets. Never put real credentials in
`.env.example`, source code, commits, screenshots, or logs. Do not ask
the user to paste secrets into chat. Put service-role and Meta secrets
in Edge Function/hosting secrets only.

Update README with: - Clerk app setup and local configuration - Supabase
project configuration - exact Clerk ↔ Supabase third-party-auth steps
for the selected SDK versions - migration path and manual SQL Editor
execution instructions - Edge Function secrets and deploy steps if
used - Meta Developer setup and required permissions only if integration
is actually implemented - install/run/typecheck/lint/test commands -
end-to-end verification checklist

## 10. Acceptance criteria

### Auth

-   [ ] Real Clerk sign-up and sign-in work with configured instance.
-   [ ] Real verification flow works if enabled.
-   [ ] Session survives app restart.
-   [ ] Protected navigation and sign-out work.
-   [ ] No Supabase Auth/custom password system/fake session.

### Supabase

-   [ ] Migration exists but was not executed by the agent.
-   [ ] No seed/demo content.
-   [ ] RLS is enabled on all private tables.
-   [ ] Clerk ID is compared as text against verified JWT subject.
-   [ ] User A cannot read/write User B's data.
-   [ ] Service-role key is absent from the client bundle.
-   [ ] Profile is created from real Clerk identity.

### Saved items/search

-   [ ] Valid URL saves to Supabase.
-   [ ] Home and Library fetch persisted rows.
-   [ ] Search/filter queries real rows.
-   [ ] Duplicate handling works.
-   [ ] Backend errors never show false success.
-   [ ] Empty states contain no fake cards.

### Integrations

-   [ ] Instagram code entry exists.
-   [ ] Code validation is server-side, expiring, single-use, and
    rate-limited.
-   [ ] Without Meta configuration, the app clearly reports not
    configured.
-   [ ] No claim of existing Saved-Reels sync.
-   [ ] Webhooks are signature-verified and idempotent if enabled.

### Delivery

-   [ ] `.env.example` contains no secrets.
-   [ ] README setup and manual migration steps are complete.
-   [ ] Typecheck/lint/tests run where configured; report actual
    results.
-   [ ] Final report distinguishes working features from unconfigured
    integrations and remaining blockers.

## 11. Do not silently invent

Do not add demo mode, fake API responses, fake sync, fake AI summaries,
hard-coded user data, paid AI/analytics services without approval, or a
fake Instagram OAuth flow. Do not execute SQL. Do not claim production
readiness because the app compiles. If an essential unknown blocks a
real feature, ask a specific question; otherwise implement the verified
portions and document exactly what remains configuration-dependent.
