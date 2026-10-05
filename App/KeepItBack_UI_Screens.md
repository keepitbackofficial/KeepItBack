# KeepItBack — Exact UI Screen Specification

**Version:** 1.0  
**Platform:** React Native — Android + iOS  
**Design Direction:** Premium, modern, dark-first, content-focused  
**Primary UX Rule:** Save in one tap. Find with one search.

---

# 1. Global Design System

## 1.1 Screen Size

Design baseline:

- iPhone 15 / 390 × 844
- Android reference: 360 × 800
- Responsive layout required
- Safe-area aware
- Support small and large phones

## 1.2 Theme

Primary theme: Dark.

Background:
- Main: #0B0B0F
- Elevated surface: #15151B
- Secondary surface: #1C1C24
- Card border: #292933

Text:
- Primary: #FFFFFF
- Secondary: #A5A5B2
- Muted: #6F6F7B

Accent:
- Purple / violet gradient
- Primary accent: #7C5CFC
- Secondary accent: #A78BFA

Status:
- Success: #35D07F
- Warning: #F5B942
- Error: #FF5C67

Use the accent sparingly. The interface should not look overly colorful.

## 1.3 Typography

Recommended:

- Inter / SF Pro / system sans-serif

Sizes:

- Display: 32 px / Bold
- H1: 26 px / Bold
- H2: 22 px / Semibold
- H3: 18 px / Semibold
- Body: 15–16 px / Regular
- Secondary: 13–14 px
- Caption: 11–12 px

## 1.4 Corner Radius

- Small: 8 px
- Medium: 12 px
- Large: 16 px
- Modal: 24 px
- Pill: 999 px

## 1.5 Spacing

Base spacing unit: 4 px.

Common:
- Screen horizontal padding: 20 px
- Section gap: 24 px
- Card gap: 12 px
- Button height: 48–52 px
- Input height: 52 px

---

# 2. Navigation Structure

Bottom navigation:

```text
┌──────────────────────────────────────┐
│                                      │
│              SCREEN                  │
│                                      │
├──────────────────────────────────────┤
│  Home   Search    +    Library  You  │
└──────────────────────────────────────┘
```

Tabs:

1. Home
2. Search
3. Save
4. Library
5. Profile

The Save button is visually emphasized and larger than normal navigation icons.

---

# 3. Screen Inventory

## Authentication

01. Splash
02. Onboarding 1
03. Onboarding 2
04. Onboarding 3
05. Sign In
06. Create Account

## Main App

07. Home
08. Search
09. Search Results
10. Filter Sheet
11. Save URL
12. Save Confirmation
13. Content Details
14. Add to Collection

## Library

15. Library
16. Collection List
17. Collection Details
18. Create Collection
19. Edit Tags
20. Notes / Why I Saved This

## Downloads

21. Downloads
22. Download Progress
23. Storage Manager

## Profile

24. Profile
25. Edit Profile
26. Settings
27. Account & Security
28. Privacy
29. Notifications

## System / States

30. Empty Library
31. Empty Search
32. Loading
33. Error
34. Offline
35. Duplicate Content
36. Unsupported Download

---

# 4. SCREEN 01 — SPLASH

## Purpose

Brand introduction while app initializes.

## Layout

```text
┌──────────────────────────────┐
│                              │
│                              │
│                              │
│          KEEPITBACK          │
│                              │
│       Save anything.         │
│       Find everything.       │
│                              │
│            ◉                 │
│        loading...            │
│                              │
│                              │
└──────────────────────────────┘
```

## Components

- KeepItBack logo
- Product name
- Tagline
- Small loading indicator

## Behavior

Check:

1. Authentication state
2. Local session
3. Initial sync state

Route to:

- Onboarding if first install
- Sign In if logged out
- Home if authenticated

---

# 5. SCREEN 02 — ONBOARDING 1

## Title

**Save anything.**

## Description

"Save Reels, Shorts, posts, images, articles and links from the apps you already use."

## Visual

Large phone mockup showing shared content being saved.

## Bottom

```text
[ Skip ]

                ● ○ ○

[ Continue ]
```

---

# 6. SCREEN 03 — ONBOARDING 2

## Title

**Find it later.**

## Description

"Search your entire saved library using keywords or natural language."

