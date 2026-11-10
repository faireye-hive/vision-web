import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeychainService } from './keychain';
import { channelSlug, contentRef, encodeJsonShortEvent, eventDestinations, IndexedEvent, JSON_SHORTS_FEED, JsonSnap, JsonVote, jsonChannelId, jsonSnapLink, jsonThreadId, loadJsonEventPage, mergeJsonEvents, parseSnapRef, projectJsonThread, publishJsonShortEvent, readJsonShortOperation, snapRefKey, validJsonShortEvent } from './jsonShorts';
vi.mock('./keychain', () => ({ KeychainService: { publishShortEvents: vi.fn() } }));
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const base = (actor: string, n: number) => ({ app: 'nebulosa-shorts' as const, version: 1 as const, actor, id: uuid(n) });
const rootRef = { author: 'alice', id: uuid(1) };
const root: JsonSnap = { ...base('alice', 1), type: 'snap', root: rootRef, parent: null, channel: null, body: 'Hello #Hive' };
const indexed = (event: any, n: number): IndexedEvent => ({ event, operationId: String(478966506512711680n + BigInt(n)), timestamp: '2026-11-09T17:00:00Z' });
const reply: JsonSnap = { ...base('bob', 2), type: 'snap', root: rootRef, parent: rootRef, channel: null, body: 'A reply' };
beforeEach(() => { vi.mocked(KeychainService.publishShortEvents).mockResolvedValue({ success: true }); });
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe('no-rewards Shorts protocol', () => {
  it('shares snaps and channels through the independent Snaps route', () => {
    const url = new URL(jsonSnapLink(rootRef, 'alice/art'), 'https://example.com');
    expect(url.pathname).toBe('/snaps');
    expect(url.searchParams.get('snap')).toBe(snapRefKey(rootRef));
    expect(url.searchParams.get('channel')).toBe('alice/art');
    expect(url.searchParams.has('mode')).toBe(false);
  });
  it('routes roots, replies and votes into the appropriate custom JSON streams', async () => {
    expect(await eventDestinations(root)).toEqual([JSON_SHORTS_FEED, await jsonThreadId(rootRef)]);
    expect(await eventDestinations(reply)).toEqual([await jsonThreadId(rootRef)]);
    expect(await eventDestinations({ ...base('carol', 3), type: 'vote', root: rootRef, target: rootRef, value: 1 })).toEqual([await jsonThreadId(rootRef)]);
  });
  it('atomically indexes a resnap in its own conversation, original conversation, global feed and channel', async () => {
    const event = { ...base('carol', 4), type: 'resnap' as const, root: { author: 'carol', id: uuid(4) }, target: rootRef, channel: 'carol/art' };
    expect(await eventDestinations(event)).toEqual([JSON_SHORTS_FEED, await jsonThreadId(event.root), await jsonChannelId('carol/art'), await jsonThreadId(rootRef)]);
  });
  it('uses valid stable custom JSON IDs for the longest names and slugs', async () => {
    const key = await jsonChannelId('abcdefghijklmnop/a-very-long-channel-name');
    expect(key.length).toBeLessThanOrEqual(32);
    expect(key).toBe(await jsonChannelId('abcdefghijklmnop/a-very-long-channel-name'));
    expect(channelSlug('Fotografia & Café')).toBe('fotografia-cafe');
  });
  it('requires the actor to be a real operation signer and rejects unsupported payloads', () => {
    const row = { id: '478966506512711680', timestamp: '2026-11-09T17:00:00Z', custom_id: JSON_SHORTS_FEED, required_posting_auths: ['alice'], json: JSON.stringify(root) };
    expect(readJsonShortOperation(row, JSON_SHORTS_FEED)?.event).toEqual(root);
    expect(readJsonShortOperation({ ...row, required_posting_auths: ['mallory'] }, JSON_SHORTS_FEED)).toBeNull();
    expect(readJsonShortOperation({ ...row, json: JSON.stringify({ ...root, version: 9 }) }, JSON_SHORTS_FEED)).toBeNull();
  });
  it('reconstructs nested replies and ignores orphan and cross-channel replies', () => {
    const nested = { ...reply, ...base('carol', 3), parent: contentRef(reply), body: 'Nested' };
    const orphan = { ...reply, ...base('carol', 4), parent: { author: 'unknown', id: uuid(8) } };
    const wrongChannel = { ...reply, ...base('carol', 5), channel: 'mallory/spam' };
    const result = projectJsonThread(rootRef, [indexed(nested, 3), indexed(root, 1), indexed(reply, 2), indexed(orphan, 4), indexed(wrongChannel, 5)]);
    expect(result?.contents.size).toBe(3);
    expect(result?.replies.get(snapRefKey(contentRef(reply)))?.[0]).toEqual(nested);
  });
  it('keeps one latest vote per actor in precise operation order, including vote removal', () => {
    const vote = (n: number, value: -1 | 0 | 1): JsonVote => ({ ...base('bob', n), type: 'vote', root: rootRef, target: rootRef, value });
    const result = projectJsonThread(rootRef, [indexed(root, 1), indexed(vote(2, 1), 2), indexed(vote(3, -1), 3), indexed(vote(4, 0), 4)]);
    expect(result?.votes.get(snapRefKey(rootRef))?.size).toBe(1);
    expect(result?.votes.get(snapRefKey(rootRef))?.get('bob')).toBe(0);
  });
  it('does not count votes published before their target or for missing content', () => {
    const vote = { ...base('bob', 3), type: 'vote' as const, root: rootRef, target: rootRef, value: 1 as const };
    const missing = { ...vote, ...base('carol', 4), target: { author: 'unknown', id: uuid(9) } };
    const result = projectJsonThread(rootRef, [indexed(vote, 0), indexed(root, 1), indexed(missing, 4)]);
    expect(result?.votes.size).toBe(0);
  });
  it('deduplicates repeated UUIDs and replaces local successful events with indexed versions', () => {
    const pending = { ...indexed(root, 1), operationId: 'pending:alice/1', pending: true };
    const result = mergeJsonEvents([pending], [indexed(root, 1), indexed(root, 1)]);
    expect(result).toHaveLength(1); expect(result[0].pending).not.toBe(true);
  });
  it('shows one snap when global, thread, channel and pending copies have distinct operation IDs', () => {
    const snap = { ...root, channel: 'alice/art' };
    const pending = { ...indexed(snap, 1), operationId: 'pending:alice/1', pending: true };
    const copies = [indexed(snap, 1), indexed(snap, 2), indexed(snap, 3)];
    const merged = mergeJsonEvents([pending], copies);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(copies[0]);
    expect(projectJsonThread(rootRef, [...copies, pending])?.contents.size).toBe(1);
  });
  it('broadcasts a channel snap once with three distinct routing IDs and one shared event identity', async () => {
    const snap = { ...root, channel: 'alice/art' };
    await publishJsonShortEvent(snap);
    expect(KeychainService.publishShortEvents).toHaveBeenCalledTimes(1);
    const operations = vi.mocked(KeychainService.publishShortEvents).mock.calls[0][1];
    expect(operations.map(operation => operation[1].id)).toEqual([
      JSON_SHORTS_FEED, await jsonThreadId(rootRef), await jsonChannelId('alice/art'),
    ]);
    expect(new Set(operations.map(operation => operation[1].json)).size).toBe(1);
    expect(operations.every(operation => JSON.parse(operation[1].json).id === root.id)).toBe(true);
  });
  it('counts one resnap per signer, even after repeated resnap operations', () => {
    const resnap = (n: number) => ({ ...base('bob', n), type: 'resnap', root: { author: 'bob', id: uuid(n) }, target: rootRef, channel: null });
    const result = projectJsonThread(rootRef, [indexed(root, 1), indexed(resnap(2), 2), indexed(resnap(3), 3)]);
    expect([...result!.resnaps]).toEqual(['bob']);
  });
  it('publishes only custom_json, never Hive comments, payout options or reward-pool votes', async () => {
    await publishJsonShortEvent(root);
    const operations = vi.mocked(KeychainService.publishShortEvents).mock.calls[0][1];
    expect(operations.every(operation => operation[0] === 'custom_json')).toBe(true);
    expect(operations[0][1].required_posting_auths).toEqual(['alice']);
    expect(JSON.stringify(operations)).not.toContain('comment_options');
  });
  it('does not report publication when Keychain cancels and blocks account changes', async () => {
    vi.mocked(KeychainService.publishShortEvents).mockResolvedValue({ success: false, message: 'Cancelled' });
    let failure: unknown; try { await publishJsonShortEvent(root); } catch (err) { failure = err; }
    expect((failure as Error).message).toBe('Cancelled');
    vi.mocked(KeychainService.publishShortEvents).mockClear();
    try { await publishJsonShortEvent(root, () => false); } catch { /* Expected. */ }
    expect(KeychainService.publishShortEvents).not.toHaveBeenCalled();
  });
  it('enforces body and schema limits before requesting a signature', () => {
    expect(validJsonShortEvent({ ...root, body: 'x'.repeat(301) })).toBe(false);
    expect(() => encodeJsonShortEvent({ ...root, body: 'x'.repeat(7000) })).toThrow();
    expect(validJsonShortEvent({ ...root, unknown: true })).toBe(false);
    expect(parseSnapRef('alice/' + uuid(1))).toEqual(rootRef);
    expect(parseSnapRef('alice/not-an-id')).toBeNull();
  });
  it('advances pagination across invalid events without rounding operation IDs', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(Array.from({ length: 20 }, () => ({ id: '478966506512711680', timestamp: '2026-11-09T17:00:00Z', custom_id: JSON_SHORTS_FEED, required_posting_auths: ['mallory'], json: JSON.stringify(root) }))))));
    const page = await loadJsonEventPage(JSON_SHORTS_FEED);
    expect(page.events).toEqual([]); expect(page.cursor).toBe('478966506512711679'); expect(page.hasMore).toBe(true);
  });
});
