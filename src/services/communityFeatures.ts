import { CATEGORY_DEFINITIONS } from '../data/categorySubtopics';
import { getCommunity, getPost, HiveCommunity, HivePost } from './hiveApi';
import { KeychainService } from './keychain';
import { HAFSQL_BASE, listSlug } from './savedLists';

export interface CommunityOption { id: string; label: string }
export interface CommunitySettings { categories: CommunityOption[]; flairs: CommunityOption[]; subtags: string[] }
export interface CommunityFeatures { community: HiveCommunity; settings: CommunitySettings; configured: boolean }
export interface CommunityOperation { id: string; custom_id: string; required_posting_auths?: string[]; required_auths?: string[]; json: string }
export const COMMUNITY_FEATURES_CHANGED = 'nebulosa:community-features-changed';
export const COMMUNITY_FLAIR_CHANGED = 'nebulosa:community-flair-changed';
const validCommunity = (name: string) => /^hive-\d{1,12}$/.test(name);
const validSlug = (id: unknown): id is string => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,31}$/.test(id);
export const settingsId = (community: string) => `neb.community.${community}`;
export const postCommunity = (post: HivePost) => [post.community, post.category].find(name => name && validCommunity(name)) || '';
export function communityRole(community: HiveCommunity, actor: string) {
  return community.team?.find(([name]) => name === actor)?.[1] || 'guest';
}
export const canConfigureCommunity = (community: HiveCommunity, actor: string) => ['owner', 'admin'].includes(communityRole(community, actor));
export const canModerateCommunity = (community: HiveCommunity, actor: string) => ['owner', 'admin', 'mod'].includes(communityRole(community, actor));
export function defaultCommunitySettings(): CommunitySettings {
  return {
    categories: CATEGORY_DEFINITIONS.map(item => ({ id: item.tag, label: item.label })),
    flairs: ['Discussion', 'Question', 'Tutorial', 'News', 'Showcase'].map(label => ({ id: listSlug(label), label })),
    subtags: []
  };
}
export function validCommunitySettings(value: any): value is CommunitySettings {
  const options = (items: any, min: number) => Array.isArray(items) && items.length >= min && items.length <= 30 &&
    items.every(item => item && validSlug(item.id) && typeof item.label === 'string' && item.label.trim().length > 0 && item.label.length <= 40) &&
    new Set(items.map(item => item.id)).size === items.length;
  return value && options(value.categories, 1) && options(value.flairs, 0) && Array.isArray(value.subtags) && value.subtags.length <= 30 &&
    value.subtags.every(validSlug) && new Set(value.subtags).size === value.subtags.length;
}
export function readCommunityEvent(row: CommunityOperation, id: string, community: string): any | null {
  try {
    const value = JSON.parse(row.json);
    if (row.custom_id !== id || value.app !== 'nebulosa-community' || value.version !== 1 || value.community !== community ||
      typeof value.actor !== 'string' || ![...(row.required_posting_auths || []), ...(row.required_auths || [])].includes(value.actor)) return null;
    return value;
  } catch { return null; }
}
async function latestEvent(id: string, community: string, accept: (event: any) => boolean): Promise<any | null> {
  let cursor = '';
  for (let page = 0; page < 100; page++) {
    const url = new URL(`${HAFSQL_BASE}/operations/custom_json/${encodeURIComponent(id)}`);
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('start', cursor);
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Could not load community settings or flairs. Please retry.');
    const rows: CommunityOperation[] = await response.json();
    if (!Array.isArray(rows) || rows.some(row => !/^\d+$/.test(String(row.id)))) throw new Error('Invalid community history response.');
    rows.sort((a, b) => BigInt(a.id) > BigInt(b.id) ? -1 : BigInt(a.id) < BigInt(b.id) ? 1 : 0);
    for (const row of rows) {
      const value = readCommunityEvent(row, id, community);
      if (value && accept(value)) return value;
    }
    if (rows.length < 100) return null;
    const next = (BigInt(rows.at(-1)!.id) - 1n).toString();
    if (next === cursor) throw new Error('Community history pagination did not advance.');
    cursor = next;
  }
  throw new Error('Community history is too large to verify. Please retry later.');
}
const cache = new Map<string, { value: CommunityFeatures; expires: number }>();
const pending = new Map<string, Promise<CommunityFeatures>>();
export async function loadCommunityFeatures(name: string, refresh = false): Promise<CommunityFeatures> {
  if (!validCommunity(name)) throw new Error('Invalid community.');
  const hit = cache.get(name);
  if (!refresh && hit && hit.expires > Date.now()) return hit.value;
  if (pending.has(name)) return pending.get(name)!;
  const request = (async () => {
    const community = await getCommunity(name, refresh);
    if (!community) throw new Error('Could not verify the community team. Please retry.');
    const event = await latestEvent(settingsId(name), name, value => value.type === 'settings' && canConfigureCommunity(community, value.actor) && validCommunitySettings(value.settings));
    const value = { community, settings: event?.settings || defaultCommunitySettings(), configured: !!event };
    // A successful local save supersedes a read that started before it.
    if (cache.get(name) !== hit && cache.has(name)) return cache.get(name)!.value;
    cache.set(name, { value, expires: Date.now() + 60000 });
    return value;
  })();
  pending.set(name, request);
  try { return await request; } finally { pending.delete(name); }
}
function encodeEvent(value: unknown) {
  const json = JSON.stringify(value);
  if (new TextEncoder().encode(json).length > 8192) throw new Error('Community settings are too large.');
  return json;
}
function announce(community: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(COMMUNITY_FEATURES_CHANGED, { detail: community }));
}
export async function saveCommunitySettings(actor: string, name: string, settings: CommunitySettings) {
  const community = await getCommunity(name, true);
  if (!community || !canConfigureCommunity(community, actor)) throw new Error('Only community owners and admins can change these settings.');
  if (!validCommunitySettings(settings)) throw new Error('Use 1–30 unique categories, up to 30 flairs and 30 subtags. Labels can have up to 40 characters; tags and IDs up to 32.');
  const result = await KeychainService.broadcastCustomJson(actor, settingsId(name), 'Posting', encodeEvent({ app: 'nebulosa-community', version: 1, type: 'settings', actor, community: name, settings }), 'Save community categories and flairs');
  if (!result.success) throw new Error(result.message || result.error || 'Settings were not saved.');
  cache.set(name, { value: { community, settings, configured: true }, expires: Date.now() + 60000 });
  announce(name);
}
export function communityPostMetadata(post: HivePost): { category: string; flair: string | null } {
  try {
    const meta = typeof post.json_metadata === 'string' ? JSON.parse(post.json_metadata) : post.json_metadata;
    const value = meta?.nebulosa?.community;
    if (value?.name !== postCommunity(post)) return { category: '', flair: null };
    return { category: validSlug(value.category) ? value.category : '', flair: validSlug(value.flair) ? value.flair : null };
  } catch { return { category: '', flair: null }; }
}
export async function postFlairId(post: Pick<HivePost, 'author' | 'permlink'>) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${post.author}/${post.permlink}`));
  return `neb.flair.${Array.from(new Uint8Array(hash)).slice(0, 11).map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
}
export function validPostFlairEvent(value: any, post: HivePost, community: HiveCommunity): boolean {
  return !post.parent_author && postCommunity(post) === community.name && value.community === community.name &&
    value.type === 'flair' && value.author === post.author && value.permlink === post.permlink &&
    (value.flair === null || validSlug(value.flair)) &&
    (value.actor === post.author || value.flair === null && canModerateCommunity(community, value.actor));
}
const flairCache = new Map<string, { flair: string | null; expires: number }>();
const pendingFlairs = new Map<string, Promise<string | null>>();
export async function loadPostFlair(post: HivePost, community: HiveCommunity): Promise<string | null> {
  const id = await postFlairId(post);
  const hit = flairCache.get(id);
  if (hit && hit.expires > Date.now()) return hit.flair;
  if (pendingFlairs.has(id)) return pendingFlairs.get(id)!;
  const request = (async () => {
    const event = await latestEvent(id, community.name, value => validPostFlairEvent(value, post, community));
    const flair = event ? event.flair : communityPostMetadata(post).flair;
    if (flairCache.get(id) !== hit && flairCache.has(id)) return flairCache.get(id)!.flair;
    flairCache.set(id, { flair, expires: Date.now() + 60000 });
    return flair;
  })();
  pendingFlairs.set(id, request);
  try { return await request; } finally { pendingFlairs.delete(id); }
}
export async function savePostFlair(actor: string, post: HivePost, flair: string | null) {
  const name = postCommunity(post);
  const [{ community, settings }, canonical] = await Promise.all([loadCommunityFeatures(name, true), getPost(post.author, post.permlink, actor, true)]);
  if (!canonical || postCommunity(canonical) !== name) throw new Error('Could not verify this post belongs to the community.');
  const event = { app: 'nebulosa-community', version: 1, type: 'flair', community: name, actor, author: post.author, permlink: post.permlink, flair };
  if (!validPostFlairEvent(event, canonical, community)) throw new Error('Only the author can choose a flair. Community moderators can remove it.');
  if (flair !== null && !settings.flairs.some(item => item.id === flair)) throw new Error('This flair is no longer available. Reopen the selector.');
  const id = await postFlairId(post);
  const result = await KeychainService.broadcastCustomJson(actor, id, 'Posting', encodeEvent(event), flair ? 'Change post flair' : 'Remove post flair');
  if (!result.success) throw new Error(result.message || result.error || 'Flair was not saved.');
  flairCache.set(id, { flair, expires: Date.now() + 60000 });
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(COMMUNITY_FLAIR_CHANGED, { detail: `${name}/${post.author}/${post.permlink}` }));
}
export function communityPublishMetadata(name: string, category: string, flair: string | null, settings: CommunitySettings) {
  if (!settings.categories.some(item => item.id === category)) throw new Error('Choose a category before publishing to this community.');
  if (flair !== null && !settings.flairs.some(item => item.id === flair)) throw new Error('Choose an available community flair.');
  return { name, category, flair };
}