Visual:

```text
🔍 Hyderabad travel

12 results

Instagram
YouTube
TikTok
```

Bottom:

```text
○ ● ○

[ Continue ]
```

---

# 7. SCREEN 04 — ONBOARDING 3

## Title

**Keep it offline.**

## Description

"Save supported content directly to your device for offline access."

Important text:

"Downloads are available only for content that can be legally and technically downloaded."

Bottom:

```text
○ ○ ●

[ Get Started ]
```

---

# 8. SCREEN 05 — SIGN IN

## Layout

```text
┌──────────────────────────────┐
│                              │
│         KeepItBack           │
│                              │
│   Your personal content      │
│          library.             │
│                              │
│ [ Continue with Google   ]   │
│ [ Continue with Apple    ]   │
│                              │
│          or                  │
│                              │
│ [ Continue with Email    ]   │
│                              │
│       Don't have an account? │
│          Sign up             │
└──────────────────────────────┘
```

Use Clerk authentication UI or custom UI connected to Clerk.

---

# 9. SCREEN 06 — CREATE ACCOUNT

Fields:

- Email
- Password if email auth is used
- Display name
- Username

Buttons:

**Create Account**

Social:

**Continue with Google**

**Continue with Apple**

Username availability should be checked asynchronously.

---

# 10. SCREEN 07 — HOME

This is the primary screen.

## Layout

```text
┌────────────────────────────────────┐
│ Good evening, Ayaz          👤     │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ 🔍 Search your saved content  │ │
│ └────────────────────────────────┘ │
│                                    │
│ Quick access                       │
│                                    │
│ [All] [Instagram] [YouTube] [TikTok]│
│                                    │
│ Recently Saved              See all│
│                                    │
│ ┌────────────┐ ┌────────────┐     │
│ │            │ │            │     │
│ │ thumbnail  │ │ thumbnail  │     │
│ │            │ │            │     │
│ └────────────┘ └────────────┘     │
│ Hyderabad     React Tips           │
│ Instagram     YouTube              │
│                                    │
│ Collections                  See all│
│                                    │
│ [✈️ Travel] [💻 Coding] [🍔 Food] │
│                                    │
├────────────────────────────────────┤
│ Home Search   +   Library Profile  │
└────────────────────────────────────┘
```

## Header

- Greeting
- Profile avatar

Greeting changes based on time:

- Good morning
- Good afternoon
- Good evening

## Search

Large rounded search field.

Tap → Search Screen.

## Quick Platform Filters

Horizontal scroll:

- All
- Instagram
- YouTube
- TikTok
- Facebook
- Other

## Recently Saved

2-column content grid.

Each card:

- Thumbnail
- Platform icon
- Content title
- Optional category
- More button

## Collections

Horizontal cards.

---

# 11. SCREEN 08 — SEARCH

## Initial State

```text
┌────────────────────────────────────┐
│ ← Search                           │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ 🔍 Search saved content       │ │
│ └────────────────────────────────┘ │
│                                    │
│ Recent searches                    │
│                                    │
│ Hyderabad                          │
│ React                              │
│ Travel                             │
│ Food                               │
│                                    │
│ Suggested                         │
│                                    │
│ "places I wanted to visit"         │
│ "videos about React"               │
└────────────────────────────────────┘
```

Keyboard opens automatically.

## Search Input

Supports:

- Keywords
- Phrases
- Natural language

Example:

"that Hyderabad cafe video"

---

# 12. SCREEN 09 — SEARCH RESULTS

Example query:

**Hyderabad**

```text
┌────────────────────────────────────┐
│ ←  Hyderabad                  ⋮    │
│                                    │
│ [All] [Instagram] [YouTube] [TikTok]│
│                                    │
│ 32 results                    Filter│
│                                    │
│ ┌────────────────────────────────┐ │
│ │ thumbnail                      │ │
│ │ Best places in Hyderabad       │ │
│ │ Instagram • @creator           │ │
│ │ #travel #hyderabad             │ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ thumbnail                      │ │
│ │ Hyderabad food guide           │ │
│ │ YouTube • Creator              │ │
│ └────────────────────────────────┘ │
│                                    │
└────────────────────────────────────┘
```

## Search Result Card

Show:

- Thumbnail
- Platform
- Content type
- Title
- Creator
- Top keywords
- Download indicator if downloaded

Tap card → Content Details.

---

# 13. SCREEN 10 — FILTER SHEET

Open from Search Results.

Bottom sheet:

```text
┌────────────────────────────────────┐
│ Filters                       Done │
│                                    │
│ Platform                           │
│ [All] [Instagram] [YouTube]        │
│ [TikTok] [Facebook] [Other]        │
│                                    │
│ Content Type                       │
│ [All] [Video] [Post] [Image]       │
│ [Carousel] [Article] [Link]        │
│                                    │
│ Category                           │
│ Travel                             │
│ Food                               │
│ Technology                         │
│ Education                          │
│ Fitness                            │
│                                    │
│ Downloaded                         │
│ ○ All   ○ Downloaded   ○ Not saved │
│                                    │
│ Date                               │
│ [Any time]                         │
│                                    │
│ [ Reset ]              [ Apply ]   │
└────────────────────────────────────┘
```

Filters can be combined.

---

# 14. SCREEN 11 — SAVE URL

This screen is mainly for the in-app Save button.

```text
┌────────────────────────────────────┐
│ Cancel                     Save    │
│                                    │
│ Save something                     │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ Paste a link here...          │ │
│ └────────────────────────────────┘ │
│                                    │
│              or                    │
│                                    │
│ [ 📋 Paste from Clipboard ]        │
│                                    │
│                                    │
│ KeepItBack will automatically      │
│ detect the platform and content.   │
│                                    │
│              [ Save ]              │
└────────────────────────────────────┘
```

When the user shares from another app, this screen can be bypassed.

---

# 15. SCREEN 12 — SAVE CONFIRMATION

This is the most important micro-interaction.

```text
┌──────────────────────────────┐
│                              │
│             ✓                │
│                              │
│       Saved to KeepItBack    │
│                              │
│       Hyderabad Travel       │
│       Instagram Reel        │
│                              │
│ [ ↓ Save to Device ]         │
│                              │
│ [ Add to Collection ]        │
│                              │
│            Done              │
└──────────────────────────────┘
```

## Important

The save operation must already be complete before optional actions appear.

The user does NOT have to choose a collection.

---

# 16. SCREEN 13 — CONTENT DETAILS

```text
┌────────────────────────────────────┐
│ ←                              ⋮   │
│                                    │
│ ┌────────────────────────────────┐ │
│ │                                │ │
│ │          CONTENT               │ │
│ │                                │ │
│ └────────────────────────────────┘ │
│                                    │
│ Best Places in Hyderabad            │
│ Instagram • @creator               │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ ✨ AI Summary                  │ │
│ │                                │ │
│ │ Five places worth visiting    │ │
│ │ around Hyderabad...           │ │
│ └────────────────────────────────┘ │
│                                    │
│ Keywords                           │
│ [Hyderabad] [Travel] [Tourism]    │
│                                    │
│ Collection                         │
│ ✈️ Hyderabad Trip                  │
│                                    │
│ Note                               │
│ "Visit during my next trip"       │
│                                    │
│ ┌──────────────┐ ┌──────────────┐ │
│ │ Open Original│ │ Save Device ↓│ │
│ └──────────────┘ └──────────────┘ │
└────────────────────────────────────┘
```

---

# 17. SCREEN 14 — ADD TO COLLECTION

Bottom sheet:

```text
┌────────────────────────────────────┐
│ Add to Collection             ×    │
│                                    │
│ 🔍 Search collections               │
│                                    │
│ ☑ ✈️ Hyderabad Trip                │
│ ☐ 🍔 Food                           │
│ ☐ 💻 Coding                         │
│ ☐ 🛍️ Buy Later                      │
│                                    │
│ [+ Create Collection]              │
│                                    │
│                 [Done]              │
└────────────────────────────────────┘
```

Allow multiple collections.

---

# 18. SCREEN 15 — LIBRARY

