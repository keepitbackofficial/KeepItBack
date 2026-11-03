# KeepItBack — Complete Authentication, Metadata API & Video Download Implementation

You are a senior React Native / Expo engineer, Supabase architect, and mobile application developer.

I want you to implement a complete, production-ready authentication and video-saving system in my existing **KeepItBack** application.

Do not create a demo or prototype. Implement real functionality, real database operations, real authentication, real API integrations, and real device storage operations.

Do not use dummy data, mock authentication, simulated downloads, hardcoded user profiles, or placeholder functionality.

First inspect the entire existing project, understand its architecture, and then implement the features without unnecessarily changing existing functionality or redesigning unrelated screens.

---

# 1. Existing Project Context

Application name: KeepItBack

Application purpose:

KeepItBack allows users to save videos and reels from different social-media platforms into one organized application.

The application should allow users to:

- Sign up and sign in using Google.
- Share a social-media video URL with KeepItBack.
- Automatically retrieve video metadata.
- Display the video title, thumbnail, creator, duration, and resolution.
- Download and save the actual video.
- Store downloaded videos locally on the device.
- Organize saved videos.
- Search saved videos.
- Access their saved content later.

### Existing technology

Use the existing project configuration and preserve compatible dependencies.

Expected technology:

- React Native
- Expo
- Expo Router
- Supabase
- Supabase Auth
- Supabase PostgreSQL
- React Native AsyncStorage
- Expo-compatible browser authentication
- KeepItBack Metadata API
- Expo-compatible file-system and media-library APIs

Important: Inspect `package.json`, Expo SDK version, existing navigation, authentication code, and existing database configuration before changing dependencies.

Do not upgrade Expo or React Native unnecessarily.

---

# 2. Google Sign Up / Sign In Using Supabase

Implement complete Google authentication through Supabase Auth.

The application must support:

- First-time Google sign-up.
- Existing-user Google sign-in.
- Automatic account creation through Google OAuth when a new user authenticates.
- Persistent login sessions.
- Session restoration when the application is reopened.
- Logout.
- Authentication error handling.
- Expired-session handling.

## 2.1 Supabase configuration

Use the existing Supabase project.

Environment variables:

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Use the Supabase publishable/anon key appropriate to the existing project configuration.

Never put a Supabase service-role key in the mobile application.

Create a centralized Supabase client.

For React Native, configure:

- AsyncStorage for session persistence.
- `persistSession: true`.
- `autoRefreshToken: true`.
- `detectSessionInUrl: false`.
- Appropriate URL-session handling for the installed Supabase SDK version.

Do not initialize multiple Supabase clients throughout the application.

## 2.2 Google OAuth implementation

Use Supabase Auth's Google provider.

Authentication should use the browser-based OAuth flow compatible with the installed Expo SDK.

Preferred approach:

1. User taps Continue with Google.
2. Application starts Supabase Google OAuth.
3. Open the Google authentication page using the supported Expo browser authentication flow.
4. User selects their Google account.
5. Google authenticates the user.
6. Supabase receives the OAuth callback.
7. Application exchanges the authorization code for a Supabase session using the appropriate PKCE flow.
8. Persist the session securely.
9. Retrieve the authenticated user.
10. Navigate to the home screen.

Use the current supported Expo and Supabase APIs. Do not blindly copy outdated authentication examples.

Example of the intended Supabase OAuth request:

```javascript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: redirectUrl,
    skipBrowserRedirect: true
  }
});
```

Complete the browser authentication, callback handling, and session exchange correctly for the installed SDK versions.

Do not leave the authentication flow incomplete after opening the Google login page.

## 2.3 Google Cloud configuration

Prepare a setup guide explaining how to configure:

- Google Cloud project.
- OAuth consent screen.
- Google OAuth client.
- Authorized redirect URI.
- Supabase Google provider.
- Supabase callback URL.
- Expo deep-link scheme.
- Android package name.
- iOS bundle identifier.

Make the redirect URI match the actual authentication flow.

Important: Do not assume that Expo Go and a standalone Android application use the same OAuth redirect configuration.

