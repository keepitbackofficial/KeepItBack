require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const dns = require("node:dns").promises;
const ipaddr = require("ipaddr.js");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const execFileAsync = promisify(execFile);
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const app = express();
app.set("trust proxy", "loopback");
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "100kb" }));

app.use("/api", rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false
}));

const PLATFORMS = {
  youtube: ["youtube.com", "youtu.be"],
  instagram: ["instagram.com"],
  tiktok: ["tiktok.com"],
  facebook: ["facebook.com", "fb.watch"],
  twitter: ["twitter.com", "x.com"],
  pinterest: ["pinterest.com", "pin.it"],
  reddit: ["reddit.com", "redd.it"]
};

function detectPlatform(hostname) {
  const host = hostname.toLowerCase().replace(/^www\./, "");

  for (const [platform, domains] of Object.entries(PLATFORMS)) {
    if (domains.some(domain => host === domain || host.endsWith("." + domain))) {
      return platform;
    }
  }

  return null;
}

function extractMeta(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${escaped}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i")
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeEntities(match[1]);
  }

  return null;
}

function decodeEntities(value) {
  return value
    ?.replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function safeFetch(url, allowedHost) {
  let current = new URL(url);

  for (let i = 0; i < 4; i++) {
    if (
      current.protocol !== "https:" ||
      current.username ||
      current.password ||
      current.port ||
      !(current.hostname === allowedHost ||
        current.hostname.endsWith("." + allowedHost))
    ) {
      throw new Error("The platform redirected to an unsupported address.");
    }

    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(12000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KeepItBackMetadata/1.0)",
        "Accept": "text/html,application/json"
      }
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Invalid redirect.");
      current = new URL(location, current);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Platform returned HTTP ${response.status}.`);
    }

    const length = Number(response.headers.get("content-length") || 0);
    if (length > 2_000_000) throw new Error("Response too large.");

    const body = await response.text();
    if (body.length > 2_000_000) throw new Error("Response too large.");

    return { body, contentType: response.headers.get("content-type") || "" };
  }

  throw new Error("Too many redirects.");
}

async function getOembed(platform, url) {
  const endpoints = {
    youtube: "https://www.youtube.com/oembed?format=json&url=",
    tiktok: "https://www.tiktok.com/oembed?url=",
    reddit: "https://www.reddit.com/oembed?url=",
    twitter: "https://publish.twitter.com/oembed?url="
  };

  const endpoint = endpoints[platform];
  if (!endpoint) return null;

  const host = new URL(endpoint).hostname;
  const result = await safeFetch(endpoint + encodeURIComponent(url), host);

  try {
    const data = JSON.parse(result.body);
    return {
      title: data.title || null,
      author: data.author_name || null,
      thumbnail: data.thumbnail_url || null,
      provider: data.provider_name || null
    };
  } catch {
    return null;
  }
}

async function getOpenGraph(url, platform) {
  const host = new URL(url).hostname;
  const result = await safeFetch(url, host);

  if (!result.contentType.includes("text/html")) {
    throw new Error("The platform did not return an HTML page.");
  }

  const html = result.body;

  return {
    title:
      extractMeta(html, "og:title") ||
      extractMeta(html, "twitter:title") ||
      (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || null),
    description:
      extractMeta(html, "og:description") ||
      extractMeta(html, "description") ||
      extractMeta(html, "twitter:description"),
    thumbnail:
      extractMeta(html, "og:image") ||
      extractMeta(html, "twitter:image"),
    author: extractMeta(html, "author"),
    provider: platform
  };
}

app.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "KeepItBack Metadata API",
    status: "online"
  });
});

async function getExtractorMetadata(url) {
  const { stdout } = await execFileAsync(YTDLP_PATH, [
    "--ignore-config",
    "--no-playlist",
    "--no-warnings",
    "--no-progress",
    "--skip-download",
    "--dump-single-json",
    "--socket-timeout", "12",
    "--retries", "1",
    "--extractor-retries", "1",
    "--",
    url
  ], {
    timeout: 30000,
    maxBuffer: 5 * 1024 * 1024,
    killSignal: "SIGKILL",
    windowsHide: true,
    env: {
      PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin:/root/.local/bin",
      HOME: "/tmp",
      LANG: "C.UTF-8",
      HTTP_PROXY: "",
      HTTPS_PROXY: "",
      ALL_PROXY: "",
      http_proxy: "",
      https_proxy: "",
      all_proxy: ""
    }
  });

  const info = JSON.parse(stdout.trim());
  return {
    title: info.title || null,
    description: info.description || null,
    thumbnail: info.thumbnail || (Array.isArray(info.thumbnails) ? info.thumbnails.at(-1)?.url : null) || null,
    author: info.uploader || info.channel || info.creator || null,
    provider: info.extractor_key || info.extractor || null,
    duration: Number.isFinite(Number(info.duration)) ? Number(info.duration) : null,
    width: Number.isFinite(Number(info.width)) ? Number(info.width) : null,
    height: Number.isFinite(Number(info.height)) ? Number(info.height) : null
  };
}

app.get("/api/v1/resolve", async (req, res) => {
  const input = req.query.url;

  if (!input || typeof input !== "string") {
    return res.status(400).json({
      success: false,
      error: "MISSING_URL",
      message: "Provide a URL using ?url="
    });
  }

  let parsed;

  try {
    parsed = new URL(input);
  } catch {
    return res.status(400).json({
      success: false,
      error: "INVALID_URL",
      message: "The supplied URL is invalid."
    });
  }

  const platform = detectPlatform(parsed.hostname);

  if (!platform || parsed.protocol !== "https:") {
    return res.status(400).json({
      success: false,
      error: "UNSUPPORTED_URL",
      message: "This URL is not from a supported platform."
    });
  }

  try {
    await validatePublicHostname(parsed.hostname);

    let metadata = await getOembed(platform, parsed.href).catch(() => null);

    if (!metadata || (!metadata.title && !metadata.thumbnail && !metadata.description)) {
      const openGraph = await getOpenGraph(parsed.href, platform).catch(() => null);
      metadata = { ...(openGraph || {}), ...(metadata || {}) };
    }

    // yt-dlp is the cross-platform metadata fallback for public content.
    // It may still fail when a platform blocks unauthenticated access.
    if (!metadata?.title || !metadata?.thumbnail || !metadata?.description || !metadata?.author) {
      const extracted = await getExtractorMetadata(parsed.href).catch(() => null);
      if (extracted) metadata = { ...extracted, ...(metadata || {}) };
    }

    if (!metadata || (!metadata.title && !metadata.thumbnail && !metadata.description)) {
      return res.status(404).json({
        success: false,
        error: "METADATA_UNAVAILABLE",
        platform,
        message: "The platform did not provide usable public metadata."
      });
    }

    return res.json({
      success: true,
      platform,
      url: parsed.href,
      metadata: {
        title: metadata.title || null,
        description: metadata.description || null,
        thumbnail: metadata.thumbnail || null,
        author: metadata.author || null,
        provider: metadata.provider || platform,
        duration: metadata.duration || null,
        width: metadata.width || null,
        height: metadata.height || null
      }
    });
  } catch (error) {
    return res.status(502).json({
      success: false,
      error: "METADATA_FETCH_FAILED",
      platform,
      message: error.message
    });
  }
});
// Supported platform capabilities
const PLATFORM_CAPABILITIES = {
  instagram: { name: "Instagram", metadata: "public_when_available", download: "best_effort_public" },
  youtube: { name: "YouTube", metadata: "public_when_available", download: "best_effort_public" },
  tiktok: { name: "TikTok", metadata: "public_when_available", download: "best_effort_public" },
  facebook: { name: "Facebook", metadata: "public_when_available", download: "best_effort_public" },
  twitter: { name: "X", metadata: "public_when_available", download: "best_effort_public" },
  pinterest: { name: "Pinterest", metadata: "public_when_available", download: "best_effort_public" },
  reddit: { name: "Reddit", metadata: "public_when_available", download: "best_effort_public" }
};

// GET /api/v1/platforms
app.get("/api/v1/platforms", (req, res) => {
  res.json({
    success: true,
    platforms: PLATFORM_CAPABILITIES
  });
});

// Validate that every DNS answer is a public unicast IP.
async function validatePublicHostname(hostname) {
  const host = String(hostname || "")
    .toLowerCase()
    .replace(/\.$/, "");

  if (!host || host === "localhost" || host.endsWith(".localhost")) {
    throw new Error("Invalid hostname");
  }

  const addresses = await dns.lookup(host, {
    all: true,
    verbatim: true
  });

  if (!addresses.length) {
    throw new Error("Hostname has no DNS records");
  }

  for (const item of addresses) {
    let range;

    try {
      range = ipaddr.process(item.address).range();
    } catch {
      throw new Error("Invalid IP address in DNS response");
    }

    if (range !== "unicast") {
      throw new Error("Hostname resolves to a non-public IP address");
    }
  }

  return true;
}

// Temporary public media extraction and download service
const YTDLP_PATH = "/root/.local/bin/yt-dlp";
const FFMPEG_PATH = process.env.FFMPEG_PATH || "/usr/bin/ffmpeg";
const MEDIA_DIR = "/tmp/keepitback-media";
const PUBLIC_BASE_URL = (
  process.env.PUBLIC_BASE_URL || "https://eqwxy.aiccloud.online"
).replace(/\/+$/, "");

const MAX_MEDIA_BYTES = 250 * 1024 * 1024;
const MEDIA_TTL_MS = 15 * 60 * 1000;
const MAX_CONCURRENT_DOWNLOADS = 1; // H.264 transcoding is CPU-intensive on this 4 GB VPS.

const temporaryMedia = new Map();
let activeMediaJobs = 0;

fs.mkdirSync(MEDIA_DIR, { recursive: true });

// Remove stale files left behind by a previous API process.
for (const entry of fs.readdirSync(MEDIA_DIR)) {
  fs.rmSync(path.join(MEDIA_DIR, entry), { recursive: true, force: true });
}

function safeFilename(title) {
  const clean = String(title || "keepitback-video")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._ -]/gu, "")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 90);

  return `${clean || "keepitback-video"}.mp4`;
}

function removeTemporaryMedia(token, item) {
  if (token) temporaryMedia.delete(token);
  if (item?.directory) {
    fs.promises.rm(item.directory, { recursive: true, force: true }).catch(() => {});
  }
}

// Expire temporary downloads automatically.
const mediaCleanupTimer = setInterval(() => {
  const now = Date.now();

  for (const [token, item] of temporaryMedia.entries()) {
    if (item.expiresAt <= now) {
      removeTemporaryMedia(token, item);
    }
  }
}, 60 * 1000);

mediaCleanupTimer.unref();

// Extract and download a public video, merging separate audio/video streams.
const mediaLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false
});

app.get("/api/v1/media", mediaLimiter, async (req, res) => {
  const input = req.query.url;

  if (!input || typeof input !== "string" || input.length > 2048) {
    return res.status(400).json({
      success: false,
      error: "INVALID_URL",
      message: "Provide a valid URL under 2048 characters."
    });
  }

  let parsed;

  try {
    parsed = new URL(input);
  } catch {
    return res.status(400).json({
      success: false,
      error: "INVALID_URL",
      message: "The supplied URL is invalid."
    });
  }

  const platform = detectPlatform(parsed.hostname);

  if (
    !platform ||
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.port
  ) {
    return res.status(400).json({
      success: false,
      error: "UNSUPPORTED_URL",
      message: "Only supported HTTPS platform URLs are accepted."
    });
  }

  try {
    await validatePublicHostname(parsed.hostname);
  } catch {
    return res.status(400).json({
      success: false,
      platform,
      error: "HOST_VALIDATION_FAILED",
      message: "The supplied hostname could not be validated."
    });
  }

  if (activeMediaJobs >= MAX_CONCURRENT_DOWNLOADS) {
    return res.status(429).json({
      success: false,
      platform,
      error: "SERVER_BUSY",
      message: "The download service is busy. Please retry shortly."
    });
  }

  activeMediaJobs++;

  const jobId = crypto.randomUUID();
  const jobDirectory = path.join(MEDIA_DIR, jobId);

  try {
    fs.mkdirSync(jobDirectory, { recursive: true });

    const outputTemplate = path.join(jobDirectory, "media.%(ext)s");

    const args = [
      "--ignore-config",
      "--no-playlist",
      "--no-warnings",
      "--no-progress",
      "--socket-timeout", "20",
      "--retries", "1",
      "--fragment-retries", "1",
      "--extractor-retries", "1",
      "--max-filesize", "250M",
      // Prefer broadly compatible AVC/H.264 + AAC when the source offers it.
      // Otherwise download the best public streams and transcode the merged file below.
      "--format", "bv*[vcodec^=avc1]+ba[acodec^=mp4a]/bv*+ba/b",
      "--merge-output-format", "mp4",
      "--output", outputTemplate,
      "--print-json",
      "--",
      parsed.href
    ];

    const { stdout } = await execFileAsync(YTDLP_PATH, args, {
      timeout: 180000,
      maxBuffer: 10 * 1024 * 1024,
      killSignal: "SIGKILL",
      windowsHide: true,
      env: {
        PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin:/root/.local/bin",
        HOME: "/tmp",
        LANG: "C.UTF-8",
        HTTP_PROXY: "",
        HTTPS_PROXY: "",
        ALL_PROXY: "",
        http_proxy: "",
        https_proxy: "",
        all_proxy: ""
      }
    });

    // yt-dlp prints metadata after the download.
    let info = null;
    try {
      const lines = stdout.trim().split("\n");
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          info = JSON.parse(lines[i]);
          break;
        } catch {}
      }
    } catch {}

    if (info?.availability && info.availability !== "public") {
      throw new Error("CONTENT_NOT_PUBLIC");
    }

    const files = fs.readdirSync(jobDirectory)
      .filter(name => name.toLowerCase().endsWith(".mp4"));

    if (!files.length) {
      throw new Error("MERGED_MP4_NOT_CREATED");
    }

    let filePath = path.join(jobDirectory, files[0]);
    let stat = fs.statSync(filePath);

    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_MEDIA_BYTES) {
      throw new Error("MEDIA_SIZE_INVALID");
    }

    // Always produce H.264 video + AAC audio in an MP4 container for
    // better compatibility with Android gallery and media players.
    const convertedPath = path.join(jobDirectory, "keepitback-compatible.mp4");

    await execFileAsync(FFMPEG_PATH, [
      "-y",
      "-hide_banner",
      "-loglevel", "error",
      "-i", filePath,
      "-map", "0:v:0",
      "-map", "0:a:0?",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-threads", "2",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      convertedPath
    ], {
      timeout: 180000,
      maxBuffer: 2 * 1024 * 1024,
      killSignal: "SIGKILL",
      windowsHide: true,
      env: {
        PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
        HOME: "/tmp",
        LANG: "C.UTF-8"
      }
    });

    const convertedStat = fs.statSync(convertedPath);
    if (!convertedStat.isFile() || convertedStat.size <= 0 || convertedStat.size > MAX_MEDIA_BYTES) {
      throw new Error("CONVERTED_MEDIA_SIZE_INVALID");
    }

    fs.rmSync(filePath, { force: true });
    filePath = convertedPath;
    stat = convertedStat;

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + MEDIA_TTL_MS;
    const filename = safeFilename(info?.title);

    temporaryMedia.set(token, {
      filePath,
      directory: jobDirectory,
      filename,
      expiresAt,
      size: stat.size
    });

    return res.json({
      success: true,
      platform,
      url: parsed.href,
      media: {
        available: true,
        type: "video",
        download_url: `${PUBLIC_BASE_URL}/api/v1/media/download/${token}`,
        mime_type: "video/mp4",
        filename,
        filesize: stat.size,
        duration: Number.isFinite(Number(info?.duration)) ? Number(info.duration) : null,
        width: Number.isFinite(Number(info?.width)) ? Number(info.width) : null,
        height: Number.isFinite(Number(info?.height)) ? Number(info.height) : null,
        metadata: {
          title: info?.title || null,
          description: info?.description || null,
          thumbnail: info?.thumbnail || null,
          uploader: info?.uploader || info?.channel || info?.creator || null,
          uploader_url: info?.uploader_url || info?.channel_url || null,
          platform_id: info?.id || null
        },
        video_codec: "h264",
        audio_codec: "aac",
        expires_at: new Date(expiresAt).toISOString(),
        expires_in_seconds: 900
      },
      notice: "The video was converted to H.264/AAC MP4. This temporary download URL expires in 15 minutes; save it to your device before expiry."
    });

  } catch (error) {
    fs.rmSync(jobDirectory, { recursive: true, force: true });

    const diagnostic = String(
      error.stderr || error.message || "Unknown error"
    ).slice(0, 1000);

    console.error("[KeepItBack media]", diagnostic);

    if (error.message === "CONTENT_NOT_PUBLIC") {
      return res.status(403).json({
        success: false,
        platform,
        error: "CONTENT_NOT_PUBLIC",
        message: "Only publicly available content is supported."
      });
    }

    if (error.killed || error.signal === "SIGKILL") {
      return res.status(504).json({
        success: false,
        platform,
        error: "MEDIA_RESOLUTION_TIMEOUT",
        message: "Media processing took too long. Please retry later."
      });
    }

    return res.status(422).json({
      success: false,
      platform,
      error: "MEDIA_UNAVAILABLE",
      message: "A downloadable public MP4 could not be created. The content may be restricted, unsupported, or unavailable."
    });

  } finally {
    activeMediaJobs--;
  }
});
// Serve temporary MP4 files using unguessable tokens.
app.get("/api/v1/media/download/:token", (req, res) => {
  const token = req.params.token;

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.status(404).json({
      success: false,
      error: "DOWNLOAD_NOT_FOUND"
    });
  }

  const item = temporaryMedia.get(token);

  if (!item || item.expiresAt <= Date.now()) {
    if (item) removeTemporaryMedia(token, item);

    return res.status(404).json({
      success: false,
      error: "DOWNLOAD_EXPIRED",
      message: "This temporary download link has expired. Resolve the media again."
    });
  }

  if (!fs.existsSync(item.filePath)) {
    removeTemporaryMedia(token, item);

    return res.status(404).json({
      success: false,
      error: "DOWNLOAD_NOT_FOUND"
    });
  }

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", "video/mp4");

  res.download(item.filePath, item.filename, error => {
    if (error && !res.headersSent) {
      res.status(500).json({
        success: false,
        error: "DOWNLOAD_FAILED"
      });
    }
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`KeepItBack API running on 127.0.0.1:${PORT}`);
});