```text
┌────────────────────────────────────┐
│ Library                         ⋮  │
│                                    │
│ 482 saved                          │
│                                    │
│ [All] [Videos] [Posts] [Images]   │
│                                    │
│ Sort: Recently saved               │
│                                    │
│ ┌────────────┐ ┌────────────┐     │
│ │ thumbnail  │ │ thumbnail  │     │
│ │            │ │            │     │
│ └────────────┘ └────────────┘     │
│ Title        Title                 │
│ Instagram    YouTube               │
│                                    │
├────────────────────────────────────┤
│ Home Search   +   Library Profile  │
└────────────────────────────────────┘
```

Sort options:

- Recently saved
- Recently opened
- A–Z
- Oldest
- Most used

---

# 19. SCREEN 16 — COLLECTION LIST

```text
┌────────────────────────────────────┐
│ Collections                    +   │
│                                    │
│ Your collections                   │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ [cover]  ✈️ Hyderabad Trip     │ │
│ │          27 items              │ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ [cover]  💻 Coding             │ │
│ │          43 items              │ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ [cover]  🍔 Food               │ │
│ │          18 items              │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

---

# 20. SCREEN 17 — COLLECTION DETAILS

```text
┌────────────────────────────────────┐
│ ← Hyderabad Trip              ⋮    │
│                                    │
│ ┌────────────────────────────────┐ │
│ │         COVER IMAGE            │ │
│ └────────────────────────────────┘ │
│                                    │
│ ✈️ Hyderabad Trip                  │
│ 27 saved items                     │
│                                    │
│ [ Share ] [ Edit ]                 │
│                                    │
│ ┌────────────┐ ┌────────────┐     │
│ │ thumbnail  │ │ thumbnail  │     │
│ └────────────┘ └────────────┘     │
│                                    │
└────────────────────────────────────┘
```

---

# 21. SCREEN 18 — CREATE COLLECTION

```text
┌────────────────────────────────────┐
│ Cancel              Create         │
│                                    │
│ New Collection                     │
│                                    │
│ [        Cover Image        ]      │
│                                    │
│ Collection name                    │
│ ┌────────────────────────────────┐ │
│ │ Hyderabad Trip                │ │
│ └────────────────────────────────┘ │
│                                    │
│ Description                        │
│ ┌────────────────────────────────┐ │
│ │ Places and food to try...     │ │
│ └────────────────────────────────┘ │
│                                    │
│ Privacy                            │
│ ● Private                          │
│ ○ Public                           │
│                                    │
│              [ Create ]            │
└────────────────────────────────────┘
```

Public option can be disabled until public collections are implemented.

---

# 22. SCREEN 19 — EDIT TAGS

Bottom sheet:

```text
┌────────────────────────────────────┐
│ Tags                           Done │
│                                    │
│ [ Hyderabad × ] [ Travel × ]       │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ Add a tag...                  │ │
│ └────────────────────────────────┘ │
│                                    │
│ Suggested                          │
│ [ Tourism ] [ Weekend ] [ India ]  │
└────────────────────────────────────┘
```

---

# 23. SCREEN 20 — WHY I SAVED THIS

Optional modal after save or from Details.

```text
┌────────────────────────────────────┐
│ Why did you save this?             │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ Example: Try this restaurant  │ │
│ └────────────────────────────────┘ │
│                                    │
│ Quick options                      │
│ [Watch later] [Try later]          │
│ [Buy later] [Learn this]           │
│                                    │
│ [ Skip ]              [ Save ]     │
└────────────────────────────────────┘
```

Never block the original save.

---

# 24. SCREEN 21 — DOWNLOADS

```text
┌────────────────────────────────────┐
│ Downloads                          │
│                                    │
│ 14 items • 1.8 GB                  │
│                                    │
│ [All] [Videos] [Images]            │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ thumbnail                      │ │
│ │ Hyderabad Travel               │ │
│ │ 28 MB                 ✓ Offline│ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ thumbnail                      │ │
│ │ React Tutorial                 │ │
│ │ 42 MB                 ✓ Offline│ │
│ └────────────────────────────────┘ │
│                                    │
│ [ Manage Storage ]                 │
└────────────────────────────────────┘
```

---

# 25. SCREEN 22 — DOWNLOAD PROGRESS

```text
┌──────────────────────────────┐
│ Saving to Device             │
│                              │
│        [ THUMBNAIL ]         │
│                              │
│ Hyderabad Travel             │
│                              │
│ Downloading...               │
│ ███████████████░░░ 78%       │
│                              │
│ 22.4 MB / 28.7 MB            │
│                              │
│ [ Cancel ]                   │
└──────────────────────────────┘
```

After completion:

```text
✓ Available Offline