If the existing project is running through Expo Go, implement a compatible development flow. Do not require a native Google Sign-In SDK or a custom SHA-1 certificate unless the chosen implementation actually requires it.

Document any configuration that must be completed manually in Google Cloud or Supabase.

## 2.4 Authentication UI

Implement professional authentication screens matching the existing KeepItBack design.

Include:

- KeepItBack logo.
- Welcome heading.
- Short application description.
- Continue with Google button.
- Google icon.
- Loading state.
- Authentication error state.
- Privacy policy link.
- Terms of service link.

Avoid unnecessary email/password authentication unless it already exists in the application.

## 2.5 User profile

After successful authentication, retrieve the actual Supabase user.

Use Google profile information where available:

- User ID.
- Full name.
- Email.
- Avatar/profile image.
- Account creation timestamp.

Create or update the user's profile in the database.

Do not create a second profile every time the user logs in.

---

# 3. Supabase Database Integration

Inspect the current database schema before creating migrations.

Do not overwrite existing tables or delete existing data.

Create migrations only for missing functionality.

Suggested user profile table:

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

Suggested saved videos table:

```sql
create table if not exists public.saved_videos (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id) on delete cascade,

  original_url text not null,
  platform text not null,
  platform_id text,

  title text,
  description text,
  thumbnail_url text,
  uploader text,

  duration double precision,
  width integer,
  height integer,

  filename text,
  filesize bigint,
  mime_type text,

  local_uri text,
  storage_path text,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id, original_url)
);
```

Treat this as a proposed schema. Adapt it to existing tables and naming conventions.

## 3.1 Row Level Security

Enable RLS on all user-owned tables.

Users must only be able to access their own records.

Example:

```sql
alter table public.saved_videos enable row level security;

create policy "Users can read their own saved videos"
on public.saved_videos
for select
using (auth.uid() = user_id);

create policy "Users can insert their own saved videos"
on public.saved_videos
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own saved videos"
on public.saved_videos
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own saved videos"
on public.saved_videos
for delete
using (auth.uid() = user_id);
```

Create equivalent profile policies.

Do not expose another user's saved videos or profile data.

Create the SQL migration file and provide its complete contents. I will execute the migration manually in the Supabase SQL Editor.

Do not claim that a migration has been executed unless it actually has been executed.

---

# 4. KeepItBack Metadata API Integration

Use my existing live API.

**API Base URL:**

```text
https://eqwxy.aiccloud.online
```

Do not create another metadata backend.

Do not use third-party metadata APIs as a replacement.

## 4.1 Metadata endpoint

```http
GET https://eqwxy.aiccloud.online/api/v1/resolve?url=SOCIAL_MEDIA_URL
```

Purpose:

Retrieve:

- Platform.
- Title.
- Description.
- Thumbnail.
- Author.
- Duration.
- Width.
- Height.
- Platform ID.

Example:

```javascript
const API_BASE = "https://eqwxy.aiccloud.online";

async function fetchMetadata(url) {
  const endpoint = new URL(`${API_BASE}/api/v1/resolve`);

  endpoint.searchParams.set("url", url);

  const response = await fetch(endpoint);

  if (!response.ok) {
    throw new Error("Metadata request failed");
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error("Unable to retrieve metadata");
  }

  return result;
}
```

## 4.2 Media resolution endpoint

```http
GET https://eqwxy.aiccloud.online/api/v1/media?url=SOCIAL_MEDIA_URL
```

Purpose:

- Extract downloadable video.
- Download source media.
- Convert the media into MP4.
- Return media properties.
- Generate a temporary download URL.

Expected response structure:

```json
{
  "success": true,
  "platform": "instagram",
  "url": "ORIGINAL_URL",
  "media": {
    "available": true,
    "type": "video",
    "download_url": "https://eqwxy.aiccloud.online/api/v1/media/download/TOKEN",
    "mime_type": "video/mp4",
    "filename": "video.mp4",
    "filesize": 1872906,
    "duration": 13.073991,
    "width": 1080,
    "height": 1920,
    "metadata": {
      "title": "Video title",
      "description": "Video description",
      "thumbnail": "https://example.com/thumbnail.jpg",
      "uploader": "creator",
      "platform_id": "PLATFORM_ID"
    },
    "video_codec": "h264",
    "audio_codec": "aac",
    "expires_in_seconds": 900
  }
}
```

