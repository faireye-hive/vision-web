import { afterEach, describe, expect, it, vi } from 'vitest';
import { customListId, decodeSignedPayload, encodeListPayload, listSlug, loadSavedLists } from './savedLists';
afterEach(() => { vi.unstubAllGlobals(); });
const payload = { app: 'nebulosa', version: 1, kind: 'list', owner: 'alice', revision: 1 };
const operation = (data: unknown, signer = 'alice', id = 'list-id', opId = '478966506512711680') => ({ id: opId, custom_id: id, required_posting_auths: [signer], required_auths: [], json: JSON.stringify(data) });
describe('public saved lists protocol', () => {
  it('keeps requested namespaces when they fit and hashes longer identifiers deterministically', async () => {
    expect(await customListId('alice')).toBe('nebulosa.alice.mylists');
    expect(await customListId('alice', 'art')).toBe('nebulosa.alice.lists.art');
    const id = await customListId('abcdefghijklmnop', 'a-very-long-list-name');
    expect(id.length).toBeLessThanOrEqual(32);
    expect(id).toBe(await customListId('abcdefghijklmnop', 'a-very-long-list-name'));
    expect(id).not.toBe(await customListId('another-account', 'a-very-long-list-name'));
  });
  it('rejects forged payloads even when the custom id and owner fields match', () => {
    expect(decodeSignedPayload(operation(payload, 'mallory'), 'alice', 'list-id')).toBeNull();
    expect(decodeSignedPayload(operation(payload), 'alice', 'list-id')).toEqual(payload);
    expect(decodeSignedPayload(operation({ ...payload, owner: 'mallory' }), 'alice', 'list-id')).toBeNull();
  });
  it('enforces UTF-8 payload limits before invoking Keychain', () => {
    expect(() => encodeListPayload({ text: '😀'.repeat(3000) })).toThrow('full');
    expect(listSlug('Minha lista de Café!')).toBe('minha-lista-de-cafe');
  });
  it('reconstructs only the latest signed catalog and list snapshot', async () => {
    const catalogId = await customListId('alice'); const id = await customListId('alice', 'art');
    const list = { ...payload, kind: 'list', id, slug: 'art', title: 'Art', posts: [{ author: 'bob', permlink: 'painting', title: 'Painting' }] };
    const catalog = { ...payload, kind: 'catalog', lists: [{ id, slug: 'art', title: 'Art' }] };
    vi.stubGlobal('fetch', vi.fn(async (url: URL) => new Response(JSON.stringify(url.pathname.endsWith(catalogId)
      ? [operation(catalog, 'alice', catalogId)]
      : [operation({ ...list, posts: [] }, 'mallory', id, '478966506512711681'), operation(list, 'alice', id)]))));
    expect(await loadSavedLists('alice')).toEqual([list]);
  });
  it('treats network failures as errors instead of an empty directory', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    let error: unknown;
    try { await loadSavedLists('alice'); } catch (value) { error = value; }
    expect(error).toBeInstanceOf(Error);
  });
  it('does not silently display partial data when a registered list is not indexed', async () => {
    const catalogId = await customListId('alice'); const id = await customListId('alice', 'art');
    vi.stubGlobal('fetch', vi.fn(async (url: URL) => new Response(JSON.stringify(url.pathname.endsWith(catalogId)
      ? [operation({ ...payload, kind: 'catalog', lists: [{ id, slug: 'art', title: 'Art' }] }, 'alice', catalogId)] : []))));
    let error: unknown; try { await loadSavedLists('alice'); } catch (value) { error = value; }
    expect((error as Error).message).toContain('indexed');
  });
});
