/**
 * Video Embed Utilities
 *
 * Safe, lazy-loaded video player integrations for:
 * - YouTube (standard videos, shorts, embeds)
 * - 3Speak (decentralized Hive video network on IPFS: play.3speak.tv, 3speak.tv)
 * - BitChute (bitchute.com/video, bitchute.com/embed)
 *
 * Crucial rule: Zero iframes or video streams load before user explicitly clicks.
 * Dedicated own HLS video player for 3Speak without iframes.
 */

import Hls from 'hls.js';
import { imageIdentity } from '../services/shortsApi';

export type VideoPlatform = 'youtube' | '3speak' | 'bitchute';

export interface VideoInfo {
  platform: VideoPlatform;
  id: string; // YouTube: 11-char ID; 3Speak: "owner/permlink"; BitChute: video ID
  originalUrl: string;
  embedUrl: string;
  thumbnailUrl: string;
  title?: string;
}

export interface ThreeSpeakEmbedData {
  title?: string;
  thumbnail?: string;
  videoUrl?: string;
  videoUrlFallback1?: string;
  videoUrlFallback2?: string;
  videoUrlFallback3?: string;
  duration?: number;
}

// Global in-memory cache for 3Speak metadata so components share it
const threeSpeakCache = new Map<string, ThreeSpeakEmbedData>();
const threeSpeakInFlight = new Map<string, Promise<ThreeSpeakEmbedData | null>>();

export function setCached3SpeakData(videoId: string, data: Partial<ThreeSpeakEmbedData>) {
  const cleanId = (videoId || '').trim().toLowerCase();
  if (!cleanId) return;
  const existing = threeSpeakCache.get(cleanId) || {};
  threeSpeakCache.set(cleanId, { ...existing, ...data });
}

export function getCached3SpeakData(videoId: string): ThreeSpeakEmbedData | null {
  return threeSpeakCache.get((videoId || '').trim().toLowerCase()) || null;
}