The actual response may include additional fields.

Never hardcode sample metadata or download URLs.

## 4.3 Supported platforms

Use the same API endpoint for:

- Instagram Reels.
- YouTube Shorts.
- YouTube videos.
- Pinterest videos.
- X / Twitter videos.
- Other platforms supported by the backend.

Do not build separate download implementations for every platform.

The API detects the platform.

---

# 5. Share URL Integration

Implement the ability to receive shared social-media URLs.

Support:

1. Android share intent.
2. iOS share functionality where supported.
3. Copy-and-paste URL.
4. Manual URL input.
5. Existing in-app share button.

When a user shares a video from Instagram, YouTube, Pinterest, X or another supported platform to KeepItBack:

1. Receive the shared URL.
2. Validate that it is a URL.
3. Open KeepItBack.
4. Check authentication.
5. If logged out, request sign-in.
6. After successful sign-in, continue processing the pending URL.
7. Call the metadata API.
8. Display the retrieved content.

Do not lose the shared URL during login or navigation.

Prevent duplicate processing when the same share intent is delivered more than once.

Use the existing Expo-compatible linking and sharing architecture. Inspect whether native share-intent support requires a development build rather than Expo Go.

---

# 6. Metadata Preview UI

After a user submits or shares a URL, display a real metadata preview.

The preview should include:

- Video thumbnail.
- Video title.
- Platform name and icon.
- Creator name, if available.
- Duration.
- Resolution.
- Download button.

Example:

```text
--------------------------------
        VIDEO THUMBNAIL
--------------------------------

Video title

Instagram · Creator name

Duration: 00:13
Resolution: 1080 × 1920

[ Download Video ]
```

Requirements:

- Show loading skeletons while fetching metadata.
- Show a useful error if metadata extraction fails.
- Support missing titles and thumbnails.
- Avoid broken image layouts.
- Do not use fake preview data.
- Prevent repeated requests while a request is running.

If metadata retrieval succeeds but media extraction later fails, preserve the metadata preview and display a separate download error.

---

# 7. Video Download and Device Storage

This is a critical feature.

When a user taps Download Video, download the actual processed video from the URL returned by my API.

Do not merely save the original social-media URL.

Do not save a thumbnail instead of the video.

## 7.1 Download flow

Implement the following:

1. User taps Download.
2. Validate that the metadata result contains a valid source URL.
3. Call the media endpoint.
4. Read `media.download_url`.
5. Read the filename and MIME type.
6. Download the actual MP4.
7. Track download progress.
8. Verify that the downloaded file exists and is not empty.
9. Save it to the selected local destination.
10. Insert or update the saved video record in Supabase.
11. Display download success.

Use Expo-compatible file-system APIs that match the project's installed SDK.

Do not use deprecated APIs without checking compatibility.

## 7.2 Storage permissions

Handle Android and iOS permissions correctly.

Do not request broad storage access unnecessarily.

### Android

Inspect the installed Expo SDK and Android target SDK.

Use the appropriate permissions for the actual operations.

Consider:

- Android 13+ media permissions.
- `READ_MEDIA_VIDEO` only if reading existing videos from the user's media library is required.
- MediaStore or the appropriate Expo Media Library API for adding videos to the device gallery.
- App-specific storage for temporary downloads.

Do not request `MANAGE_EXTERNAL_STORAGE` merely to save a downloaded video.

Where supported, save to the user's gallery or an appropriate Downloads location.

### iOS

Use the appropriate Photos permission for adding videos to the photo library.

Use add-only permission when the app only needs to save media and does not need to read the entire photo library.

Explain the permission to the user before requesting it.

### Permission UX

Implement:

- Permission request.
- Permission denied state.
- Permission permanently denied guidance where supported.
- Open Settings action.
- Retry action.
- Download cancellation.

Never crash when permission is denied.

If saving to an app-private folder does not require gallery access, allow that option without requesting unnecessary permissions.

## 7.3 Download progress

Show real progress where supported.

