import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAccount } from './hiveApi';
import { KeychainService } from './keychain';
import { chatOperationMessage, decryptChatMessage, loadChatPage, mergeChatMessages, sendEncryptedChat, ChatMessage } from './encryptedChat';
vi.mock('./hiveApi', () => ({ getAccount: vi.fn(), hiveRpcCall: vi.fn() }));
const memo = '#' + 'A'.repeat(250);
const id = '12345678-1234-1234-1234-123456789abc';
const envelope = { app: 'nebulosa-chat' as const, version: 1 as const, id, from: 'alice', to: 'bob', memo };
const message: ChatMessage = { ...envelope, operationId: '478966506512711680', timestamp: '2026-11-09T17:00:00Z' };
const row = { id: message.operationId, timestamp: message.timestamp, custom_id: 'nebulosa.chat.bob', required_posting_auths: ['alice'], required_auths: [], json: JSON.stringify(envelope) };
beforeEach(() => { vi.mocked(getAccount).mockResolvedValue({ name: 'bob', memo_key: 'STM-public-key' } as any); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('memo encrypted chat', () => {
  it('encrypts before publishing and never puts the message body in custom JSON', async () => {
    const encode = vi.spyOn(KeychainService, 'encodeMemoMessage').mockResolvedValue({ success: true, result: memo });
    const broadcast = vi.spyOn(KeychainService, 'broadcastChatMessage').mockResolvedValue({ success: true });
    const sent = await sendEncryptedChat('alice', 'bob', 'very private content');
    expect(encode).toHaveBeenCalledWith('alice', 'bob', expect.stringContaining('very private content'));
    expect(sent.memo).toBe(memo);
    expect(broadcast).toHaveBeenCalledWith('alice', 'bob', JSON.stringify(sent));
    expect(broadcast.mock.calls[0][2]).not.toContain('very private content');
    expect(Object.keys(sent)).not.toContain('body');
  });
  it('never broadcasts when encryption is cancelled', async () => {
    vi.spyOn(KeychainService, 'encodeMemoMessage').mockResolvedValue({ success: false });
    const publish = vi.spyOn(KeychainService, 'broadcastChatMessage');
    let failure: unknown; try { await sendEncryptedChat('alice', 'bob', 'secret'); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(Error); expect(publish).not.toHaveBeenCalled();
  });
  it('rejects a plaintext encode response instead of falling back to public text', async () => {
    vi.spyOn(KeychainService, 'encodeMemoMessage').mockResolvedValue({ success: true, result: '#{"body":"secret"}' });
    const publish = vi.spyOn(KeychainService, 'broadcastChatMessage');
    let failure: unknown; try { await sendEncryptedChat('alice', 'bob', 'secret'); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(Error); expect(publish).not.toHaveBeenCalled();
  });
  it('aborts before publication if the active account changes during encryption', async () => {
    let active = true;
    vi.spyOn(KeychainService, 'encodeMemoMessage').mockImplementation(async () => { active = false; return { success: true, result: memo }; });
    const publish = vi.spyOn(KeychainService, 'broadcastChatMessage');
    let failure: unknown; try { await sendEncryptedChat('alice', 'bob', 'secret', () => active); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(Error); expect(publish).not.toHaveBeenCalled();
  });
  it('rejects an impersonated sender, wrong mailbox, and extra plaintext fields', () => {
    expect(chatOperationMessage(row, 'bob')).toMatchObject(envelope);
    expect(chatOperationMessage({ ...row, required_posting_auths: ['mallory'] }, 'bob')).toBeNull();
    expect(chatOperationMessage(row, 'charlie')).toBeNull();
    expect(chatOperationMessage({ ...row, json: JSON.stringify({ ...envelope, body: 'plaintext' }) }, 'bob')).toBeNull();
  });
  it('decrypts through Memo authority and binds the plaintext to signed message metadata', async () => {
    const decode = vi.spyOn(KeychainService, 'decodeMemoMessage').mockResolvedValue({ success: true, result: JSON.stringify({ app: envelope.app, version: 1, id, from: 'alice', to: 'bob', body: 'hello' }) });
    expect(await decryptChatMessage('bob', message)).toBe('hello');
    expect(decode).toHaveBeenCalledWith('bob', memo);
    decode.mockResolvedValue({ success: true, result: JSON.stringify({ app: envelope.app, version: 1, id, from: 'mallory', to: 'bob', body: 'hello' }) });
    let failure: unknown; try { await decryptChatMessage('bob', message); } catch (error) { failure = error; }
    expect((failure as Error).message).toContain('signed envelope');
  });
  it('deduplicates a confirmed message against its locally pending ciphertext', () => {
    const result = mergeChatMessages([{ ...message, operationId: `pending:${id}` }], [message]);
    expect(result).toHaveLength(1); expect(result[0].operationId).toBe(message.operationId);
  });
  it('uses precise string operation IDs for pagination even when messages are invalid', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(Array.from({ length: 100 }, () => ({ ...row, required_posting_auths: ['mallory'] }))))));
    const result = await loadChatPage('bob');
    expect(result.messages).toEqual([]); expect(result.cursor).toBe('478966506512711679'); expect(result.hasMore).toBe(true);
  });
  it('publishes ciphertext to both participants in one Posting transaction', async () => {
    const broadcast = vi.fn((_user: string, _ops: unknown[], _key: string, callback: (response: any) => void) => callback({ success: true }));
    vi.stubGlobal('window', { hive_keychain: { requestBroadcast: broadcast } });
    const result = await KeychainService.broadcastChatMessage('alice', 'bob', JSON.stringify(envelope));
    expect(result.success).toBe(true);
    const operations = broadcast.mock.calls[0][1] as any[];
    expect(operations.map(op => op[1].id)).toEqual(['nebulosa.chat.alice', 'nebulosa.chat.bob']);
    expect(operations.every(op => op[1].json === JSON.stringify(envelope) && op[1].required_posting_auths[0] === 'alice')).toBe(true);
    expect(broadcast.mock.calls[0][2]).toBe('Posting');
  });
  it('passes the required encryption marker and Memo authority to Keychain', async () => {
    const encode = vi.fn((_from: string, _to: string, _text: string, _key: string, callback: (response: any) => void) => callback({ success: true, result: memo }));
    vi.stubGlobal('window', { hive_keychain: { requestEncodeMessage: encode } });
    await KeychainService.encodeMemoMessage('alice', 'bob', '{"body":"secret"}');
    expect(encode.mock.calls[0].slice(0, 4)).toEqual(['alice', 'bob', '#{"body":"secret"}', 'Memo']);
  });
});
