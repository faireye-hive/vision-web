/**
 * Image URL helpers for shorts.
 *
 * Fake-image protection is the whitelist proxy in `getSafeImageUrl` (wsrv.nl
 * re-encodes to webp). Callers must render that URL only — never the raw host.
 * A hidden Image() preload is intentionally not used: it downloaded every file
 * twice and treated a missing CORS header as a broken image.
 */
import { getSafeImageUrl } from './sanitize';

export interface VerificationResult {
  valid: boolean;
  resolvedUrl: string;
  width?: number;
  height?: number;
  error?: string;
}

export function isPlausibleImageUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  if (/^(javascript|data|blob|vbscript):/i.test(trimmed)) return false;
  if (
    trimmed.includes('pixel') &&
    (trimmed.includes('1x1') || trimmed.includes('spacer') || trimmed.includes('tracking'))
  ) {
    return false;
  }
  return true;
}

export function getHiveProxyUrl(originalUrl: string): string {
  if (!originalUrl) return '';
  if (originalUrl.includes('images.hive.blog') || originalUrl.includes('images.ecency.com')) {
    return originalUrl;
  }
  return `https://images.hive.blog/0x0/${encodeURI(originalUrl)}`;
}

export function getEcencyProxyUrl(originalUrl: string): string {
  if (!originalUrl) return '';
  if (originalUrl.includes('images.ecency.com')) {
    return originalUrl;
  }
  return `https://images.ecency.com/0x0/${encodeURI(originalUrl)}`;
}

/**
 * URL safe to put in an <img>. Already-proxied wsrv links pass through.
 * Anything else must be on the host whitelist and is rewritten through the proxy.
 * Returns null when the origin is not allowed — the raw URL must not be loaded.
 */
export function resolveProtectedImageUrl(rawUrl: string, width = 1200): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!isPlausibleImageUrl(trimmed)) return null;
  if (/^https:\/\/wsrv\.nl\//i.test(trimmed)) return trimmed;
  return getSafeImageUrl(trimmed, { width });
}
