# KeepItBack Universal Metadata & Media API
## Developer Documentation for AI Agents and Application Integrations

**API Base URL:** `https://eqwxy.aiccloud.online`

**API Version:** v1  
**Primary API Prefix:** `/api/v1`  
**Supported output format:** JSON  
**Media output:** MP4 (H.264 video + AAC audio)

---

# 1. Overview

KeepItBack provides a universal metadata extraction and media resolution API. An application or AI agent can submit a supported social-media URL and retrieve its metadata, or request a downloadable, processed video.

The API is designed to handle URLs from multiple social platforms through a unified interface.

### Main capabilities

- Extract video titles and descriptions.
- Retrieve thumbnails and creator information when available.
- Extract platform-specific video identifiers.
- Detect video duration and resolution.
- Resolve downloadable media.
- Convert video into MP4 using H.264 and AAC.
- Generate temporary download URLs.
- Return media information in a consistent JSON structure.

### Supported platforms tested

| Platform | Metadata | Media extraction | Duration |
|---|---|---|---|
| YouTube / Shorts | Yes | Yes | Yes |
| Instagram / Reels | Yes | Yes | Yes |
| Pinterest | Yes | Yes | Yes |
| X / Twitter | Yes | Yes | Yes |

The API uses a platform-aware extraction process. Availability of individual metadata fields depends on the source platform and the content.

---

# 2. API Base URL

All requests should use:

`https://eqwxy.aiccloud.online`

The versioned API prefix is:

`https://eqwxy.aiccloud.online/api/v1`

Do not hardcode platform-specific endpoints into your application. Use the universal endpoints and provide the original URL as a query parameter.

---

# 3. Available Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Check API health |
| GET | `/api/v1/resolve` | Extract metadata |
| GET | `/api/v1/media` | Resolve and process downloadable media |
| GET | `/api/v1/media/download/:token` | Download processed media |

## 3.1 Health Check

Check whether the API service is online.

**Request**

```http
GET https://eqwxy.aiccloud.online/health
```

**cURL**

```bash
curl -i https://eqwxy.aiccloud.online/health
```

**Example response**

```json
{
  "success": true,
  "service": "KeepItBack Metadata API",
  "status": "online"
}
```

Use this endpoint for basic service availability checks. A successful health check does not guarantee that every external platform is accessible.

---

# 4. Metadata Resolution API

## Endpoint

```http
GET /api/v1/resolve
```

This endpoint extracts metadata from a supported social-media URL without requesting a processed media download.

### Request syntax

```http
GET https://eqwxy.aiccloud.online/api/v1/resolve?url=SOCIAL_MEDIA_URL
```

The `url` parameter is required.

### cURL example

```bash
curl -G "https://eqwxy.aiccloud.online/api/v1/resolve" \
  --data-urlencode "url=https://www.instagram.com/reel/DfAoc2zIHof"
```

### JavaScript example

```javascript
const API_BASE = "https://eqwxy.aiccloud.online";

async function getMetadata(url) {
  const endpoint = new URL(`${API_BASE}/api/v1/resolve`);

  endpoint.searchParams.set("url", url);

  const response = await fetch(endpoint);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error("Metadata extraction failed");
  }

  return data;
}

// Example
const metadata = await getMetadata(
  "https://www.instagram.com/reel/DfAoc2zIHof"
);

console.log(metadata);
```

### Python example

```python
import requests

API_BASE = "https://eqwxy.aiccloud.online"

def get_metadata(url):
    response = requests.get(
        f"{API_BASE}/api/v1/resolve",
        params={"url": url},
        timeout=60
    )

    response.raise_for_status()

    data = response.json()

    if not data.get("success"):
        raise Exception("Metadata extraction failed")

    return data

result = get_metadata(
    "https://www.youtube.com/shorts/vLwdi8EU8vU"
)

print(result)
```

### Metadata response structure

The following is a normalized representation of the metadata fields observed in API responses. Some fields can be null if the platform does not expose them.

```json
{
  "success": true,
  "platform": "instagram",
  "url": "https://www.instagram.com/reel/DfAoc2zIHof",
  "metadata": {
    "title": "Video title",
    "description": "Video description",
    "thumbnail": "https://example.com/thumbnail.jpg",
    "author": "creator_username",
    "duration": 13.07,
    "width": 1080,
    "height": 1920,
    "platform_id": "DfAoc2zIHof"
  }
}
```

### Metadata field reference

