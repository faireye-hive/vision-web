import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeychainService } from './keychain';
vi.mock('./hiveApi', () => ({ hiveRpcCall: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); });
const operation = () => ['custom_json', { id: 'nebulosa.shorts.v1', required_auths: [], required_posting_auths: ['alice'], json: JSON.stringify({ app: 'nebulosa-shorts', version: 1, actor: 'alice', type: 'snap' }) }];
describe('no-rewards Keychain publishing', () => {
  it('uses Posting authority and returns the extension result', async () => {
    const broadcast = vi.fn((_user: string, _operations: any[], _key: string, callback: (response: any) => void) => callback({ success: true }));
    vi.stubGlobal('window', { hive_keychain: { requestBroadcast: broadcast } });
    const operations = [operation()];
    expect((await KeychainService.publishShortEvents('alice', operations)).success).toBe(true);
    expect(broadcast).toHaveBeenCalledWith('alice', operations, 'Posting', expect.any(Function));
  });
  it('rejects reward-pool operations before contacting the extension', async () => {
    const broadcast = vi.fn(); vi.stubGlobal('window', { hive_keychain: { requestBroadcast: broadcast } });
    expect((await KeychainService.publishShortEvents('alice', [['vote', { voter: 'alice' }]])).success).toBe(false);
    expect(broadcast).not.toHaveBeenCalled();
  });
  it('rejects an actor mismatch and operations outside the Shorts namespaces', async () => {
    const broadcast = vi.fn(); vi.stubGlobal('window', { hive_keychain: { requestBroadcast: broadcast } });
    const op = operation() as any; op[1].id = 'follow';
    expect((await KeychainService.publishShortEvents('alice', [op])).success).toBe(false);
    expect((await KeychainService.publishShortEvents('mallory', [operation()])).success).toBe(false);
    expect(broadcast).not.toHaveBeenCalled();
  });
});