Example:

```text
Downloading video...

[██████████░░░░░░] 62%

12.4 MB / 20 MB
```

Use the actual download task progress.

Do not simulate progress with timers.

Allow users to cancel downloads.

Clean up partial files after cancellation or failure.

## 7.4 Save location

Use a consistent folder or media-library organization.

Suggested:

```text
KeepItBack/
    Downloads/
        video1.mp4
        video2.mp4
```

Adapt this to what the Android and iOS operating systems actually permit.

Do not claim a file is saved in a public folder if it was saved only in the app's private storage.

---

# 8. Supabase Storage vs Local Device Storage

Keep these two concepts separate.

### Local device storage

This is the primary destination for downloaded videos.

The user should be able to access saved videos even when offline.

### Supabase Storage

Do not automatically upload every downloaded video to Supabase Storage.

Large video uploads can consume substantial storage and bandwidth.

Only implement cloud video storage if the existing project already requires it or has an explicit cloud-backup feature.

If cloud storage is implemented:

- Use a private bucket.
- Use user-specific storage paths.
- Configure Storage RLS.
- Never make private user videos publicly accessible by default.
- Do not upload without user consent.
- Avoid uploading the same file more than once.

The database should distinguish between:

- `local_uri`: local device file location.
- `storage_path`: cloud object path, if uploaded.

A local URI is device-specific and must not be treated as a permanent cloud URL.

---

# 9. Saved Videos Screen

Implement a complete Saved Videos screen.

Display actual saved videos belonging to the authenticated user.

Each item should show:

- Thumbnail.
- Title.
- Platform.
- Duration.
- Saved date.
- Downloaded status.

Features:

- Search by title.
- Filter by platform.
- Sort by newest and oldest.
- Open video.
- Delete saved video.
- View details.
- Share saved video.
- Retry missing downloads where appropriate.

When a user deletes a video:

1. Confirm the action.
2. Delete the local file if it exists and belongs to the app.
3. Delete the corresponding database record.
4. Update the UI.

Do not delete another user's records or unrelated files.

If a file has disappeared from device storage, show that it is unavailable rather than pretending it exists.

---

# 10. Download Management

Implement a download manager.

Show:

- Active downloads.
- Progress.
- Completed downloads.
- Failed downloads.
- Cancel action.
- Retry action.

Prevent duplicate concurrent downloads of the same URL.

If the app closes during a download, handle the incomplete task gracefully.

Do not mark a download as complete until the actual file has been verified.

---

# 11. Authentication and Navigation Protection

Implement an application-level authentication state.

Expected behavior:

```text
Application launches
        |
        v
Restore Supabase session
        |
        v
Is user authenticated?
      /   \
    No     Yes
    |       |
Sign-in    Home
screen     screen
```

Requirements:

- No flicker between login and home screens.
- Restore sessions correctly.
- Handle expired sessions.
- Handle sign-out.
- Protect authenticated routes.
- Preserve pending shared URLs across authentication.
- Do not redirect users incorrectly during the OAuth callback.

---

# 12. UI and UX Requirements

Preserve the existing KeepItBack design language.

Do not redesign the entire application unnecessarily.

Implement consistent:

- Buttons.
- Loading states.
- Error states.
- Empty states.
- Permission screens.
- Download progress.
- Success notifications.
- Confirmation dialogs.

All screens must work on real Android and iOS devices.

Ensure the UI is responsive and handles:

- Long titles.
- Missing thumbnails.
- Large files.
- Slow network connections.
- Failed requests.
- Permission denial.
- Offline saved videos.

---

# 13. Error Handling

Implement centralized error handling.

Handle these situations:

| Scenario | Expected behavior |
|---|---|
| Invalid URL | Show validation error |
| Unsupported platform | Explain that the link is unsupported |
| Metadata unavailable | Show a useful message |
| Media unavailable | Keep metadata preview and show download error |
| Network timeout | Offer retry |
| Expired download URL | Request a new media URL |
| Permission denied | Explain how to enable permission |
| Insufficient storage | Show storage error |
| Download cancelled | Remove partial file |
| Supabase session expired | Restore or request login |
| Duplicate saved video | Prevent duplicate record |
| Database failure | Do not falsely show successful cloud save |