| Field | Type | Description |
|---|---|---|
| `success` | Boolean | Whether the request succeeded |
| `platform` | String | Detected source platform |
| `url` | String | Submitted source URL |
| `metadata.title` | String / null | Content title |
| `metadata.description` | String / null | Content description |
| `metadata.thumbnail` | String / null | Thumbnail image URL |
| `metadata.author` | String / null | Creator or author |
| `metadata.duration` | Number / null | Duration in seconds |
| `metadata.width` | Number / null | Video width |
| `metadata.height` | Number / null | Video height |
| `metadata.platform_id` | String / null | Platform-specific content ID |

**Important:** Do not assume every field is populated. An agent should handle missing metadata gracefully.

---

# 5. Media Resolution API

## Endpoint

```http
GET /api/v1/media
```

This endpoint resolves a social-media URL into a processed downloadable video.

Unlike the metadata endpoint, this operation can take longer because it may need to extract, download, and convert the source video.

### Request syntax

```http
GET https://eqwxy.aiccloud.online/api/v1/media?url=SOCIAL_MEDIA_URL
```

### cURL example

```bash
curl -G "https://eqwxy.aiccloud.online/api/v1/media" \
  --data-urlencode "url=https://www.youtube.com/shorts/vLwdi8EU8vU"
```

Use a longer client timeout for media extraction than for metadata requests.

### JavaScript example

```javascript
const API_BASE = "https://eqwxy.aiccloud.online";

async function resolveMedia(url) {
  const endpoint = new URL(`${API_BASE}/api/v1/media`);

  endpoint.searchParams.set("url", url);

  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(260000)
  });

  if (!response.ok) {
    throw new Error(`Media API failed: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success || !data.media?.available) {
    throw new Error("Media is unavailable");
  }

  return data.media;
}

// Example
const media = await resolveMedia(
  "https://www.youtube.com/shorts/vLwdi8EU8vU"
);

console.log("Download URL:", media.download_url);
console.log("Duration:", media.duration);
console.log("Resolution:", media.width, media.height);
```

### Media response example

```json
{
  "success": true,
  "platform": "instagram",
  "url": "https://www.instagram.com/reel/DfAoc2zIHof",
  "media": {
    "available": true,
    "type": "video",
    "download_url": "https://eqwxy.aiccloud.online/api/v1/media/download/TOKEN",
    "mime_type": "video/mp4",
    "filename": "Video by creator.mp4",
    "filesize": 1872906,
    "duration": 13.073991,
    "width": 1080,
    "height": 1920,
    "metadata": {
      "title": "Video title",
      "description": "Video description",
      "thumbnail": "https://example.com/thumbnail.jpg",
      "uploader": "creator",
      "uploader_url": null,
      "platform_id": "DfAoc2zIHof"
    },
    "video_codec": "h264",
    "audio_codec": "aac",
    "expires_at": "2026-11-02T17:45:50.393Z",
    "expires_in_seconds": 900
  },
  "notice": "The video was converted to H.264/AAC MP4. This temporary download URL expires in 15 minutes; save it to your device before expiry."
}
```

### Media response field reference

| Field | Type | Description |
|---|---|---|
| `success` | Boolean | Whether media resolution succeeded |
| `platform` | String | Detected platform |
| `url` | String | Original submitted URL |
| `media.available` | Boolean | Whether downloadable media is available |
| `media.type` | String | Media type |
| `media.download_url` | String | Temporary download URL |
| `media.mime_type` | String | Output MIME type |
| `media.filename` | String | Suggested output filename |
| `media.filesize` | Number | File size in bytes |
| `media.duration` | Number / null | Final video duration in seconds |
| `media.width` | Number / null | Output width |
| `media.height` | Number / null | Output height |
| `media.metadata` | Object | Related content metadata |
| `media.video_codec` | String | Video codec |
| `media.audio_codec` | String | Audio codec |
| `media.expires_at` | String | Download link expiration timestamp |
| `media.expires_in_seconds` | Number | Remaining link lifetime at creation |

---

# 6. Download Process

## Endpoint

```http
GET /api/v1/media/download/:token
```

The media endpoint returns a temporary download URL containing a token.

For example:

```text
https://eqwxy.aiccloud.online/api/v1/media/download/GENERATED_TOKEN
```

The token is generated by the API. Never construct or modify it yourself.

### cURL example

```bash
curl -L --fail \
  "https://eqwxy.aiccloud.online/api/v1/media/download/GENERATED_TOKEN" \
  -o downloaded-video.mp4
