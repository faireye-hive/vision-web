import { getAccount } from './hiveApi';
import { KeychainService } from './keychain';

export async function encodeDraftMemo(text: string, account: string, sender?: string): Promise<string> {
  const recipient = account.trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z][a-z0-9.-]{2,15}$/.test(recipient)) {
    throw new Error('Enter a valid Hive account name.');
  }

  if (sender && window.hive_keychain?.requestEncodeMessage) {
    const response = await KeychainService.encodeMemoMessage(sender, recipient, text);
    if (!response.success || typeof response.result !== 'string' || !response.result.startsWith('#')) {
      throw new Error(response.message || response.error || 'Hive Keychain could not encode this text.');
    }
    return response.result;
  }

  const recipientAccount = await getAccount(recipient, true);
  if (!recipientAccount?.memo_key) {
    throw new Error('The recipient’s public memo key could not be found.');
  }

  // This key exists only for this memo and has no Hive account authority.
  const { Memo, PrivateKey } = await import('hive-tx');
  const temporaryKey = PrivateKey.randomKey();
  return Memo.encode(temporaryKey, recipientAccount.memo_key, `#${text}`);
}
