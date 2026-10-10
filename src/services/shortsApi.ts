/**
 * SHORTS API SERVICE
 *
 * Powers the Twitter/microblogging "Shorts" feed by retrieving short-form
 * community snaps published to the Hive blockchain under @peak.snaps container posts.
 *
 * Architecture:
 * 1. @peak.snaps posts periodic container posts (depth 0).
 * 2. Community members publish short-form snaps as top-level comments (depth 1).
 * 3. Replies to snaps are subcomments (depth >= 2).
 * 4. As users scroll to the end of a container's snaps, the next container is automatically loaded.
 */

import { hiveRpcCall, HivePost, getDiscussion, getAccountPosts, getFollowedCommentsFeed, getMutedAccounts } from './hiveApi';
import { fetchWithCache, apiCache, CACHE_TTL } from './apiCache';

function hiveTime(value: string | undefined): number {
  if (!value) return 0;
  const safe = value.endsWith('Z') ? value : `${value}Z`;
  const time = new Date(safe).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export interface PeakSnapsContainer {
  author: string;
  permlink: string;
  title: string;
  created: string;
  children: number;
  payout: number;
  is_paidout?: boolean;
}

export interface ContainerSnapsResult {
  container: PeakSnapsContainer;
  snaps: HivePost[];
  discussionMap: Record<string, HivePost>;
}

/**
 * Fetch container posts published by @peak.snaps
 */
function isSnapComment(post: HivePost): boolean {
  return (post.parent_author || '').toLowerCase() === 'peak.snaps';
}

import { getCachedReplies, setCachedReplies } from './shortsCache';

// Maximum age for snap containers (3 to 5 days horizon)
export const MAX_CONTAINER_DAYS = 5;
export const MAX_CONTAINER_AGE_MS = MAX_CONTAINER_DAYS * 24 * 60 * 60 * 1000;

// Official Peak Snaps Community on Hive
export const PEAK_SNAPS_COMMUNITY = 'hive-124838';
export const MAX_REPLIES_DAYS = 3;
export const MAX_REPLIES_AGE_MS = MAX_REPLIES_DAYS * 24 * 60 * 60 * 1000;

/**
 * Checks if a reply post was made inside the Peak Snaps community.
 * Verifies:
 * - community: "hive-124838"
 * - category: "hive-124838"
 * - url: contains "/hive-124838/@peak.snaps/snap-container-"
 * - root_author / parent_author: "peak.snaps"
 * - root_permlink / parent_permlink: starts with "snap-container-"
 */
export function isPeakSnapReply(post: HivePost): boolean {
  if (!post) return false;

  const community = (post.community || '').toLowerCase();
  const category = (post.category || '').toLowerCase();
  const url = (post.url || '').toLowerCase();
  const rootAuthor = (post.root_author || '').toLowerCase();
  const rootPermlink = (post.root_permlink || '').toLowerCase();
  const parentAuthor = (post.parent_author || '').toLowerCase();
  const parentPermlink = (post.parent_permlink || '').toLowerCase();

  // 1. Peak Snaps official community ID check
  if (community === PEAK_SNAPS_COMMUNITY || category === PEAK_SNAPS_COMMUNITY) {
    return true;
  }

  // 2. URL containing /hive-124838/@peak.snaps/snap-container-
  if (
    url.includes(PEAK_SNAPS_COMMUNITY) ||
    url.includes('/@peak.snaps/snap-container-') ||
    url.includes('snap-container-')
  ) {
    return true;
  }

  // 3. Root author or parent author is peak.snaps
  if (rootAuthor === 'peak.snaps' || parentAuthor === 'peak.snaps') {
    return true;
  }

  // 4. Root or parent permlink is a snap-container
  if (rootPermlink.startsWith('snap-container-') || parentPermlink.startsWith('snap-container-')) {
    return true;
  }

  return false;
}

/**
 * Snaps written by people you follow, taken from the followed-comments feed.
 * That feed is already cached; this keeps comments from followed accounts.
 */
export async function loadFollowingSnaps(account: string): Promise<HivePost[]> {
  if (!account) return [];
  const comments = await getFollowedCommentsFeed(account);
  const snapComments = comments.filter(isSnapComment);
  if (snapComments.length > 0) return snapComments;
  return comments.slice(0, 30);
}

/**
 * Replies directed to your snaps/account.
 * Uses bridge.get_account_posts directly with sort="replies", account=<user>, limit=20.
 * Strictly filters to replies belonging to the Peak Snaps community ("hive-124838").
 * Paginates up to 3 days if needed to find snap replies, stopping immediately
 * once older posts are encountered. Results are cached to prevent repeated RPC calls.
 * Does NOT scan containers like the general Shorts feed.
 */
export async function loadRepliesToAccount(
  account: string,
  _limit: number = 20,
  forceRefresh: boolean = false
): Promise<HivePost[]> {
  const me = account.replace(/^@/, '').trim().toLowerCase();
  if (!me) return [];

  if (!forceRefresh) {
    const cached = getCachedReplies(me);
    if (cached) return cached;
  }

  const muted = await getMutedAccounts(me).catch(() => [] as string[]);
  const mutedNames = new Set(muted);

  const now = Date.now();
  const snapReplies: HivePost[] = [];
  const seenPermlinks = new Set<string>();

  let startAuthor: string | undefined = undefined;
  let startPermlink: string | undefined = undefined;
  let page = 0;
  const maxPages = 6; // Safety limit (scans up to 120 replies across pages)

  while (page < maxPages) {
    page++;
    const params: Record<string, any> = {
      account: me,
      limit: 20,
      sort: 'replies'
    };

    if (startAuthor && startPermlink) {
      params.start_author = startAuthor;
      params.start_permlink = startPermlink;
    }

    let batch: HivePost[] = [];
    try {
      const res = await hiveRpcCall<HivePost[]>('bridge.get_account_posts', params);
      batch = Array.isArray(res) ? res : [];
    } catch (err) {
      console.warn(`[loadRepliesToAccount] Failed page ${page}:`, err);
      break;
    }

    if (batch.length === 0) break;

    // When paginating with start_author/start_permlink, the first post is the anchor from the previous page
    const items: HivePost[] = (startAuthor && startPermlink) ? batch.slice(1) : batch;
    if (items.length === 0) break;

    let reached3DayHorizon = false;

    for (const post of items) {
      if (!post || !post.author || !post.permlink) continue;

      const postTime = hiveTime(post.created);
      // Stop examining posts older than 3 days
      if (postTime > 0 && (now - postTime) > MAX_REPLIES_AGE_MS) {
        reached3DayHorizon = true;
        break;
      }

      if (seenPermlinks.has(post.permlink)) continue;
      seenPermlinks.add(post.permlink);

      if (mutedNames.has(post.author.toLowerCase())) continue;

      // Filter: strictly check for peak.snaps community ("hive-124838")
      if (isPeakSnapReply(post)) {
        snapReplies.push(post);
      }
    }

    // Stop paginating if we reached posts older than 3 days or if the batch was smaller than requested limit
    if (reached3DayHorizon || batch.length < 20) {
      break;
    }

    // Advance pagination anchor
    const lastItem: HivePost = items[items.length - 1];
    startAuthor = lastItem.author;
    startPermlink = lastItem.permlink;
  }

  // Sort newest first
  snapReplies.sort((a, b) => hiveTime(b.created) - hiveTime(a.created));

  setCachedReplies(me, snapReplies);
  return snapReplies;
}

export async function getPeakSnapsContainers(
  limit: number = 10,
  startAuthor?: string,
  startPermlink?: string,
  forceRefresh: boolean = false
): Promise<PeakSnapsContainer[]> {
  const cacheKey = `peak_snaps_containers:${limit}:${startAuthor || 'none'}:${startPermlink || 'none'}`;

  return fetchWithCache(
    cacheKey,
    async () => {
      const params: Record<string, any> = {
        sort: 'posts',
        account: 'peak.snaps',
        limit
      };

      if (startAuthor && startPermlink) {
        params.start_author = startAuthor;
        params.start_permlink = startPermlink;
      }

      let posts: any[] = [];
      try {
        posts = await hiveRpcCall<any[]>('bridge.get_account_posts', params);
      } catch (err) {
        console.warn('[getPeakSnapsContainers] RPC call failed:', err);
        return [];
      }
      if (!Array.isArray(posts)) return [];

      // Filter to container posts and map essential properties
      const mappedContainers = posts
        .filter((p) => p && p.permlink && p.permlink.startsWith('snap-container-'))
        .map((p) => ({
          author: p.author || 'peak.snaps',
          permlink: p.permlink,
          title: p.title || 'Snaps Container',
          created: p.created || '',
          children: p.children || 0,
          payout: Number(p.payout) || 0,
          is_paidout: !!p.is_paidout
        }));

      // Keep only containers within 3-5 days
      const now = Date.now();
      const recent = mappedContainers.filter((c) => {
        const time = hiveTime(c.created);
        return time > 0 && (now - time) <= MAX_CONTAINER_AGE_MS;
      });

      // Guard: if all containers are older than 5 days, keep at least the 3 latest containers
      return recent.length > 0 ? recent : mappedContainers.slice(0, 3);
    },
    { ttl: CACHE_TTL.FEED, forceRefresh }
  );
}

/**
 * Fetch all snaps (comments) for a specific container post.
 * The container post itself (depth: 0, author: 'peak.snaps') is strictly excluded.
 * Returns only the top-level user snaps, along with the complete discussion map for subcomments.
 */
export async function getContainerSnaps(
  containerPermlink: string,
  forceRefresh: boolean = false,
  _observer: string = ''
): Promise<ContainerSnapsResult> {
  // Do not forward observer. See getDiscussion.
  const discussion = await getDiscussion('peak.snaps', containerPermlink, forceRefresh);

  const containerKey = `peak.snaps/${containerPermlink}`;
  const rawContainer = discussion[containerKey];

  const container: PeakSnapsContainer = {
    author: 'peak.snaps',
    permlink: containerPermlink,
    title: rawContainer?.title || 'Snaps Container',
    created: rawContainer?.created || '',
    children: rawContainer?.children || 0,
    payout: Number(rawContainer?.payout) || 0,
    is_paidout: !!rawContainer?.is_paidout
  };

  // Filter for top-level snaps: depth === 1, parent_author === 'peak.snaps', exclude depth 0
  const snaps: HivePost[] = [];

  Object.entries(discussion).forEach(([key, post]) => {
    if (!post || !post.author) return;

    // The main container post must NOT appear
    if (post.author === 'peak.snaps' && post.depth === 0) return;

    // Top-level snap comment
    if (post.depth === 1 || post.parent_author === 'peak.snaps') {
      snaps.push(post);
    }
  });

  // Sort snaps newest first (chronological microblog feed)
  snaps.sort((a, b) => hiveTime(b.created) - hiveTime(a.created));

  return {
    container,
    snaps,
    discussionMap: discussion
  };
}

/**
 * Extract subcomments (direct replies) for a given snap from the discussion map
 */
export function getSnapSubcomments(
  snap: HivePost,
  discussionMap: Record<string, HivePost>
): HivePost[] {
  if (!snap.replies || !Array.isArray(snap.replies) || snap.replies.length === 0) {
    // Fallback search in discussionMap where parent_permlink === snap.permlink
    return Object.values(discussionMap).filter(
      (p) => p && p.parent_author === snap.author && p.parent_permlink === snap.permlink
    );
  }

  const subcomments: HivePost[] = [];
  for (const replyKey of snap.replies) {
    const replyPost = discussionMap[replyKey];
    if (replyPost) {
      subcomments.push(replyPost);
    }
  }

  // Sort subcomments in conversational order (oldest to newest)
  subcomments.sort((a, b) => hiveTime(a.created) - hiveTime(b.created));

  return subcomments;
}

export interface ThreadCommentNode {
  comment: HivePost;
  replies: ThreadCommentNode[];
}

/**
 * Recursively build a structured comment tree for a snap or comment
 * from a discussion map. Supports nested comments ("comment of a comment") to arbitrary depth.
 */
export function buildCommentTree(
  parentAuthor: string,
  parentPermlink: string,
  discussionMap: Record<string, HivePost>,
  visited: Set<string> = new Set()
): ThreadCommentNode[] {
  const directReplies: HivePost[] = [];

  // Look up parent in discussionMap to see if replies array is present
  const parentKey = `${parentAuthor}/${parentPermlink}`;
  const parentPost = discussionMap[parentKey];

  if (parentPost && Array.isArray(parentPost.replies) && parentPost.replies.length > 0) {
    for (const replyKey of parentPost.replies) {
      const child = discussionMap[replyKey];
      if (child && !visited.has(`${child.author}/${child.permlink}`)) {
        directReplies.push(child);
      }
    }
  }

  // Also match any child whose parent_author and parent_permlink match
  Object.values(discussionMap).forEach((p) => {
    if (
      p &&
      p.parent_author === parentAuthor &&
      p.parent_permlink === parentPermlink &&
      !visited.has(`${p.author}/${p.permlink}`) &&
      !directReplies.some((d) => d.author === p.author && d.permlink === p.permlink)
    ) {
      directReplies.push(p);
    }
  });

  // Sort direct replies chronologically (oldest to newest)
  directReplies.sort((a, b) => hiveTime(a.created) - hiveTime(b.created));

  // Recursively process each child reply and its nested subcomments
  const tree: ThreadCommentNode[] = [];
  for (const child of directReplies) {
    const key = `${child.author}/${child.permlink}`;
    visited.add(key);
    const childReplies = buildCommentTree(child.author, child.permlink, discussionMap, visited);
    tree.push({
      comment: child,
      replies: childReplies
    });
  }

  return tree;
}

/** Same photo even when one copy is proxied or has a cache query. */
export function imageIdentity(url: string): string {
  let current = url.trim();
  for (let hop = 0; hop < 3; hop++) {
    try {
      const parsed = new URL(current);
      if (parsed.hostname === 'wsrv.nl') {
        const inner = parsed.searchParams.get('url');
        if (!inner) break;
        current = inner.startsWith('http') ? inner : `https://${inner}`;
        continue;
      }
      const wrapped = parsed.pathname.match(/^\/0x0\/(.+)$/);
      if ((parsed.hostname === 'images.hive.blog' || parsed.hostname === 'images.ecency.com') && wrapped) {
        const inner = decodeURIComponent(wrapped[1]);
        current = inner.startsWith('http') ? inner : `https://${inner}`;
        continue;
      }
      return `${parsed.hostname}${decodeURIComponent(parsed.pathname)}`.replace(/\/+$/, '').toLowerCase();
    } catch {
      return current.toLowerCase();
    }
  }
  return current.toLowerCase();
}

export interface HivePostLink {
  author: string;
  permlink: string;
  raw: string;
}

const HIVE_LINK_RE = /https?:\/\/(?:www\.)?(?:peakd\.com|ecency\.com|hive\.blog)\/(?:[a-z0-9-]+\/)?@([a-z0-9.-]+)\/([a-z0-9-]+)/gi;

export function extractHivePostLinks(body: string, self?: { author: string; permlink: string }): HivePostLink[] {
  const seen = new Set<string>();
  const links: HivePostLink[] = [];
  const selfKey = self ? `${self.author.toLowerCase()}/${self.permlink.toLowerCase()}` : '';
  let match: RegExpExecArray | null;
  const source = body || '';
  HIVE_LINK_RE.lastIndex = 0;
  while ((match = HIVE_LINK_RE.exec(source)) !== null) {
    const author = match[1].toLowerCase();
    const permlink = match[2].toLowerCase();
    const key = `${author}/${permlink}`;
    if (key === selfKey || seen.has(key)) continue;
    seen.add(key);
    links.push({ author, permlink, raw: match[0] });
  }
  return links;
}

export function extractHashtags(body: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  const hashRegex = /(?:^|\s)#([a-zA-Z0-9_\u0080-\uFFFF]+)/g;
  let match: RegExpExecArray | null;
  const source = body || '';
  while ((match = hashRegex.exec(source)) !== null) {
    const tag = match[1].normalize('NFKC').toLowerCase();
    if (tag.length < 2 || /^\d+$/.test(tag) || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

/** Keep the first copy of each hashtag in the text. */
export function collapseDuplicateHashtags(body: string): string {
  if (typeof body !== 'string') return '';
  const seen = new Set<string>();
  return body.replace(/(^|\s)#([a-zA-Z0-9_\u0080-\uFFFF]+)/g, (full, lead: string, tag: string) => {
    const key = tag.normalize('NFKC').toLowerCase();
    if (seen.has(key)) return lead;
    seen.add(key);
    return full;
  });
}

/** Drop loaded image URLs and resnap links so the text does not repeat the card. */
export function stripResolvedSnapUrls(body: string, urls: string[]): string {
  if (typeof body !== 'string') return '';
  const exact = new Set(urls.filter(Boolean));
  const keys = new Set(urls.filter(Boolean).map(imageIdentity));
  let next = body.replace(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/gi, (full, url: string) => {
    return exact.has(url) || keys.has(imageIdentity(url)) ? '' : full;
  });
  next = next.replace(/https?:\/\/[^\s<>"')\]]+/gi, (found) => {
    const clean = found.replace(/[),.;]+$/, '');
    const tail = found.slice(clean.length);
    if (exact.has(found) || exact.has(clean) || keys.has(imageIdentity(clean))) return '';
    return clean + tail;
  });
  return next.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Extract image URLs from a Snap markdown body.
 * The same photo is returned once, even if metadata and the body both include it.
 */
export function extractSnapImages(body: string, jsonMetadata?: any): string[] {
  const images: string[] = [];
  const seen = new Set<string>();
  const push = (url: string) => {
    const key = imageIdentity(url);
    if (seen.has(key)) return;
    seen.add(key);
    images.push(url);
  };

  // 1. Check json_metadata image array if available
  if (jsonMetadata) {
    try {
      const meta = typeof jsonMetadata === 'string' ? JSON.parse(jsonMetadata) : jsonMetadata;
      if (Array.isArray(meta.image)) {
        meta.image.forEach((img: any) => {
          if (typeof img === 'string' && img.startsWith('http')) {
            push(img);
          }
        });
      }
    } catch {
      // Ignore parse error
    }
  }

  // 2. Regex for markdown images: ![alt](url)
  const mdRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)/gi;
  let match;
  while ((match = mdRegex.exec(body)) !== null) {
    if (match[1]) push(match[1]);
  }

  // 3. Regex for raw image URLs ending in jpg, jpeg, png, gif, webp
  const urlRegex = /(https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp|svg)(?:\?[^\s<>"']*)?)/gi;
  while ((match = urlRegex.exec(body)) !== null) {
    if (match[1]) push(match[1]);
  }

  // 4. IPFS URLs
  const ipfsRegex = /(https?:\/\/[^\s<>"']*ipfs[^\s<>"']+)/gi;
  while ((match = ipfsRegex.exec(body)) !== null) {
    if (match[1]) push(match[1]);
  }

  // Filter out invalid, deceptive or tracking URLs
  return images.filter((url) => {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase().trim();
    if (!lower.startsWith('http://') && !lower.startsWith('https://')) return false;
    // Exclude tracking pixels, badges, spacer gifs and small icons
    if (lower.includes('1x1') || lower.includes('pixel') || lower.includes('spacer.gif') || lower.includes('badge')) return false;
    return true;
  });
}

/**
 * Clean up microblogging body by stripping image markdown tags
 * so they don't duplicate when rendered in dedicated media cards.
 */
export function cleanSnapBody(body: string): string {
  if (!body) return '';

  return body
    // Remove markdown images: ![...](...)
    .replace(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/gi, '')
    // Remove standalone image URLs
    .replace(/(?:^|\s)(https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s<>"']*)?)(?=\s|$)/gi, '')
    // Remove bot/app footer signatures
    .replace(/<sub>.*?Posted (?:via|using).*?<\/sub>/gi, '')
    .trim();
}