```

### JavaScript download example

```javascript
async function downloadVideo(media) {
  const response = await fetch(media.download_url);

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }

  const videoBuffer = await response.arrayBuffer();

  // In a browser, use a Blob URL to initiate a download.
  const blob = new Blob([videoBuffer], {
    type: media.mime_type || "video/mp4"
  });

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = media.filename || "video.mp4";
  link.click();

  URL.revokeObjectURL(objectUrl);
}
```

### Download URL expiration

- Temporary download URLs expire after **15 minutes**.
- The API returns `expires_at` and `expires_in_seconds`.
- Applications should download or securely transfer the file immediately.
- If the URL expires, call `/api/v1/media` again to generate a fresh media result.
- Do not permanently store temporary download URLs as if they were reusable source URLs.

---

# 7. How the API Works Internally

The API uses a multi-stage media processing pipeline.

```text
Client / AI Agent
       |
       v
Submit social-media URL
       |
       v
Platform detection
       |
       v
Metadata extraction
       |
       v
Media extraction using yt-dlp
       |
       v
Download source media
       |
       v
FFmpeg conversion
       |
       v
FFprobe duration detection
       |
       v
Temporary download token
       |
       v
JSON response
       |
       v
Client downloads MP4
```

## Stage 1: URL processing

The API receives the original URL and determines the platform.

Example:

```text
https://www.youtube.com/shorts/VIDEO_ID
```

Detected platform:

```text
youtube
```

The API retains the original source URL and extracts the platform-specific identifier when available.

## Stage 2: Metadata extraction

The metadata resolver attempts to retrieve information such as:

- Title
- Description
- Thumbnail
- Creator or uploader
- Video duration
- Resolution
- Platform identifier

Metadata availability depends on the platform and its access restrictions.

## Stage 3: Media extraction

The media resolver uses `yt-dlp` to obtain the source media.

For YouTube, the current server configuration uses a server-side cookie file and JavaScript challenge support.

Instagram, Pinterest, X and other supported platforms follow their applicable extraction paths.

## Stage 4: FFmpeg conversion

The extracted source is processed with FFmpeg.

The normalized output is:

| Property | Output |
|---|---|
| Container | MP4 |
| Video codec | H.264 |
| Audio codec | AAC |
| MIME type | `video/mp4` |

This makes the output more consistent for mobile applications and other clients.

## Stage 5: Duration detection

The API uses FFprobe to inspect the final converted MP4.

This is important because the source platform or yt-dlp may not provide a usable duration.

The API therefore attempts to read the duration from the converted file and falls back to yt-dlp metadata if FFprobe cannot determine it.

For example:

```json
{
  "duration": 13.073991
}
```

Duration is measured in seconds.

## Stage 6: Temporary download URL

After processing, the API creates a temporary token and returns a download URL.

The client can then download the final MP4 through the download endpoint.

---

# 8. Platform-Specific Examples

All platforms use the same media endpoint.

### YouTube Shorts

```bash
curl -G "https://eqwxy.aiccloud.online/api/v1/media" \
  --data-urlencode "url=https://www.youtube.com/shorts/vLwdi8EU8vU"
```

### Instagram Reels

```bash
curl -G "https://eqwxy.aiccloud.online/api/v1/media" \
  --data-urlencode "url=https://www.instagram.com/reel/DfAoc2zIHof"
```

### Pinterest

```bash
curl -G "https://eqwxy.aiccloud.online/api/v1/media" \
  --data-urlencode "url=https://in.pinterest.com/pin/927741592008667022/"
```

### X / Twitter

```bash
curl -G "https://eqwxy.aiccloud.online/api/v1/media" \
  --data-urlencode "url=https://x.com/advitwake/status/1905257088269607378"
```

The client does not need separate download logic for each platform. It should use the returned `download_url`.

---

# 9. Recommended Integration for AI Agents

AI agents should follow this workflow:

1. Receive a social-media URL from the user.
2. Call `/api/v1/resolve` if only metadata is needed.
3. Call `/api/v1/media` if the user requests the actual video.
4. Validate `success` and `media.available`.
5. Read `download_url` from the response.
6. Download the media before the temporary link expires.
7. Use the returned metadata and file properties in the application.

### Agent implementation example

```javascript
const API_BASE = "https://eqwxy.aiccloud.online";