Do not silently swallow exceptions.

Add useful development logging without exposing tokens, OAuth credentials, or sensitive URLs.

---

# 14. Security Requirements

- Use Supabase RLS.
- Never include service-role keys in the app.
- Do not hardcode Google OAuth client secrets.
- Do not store Google passwords.
- Do not log access tokens or refresh tokens.
- Validate submitted URLs.
- Restrict access to user-owned saved-video records.
- Treat temporary download URLs as sensitive.
- Avoid arbitrary filesystem access.
- Avoid broad storage permissions.
- Do not expose private Supabase Storage buckets.

---

# 15. Implementation Requirements

Before making changes:

1. Inspect the complete project structure.
2. Inspect `package.json`.
3. Identify the Expo SDK version.
4. Inspect the existing Supabase configuration.
5. Inspect the existing authentication implementation.
6. Inspect Expo Router navigation.
7. Inspect existing screens and reusable components.
8. Inspect existing database-related code.
9. Identify dependencies that are already installed.
10. Identify any incompatible packages.

Then implement the features.

### Important restrictions

- Do not create duplicate Supabase clients.
- Do not introduce a second authentication provider.
- Do not replace working application logic unnecessarily.
- Do not delete existing screens.
- Do not change unrelated styling.
- Do not add fake data.
- Do not leave TODOs for core features.
- Do not claim features work without testing them.
- Do not run destructive database migrations.
- Do not expose credentials.
- Do not upgrade Expo just to solve a minor dependency issue.

Use real API responses and real Supabase records throughout the application.

---

# 16. Required Deliverables

After implementation, provide:

### A. Code changes

List every file created or modified.

Explain the purpose of each important file.

### B. Supabase SQL migration

Provide the complete SQL migration for me to execute manually.

Include:

- Tables.
- Indexes.
- RLS.
- Policies.
- Triggers, if needed.
- Storage bucket policies, if cloud storage is implemented.

### C. Environment variables

Provide the exact `.env` structure.

Never include real secrets in source code.

### D. Google OAuth setup

Provide exact configuration steps for:

- Google Cloud.
- Supabase Authentication.
- Redirect URLs.
- Expo scheme.
- Android.
- iOS.

### E. Device permissions

Explain the Android and iOS permission configuration and how to test saving a video.

### F. API integration

Confirm the application uses:

```text
https://eqwxy.aiccloud.online/api/v1/resolve
https://eqwxy.aiccloud.online/api/v1/media
https://eqwxy.aiccloud.online/api/v1/media/download/:token
```

### G. Testing

Test the following scenarios:

1. New user signs up with Google.
2. Existing user signs in with Google.
3. Session persists after restarting the app.
4. User logs out.
5. Instagram Reel metadata retrieval.
6. YouTube Shorts metadata retrieval.
7. Pinterest metadata retrieval.
8. X/Twitter metadata retrieval.
9. Media extraction.
10. Actual video download.
11. File saving to device storage.
12. Download cancellation.
13. Permission denied handling.
14. Saved videos appear after restarting the app.
15. Deleting a saved video removes its local file and database record.
16. One user's saved videos cannot be accessed by another user.

Do not mark a test as passed unless it was actually performed.

---

# 17. Execution Strategy

Work in the following order:

**Phase 1:** Inspect the project and identify existing architecture.

**Phase 2:** Implement Supabase Google authentication and session persistence.

**Phase 3:** Implement profile creation and database migrations.

**Phase 4:** Integrate the KeepItBack metadata API.

**Phase 5:** Implement share-intent handling and URL submission.

**Phase 6:** Implement media extraction and real downloads.

**Phase 7:** Implement local storage and platform permissions.

**Phase 8:** Implement Saved Videos and Download Manager.

**Phase 9:** Implement error handling and security.

**Phase 10:** Test the complete user journey.

Do not skip phases or implement fake functionality to make the UI appear complete.

If a critical configuration or architectural decision is missing, ask me before making assumptions.

Start by inspecting the existing codebase. Give me a short architecture assessment, identify any blockers, and then begin implementation.