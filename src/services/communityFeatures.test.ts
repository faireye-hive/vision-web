import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCommunity, getPost, HiveCommunity, HivePost } from './hiveApi';
import { KeychainService } from './keychain';
import { communityPublishMetadata, defaultCommunitySettings, loadCommunityFeatures, loadPostFlair, postFlairId, readCommunityEvent, saveCommunitySettings, savePostFlair, settingsId, validCommunitySettings, validPostFlairEvent } from './communityFeatures';

vi.mock('./hiveApi', () => ({ getCommunity: vi.fn(), getPost: vi.fn() }));
vi.mock('./keychain', () => ({ KeychainService: { broadcastCustomJson: vi.fn() } }));
const community = (name = 'hive-100001') => ({ name, team: [['owner', 'owner', ''], ['admin', 'admin', ''], ['moderator', 'mod', '']] }) as HiveCommunity;
const post = (permlink = 'first-post', name = 'hive-100001'): HivePost => ({ post_id: 1, title: 'A post', body: 'Body', created: '2026-11-09T00:00:00', depth: 0, children: 0, net_rshares: 0, is_paidout: false, payout: 0, pending_payout_value: '0.000 HBD', author_reputation: 0, author: 'alice', permlink, community: name, category: name, json_metadata: { nebulosa: { community: { name, category: 'art', flair: 'question' } } } });
const settings = () => ({ categories: [{ id: 'art', label: 'Art' }], flairs: [{ id: 'question', label: 'Question' }], subtags: ['painting'] });
const event = (actor: string, extra: object = {}) => ({ app: 'nebulosa-community', version: 1, community: 'hive-100001', actor, ...extra });
const row = (id: string, payload: any, custom_id = settingsId(payload.community)) => ({ id, custom_id, json: JSON.stringify(payload), required_posting_auths: [payload.actor] });
beforeEach(() => {
  vi.mocked(getCommunity).mockImplementation(async name => community(name));
  vi.mocked(getPost).mockImplementation(async (_author, permlink) => post(permlink));
  vi.mocked(KeychainService.broadcastCustomJson).mockResolvedValue({ success: true });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('community categories and flair permissions', () => {
  it('requires an explicit valid category and rejects retired flairs before publishing', () => {
    expect(() => communityPublishMetadata('hive-100001', '', null, settings())).toThrow(/Choose a category/);
    expect(() => communityPublishMetadata('hive-100001', 'art', 'retired', settings())).toThrow(/available/);
    expect(communityPublishMetadata('hive-100001', 'art', 'question', settings())).toEqual({ name: 'hive-100001', category: 'art', flair: 'question' });
  });
  it('rejects ambiguous IDs and oversized settings and supports usable defaults', () => {
    expect(validCommunitySettings(defaultCommunitySettings())).toBe(true);
    expect(validCommunitySettings({ ...settings(), categories: [] })).toBe(false);
    expect(validCommunitySettings({ ...settings(), flairs: [{ id: 'same', label: 'A' }, { id: 'same', label: 'B' }] })).toBe(false);
    expect(validCommunitySettings({ ...settings(), subtags: ['Bad Tag'] })).toBe(false);
  });
  it('ignores forged actors, wrong streams and cross-community payloads', () => {
    const payload = event('admin', { type: 'settings', settings: settings() });
    const operation = row('10', payload);
    expect(readCommunityEvent(operation, operation.custom_id, 'hive-100001')).toEqual(payload);
    expect(readCommunityEvent({ ...operation, required_posting_auths: ['mallory'] }, operation.custom_id, 'hive-100001')).toBeNull();
    expect(readCommunityEvent(operation, 'wrong-id', 'hive-100001')).toBeNull();
    expect(readCommunityEvent(operation, operation.custom_id, 'hive-100002')).toBeNull();
  });
  it('finds the latest authorized settings without losing precision in operation IDs', async () => {
    const name = 'hive-100003';
    const older = event('owner', { community: name, type: 'settings', settings: settings() });
    const newer = event('admin', { community: name, type: 'settings', settings: { ...settings(), subtags: ['tutorial'] } });
    const forged = event('mallory', { community: name, type: 'settings', settings: { ...settings(), subtags: ['spam'] } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [row('9007199254740992', older), row('9007199254740994', forged), row('9007199254740993', newer)] }));
    expect((await loadCommunityFeatures(name)).settings.subtags).toEqual(['tutorial']);
  });
  it('limits settings changes to owners and admins, even when called directly', async () => {
    await expect(saveCommunitySettings('moderator', 'hive-100001', settings())).rejects.toThrow(/owners and admins/);
    await expect(saveCommunitySettings('mallory', 'hive-100001', settings())).rejects.toThrow();
    expect(KeychainService.broadcastCustomJson).not.toHaveBeenCalled();
    await saveCommunitySettings('admin', 'hive-100001', settings());
    expect(KeychainService.broadcastCustomJson).toHaveBeenCalledWith('admin', settingsId('hive-100001'), 'Posting', expect.any(String), expect.any(String));
  });
  it('allows authors to choose flairs and moderators only to remove them on the matching post', () => {
    const base = { type: 'flair', community: 'hive-100001', actor: 'alice', author: 'alice', permlink: 'first-post', flair: 'question' };
    expect(validPostFlairEvent(base, post(), community())).toBe(true);
    expect(validPostFlairEvent({ ...base, actor: 'moderator' }, post(), community())).toBe(false);
    expect(validPostFlairEvent({ ...base, actor: 'moderator', flair: null }, post(), community())).toBe(true);
    expect(validPostFlairEvent({ ...base, actor: 'mallory', flair: null }, post(), community())).toBe(false);
    expect(validPostFlairEvent({ ...base, permlink: 'other' }, post(), community())).toBe(false);
    expect(validPostFlairEvent({ ...base, community: 'hive-999999' }, post(), community())).toBe(false);
  });
  it('keeps a signed moderator removal instead of restoring the original metadata flair', async () => {
    const target = post('removed-flair');
    const id = await postFlairId(target);
    const removal = event('moderator', { type: 'flair', author: 'alice', permlink: target.permlink, flair: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [row('20', removal, id)] }));
    expect(await loadPostFlair(target, community())).toBeNull();
  });
  it('checks the canonical community before broadcasting and never updates on rejection', async () => {
    vi.mocked(getPost).mockResolvedValue(post('wrong-community', 'hive-999999'));
    await expect(savePostFlair('alice', post('wrong-community'), 'question')).rejects.toThrow(/belongs/);
    expect(KeychainService.broadcastCustomJson).not.toHaveBeenCalled();
    vi.mocked(getPost).mockResolvedValue(post('rejected'));
    vi.mocked(KeychainService.broadcastCustomJson).mockResolvedValue({ success: false, message: 'User rejected' });
    await expect(savePostFlair('alice', post('rejected'), 'question')).rejects.toThrow('User rejected');
  });
  it('uses a stable custom JSON ID within Hive limits for long permlinks', async () => {
    const target = post('a'.repeat(256));
    expect((await postFlairId(target)).length).toBeLessThanOrEqual(32);
    expect(await postFlairId(target)).toBe(await postFlairId(target));
    expect(await postFlairId(target)).not.toBe(await postFlairId(post('other')));
  });
  it('does not replace a successful local configuration save with an older in-flight read', async () => {
    const name = 'hive-100004';
    let finish!: (value: unknown) => void;
    let started!: () => void;
    const reading = new Promise<void>(resolve => { started = resolve; });
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      started();
      return { ok: true, json: () => new Promise(resolve => { finish = resolve; }) };
    }));
    const oldRead = loadCommunityFeatures(name);
    await reading;
    const updated = { ...settings(), subtags: ['new-topic'] };
    await saveCommunitySettings('owner', name, updated);
    finish([]);
    expect((await oldRead).settings).toEqual(updated);
  });
  it('keeps network failures as errors instead of bypassing configured category rules', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(loadCommunityFeatures('hive-100005')).rejects.toThrow(/Could not load/);
  });
});
