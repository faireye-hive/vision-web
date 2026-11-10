import { HAFSQL_BASE } from './savedLists';
import { getCleanSnapTextLength } from '../utils/snapText';
import { KeychainService } from './keychain';
export const JSON_SHORTS_APP = 'nebulosa-shorts';
export const JSON_SHORTS_FEED = 'nebulosa.shorts.v1';
export const JSON_SHORTS_CHANNELS = 'nebulosa.channels.v1';
export interface SnapRef { author: string; id: string }
interface BaseEvent { app: typeof JSON_SHORTS_APP; version: 1; id: string; actor: string }
export interface JsonSnap extends BaseEvent { type: 'snap'; root: SnapRef; parent: SnapRef | null; channel: string | null; body: string }
export interface JsonResnap extends BaseEvent { type: 'resnap'; root: SnapRef; target: SnapRef; channel: string | null }
export interface JsonVote extends BaseEvent { type: 'vote'; root: SnapRef; target: SnapRef; value: -1 | 0 | 1 }
export interface JsonChannel extends BaseEvent { type: 'channel'; slug: string; title: string; description: string }
export type JsonContent = JsonSnap | JsonResnap;
export type JsonShortEvent = JsonContent | JsonVote | JsonChannel;
export interface IndexedEvent { event: JsonShortEvent; operationId: string; timestamp: string; pending?: boolean }
export interface JsonThread { root: JsonContent; contents: Map<string, JsonContent>; replies: Map<string, JsonSnap[]>; votes: Map<string, Map<string, number>>; resnaps: Set<string> }
export const snapRefKey = (ref: SnapRef) => `${ref.author}/${ref.id}`;
export const contentRef = (event: JsonContent): SnapRef => ({ author: event.actor, id: event.id });
const account = (value: unknown): value is string => typeof value === 'string' && /^[a-z][a-z0-9.-]{2,15}$/.test(value);
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
export const validSnapRef = (value: any): value is SnapRef => value && account(value.author) && uuid(value.id) && Object.keys(value).every(key => ['author', 'id'].includes(key));
export const parseSnapRef = (value: string): SnapRef | null => {
  const parts = value.split('/');
  const [author, id] = parts;
  const ref = { author, id };
  return parts.length === 2 && validSnapRef(ref) ? ref : null;
};
export const channelSlug = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48).replace(/-$/, '');
export const validChannelKey = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const parts = value.split('/');
  const [owner, slug] = parts;
  return parts.length === 2 && account(owner) && !!slug && slug.length <= 48 && channelSlug(slug) === slug;
};
export function validJsonShortEvent(value: any): value is JsonShortEvent {
  if (!value || value.app !== JSON_SHORTS_APP || value.version !== 1 || !uuid(value.id) || !account(value.actor)) return false;
  const base = ['app', 'version', 'id', 'actor', 'type'];
  const keys = (extra: string[]) => Object.keys(value).every(key => [...base, ...extra].includes(key));
  if (value.type === 'channel') return keys(['slug', 'title', 'description']) && typeof value.slug === 'string' && !!value.slug && channelSlug(value.slug) === value.slug
    && typeof value.title === 'string' && !!value.title.trim() && value.title.length <= 80 && typeof value.description === 'string' && value.description.length <= 300;
  if (!validSnapRef(value.root)) return false;
  if (value.type === 'vote') return keys(['root', 'target', 'value']) && validSnapRef(value.target) && [-1, 0, 1].includes(value.value);
  if (value.channel !== null && !validChannelKey(value.channel)) return false;
  if (value.type === 'resnap') return keys(['root', 'target', 'channel']) && validSnapRef(value.target) && value.root.author === value.actor && value.root.id === value.id && snapRefKey(value.root) !== snapRefKey(value.target);
  if (value.type !== 'snap' || !keys(['root', 'parent', 'channel', 'body']) || typeof value.body !== 'string' || !value.body.trim()
    || new TextEncoder().encode(value.body).length > 6000 || getCleanSnapTextLength(value.body) > 300) return false;
  if (value.parent === null) return value.root.author === value.actor && value.root.id === value.id;
  return validSnapRef(value.parent) && snapRefKey(value.parent) !== `${value.actor}/${value.id}`;
}
export function encodeJsonShortEvent(event: JsonShortEvent): string {
  if (!validJsonShortEvent(event)) throw new Error('Invalid snap event. Use up to 300 visible characters and keep the message under 6,000 bytes.');
  const json = JSON.stringify(event);
  if (new TextEncoder().encode(json).length > 8192) throw new Error('This event exceeds Hive’s size limit.');
  return json;
}
async function hashedId(prefix: string, key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return prefix + Array.from(new Uint8Array(digest)).slice(0, 10).map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export const jsonThreadId = (ref: SnapRef) => hashedId('neb.thread.', snapRefKey(ref));
export const jsonChannelId = (key: string) => hashedId('neb.channel.', key);
export async function eventDestinations(event: JsonShortEvent): Promise<string[]> {
  if (event.type === 'channel') return [JSON_SHORTS_CHANNELS];
  if (event.type === 'vote' || event.type === 'snap' && event.parent) return [await jsonThreadId(event.root)];
  const destinations = [JSON_SHORTS_FEED, await jsonThreadId(event.root)];
  if (event.channel) destinations.push(await jsonChannelId(event.channel));
  if (event.type === 'resnap') destinations.push(await jsonThreadId(event.target));
  return [...new Set(destinations)];
}
export async function publishJsonShortEvent(event: JsonShortEvent, stillCurrent: () => boolean = () => true): Promise<IndexedEvent> {
  const json = encodeJsonShortEvent(event);
  const ids = await eventDestinations(event);
  if (!stillCurrent()) throw new Error('The signed-in account changed. Please try again.');
  const operations = ids.map(id => ['custom_json', { required_auths: [], required_posting_auths: [event.actor], id, json }]);
  const response = await KeychainService.publishShortEvents(event.actor, operations);
  if (!response.success) throw new Error(response.message || response.error || 'The operation was not published.');
  return { event, operationId: `pending:${event.actor}/${event.id}`, timestamp: new Date().toISOString(), pending: true };
}
export function readJsonShortOperation(row: any, customId: string): IndexedEvent | null {
  if (row?.custom_id !== customId || !/^\d+$/.test(String(row.id)) || typeof row.timestamp !== 'string' || !Number.isFinite(Date.parse(row.timestamp))) return null;
  try {
    const event = JSON.parse(row.json);
    if (!validJsonShortEvent(event) || ![...(Array.isArray(row.required_posting_auths) ? row.required_posting_auths : []), ...(Array.isArray(row.required_auths) ? row.required_auths : [])].includes(event.actor)) return null;
    return { event, operationId: String(row.id), timestamp: row.timestamp };
  } catch { return null; }
}
// Limit public RPC fan-out when a feed renders several conversations.
let activeRequests = 0;
const queue: Array<() => void> = [];
async function acquire() { if (activeRequests >= 4) await new Promise<void>(resolve => queue.push(resolve)); else activeRequests++; }
function release() { const next = queue.shift(); if (next) next(); else activeRequests--; }
export async function loadJsonEventPage(id: string, cursor = '', limit = 20): Promise<{ events: IndexedEvent[]; cursor: string; hasMore: boolean }> {
  await acquire();
  try {
    const url = new URL(`${HAFSQL_BASE}/operations/custom_json/${encodeURIComponent(id)}`);
    url.searchParams.set('limit', String(limit)); if (cursor) url.searchParams.set('start', cursor);
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Could not load no-rewards Shorts. Please try again.');
    const rows = await response.json(); if (!Array.isArray(rows)) throw new Error('Invalid Shorts response.');
    const ids = rows.map(row => String(row.id)).filter(value => /^\d+$/.test(value));
    const oldest = ids.reduce((min, value) => !min || BigInt(value) < BigInt(min) ? value : min, '');
    const next = oldest && BigInt(oldest) > 0n ? (BigInt(oldest) - 1n).toString() : '';
    if (cursor && next && BigInt(next) >= BigInt(cursor)) throw new Error('Shorts pagination did not advance.');
    return { events: rows.map(row => readJsonShortOperation(row, id)).filter((event): event is IndexedEvent => !!event), cursor: next, hasMore: rows.length === limit && !!next };
  } finally { release(); }
}
export function mergeJsonEvents(existing: IndexedEvent[], incoming: IndexedEvent[]): IndexedEvent[] {
  const map = new Map<string, IndexedEvent>();
  // First signed event establishes an immutable UUID for this signer.
  const all = [...existing, ...incoming].sort(compareEvents);
  for (const item of all) {
    const key = `${item.event.actor}/${item.event.id}`;
    const old = map.get(key);
    if (!old || old.pending && !item.pending && JSON.stringify(old.event) === JSON.stringify(item.event)) map.set(key, item);
  }
  return [...map.values()].sort(compareEvents);
}
function compareEvents(a: IndexedEvent, b: IndexedEvent): number {
  if (a.pending !== b.pending) return a.pending ? 1 : -1;
  if (a.pending) return a.timestamp.localeCompare(b.timestamp) || a.operationId.localeCompare(b.operationId);
  return BigInt(a.operationId) > BigInt(b.operationId) ? 1 : BigInt(a.operationId) < BigInt(b.operationId) ? -1 : 0;
}
export function projectJsonThread(rootRef: SnapRef, history: IndexedEvent[]): JsonThread | null {
  const rootKey = snapRefKey(rootRef);
  const ordered = mergeJsonEvents([], history);
  const root = ordered.map(item => item.event).find((event): event is JsonContent => (event.type === 'snap' && !event.parent || event.type === 'resnap') && event.actor === rootRef.author && event.id === rootRef.id);
  if (!root) return null;
  const result: JsonThread = { root, contents: new Map([[rootKey, root]]), replies: new Map(), votes: new Map(), resnaps: new Set() };
  const rowsByRef = new Map(ordered.map(item => [`${item.event.actor}/${item.event.id}`, item]));
  const ownRootEvent = rowsByRef.get(rootKey)!;
  // Index parents before their descendants, regardless of reverse-page arrival order.
  for (const item of ordered) {
    const event = item.event;
    if (event.type === 'snap' && event.parent && event.channel === root.channel && snapRefKey(event.root) === rootKey && result.contents.has(snapRefKey(event.parent)) && compareEvents(item, ownRootEvent) > 0) {
      const parentKey = snapRefKey(event.parent);
      const parentRow = rowsByRef.get(snapRefKey(event.parent));
      if (parentRow && compareEvents(item, parentRow) <= 0) continue;
      result.contents.set(`${event.actor}/${event.id}`, event);
      result.replies.set(parentKey, [...(result.replies.get(parentKey) || []), event]);
    }
    if (event.type === 'vote' && snapRefKey(event.root) === rootKey && result.contents.has(snapRefKey(event.target))) {
      const targetRow = rowsByRef.get(snapRefKey(event.target));
      if (!targetRow || compareEvents(item, targetRow) <= 0) continue;
      const votes = result.votes.get(snapRefKey(event.target)) || new Map(); votes.set(event.actor, event.value); result.votes.set(snapRefKey(event.target), votes);
    }
    if (event.type === 'resnap' && snapRefKey(event.target) === rootKey && compareEvents(item, ownRootEvent) > 0) result.resnaps.add(event.actor);
  }
  return result;
}
export async function loadJsonThread(root: SnapRef): Promise<IndexedEvent[]> {
  const id = await jsonThreadId(root); let cursor = ''; let all: IndexedEvent[] = [];
  for (let page = 0; page < 100; page++) {
    const result = await loadJsonEventPage(id, cursor, 100);
    all = mergeJsonEvents(all, result.events.filter(item => {
      const event = item.event;
      return event.type !== 'channel' && (snapRefKey(event.root) === snapRefKey(root) || event.type === 'resnap' && snapRefKey(event.target) === snapRefKey(root));
    }));
    if (!result.hasMore) return all;
    cursor = result.cursor;
  }
  throw new Error('This conversation is too large to load completely. Reactions are unavailable until a dedicated index is added.');
}
export async function loadJsonChannels(): Promise<IndexedEvent[]> {
  let all: IndexedEvent[] = []; let cursor = '';
  for (let page = 0; page < 50; page++) {
    const result = await loadJsonEventPage(JSON_SHORTS_CHANNELS, cursor, 100);
    all = mergeJsonEvents(all, result.events.filter(item => item.event.type === 'channel'));
    if (!result.hasMore) return all;
    cursor = result.cursor;
  }
  throw new Error('The channel directory is too large to load completely.');
}
export function newJsonEvent(actor: string): BaseEvent { return { app: JSON_SHORTS_APP, version: 1 as const, id: crypto.randomUUID(), actor }; }
export function jsonSnapLink(root: SnapRef, channel?: string | null) {
  const params = new URLSearchParams({ snap: snapRefKey(root) });
  if (channel) params.set('channel', channel);
  return `/snaps?${params}`;
}