export async function get3SpeakData(videoId: string): Promise<ThreeSpeakEmbedData | null> {
  const cleanId = (videoId || '').trim().toLowerCase();
  if (!cleanId) return null;

  if (threeSpeakCache.has(cleanId) && threeSpeakCache.get(cleanId)?.videoUrl) {
    return threeSpeakCache.get(cleanId)!;
  }

  if (threeSpeakInFlight.has(cleanId)) {
    return threeSpeakInFlight.get(cleanId)!;
  }

  const promise = (async () => {
    try {
      const res = await fetch(`https://play.3speak.tv/api/embed?v=${encodeURIComponent(cleanId)}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.success) {
        const item: ThreeSpeakEmbedData = {
          title: data.title,
          thumbnail: data.thumbnail,
          videoUrl: data.videoUrl,
          videoUrlFallback1: data.videoUrlFallback1,
          videoUrlFallback2: data.videoUrlFallback2,
          videoUrlFallback3: data.videoUrlFallback3,
          duration: data.duration
        };
        const prev = threeSpeakCache.get(cleanId) || {};
        threeSpeakCache.set(cleanId, { ...prev, ...item });
        return item;
      }
      return null;
    } catch {
      return null;
    } finally {
      threeSpeakInFlight.delete(cleanId);
    }
  })();

  threeSpeakInFlight.set(cleanId, promise);
  return promise;
}

/**
 * Extract 3Speak video IDs from text or json_metadata
 */
export function extract3SpeakVideoIds(text?: string, jsonMetadata?: any): string[] {
  const ids: string[] = [];
  const add = (id?: string) => {
    if (id && typeof id === 'string') {
      const clean = id.trim().toLowerCase();
      if (clean && !ids.includes(clean)) ids.push(clean);
    }
  };

  if (text && typeof text === 'string') {
    const regex = /(?:play\.)?3speak\.(?:tv|online)\/(?:embed\?v=|watch\?v=|shorts\?v=|embed\/|watch\/|shorts\/)([a-z0-9.-]+\/[a-z0-9_-]+)/gi;
    let m;
    while ((m = regex.exec(text)) !== null) {
      if (m[1]) add(m[1]);
    }
  }

  if (jsonMetadata) {
    try {
      const meta = typeof jsonMetadata === 'string' ? JSON.parse(jsonMetadata) : jsonMetadata;
      if (meta?.video?.info?.author && meta?.video?.info?.permlink) {
        add(`${meta.video.info.author}/${meta.video.info.permlink}`);
      }
      if (typeof meta?.video?.url === 'string') {
        const m = meta.video.url.match(/(?:embed\?v=|watch\?v=|shorts\?v=|embed\/|watch\/|shorts\/)([a-z0-9.-]+\/[a-z0-9_-]+)/i);
        if (m && m[1]) add(m[1]);
      }
      if (Array.isArray(meta?.links)) {
        for (const link of meta.links) {
          if (typeof link === 'string') {
            const m = link.match(/(?:embed\?v=|watch\?v=|shorts\?v=|embed\/|watch\/|shorts\/)([a-z0-9.-]+\/[a-z0-9_-]+)/i);
            if (m && m[1]) add(m[1]);
          }
        }
      }
    } catch {}
  }

  return ids;
}

/**
 * Extract 3Speak video thumbnail from Hive json_metadata if present.
 * Authors frequently have the image inside metadata even before 3Speak API resolves.
 */
export function extract3SpeakThumbnailFromHive(jsonMetadata: any, body?: string): string | null {
  if (!jsonMetadata) return null;
  try {
    const meta = typeof jsonMetadata === 'string' ? JSON.parse(jsonMetadata) : jsonMetadata;

    // 1. Direct video.thumbnail
    if (meta.video?.thumbnail && typeof meta.video.thumbnail === 'string') {
      return meta.video.thumbnail;
    }

    // 2. video.info.sourceMap
    if (Array.isArray(meta.video?.info?.sourceMap)) {
      const item = meta.video.info.sourceMap.find(
        (s: any) => s.type === 'thumbnail' || s.url?.includes('thumbnail') || s.url?.includes('images.3speak.tv')
      );
      if (item?.url && typeof item.url === 'string') return item.url;
    }

    // 3. direct thumbnail property
    if (meta.thumbnail && typeof meta.thumbnail === 'string') {
      return meta.thumbnail;
    }

    // 4. If post is a 3Speak video or body has 3speak video, check meta.image
    const is3Speak =
      meta.app?.includes('3speak') ||
      Boolean(meta.video) ||
      Boolean(meta['threespeak.video']) ||
      Boolean(body && (body.includes('3speak.tv') || body.includes('play.3speak.tv')));

    if (is3Speak && Array.isArray(meta.image) && meta.image.length > 0) {
      // Find image from 3speak or first valid image
      const img3s = meta.image.find((img: any) => typeof img === 'string' && (img.includes('3speak') || img.includes('thumbnail')));
      if (img3s) return img3s;
      if (typeof meta.image[0] === 'string' && meta.image[0].startsWith('http')) {
        return meta.image[0];
      }
    }
  } catch {}
  return null;
}

/**
 * Extract filename / basename of an image across arbitrary CDNs (e.g. 1791673300329-dd90449b9e5cf932.webp)
 */
export function extractImageBasename(url: string): string {
  if (!url || typeof url !== 'string') return '';
  let clean = url.trim();

  // If wsrv.nl proxy, unwrap
  if (clean.includes('wsrv.nl/?url=') || clean.includes('wsrv.nl?url=')) {
    const match = clean.match(/[?&]url=([^&]+)/);
    if (match && match[1]) clean = decodeURIComponent(match[1]);
  }

  // If hive proxy /0x0/ or /640x360/ or /p/, unwrap if followed by http
  const httpMatch = clean.match(/https?:\/\/[^/]+\/(?:0x0|640x360|1280x720|p)\/(https?:\/\/.+)/i);
  if (httpMatch && httpMatch[1]) {
    clean = decodeURIComponent(httpMatch[1]);
  }

  // Strip query string and hash
  clean = clean.split('?')[0].split('#')[0];

  // Get last path segment
  const parts = clean.split('/');
  const lastSegment = parts[parts.length - 1] || '';

  return decodeURIComponent(lastSegment).toLowerCase();
}

/**
 * Expand 3Speak video URLs into multiple robust IPFS gateways
 */
export function buildExpanded3SpeakSources(rawSources: string[]): string[] {
  const list: string[] = [];
  const add = (url?: string) => {
    if (!url || typeof url !== 'string') return;
    const clean = url.trim();
    if (clean && !list.includes(clean)) list.push(clean);
  };

  for (const src of rawSources) {
    add(src);

    // Decode URL if it has query parameter u=
    try {
      if (src.includes('u=')) {
        const match = src.match(/[?&]u=([^&]+)/);
        if (match && match[1]) {
          const decoded = decodeURIComponent(match[1]);
          add(decoded);
        }
      }
    } catch {}

    // Extract IPFS CID
    const cidMatch = src.match(/(?:ipfs\/|%2Fipfs%2F)([a-zA-Z0-9]{40,})/i);
    if (cidMatch && cidMatch[1]) {
      const cid = cidMatch[1];
      add(`https://ipfs-3speak.b-cdn.net/ipfs/${cid}/manifest.m3u8`);
      add(`https://ipfs-3speak.b-cdn.net/ipfs/${cid}/480p/index.m3u8`);
      add(`https://ipfs.io/ipfs/${cid}/manifest.m3u8`);
      add(`https://cloudflare-ipfs.com/ipfs/${cid}/manifest.m3u8`);
    }
  }

  return list.filter(Boolean);
}

/**
 * Normalizes an image URL by stripping proxy wrappers (wsrv.nl, images.hive.blog, etc.)
 */
function normalizeImageUrl(url: string): string {
  if (!url) return '';
  let s = url.trim();

  // Strip wsrv.nl proxy
  if (s.includes('wsrv.nl/?url=') || s.includes('wsrv.nl?url=')) {
    const match = s.match(/[?&]url=([^&]+)/);
    if (match && match[1]) s = decodeURIComponent(match[1]);
  }

  // Strip hive image proxies
  s = s.replace(/https?:\/\/images\.(?:hive\.blog|ecency\.com)\/(?:[0-9]+x[0-9]+\/|0x0\/|p\/)?/gi, '');

  // Strip protocol and trailing slashes
  s = s.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return s.toLowerCase();
}

/**
 * Check if an image URL is the thumbnail of a 3Speak video.
 * Matches across different CDNs (e.g. images.3speak.tv vs images.hive.blog) using filename and image identity.
 */
export function is3SpeakThumbnail(
  imageUrl: string,
  threeSpeakThumbnail?: string,
  threeSpeakVideoId?: string
): boolean {
  if (!imageUrl || typeof imageUrl !== 'string') return false;
  const cleanImage = imageUrl.trim();
  if (!cleanImage) return false;

  const baseImage = extractImageBasename(cleanImage);
  const normImage = normalizeImageUrl(cleanImage);

  // 1. Match against known/provided thumbnail
  if (threeSpeakThumbnail) {
    const cleanApi = threeSpeakThumbnail.trim();
    if (cleanImage === cleanApi) return true;

    // Basename match across different CDNs (e.g., 1791673300329-dd90449b9e5cf932.webp)
    const baseApi = extractImageBasename(cleanApi);
    if (baseImage && baseApi && baseImage === baseApi && baseImage.length > 5) {
      return true;
    }

    // Normalized URL match
    const normApi = normalizeImageUrl(cleanApi);
    if (normImage === normApi) return true;

    // Image identity match
    if (imageIdentity(cleanImage) === imageIdentity(cleanApi)) return true;

    // Hive image hash match (e.g. DQmdUZEhyg5pV2qjr1NqNw8xwxBetBjk9wqB2csM39sJHZQ)
    const hashA = cleanImage.match(/DQm[a-zA-Z0-9]{40,}/)?.[0];
    const hashB = cleanApi.match(/DQm[a-zA-Z0-9]{40,}/)?.[0];
    if (hashA && hashB && hashA === hashB) return true;
  }

  // 2. Check if URL matches 3Speak thumbnail endpoint or patterns for this video
  if (threeSpeakVideoId) {
    const idLower = threeSpeakVideoId.toLowerCase();
    if (cleanImage.toLowerCase().includes(`play.3speak.tv/thumbnail?v=${idLower}`)) {
      return true;
    }
    const [owner, permlink] = idLower.split('/');
    if (owner && permlink) {
      const lower = cleanImage.toLowerCase();
      if (lower.includes(owner) && lower.includes(permlink) && (lower.includes('thumbnail') || lower.includes('3speak'))) {
        return true;
      }
    }
    // Also check memory cache if thumbnail was registered for this video
    const cached = getCached3SpeakData(threeSpeakVideoId);
    if (cached?.thumbnail && cached.thumbnail !== threeSpeakThumbnail) {
      if (is3SpeakThumbnail(imageUrl, cached.thumbnail)) return true;
    }
  }

  // 3. Timestamped 3Speak thumbnail filename convention
  // 3Speak formats: 1791...-<hash>.webp or video-thumbnail-<timestamp>.jpg
  if (baseImage.startsWith('video-thumbnail-') && (threeSpeakVideoId || threeSpeakThumbnail)) {
    return true;
  }

  if (/^\d{13}-[a-f0-9]+\.(?:webp|jpg|jpeg|png)$/i.test(baseImage) && (threeSpeakVideoId || threeSpeakThumbnail)) {
    return true;
  }

  return false;
}

// Regex patterns for detecting video URLs
const YOUTUBE_URL_REGEX = /(?:https?:)?\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;
const THREESPEAK_URL_REGEX = /(?:https?:)?\/\/(?:play\.)?3speak\.(?:tv|online)\/(?:embed\?v=|watch\?v=|shorts\?v=|embed\/|watch\/|shorts\/)([a-z0-9.-]+\/[a-z0-9_-]+)/i;
const BITCHUTE_URL_REGEX = /(?:https?:)?\/\/(?:www\.)?bitchute\.com\/(?:video|embed)\/([a-zA-Z0-9_-]+)/i;

/**
 * Detect if a URL is a supported video URL and parse its metadata
 */
export function parseVideoUrl(url: string, jsonMetadata?: any): VideoInfo | null {
  if (!url || typeof url !== 'string') return null;
  const clean = url.trim();

  // 1. YouTube
  const ytMatch = clean.match(YOUTUBE_URL_REGEX);
  if (ytMatch && ytMatch[1]) {
    const id = ytMatch[1];
    return {
      platform: 'youtube',
      id,
      originalUrl: clean,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`,
      thumbnailUrl: `https://wsrv.nl/?url=i.ytimg.com/vi/${id}/hqdefault.jpg&output=webp`
    };
  }

  // 2. 3Speak
  const tsMatch = clean.match(THREESPEAK_URL_REGEX);
  if (tsMatch && tsMatch[1]) {
    const id = tsMatch[1];
    const parts = id.split('/');
    const owner = parts[0];
    const permlink = parts[1];

    let cached = getCached3SpeakData(id);

    // If no cached thumbnail yet, check Hive jsonMetadata
    const hiveThumbnail = extract3SpeakThumbnailFromHive(jsonMetadata, clean);
    if (!cached && hiveThumbnail) {
      cached = { thumbnail: hiveThumbnail };
      setCached3SpeakData(id, cached);
    } else if (cached && !cached.thumbnail && hiveThumbnail) {
      cached.thumbnail = hiveThumbnail;
      setCached3SpeakData(id, cached);
    }

    const thumb =
      cached?.thumbnail ||
      hiveThumbnail ||
      `https://images.hive.blog/640x360/https://play.3speak.tv/thumbnail?v=${encodeURIComponent(owner)}/${encodeURIComponent(permlink)}`;

    return {
      platform: '3speak',
      id,
      originalUrl: clean,
      embedUrl: `https://play.3speak.tv/embed?v=${encodeURIComponent(owner)}/${encodeURIComponent(permlink)}`,
      thumbnailUrl: thumb
    };
  }

  // 3. BitChute
  const bcMatch = clean.match(BITCHUTE_URL_REGEX);
  if (bcMatch && bcMatch[1]) {
    const id = bcMatch[1];
    return {
      platform: 'bitchute',
      id,
      originalUrl: clean,
      embedUrl: `https://www.bitchute.com/embed/${id}/`,
      thumbnailUrl: ''
    };
  }

  return null;
}

/**
 * Generate lightweight HTML facade for click-to-load video players.
 * This contains NO iframes or video network requests until user clicks.
 */
export function buildVideoFacadeHtml(info: VideoInfo): string {
  const platformNames: Record<VideoPlatform, string> = {
    youtube: 'YouTube',
    '3speak': '3Speak (IPFS)',
    bitchute: 'BitChute'
  };

  const platformBadgeColors: Record<VideoPlatform, string> = {
    youtube: 'bg-red-600 text-white',
    '3speak': 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white',
    bitchute: 'bg-gradient-to-r from-orange-600 to-red-600 text-white'
  };

  const platformName = platformNames[info.platform] || 'Video';
  const badgeColor = platformBadgeColors[info.platform] || 'bg-slate-700 text-white';

  const thumbnailHtml = info.thumbnailUrl
    ? `<img src="${info.thumbnailUrl}" alt="${platformName} Video" class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />`
    : `<div class="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center"><span class="text-slate-500 text-xs font-semibold tracking-wider uppercase">${platformName}</span></div>`;

  return `
<div class="nebulosa-video-container my-2.5 mx-auto max-w-2xl">
  <div
    class="nebulosa-lazy-video-facade group relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:shadow-md cursor-pointer select-none transition-shadow duration-200"
    data-video-platform="${info.platform}"
    data-video-id="${info.id}"
    data-video-embed="${encodeURIComponent(info.embedUrl)}"
    data-original-url="${encodeURIComponent(info.originalUrl)}"
    tabindex="0"
    role="button"
    aria-label="Play ${platformName} video"
  >
    ${thumbnailHtml}
    
    <!-- Dark gradient overlay for readability and contrast -->
    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/35 group-hover:bg-black/30 transition-colors duration-200"></div>

    <!-- Platform Badge with crisp typography -->
    <div class="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide shadow-md backdrop-blur-xs ${badgeColor}">
      <span>${platformName}</span>
    </div>

    <!-- Center Play Button with refined scale & glow -->
    <div class="absolute inset-0 flex flex-col items-center justify-center gap-2">
      <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-white flex items-center justify-center shadow-xl group-hover:scale-105 group-active:scale-95 transition-all duration-200 border border-white/20">
        <svg class="w-6 h-6 sm:w-7 sm:h-7 ml-0.5 text-purple-600 dark:text-purple-400 fill-current" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </div>
      <span class="text-[11px] font-semibold text-white/95 drop-shadow-md tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-black/50 backdrop-blur-xs border border-white/10">
        Click to play
      </span>
    </div>
  </div>
</div>
`.trim();
}

/**
 * Replace YouTube, 3Speak, and BitChute markdown/raw links with lazy video facades,
 * and strip duplicate static thumbnail images for 3Speak videos.
 */
export function transformVideoEmbedsInMarkdown(
  markdown: string,
  options?: {
    threeSpeakThumbnails?: Record<string, string>;
    jsonMetadata?: any;
  }
): string {
  if (!markdown || typeof markdown !== 'string') return '';

  let result = markdown;
  const threeSpeakIds = extract3SpeakVideoIds(markdown, options?.jsonMetadata);

  // Seed options with thumbnail from Hive jsonMetadata if available
  const hiveThumb = extract3SpeakThumbnailFromHive(options?.jsonMetadata, markdown);
  const activeThumbs: Record<string, string> = { ...(options?.threeSpeakThumbnails || {}) };

  if (hiveThumb) {
    for (const id of threeSpeakIds) {
      if (!activeThumbs[id]) {
        activeThumbs[id] = hiveThumb;
      }
      setCached3SpeakData(id, { thumbnail: hiveThumb });
    }
  }

  // 1. Raw <iframe> tags with supported video platforms
  result = result.replace(
    /<iframe[^>]*\bsrc=["'](https?:\/\/[^"']+)["'][^>]*>[\s\S]*?<\/iframe>/gi,
    (match, src) => {
      const info = parseVideoUrl(src, options?.jsonMetadata);
      if (info) {
        if (info.platform === '3speak' && activeThumbs[info.id]) {
          info.thumbnailUrl = activeThumbs[info.id];
        }
        return buildVideoFacadeHtml(info);
      }
      return match;
    }
  );

  // 2. HTML anchor wrapping image for 3Speak: <a href="3speak_url"><img src="thumb_url" .../></a>
  result = result.replace(
    /<a\s+[^>]*href=["'](https?:\/\/(?:play\.)?3speak\.(?:tv|online)\/[^"']+)["'][^>]*>\s*<img\s+[^>]*src=["']([^"']+)["'][^>]*\/?>\s*<\/a>/gi,
    (match, url, thumb) => {
      const info = parseVideoUrl(url, options?.jsonMetadata);
      if (info) {
        if (thumb) info.thumbnailUrl = thumb;
        return buildVideoFacadeHtml(info);
      }
      return match;
    }
  );

  // 3. Standalone Markdown video image links: [![alt](thumb)](video_url)
  result = result.replace(
    /\[!\[[^\]]*\]\(([^)]+)\)\]\((https?:\/\/[^\s\)]+)\)/gi,
    (match, thumb, url) => {
      const info = parseVideoUrl(url, options?.jsonMetadata);
      if (info) {
        if (thumb) info.thumbnailUrl = thumb;
        return buildVideoFacadeHtml(info);
      }
      return match;
    }
  );

  // 4. Standalone video URLs on their own line (or wrapped in <center>...</center> or <p>...</p>)
  result = result.replace(
    /(?:^|(?:\r?\n)|<center>|<p>)\s*(https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be|3speak\.tv|3speak\.online|play\.3speak\.tv|bitchute\.com)\/[^\s<>"']+)\s*(?:<\/center>|<\/p>|(?:\r?\n)|$)/gim,
    (match, url) => {
      const info = parseVideoUrl(url, options?.jsonMetadata);
      if (info) {
        if (info.platform === '3speak' && activeThumbs[info.id]) {
          info.thumbnailUrl = activeThumbs[info.id];
        }
        return `\n\n${buildVideoFacadeHtml(info)}\n\n`;
      }
      return match;
    }
  );

  // 5. If this post contains a 3Speak video, remove any standalone static image that is the 3Speak thumbnail
  if (threeSpeakIds.length > 0) {
    // Strip standalone markdown images: ![alt](url)
    result = result.replace(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/gi, (imgMatch, imgUrl) => {
      for (const id of threeSpeakIds) {
        const thumb = activeThumbs[id] || getCached3SpeakData(id)?.thumbnail;
        if (is3SpeakThumbnail(imgUrl, thumb, id)) {
          return ''; // Strip duplicate standalone image
        }
      }
      return imgMatch;
    });

    // Strip standalone HTML images: <img src="url" ... />
    result = result.replace(/<img\s+[^>]*src=["']([^"']+)["'][^>]*\/?>/gi, (imgMatch, imgUrl) => {
      for (const id of threeSpeakIds) {
        const thumb = activeThumbs[id] || getCached3SpeakData(id)?.thumbnail;
        if (is3SpeakThumbnail(imgUrl, thumb, id)) {
          return ''; // Strip duplicate standalone image
        }
      }
      return imgMatch;
    });

    // Strip bare image URLs on line if they match 3Speak thumbnail
    result = result.replace(
      /(?:^|(?:\r?\n)|<center>|<p>)\s*(https?:\/\/[^\s<"']+\.(?:png|jpg|jpeg|gif|webp)(?:\?[^\s<"']*)?)\s*(?:<\/center>|<\/p>|(?:\r?\n)|$)/gim,
      (match, imgUrl) => {
        for (const id of threeSpeakIds) {
          const thumb = activeThumbs[id] || getCached3SpeakData(id)?.thumbnail;
          if (is3SpeakThumbnail(imgUrl, thumb, id)) {
            return '\n';
          }
        }
        return match;
      }
    );
  }

  return result;
}

/**
 * Activate a lazy video facade on click/key by replacing its contents with a player
 * Dedicated own HLS player for 3Speak (NO iframe).
 */
export function activateLazyVideoFacade(facade: HTMLElement) {
  if (facade.querySelector('iframe') || facade.querySelector('video')) return;

  const platform = (facade.getAttribute('data-video-platform') as VideoPlatform) || 'youtube';
  const embedUrlRaw = facade.getAttribute('data-video-embed');
  const originalUrlRaw = facade.getAttribute('data-original-url');
  const videoId = facade.getAttribute('data-video-id') || '';

  let embedUrl = '';
  if (embedUrlRaw) {
    try {
      embedUrl = decodeURIComponent(embedUrlRaw);
    } catch {
      embedUrl = embedUrlRaw;
    }
  }

  let originalUrl = '';
  if (originalUrlRaw) {
    try {
      originalUrl = decodeURIComponent(originalUrlRaw);
    } catch {
      originalUrl = originalUrlRaw;
    }
  }

  if (!embedUrl) {
    if (platform === 'youtube') {
      embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
    } else if (platform === '3speak') {
      embedUrl = `https://play.3speak.tv/embed?v=${encodeURIComponent(videoId)}`;
    } else if (platform === 'bitchute') {
      embedUrl = `https://www.bitchute.com/embed/${videoId}/`;
    }
  }

  // 1. Dedicated HLS video player for 3Speak (NO iframe, using videoUrl manifest .m3u8 and fallbacks)
  if (platform === '3speak') {
    facade.innerHTML = `
      <div class="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-3 z-0">
        <div class="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-xs text-white/90 font-medium tracking-wide">Connecting to 3Speak IPFS stream...</span>
      </div>
    `;

    fetch(`https://play.3speak.tv/api/embed?v=${encodeURIComponent(videoId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!data || !data.success || !data.videoUrl) {
          throw new Error('No video stream manifest returned from 3Speak API');
        }

        const rawSources = [
          data.videoUrl,
          data.videoUrlFallback1,
          data.videoUrlFallback2,
          data.videoUrlFallback3
        ].filter(Boolean) as string[];

        // Expand sources with IPFS gateways
        const sources = buildExpanded3SpeakSources(rawSources);

        facade.innerHTML = '';
        facade.classList.remove('cursor-pointer', 'select-none');
        facade.removeAttribute('tabindex');
        facade.removeAttribute('role');

        const video = document.createElement('video');
        video.controls = true;
        video.playsInline = true;
        video.autoplay = true;
        const posterUrl = data.thumbnail || getCached3SpeakData(videoId)?.thumbnail;
        if (posterUrl) video.poster = posterUrl;
        video.className = 'w-full h-full bg-black rounded-2xl object-contain relative z-10';

        // Add top bar badge for IPFS Node with refined typography
        const topBadge = document.createElement('div');
        topBadge.className = 'absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md text-[11px] font-semibold text-white/95 shadow-md border border-white/10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity';
        topBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-purple-400"></span><span class="ipfs-node-text font-semibold">IPFS Node #1</span>`;

        facade.appendChild(video);
        facade.appendChild(topBadge);

        let hlsInstance: Hls | null = null;
        let networkRetries = 0;

        const updateNodeText = (idx: number) => {
          const textEl = topBadge.querySelector('.ipfs-node-text');
          if (textEl) textEl.textContent = `IPFS Node #${idx + 1} of ${sources.length}`;
        };

        const tryPlaySource = (idx: number) => {
          if (idx >= sources.length) {
            console.error('[3Speak] All IPFS sources failed');
            showStreamError();
            return;
          }

          const src = sources[idx];
          updateNodeText(idx);
          networkRetries = 0;

          if (Hls.isSupported()) {
            if (hlsInstance) {
              hlsInstance.destroy();
              hlsInstance = null;
            }
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: false,
              backBufferLength: 90,
              fragLoadingTimeOut: 15000,
              manifestLoadingTimeOut: 15000,
              fragLoadingMaxRetry: 3,
              manifestLoadingMaxRetry: 3
            });
            hlsInstance = hls;
            hls.loadSource(src);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              const p = video.play();
              if (p !== undefined) {
                p.catch(() => {});
              }
            });

            hls.on(Hls.Events.ERROR, (_, errData) => {
              if (errData.fatal) {
                switch (errData.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    if (networkRetries < 2) {
                      networkRetries++;
                      hls.startLoad();
                    } else {
                      hls.destroy();
                      hlsInstance = null;
                      tryPlaySource(idx + 1);
                    }
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    hls.recoverMediaError();
                    break;
                  default:
                    hls.destroy();
                    hlsInstance = null;
                    tryPlaySource(idx + 1);
                    break;
                }
              }
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = src;
            video.play().catch(() => {});
            video.addEventListener('error', () => {
              tryPlaySource(idx + 1);
            }, { once: true });
          } else {
            showStreamError();
          }
        };

        const showStreamError = () => {
          facade.innerHTML = `
            <div class="w-full h-full bg-slate-950 flex flex-col items-center justify-center p-6 text-center gap-3 rounded-2xl">
              <svg class="w-8 h-8 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p class="text-sm text-slate-300 font-medium">Unable to connect to 3Speak IPFS stream.</p>
              <div class="flex items-center gap-2 mt-2">
                <button type="button" class="retry-btn px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-sm cursor-pointer">
                  Retry stream
                </button>
                <a href="${originalUrl || `https://3speak.tv/watch?v=${videoId}`}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer">
                  Open on 3Speak
                </a>
              </div>
            </div>
          `;
          facade.querySelector('.retry-btn')?.addEventListener('click', () => {
            activateLazyVideoFacade(facade);
          });
        };

        tryPlaySource(0);
      })
      .catch((err) => {
        console.error('[3Speak] Failed to fetch video stream API:', err);
        facade.innerHTML = `
          <div class="w-full h-full bg-slate-950 flex flex-col items-center justify-center p-6 text-center gap-3 rounded-2xl">
            <svg class="w-8 h-8 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p class="text-sm text-slate-300 font-medium">Could not retrieve 3Speak stream manifest.</p>
            <div class="flex items-center gap-2 mt-2">
              <button type="button" class="retry-btn px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-sm cursor-pointer">
                Retry
              </button>
              <a href="${originalUrl || `https://3speak.tv/watch?v=${videoId}`}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer">
                Open on 3Speak
              </a>
            </div>
          </div>
        `;
        facade.querySelector('.retry-btn')?.addEventListener('click', () => {
          activateLazyVideoFacade(facade);
        });
      });

    return;
  }

  // 2. Standard iframe player for YouTube and BitChute
  function mountIframe(srcUrl: string) {
    facade.innerHTML = `
      <div class="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-3 z-0">
        <div class="w-8 h-8 border-3 border-red-500 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-xs text-white/80 font-medium tracking-wide">Loading ${platform}...</span>
      </div>
    `;

    const iframe = document.createElement('iframe');
    iframe.src = srcUrl;
    iframe.className = 'w-full h-full border-0 rounded-2xl shadow-lg relative z-10';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms allow-presentation');
    iframe.title = `${platform} video player`;

    iframe.onload = () => {
      const loader = facade.querySelector('.animate-spin')?.parentElement;
      if (loader) loader.remove();
    };

    facade.appendChild(iframe);
    facade.classList.remove('cursor-pointer', 'select-none');
    facade.removeAttribute('tabindex');
    facade.removeAttribute('role');
  }

  mountIframe(embedUrl);
}

// Global click-to-load delegation for all lazy video facades across the app
if (typeof window !== 'undefined') {
  window.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const facade = target?.closest?.('.nebulosa-lazy-video-facade') as HTMLElement | null;
    if (!facade || facade.querySelector('iframe') || facade.querySelector('video')) return;
    e.preventDefault();
    e.stopPropagation();
    activateLazyVideoFacade(facade);
  }, { capture: true });

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = e.target as HTMLElement;
    const facade = target?.closest?.('.nebulosa-lazy-video-facade') as HTMLElement | null;
    if (!facade || facade.querySelector('iframe') || facade.querySelector('video')) return;
    e.preventDefault();
    e.stopPropagation();
    activateLazyVideoFacade(facade);
  });
}