[ Open ]
```

---

# 26. SCREEN 23 — STORAGE MANAGER

```text
┌────────────────────────────────────┐
│ ← Storage                         │
│                                    │
│ Device storage                    │
│                                    │
│ KeepItBack                         │
│ ███████████░░░░ 2.4 GB            │
│                                    │
│ Downloads                  2.1 GB  │
│ Cache                      280 MB  │
│ Other                       20 MB  │
│                                    │
│ Downloads                         │
│                                    │
│ Largest files                     │
│ Video A                    120 MB  │
│ Video B                     89 MB  │
│                                    │
│ [ Clear Cache ]                    │
│ [ Manage Downloads ]              │
└────────────────────────────────────┘
```

Clear cache must never delete saved cloud references.

---

# 27. SCREEN 24 — PROFILE

```text
┌────────────────────────────────────┐
│ Profile                         ⚙  │
│                                    │
│             ◯                      │
│            Ayaz                     │
│          @ayaz                      │
│                                    │
│  482              12               │
│  Saved          Collections        │
│                                    │
│ ─────────────────────────────────  │
│                                    │
│ My Collections                     │
│                                    │
│ ✈️ Hyderabad Trip                  │
│ 💻 Coding                          │
│ 🍔 Food                            │
│ 🛍️ Buy Later                       │
│                                    │
│ Downloads                          │
│ 14 items • 1.8 GB                  │
│                                    │
│ Settings                           │
└────────────────────────────────────┘
```

---

# 28. SCREEN 25 — EDIT PROFILE

Fields:

- Profile picture
- Display name
- Username
- Bio

Buttons:

**Save Changes**

Username must be unique.

---

# 29. SCREEN 26 — SETTINGS

```text
┌────────────────────────────────────┐
│ Settings                           │
│                                    │
│ Account                            │
│ > Account & Security               │
│ > Privacy                          │
│                                    │
│ App                                │
│ > Notifications                    │
│ > Appearance                       │
│ > Storage                          │
│                                    │
│ Search                             │
│ > Search Preferences               │
│                                    │
│ Data                               │
│ > Export Data                      │
│ > Delete Account                   │
│                                    │
│ About                              │
│ Version 1.0.0                      │
└────────────────────────────────────┘
```

---

# 30. SCREEN 27 — ACCOUNT & SECURITY

Options:

- Email
- Connected accounts
- Password/passkeys
- Active sessions
- Sign out all devices
- Delete account

Clerk handles authentication operations.

---

# 31. SCREEN 28 — PRIVACY

Options:

- Private profile toggle
- Public collections toggle
- AI processing preferences
- Analytics consent
- Data export
- Delete account

Default:

**Private**

---

# 32. SCREEN 29 — NOTIFICATIONS

Switches:

- Download completed
- AI processing completed
- Collection updates
- Product announcements

All optional.

---

# 33. SCREEN 30 — EMPTY LIBRARY

```text
┌────────────────────────────────────┐
│                                    │
│             ◉                      │
│                                    │
│       Your library is empty        │
│                                    │
│ Save something you find useful,    │
│ funny or interesting.              │
│                                    │
│      [ + Save Something ]          │
│                                    │
│ Tip: Share a Reel or post to       │
│ KeepItBack from any app.           │
└────────────────────────────────────┘
```

---

# 34. SCREEN 31 — EMPTY SEARCH

If no result:

```text
┌────────────────────────────────────┐
│ ← Search                           │
│                                    │
│ 🔍 "quantum cooking"               │
│                                    │
│             ◯                      │
│                                    │
│       Nothing found                │
│                                    │
│ Try a broader keyword or search    │
│ using what you remember.           │
│                                    │
│ Suggestions                        │
│ "cooking"                          │
│ "recipes"                           │
└────────────────────────────────────┘
```

---

# 35. SCREEN 32 — LOADING STATE

Use skeletons instead of blank screens.

Content card skeleton:

```text
┌──────────────────────────────┐
│ ████████████████████████████ │
│ ███████████                  │
│ ████████                     │
└──────────────────────────────┘
```

Search results should show 4–6 skeleton cards.

---

# 36. SCREEN 33 — ERROR STATE

```text
┌────────────────────────────────────┐
│                                    │
│              ⚠                     │
│                                    │
│       Something went wrong         │
│                                    │
│ We couldn't load your library.     │
│                                    │
│             [ Retry ]              │
│                                    │
└────────────────────────────────────┘
```

Do not expose technical errors to users.

---

# 37. SCREEN 34 — OFFLINE STATE

A small banner:

**You're offline**

The user can still:

- View downloaded content
- View cached library
- Create local saves

Pending cloud operations are queued.

Banner disappears automatically when online.

---

# 38. SCREEN 35 — DUPLICATE CONTENT

When saving an already saved URL:

```text
┌──────────────────────────────┐
│                              │
│        Already Saved ✓       │
│                              │
│ Hyderabad Travel             │
│ Instagram                    │
│                              │
│ [ Open Saved Item ]          │
│                              │
│ [ Save Anyway ]              │
│                              │
│ [ Cancel ]                   │
└──────────────────────────────┘
```

---

# 39. SCREEN 36 — UNSUPPORTED DOWNLOAD

```text
┌──────────────────────────────┐
│ Download unavailable         │
│                              │
│ This content cannot be saved │
│ directly to your device.     │
│                              │
│ Your KeepItBack bookmark is  │
│ still saved.                 │
│                              │
│ [ Open Original ]            │
│ [ Got it ]                   │
└──────────────────────────────┘
```

Never suggest bypassing restrictions.

---

# 40. SHARE EXTENSION UX

This is one of the most important product surfaces.

When user shares from Instagram:

```text
Instagram
    ↓
