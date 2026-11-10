import { getAccount } from './hiveApi';
import { KeychainService } from './keychain';
import { HAFSQL_BASE } from './savedLists';
export interface ChatEnvelope { app: 'nebulosa-chat'; version: 1; id: string; from: string; to: string; memo: string }
export interface ChatMessage extends ChatEnvelope { operationId: string; timestamp: string }
export const cleanChatAccount = (name: string) => name.trim().replace(/^@/, '').toLowerCase();
export const validChatAccount = (name: unknown): name is string => typeof name === 'string' && /^[a-z][a-z0-9.-]{2,15}$/.test(name);
export const encryptedMemo = (memo: unknown): memo is string => typeof memo === 'string' && memo.length <= 7900 && /^#[1-9A-HJ-NP-Za-km-z]{100,}$/.test(memo);
export function validChatEnvelope(value: any): value is ChatEnvelope {
  return value?.app === 'nebulosa-chat' && value.version === 1 && typeof value.id === 'string' && /^[a-f0-9-]{36}$/.test(value.id)
    && validChatAccount(value.from) && validChatAccount(value.to) && value.from !== value.to && encryptedMemo(value.memo)
    && Object.keys(value).every(key => ['app', 'version', 'id', 'from', 'to', 'memo'].includes(key));
}
export function chatOperationMessage(row: any, viewer: string): ChatMessage | null {
  if (!row || row.custom_id !== `nebulosa.chat.${viewer}` || !/^\d+$/.test(String(row.id))) return null;
  try {
    const value = JSON.parse(row.json);
    if (!validChatEnvelope(value) || (value.from !== viewer && value.to !== viewer) ||
      ![...(Array.isArray(row.required_posting_auths) ? row.required_posting_auths : []), ...(Array.isArray(row.required_auths) ? row.required_auths : [])].includes(value.from)) return null;
    if (typeof row.timestamp !== 'string' || !Number.isFinite(Date.parse(row.timestamp))) return null;
    return { ...value, operationId: String(row.id), timestamp: row.timestamp };
  } catch { return null; }
}
export async function loadChatPage(viewer: string, cursor = ''): Promise<{ messages: ChatMessage[]; cursor: string; hasMore: boolean }> {
  if (!validChatAccount(viewer)) throw new Error('Invalid Hive account.');
  const url = new URL(`${HAFSQL_BASE}/operations/custom_json/${encodeURIComponent(`nebulosa.chat.${viewer}`)}`);
  url.searchParams.set('limit', '100');
  if (cursor) url.searchParams.set('start', cursor);
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Could not load encrypted messages. Please retry.');
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Invalid message history response.');
  const ids = rows.map(row => String(row.id)).filter(id => /^\d+$/.test(id));
  const oldest = ids.reduce((min, id) => !min || BigInt(id) < BigInt(min) ? id : min, '');
  const next = oldest && BigInt(oldest) > 0n ? (BigInt(oldest) - 1n).toString() : '';
  if (cursor && next && BigInt(next) >= BigInt(cursor)) throw new Error('Message history did not advance. Please retry.');
  return { messages: rows.map(row => chatOperationMessage(row, viewer)).filter((message): message is ChatMessage => !!message), cursor: next, hasMore: rows.length === 100 && !!next };
}
export function mergeChatMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const messages = new Map<string, ChatMessage>();
  for (const item of [...current, ...incoming]) {
    const key = `${item.from}/${item.id}`;
    const old = messages.get(key);
    if (!old || old.memo === item.memo && (old.operationId.startsWith('pending:') || !item.operationId.startsWith('pending:') && BigInt(item.operationId) > BigInt(old.operationId))) messages.set(key, item);
  }
  return [...messages.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id));
}
export async function sendEncryptedChat(from: string, to: string, body: string, stillCurrent: () => boolean = () => true): Promise<ChatEnvelope> {
  if (!validChatAccount(from) || !validChatAccount(to) || from === to) throw new Error('Choose another valid Hive account.');
  if (!body.trim() || new TextEncoder().encode(body).length > 3000) throw new Error('Write a message of up to 3,000 UTF-8 bytes.');
  const account = await getAccount(to, true);
  if (!account?.memo_key) throw new Error('Recipient not found or no memo public key is available.');
  if (!stillCurrent()) throw new Error('The signed-in account changed.');
  const id = crypto.randomUUID();
  const plaintext = JSON.stringify({ app: 'nebulosa-chat', version: 1, id, from, to, body });
  const encrypted = await KeychainService.encodeMemoMessage(from, to, plaintext);
  if (!encrypted.success || !encryptedMemo(encrypted.result)) throw new Error('Encryption was not completed. Nothing was published. Check your memo key in Hive Keychain.');
  if (!stillCurrent()) throw new Error('The signed-in account changed. Nothing was published.');
  const envelope: ChatEnvelope = { app: 'nebulosa-chat', version: 1, id, from, to, memo: encrypted.result };
  const json = JSON.stringify(envelope);
  if (new TextEncoder().encode(json).length > 8192) throw new Error('Encrypted message exceeds Hive’s size limit. Shorten it and retry.');
  const result = await KeychainService.broadcastChatMessage(from, to, json);
  if (!result.success) throw new Error('The encrypted message was not sent. Confirm the request in Hive Keychain to send it.');
  return envelope;
}
export async function decryptChatMessage(viewer: string, message: ChatMessage): Promise<string> {
  if (!validChatEnvelope({ app: message.app, version: message.version, id: message.id, from: message.from, to: message.to, memo: message.memo }) || viewer !== message.from && viewer !== message.to) throw new Error('This message does not belong to this account.');
  const result = await KeychainService.decodeMemoMessage(viewer, message.memo);
  if (!result.success || typeof result.result !== 'string') throw new Error('Could not unlock this message. Check your private memo key in Hive Keychain.');
  try {
    const value = JSON.parse(result.result.replace(/^#/, ''));
    if (value.app !== 'nebulosa-chat' || value.version !== 1 || value.id !== message.id || value.from !== message.from || value.to !== message.to || typeof value.body !== 'string' || new TextEncoder().encode(value.body).length > 3000) throw new Error();
    return value.body;
  } catch { throw new Error('The decrypted message does not match its signed envelope.'); }
}
