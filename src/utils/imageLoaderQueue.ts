/**
 * Controlled Image Loading Queue & Verification Engine
 * 
 * Prevents CDN rate-limiting by throttling concurrent image requests (max 3 at once),
 * lazily loads upon viewport intersection, verifies that the asset is a genuine,
 * non-deceptive image (not a 1x1 tracking pixel or broken HTML payload), and provides
 * fallback Hive CDN proxies if direct hostings fail.
 */

interface VerificationResult {
  valid: boolean;
  resolvedUrl: string;
  width?: number;
  height?: number;
  error?: string;
}

// In-memory cache to avoid re-verifying already checked image URLs
const verificationCache = new Map<string, VerificationResult>();

// Queue management
type QueueItem = {
  url: string;
  resolve: (res: VerificationResult) => void;
  reject: (err: any) => void;
};

const queue: QueueItem[] = [];
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 5;
const REQUEST_STAGGER_MS = 30;

/**
 * Validates whether a URL looks like a plausible and safe image source
 */
export function isPlausibleImageUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();

  // Only allow http:// and https:// protocols
  if (!/^https?:\/\//i.test(trimmed)) return false;

  // Block suspicious or dangerous payload patterns
  if (/^(javascript|data|blob|vbscript):/i.test(trimmed)) return false;

  // Filter out known 1x1 tracking pixel beacons or ad tracking URLs
  if (
    trimmed.includes('pixel') &&
    (trimmed.includes('1x1') || trimmed.includes('spacer') || trimmed.includes('tracking'))
  ) {
    return false;
  }

  return true;
}

/**
 * Generates an alternative Hive CDN proxy URL if direct origin fails or rate-limits
 */
export function getHiveProxyUrl(originalUrl: string): string {
  if (!originalUrl) return '';
  // Avoid double-proxying
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
 * Attempts to load an image element and verifies its genuine dimensions
 */
function testImageLoad(url: string, timeoutMs = 12000): Promise<{ ok: boolean; img?: HTMLImageElement; error?: string }> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve({ ok: false, error: 'SSR environment' });
      return;
    }

    const img = new Image();
    let isDone = false;

    const timer = setTimeout(() => {
      if (!isDone) {
        isDone = true;
        img.src = '';
        resolve({ ok: false, error: 'Image request timed out' });
      }
    }, timeoutMs);

    img.onload = () => {
      if (isDone) return;
      isDone = true;
      clearTimeout(timer);

      // Verify that it is a genuine image with valid non-zero dimensions
      // Disallow 1x1 tracking pixels or zero-dimension fake assets
      const w = img.naturalWidth || 0;
      const h = img.naturalHeight || 0;

      if (w <= 1 || h <= 1) {
        resolve({
          ok: false,
          img,
          error: 'Deceptive or invalid image asset (less than 2px dimensions, likely a tracking pixel)'
        });
        return;
      }

      resolve({ ok: true, img });
    };

    img.onerror = () => {
      if (isDone) return;
      isDone = true;
      clearTimeout(timer);
      resolve({ ok: false, error: 'Image failed to load or host rejected connection' });
    };

    // Begin load
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

/**
 * Internal runner that drains the queue while respecting concurrency limits
 */
function processQueue() {
  if (activeRequests >= MAX_CONCURRENT_REQUESTS || queue.length === 0) {
    return;
  }

  const item = queue.shift();
  if (!item) return;

  activeRequests++;

  (async () => {
    const { url, resolve } = item;

    // Check cache first
    if (verificationCache.has(url)) {
      activeRequests--;
      resolve(verificationCache.get(url)!);
      setTimeout(processQueue, REQUEST_STAGGER_MS);
      return;
    }

    // Step 1: Plausibility check
    if (!isPlausibleImageUrl(url)) {
      const res: VerificationResult = {
        valid: false,
        resolvedUrl: url,
        error: 'URL is not a valid or safe image link'
      };
      verificationCache.set(url, res);
      activeRequests--;
      resolve(res);
      setTimeout(processQueue, REQUEST_STAGGER_MS);
      return;
    }

    // Step 2: Try direct load
    let test = await testImageLoad(url, 9000);

    // Step 3: If direct load failed and wasn't already a proxy, try Hive proxy
    if (!test.ok && !url.includes('images.hive.blog') && !url.includes('images.ecency.com')) {
      const proxyUrl = getHiveProxyUrl(url);
      test = await testImageLoad(proxyUrl, 9000);
      if (test.ok && test.img) {
        const res: VerificationResult = {
          valid: true,
          resolvedUrl: proxyUrl,
          width: test.img.naturalWidth,
          height: test.img.naturalHeight
        };
        verificationCache.set(url, res);
        activeRequests--;
        resolve(res);
        setTimeout(processQueue, REQUEST_STAGGER_MS);
        return;
      }

      // Step 4: If Hive proxy failed, try Ecency proxy
      const ecencyUrl = getEcencyProxyUrl(url);
      test = await testImageLoad(ecencyUrl, 9000);
      if (test.ok && test.img) {
        const res: VerificationResult = {
          valid: true,
          resolvedUrl: ecencyUrl,
          width: test.img.naturalWidth,
          height: test.img.naturalHeight
        };
        verificationCache.set(url, res);
        activeRequests--;
        resolve(res);
        setTimeout(processQueue, REQUEST_STAGGER_MS);
        return;
      }
    }

    if (test.ok && test.img) {
      const res: VerificationResult = {
        valid: true,
        resolvedUrl: url,
        width: test.img.naturalWidth,
        height: test.img.naturalHeight
      };
      verificationCache.set(url, res);
      activeRequests--;
      resolve(res);
    } else {
      const res: VerificationResult = {
        valid: false,
        resolvedUrl: url,
        error: test.error || 'Asset is not a valid genuine image'
      };
      verificationCache.set(url, res);
      activeRequests--;
      resolve(res);
    }

    setTimeout(processQueue, REQUEST_STAGGER_MS);
  })();
}

/**
 * Enqueues an image verification request with controlled concurrency.
 */
export function enqueueImageVerification(url: string): Promise<VerificationResult> {
  // If already cached, resolve immediately without queueing
  if (verificationCache.has(url)) {
    return Promise.resolve(verificationCache.get(url)!);
  }

  return new Promise((resolve, reject) => {
    queue.push({ url, resolve, reject });
    processQueue();
  });
}
