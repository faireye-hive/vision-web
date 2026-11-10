import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeychainService, KeychainResponse } from './keychain';
vi.mock('./hiveApi', () => ({ hiveRpcCall: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); });
describe('list publishing with Keychain', () => {
  it('passes the intended custom id and JSON using Posting authority', async () => {
    const request = vi.fn((user: string, id: string, key: string, json: string, label: string, callback: (response: KeychainResponse) => void) => callback({ success: true }));
    vi.stubGlobal('window', { hive_keychain: { requestCustomJson: request } });
    const response = await KeychainService.publishSavedList('alice', 'nebulosa.alice.mylists', '{"app":"nebulosa"}', 'Publish lists');
    expect(response.success).toBe(true);
    expect(request).toHaveBeenCalledWith('alice', 'nebulosa.alice.mylists', 'Posting', '{"app":"nebulosa"}', 'Publish lists', expect.any(Function));
  });
  it('returns cancellation without reporting publication success', async () => {
    vi.stubGlobal('window', { hive_keychain: { requestCustomJson: (_a: string, _b: string, _c: string, _d: string, _e: string, callback: (response: KeychainResponse) => void) => callback({ success: false, message: 'Cancelled' }) } });
    expect((await KeychainService.publishSavedList('alice', 'list', '{}', 'Publish')).success).toBe(false);
  });
  it('rejects oversized identifiers before calling the extension', async () => {
    const request = vi.fn(); vi.stubGlobal('window', { hive_keychain: { requestCustomJson: request } });
    expect((await KeychainService.publishSavedList('alice', 'a'.repeat(33), '{}', 'Publish')).success).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
});
