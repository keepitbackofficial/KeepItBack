# KeepItBack 📥

**Save anything. Find everything.**

A personal content-saving and retrieval app built from `KeepItBack_PRD.md` and
`KeepItBack_UI_Screens.md`: save links from any platform in one tap, then find
them months later with one search.

Built with **Expo SDK 57 · React Native 0.86 · TypeScript · Expo Router · Zustand**.

## Run it

```bash
cd App
npm install
npx expo start        # scan with Expo Go, or press a / i for emulator
```

Typecheck: `npx tsc --noEmit`

## Screens implemented (spec §3 inventory)

| Area | Screens |
|---|---|
| Auth | Splash, Onboarding (×3), Sign In, Create Account |
| Main | Home, Search (live + recent/suggested), Save URL, Save Confirmation |
| Content | Content Details (AI summary, keywords, tags, note, why-saved), More Menu |
| Library | Library (filters + sort), Collections, Collection Details, Create Collection, Add-to-Collection sheet, Edit Tags |
| Downloads | Downloads (progress), Storage Manager |
| Profile | Profile, Edit Profile, Settings, Account & Security, Privacy, Notifications |
| States | Empty library, Empty search, Skeleton loading, Duplicate save, Unsupported download, Delete confirmations |

## Architecture

```
app/            Expo Router routes ((auth)/(tabs)/content/collections/downloads/settings)
src/theme.ts    Design tokens from the UI spec (dark #0B0B0F, accent #7C5CFC)
src/types.ts    Domain model (saved_items, collections, tags, settings — PRD §25)
src/lib/        Platform detection · keyword+semantic search · AI pipeline
src/data/       Demo seed library (Hyderabad trip, coding, food…)
src/store/      Zustand store, persisted to AsyncStorage (multi-launch state)
src/components/ KIB component library (Button, ContentCard, BottomSheet, …)
```

Core UX rules honored: saving never requires a collection; AI never blocks a
save (runs async, 2s mock); deleting a cloud item never auto-deletes the local
copy; duplicates surface "Already Saved" with Open / Save Anyway / Cancel.

## Plugging in real services

- **Clerk (PRD §23):** auth is behind a small adapter in `app/(auth)/` — swap
  the mock `signIn()` calls for `@clerk/clerk-expo`'s `useSSO()` / Clerk
  provider. See `clerk.md` if you want to wire it with the Clerk CLI.
- **Supabase (PRD §27):** `src/store/useStore.ts` is the single data layer.
  Replace the local mutations with Supabase calls against the `saved_items`,
  `collections`, `tags` tables from the PRD §25 schema, with RLS enabled.
- **AI (PRD §20):** `src/lib/ai.ts` mocks the extraction pipeline — point it
  at a Supabase Edge Function backed by an LLM.

> Note: `clerk.md` in this folder was not created by this project's build; it
> contains Clerk CLI setup instructions requiring an interactive login.
