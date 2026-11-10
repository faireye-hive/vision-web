export interface SavedPost { author: string; permlink: string; title?: string }
export interface SavedList { id: string; owner: string; slug: string; title: string; posts: SavedPost[]; revision: number; pendingRegistration?: boolean }
export interface ListDescriptor { id: string; slug: string; title: string }
export interface ListCatalog { app: 'nebulosa'; version: 1; kind: 'catalog'; owner: string; revision: number; lists: ListDescriptor[] }
interface Operation { id: string; custom_id: string; required_posting_auths: string[]; required_auths: string[]; json: string }
export const HAFSQL_BASE = 'https://rpc.mahdiyari.info/hafsql';
export const accountName = (name: string) => name.trim().replace(/^@/, '').toLowerCase();
export const listSlug = (name: string) => name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
export async function customListId(owner: string, slug?: string): Promise<string> {
  const logical = slug ? `nebulosa.${owner}.lists.${slug}` : `nebulosa.${owner}.mylists`;
  if (new TextEncoder().encode(logical).length <= 32) return logical;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(logical));
  return `neb.${slug ? 'list' : 'index'}.${Array.from(new Uint8Array(hash)).slice(0, 10).map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
}
export function encodeListPayload(payload: unknown): string {
  const json = JSON.stringify(payload);
  if (new TextEncoder().encode(json).length > 8192) throw new Error('This list is full. Create another list to save more posts.');
  return json;
}
export function listPayload(list: SavedList) {
  return { app: 'nebulosa', version: 1, kind: 'list', owner: list.owner, id: list.id, slug: list.slug, title: list.title, posts: list.posts, revision: list.revision };
}
export function decodeSignedPayload(row: Operation, owner: string, id: string): any | null {
  if (row.custom_id !== id || ![...(row.required_posting_auths || []), ...(row.required_auths || [])].includes(owner)) return null;
  try {
    const value = JSON.parse(row.json);
    if (value?.app !== 'nebulosa' || value.version !== 1 || value.owner !== owner || !Number.isSafeInteger(value.revision) || value.revision < 0) return null;
    return value;
  } catch { return null; }
}
const validDescriptor = (value: any): value is ListDescriptor => value && typeof value.id === 'string' && value.id.length <= 32 && typeof value.slug === 'string' && !!value.slug && listSlug(value.slug) === value.slug && typeof value.title === 'string' && value.title.length > 0 && value.title.length <= 80;
export function validList(value: any): value is SavedList {
  const posts = value?.posts;
  return validDescriptor(value) && Array.isArray(posts) && posts.every((post: any) => post && typeof post.author === 'string' && /^[a-z][a-z0-9.-]{2,15}$/.test(post.author) && typeof post.permlink === 'string' && /^[a-z0-9-]{1,256}$/.test(post.permlink) && (post.title === undefined || typeof post.title === 'string' && post.title.length <= 300));
}
async function latestPayload(owner: string, id: string, accept: (value: any) => boolean): Promise<any | null> {
  let cursor = '';
  for (let page = 0; page < 100; page++) {
    const url = new URL(`${HAFSQL_BASE}/operations/custom_json/${encodeURIComponent(id)}`);
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('start', cursor);
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Could not load lists from HafSQL. Please try again.');
    const rows: Operation[] = await response.json();
    if (!Array.isArray(rows)) throw new Error('Invalid HafSQL response.');
    // IDs exceed Number.MAX_SAFE_INTEGER: sort as bigint, never as Number.
    rows.sort((a, b) => BigInt(a.id) > BigInt(b.id) ? -1 : BigInt(a.id) < BigInt(b.id) ? 1 : 0);
    for (const row of rows) {
      const value = decodeSignedPayload(row, owner, id);
      if (value && accept(value)) return value;
    }
    if (rows.length < 100) return null;
    const last = rows.at(-1)!.id;
    if (last === cursor) throw new Error('HafSQL pagination did not advance. Please try again.');
    cursor = (BigInt(last) - 1n).toString();
  }
  throw new Error('Could not find the latest signed list within the history search limit.');
}
export async function loadSavedLists(owner: string): Promise<SavedList[]> {
  const id = await customListId(owner);
  const catalog = await latestPayload(owner, id, value => value.kind === 'catalog' && Array.isArray(value.lists) && value.lists.every(validDescriptor)) as ListCatalog | null;
  if (!catalog) return [];
  const lists: SavedList[] = [];
  const descriptors = [...new Map(catalog.lists.map(item => [item.id, item])).values()];
  for (let offset = 0; offset < descriptors.length; offset += 4) {
    const results = await Promise.all(descriptors.slice(offset, offset + 4).map(async descriptor => {
      if (await customListId(owner, descriptor.slug) !== descriptor.id) throw new Error('Invalid list identifier in catalog.');
      const value = await latestPayload(owner, descriptor.id, item => item.kind === 'list' && item.id === descriptor.id && item.slug === descriptor.slug && validList(item));
      if (!value) throw new Error('A list is still being indexed by HafSQL. Please retry shortly.');
      return value as SavedList;
    }));
    lists.push(...results);
  }
  return lists;
}