Share
    ↓
KeepItBack
    ↓
┌────────────────────────────┐
│ KeepItBack                 │
│                            │
│ ✓ Saved                    │
│                            │
│ [ Save to Device ]         │
│ [ Add Collection ]         │
│ [ Done ]                   │
└────────────────────────────┘
```

The user should not need to open the full app for normal saving.

The share flow should return to the source application quickly.

---

# 41. Main Content Card Specification

Every content card should contain:

1. Thumbnail
2. Platform icon
3. Content type
4. Title
5. Creator
6. Optional category
7. Download indicator
8. More menu

Example:

```text
┌────────────────────────────────┐
│                                │
│          THUMBNAIL             │
│                                │
│                         ● ⋮    │
├────────────────────────────────┤
│ Instagram  •  Reel             │
│ Best places in Hyderabad       │
│ @creator                       │
│ #Travel #Hyderabad             │
└────────────────────────────────┘
```

---

# 42. More Menu

For any saved item:

```text
┌──────────────────────────────┐
│ Add to Collection            │
│ Edit Tags                    │
│ Add Note                     │
│ Save to Device               │
│ Open Original                │
│ Share                        │
│ Archive                      │
│ Delete                       │
└──────────────────────────────┘
```

Delete requires confirmation.

---

# 43. Delete Confirmation

```text
Delete saved item?

This will remove it from your KeepItBack library.

[ Cancel ]       [ Delete ]
```

If local download exists:

```text
☐ Also delete downloaded copy
```

Default unchecked to avoid accidental local data loss.

---

# 44. AI Processing Indicator

When AI data is not ready:

```text
✨ AI processing...
```

The content remains fully usable.

Once complete:

```text
✨ AI organized
```

AI failure should not affect saving.

---

# 45. Search Interaction Rules

When user taps Search:

1. Focus input
2. Open keyboard
3. Show recent searches
4. Begin searching after debounce
5. Show results progressively

Do not require a Search button.

Search should update while typing.

---

# 46. Search Result Ranking UI

Each result can show a subtle relevance reason:

```text
Best places in Hyderabad

Matches:
✓ Hyderabad
✓ Travel
✓ Your "Hyderabad Trip" collection
```

This should be subtle and only shown when useful.

---

# 47. AI Search Screen — Future

Example:

```text
┌────────────────────────────────────┐
│ 🔍 places to visit in Hyderabad    │
│                                    │
│ AI found 18 relevant saves         │
│                                    │
│ Most relevant                      │
│                                    │
│ 1. Hidden Hyderabad Places         │
│ 2. Weekend Hyderabad Guide         │
│ 3. Charminar Guide                 │
│ 4. Hyderabad Cafes                 │
│                                    │
│ Why these results?                 │
│ They relate to Hyderabad travel,   │
│ tourism and places.                │
└────────────────────────────────────┘
```

---

# 48. Save Button Animation

The main Save button should have a subtle animation:

Idle:

```text
     +