async function processSocialMediaUrl(inputUrl) {
  const endpoint = new URL(`${API_BASE}/api/v1/media`);
  endpoint.searchParams.set("url", inputUrl);

  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(260000)
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error("Unable to process this social-media URL");
  }

  if (!result.media?.available || !result.media.download_url) {
    throw new Error("No downloadable media is available");
  }

  return {
    platform: result.platform,
    originalUrl: result.url,
    title: result.media.metadata?.title ?? null,
    thumbnail: result.media.metadata?.thumbnail ?? null,
    duration: result.media.duration ?? null,
    width: result.media.width ?? null,
    height: result.media.height ?? null,
    filename: result.media.filename,
    filesize: result.media.filesize,
    mimeType: result.media.mime_type,
    downloadUrl: result.media.download_url,
    expiresAt: result.media.expires_at
  };
}
```

### Important agent instructions

- Always URL-encode the submitted URL.
- Do not assume a title, description, author or thumbnail exists.
- Treat `duration` as seconds, not milliseconds.
- Treat `filesize` as bytes.
- Do not assume every source has audio.
- Use `download_url` exactly as returned.
- Do not reconstruct the token or download URL.
- Do not reuse expired download links.
- Use a long timeout for media extraction.
- Avoid repeatedly calling the media endpoint for the same URL because extraction consumes server resources.
- Do not expose server-side cookies, credentials or internal filesystem paths.
- Do not claim a download completed until the client has actually received the file.

---

# 10. Performance and Usage Considerations

The current implementation has a media-processing concurrency limit of one active job.

The media endpoint also has a rate limiter. A tested response exposed headers similar to:

```http
RateLimit-Limit: 5
RateLimit-Remaining: 4
RateLimit-Reset: 60
```

These headers indicate the rate-limit state for that request. Treat the actual response headers as authoritative.

### Recommendations

- Avoid sending multiple simultaneous media requests.
- Queue media jobs on the client if processing several URLs.
- Use exponential backoff for temporary failures.
- Do not retry invalid URLs indefinitely.
- Keep media extraction and metadata extraction as separate operations.
- Use `/health` for service monitoring.

---

# 11. Error Handling

Clients should check both the HTTP status and JSON response.

Recommended pattern:

```javascript
const response = await fetch(endpoint);
const data = await response.json();

if (!response.ok) {
  throw new Error(`HTTP error: ${response.status}`);
}

if (data.success !== true) {
  throw new Error(
    data.error || data.message || "Request failed"
  );
}
```

Potential failure situations include:

- Invalid or unsupported source URL.
- Private, deleted or unavailable content.
- Platform authentication or access restrictions.
- Missing source media.
- Extraction timeout.
- Media conversion failure.
- Expired temporary download token.
- Rate limiting or server capacity limits.

The exact error codes and response bodies may vary by failure path. Integrators should not depend on undocumented error strings.

---

# 12. Security and Privacy

- Do not expose server-side cookies or credentials.
- Do not publish internal VPS paths or environment variables.
- Treat temporary download tokens as sensitive URLs.
- Validate user-provided URLs before processing.
- Do not assume that publicly accessible content is free of copyright restrictions.
- Respect platform terms, privacy restrictions and content ownership.
- Do not use this API to bypass access controls on private content.

---

# 13. Verified Platform Compatibility

The following tests were completed against the live API on November 2, 2026.

| Platform | Test result | Output |
|---|---|---|
| Instagram | Passed | 1080 × 1920, H.264/AAC |
| YouTube Shorts | Passed | 1080 × 1920, H.264/AAC |
| Pinterest | Passed | 720 × 1280, H.264/AAC |
| X / Twitter | Passed | 716 × 536, H.264/AAC |

All four platforms successfully returned processed media and a populated duration from the final MP4.

These are verified test cases, not a guarantee that every URL or every post on each platform will be downloadable.

---

# 14. Quick Reference

| Requirement | Endpoint |
|---|---|
| Check API status | `GET /health` |
| Extract metadata | `GET /api/v1/resolve?url=...` |
| Resolve video | `GET /api/v1/media?url=...` |
| Download video | `GET /api/v1/media/download/:token` |

**Base URL**

```text
https://eqwxy.aiccloud.online
```

**Metadata endpoint**

```text
https://eqwxy.aiccloud.online/api/v1/resolve
```

**Media endpoint**

```text
https://eqwxy.aiccloud.online/api/v1/media
```

**Download endpoint**

```text
https://eqwxy.aiccloud.online/api/v1/media/download/{token}
```

---

## Important implementation note

This documentation describes the endpoints and behaviors verified through the current KeepItBack API tests and implementation details available during documentation preparation. It is not a claim that every possible platform, field, error code, authentication mode or operational limit has been independently verified. Confirm the live source code before relying on undocumented behavior in a production integration.

**KeepItBack — Universal Metadata & Media Resolution API**