```

Pressed:

```text
    ◉
```

Success:

```text
    ✓
```

Then return to:

```text
    +
```

Animation should be fast and satisfying.

Avoid excessive animations.

---

# 49. Download Button States

Normal:

**↓ Save to Device**

Downloading:

**Downloading 42%**

Completed:

**✓ Available Offline**

Unavailable:

**Download unavailable**

---

# 50. Sync States

Normal:

**Synced ✓**

Syncing:

**Syncing...**

Offline:

**Waiting for connection**

Error:

**Sync failed — Retry**

The app should not block users from browsing while synchronization happens.

---

# 51. Responsive Grid

## Phone

2-column grid for content.

## Large phone

2-column grid.

## Tablet

3-column grid.

## Landscape

Use adaptive grid based on available width.

---

# 52. Accessibility

Required:

- Screen reader labels
- Minimum touch target ~44 × 44 px
- Sufficient contrast
- Dynamic font support
- Reduced-motion support
- Clear focus states
- No color-only status indicators

Example:

Download status should show both icon and text.

---

# 53. UI Component Library

Create reusable components:

- `KIBButton`
- `KIBIconButton`
- `KIBSearchBar`
- `KIBContentCard`
- `KIBPlatformBadge`
- `KIBTag`
- `KIBCollectionCard`
- `KIBBottomSheet`
- `KIBModal`
- `KIBAvatar`
- `KIBSkeleton`
- `KIBEmptyState`
- `KIBDownloadButton`
- `KIBFilterChip`
- `KIBBottomNavigation`

---

# 54. Suggested React Native Screen Structure

```text
app/
├── (auth)/
│   ├── splash.tsx
│   ├── onboarding.tsx
│   ├── sign-in.tsx
│   └── sign-up.tsx
│
├── (tabs)/
│   ├── home.tsx
│   ├── search.tsx
│   ├── save.tsx
│   ├── library.tsx
│   └── profile.tsx
│
├── content/
│   ├── [id].tsx
│   └── filters.tsx
│
├── collections/
│   ├── index.tsx
│   ├── [id].tsx
│   └── create.tsx
│
├── downloads/
│   ├── index.tsx
│   └── storage.tsx
│
└── settings/
    ├── index.tsx
    ├── account.tsx
    ├── privacy.tsx
    └── notifications.tsx
```

---

# 55. Critical UX Rules

## Rule 1

Never require a folder before saving.

## Rule 2

Never make AI processing block saving.

## Rule 3

Never make the user manually enter the title unless they want to.

## Rule 4

Always preserve the original link.

## Rule 5

Cloud save and local download are separate actions.

## Rule 6

Deleting a local download should not automatically delete the saved cloud reference.

## Rule 7

Deleting a saved cloud item should clearly explain what happens to its local copy.

## Rule 8

Search should be accessible from Home, Library and the primary navigation.

## Rule 9

The share-to-save flow should require the minimum possible number of taps.

## Rule 10

Private content must remain private by default.

---

# 56. Final UI Flow

The complete core flow is:

```text
USER SEES CONTENT
       ↓
Instagram / YouTube / TikTok / Web
       ↓
       Share
       ↓
   KeepItBack
       ↓
   ┌───────────┐
   │ ✓ SAVED   │
   └───────────┘
       ↓
Optional:
├── Save to Device
├── Add Collection
├── Add Tags
└── Add Note

       ↓

Background:
Metadata → AI → Keywords → Category → Embedding

       ↓

Months later

       ↓

Search:
"Hyderabad travel"

       ↓

Relevant results across all platforms

       ↓

Open / Share / Download / Organize
```

---

# 57. The Core KeepItBack Experience

The interface should communicate one simple idea:

**You don't need to remember where you saw it.**

KeepItBack remembers it for you.

The product should feel fast enough that users naturally build the habit:

**See → Share → Save → Forget → Search → Rediscover.**
