/**
 * Hive Keychain Browser Extension Service
 * Enables client-side, keyless authentication, voting, posting, and tipping on the Hive blockchain.
 */
import { hiveRpcCall, getHiveAvatarUrl, resolveHiveAvatarUrl, invalidateFollowingCache } from './hiveApi';
import { apiCache } from './apiCache';
import { invalidateProfileCache, invalidateAccountContentCache } from './profileCache';

// Hive Keychain global interface definition
declare global {
  interface Window {
    hive_keychain?: {
      requestEncodeMessage?: (username: string, receiver: string, message: string, key: 'Memo', callback: (response: KeychainResponse) => void) => void;
      requestVerifyKey?: (username: string, message: string, key: 'Memo', callback: (response: KeychainResponse) => void) => void;
      requestHandshake?: (callback: () => void) => void;
      requestSignBuffer?: (
        username: string,
        message: string,
        keyType: 'Posting' | 'Active' | 'Memo',
        callback: (response: KeychainResponse) => void
      ) => void;
      requestVote?: (
        username: string,
        permlink: string,
        author: string,
        weight: number,
        callback: (response: KeychainResponse) => void
      ) => void;
      requestPost?: (
        username: string,
        title: string,
        body: string,
        parentPermlink: string,
        parentAuthor: string,
        jsonMetadata: string,
        permlink: string,
        commentOptions: string,
        callback: (response: KeychainResponse) => void
      ) => void;
      requestCustomJson?: (
        username: string,
        id: string,
        keyType: 'Posting' | 'Active',
        json: string,
        displayName: string,
        callback: (response: KeychainResponse) => void
      ) => void;
      requestTransfer?: (
        username: string,
        to: string,
        amount: string,
        memo: string,
        currency: 'HIVE' | 'HBD',
        callback: (response: KeychainResponse) => void,
        enforce?: boolean
      ) => void;
      requestBroadcast?: (
        username: string,
        operations: any[],
        keyType: 'Posting' | 'Active' | 'Memo',
        callback: (response: KeychainResponse) => void
      ) => void;
    };
  }
}

export interface KeychainResponse {
  success: boolean;
  error?: string | null;
  result?: any;
  data?: any;
  message?: string;
  request_id?: number;
}

export interface CurrentUser {
  username: string;
  avatar: string;
  reputation?: number;
  votingPower?: number;
  hiveBalance?: string;
  hbdBalance?: string;
  hasKeychain: boolean;
  isDemo?: boolean;
}

const STORAGE_KEY = 'hive_keychain_user';

export class KeychainService {
  /**
   * Check if Hive Keychain extension is injected in the browser window
   */
  static isInstalled(): boolean {
    return typeof window !== 'undefined' && !!window.hive_keychain;
  }

  /**
   * Retrieve currently saved logged-in user from localStorage
   */
  static getCurrentUser(): CurrentUser | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return null;
      const user: CurrentUser = JSON.parse(data);
      return user ? { ...user, avatar: resolveHiveAvatarUrl(user.avatar, user.username) } : null;
    } catch {
      return null;
    }
  }

  private static isDemoSession(): boolean {
    return this.getCurrentUser()?.isDemo === true;
  }

  private static demoReadOnlyResponse(): KeychainResponse {
    return {
      success: false,
      error: 'Demo mode is read-only. Connect with Hive Keychain to publish, vote, follow, or transfer.'
    };
  }

  private static unavailableResponse(): KeychainResponse {
    return { success: false, error: 'This action requires Hive Keychain.' };
  }

  /** Start a clearly marked, read-only session for an existing public Hive account. */
  static async loginDemo(username: string): Promise<{ success: boolean; user?: CurrentUser; error?: string }> {
    const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();
    if (!/^[a-z][a-z0-9.-]{2,15}$/.test(cleanUsername)) {
      return { success: false, error: 'Enter a valid Hive account name (3–16 letters, numbers, dots, or hyphens).' };
    }

    try {
      const accounts = await hiveRpcCall<any[]>('condenser_api.get_accounts', [[cleanUsername]]);
      const account = Array.isArray(accounts) ? accounts[0] : null;
      if (!account?.name) return { success: false, error: `Hive account @${cleanUsername} was not found.` };

      let profile: Record<string, any> = {};
      try {
        const metadata = JSON.parse(account.posting_json_metadata || account.json_metadata || '{}');
        profile = metadata.profile || {};
      } catch {
        profile = {};
      }

      const user: CurrentUser = {
        username: cleanUsername,
        avatar: resolveHiveAvatarUrl(profile.profile_image, cleanUsername),
        hasKeychain: false,
        isDemo: true
      };
      this.saveCurrentUser(user);
      return { success: true, user };
    } catch {
      return { success: false, error: 'Could not verify this account on Hive. Check your connection and try again.' };
    }
  }

  /**
   * Save user session in localStorage
   */
  static saveCurrentUser(user: CurrentUser | null) {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  /**
   * Perform Keychain login via requestSignBuffer (or account verification fallback)
   */
  static async login(username: string): Promise<{ success: boolean; user?: CurrentUser; error?: string }> {
    const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();
    if (!cleanUsername) {
      return { success: false, error: 'Please enter a valid Hive username.' };
    }

    const hasKeychain = this.isInstalled() && Boolean(window.hive_keychain?.requestSignBuffer);

    if (!hasKeychain) {
      return { success: false, error: 'Hive Keychain was not detected. Use Demo mode for read-only browsing.' };
    }

    return new Promise((resolve) => {
      const message = `Vision Web login timestamp: ${Date.now()}`;
      window.hive_keychain!.requestSignBuffer!(
        cleanUsername,
        message,
        'Posting',
        (response: KeychainResponse) => {
          if (response.success) {
            const user: CurrentUser = {
              username: cleanUsername,
              avatar: getHiveAvatarUrl(cleanUsername),
              hasKeychain: true,
              reputation: 65,
              votingPower: 100
            };
            this.saveCurrentUser(user);
            resolve({ success: true, user });
          } else {
            resolve({
              success: false,
              error: response.message || response.error || 'Keychain signature rejected by user.'
            });
          }
        }
      );
    });
  }

  /**
   * Log out current user
   */
  static logout() {
    this.saveCurrentUser(null);
  }

  /**
   * Broadcast an upvote on a post or comment
   */
  static async vote(
    username: string,
    author: string,
    permlink: string,
    weight: number = 10000 // 10000 = 100%
  ): Promise<KeychainResponse> {
    if (this.isDemoSession()) return this.demoReadOnlyResponse();
    if (!this.isInstalled() || !window.hive_keychain?.requestVote) return this.unavailableResponse();

    return new Promise((resolve) => {
      window.hive_keychain!.requestVote!(
        username,
        permlink,
        author,
        weight,
        (response) => {
          resolve(response);
        }
      );
    });
  }

  /**
   * Publish a reply or new top-level post to Hive
   */
  static async postComment(
    username: string,
    parentAuthor: string,
    parentPermlink: string,
    body: string,
    title: string = ''
  ): Promise<KeychainResponse> {
    if (this.isDemoSession()) return this.demoReadOnlyResponse();
    const permlink = `re-${parentAuthor.replace(/[^a-z0-9]/g, '')}-${Date.now()}`;
    const jsonMetadata = JSON.stringify({
      app: 'nebulosa-web/0.0.4',
      format: 'markdown'
    });

    if (!this.isInstalled() || !window.hive_keychain?.requestPost) return this.unavailableResponse();

    return new Promise((resolve) => {
      window.hive_keychain!.requestPost!(
        username,
        title,
        body,
        parentPermlink,
        parentAuthor,
        jsonMetadata,
        permlink,
        '',
        (response) => {
          if (response.success) {
            invalidateAccountContentCache(username);
            if (parentAuthor) invalidateAccountContentCache(parentAuthor);
          }
          resolve(response);
        }
      );
    });
  }

  /**
   * Reblog a post via custom_json
   */
  static async reblog(username: string, author: string, permlink: string): Promise<KeychainResponse> {
    if (this.isDemoSession()) return this.demoReadOnlyResponse();
    const cleanUser = username.replace(/^@/, '').trim().toLowerCase();
    const cleanAuthor = author.replace(/^@/, '').trim().toLowerCase();
    const cleanPermlink = permlink.trim();
    const json = JSON.stringify(['reblog', { account: cleanUser, author: cleanAuthor, permlink: cleanPermlink }]);

    if (!this.isInstalled() || !window.hive_keychain?.requestCustomJson) return this.unavailableResponse();

    return new Promise((resolve) => {
      try {
        if (!window.hive_keychain?.requestCustomJson) {
          resolve({
            success: false,
            error: 'Hive Keychain requestCustomJson is not available.'
          });
          return;
        }

        window.hive_keychain.requestCustomJson(
          cleanUser,
          'follow',
          'Posting',
          json,
          `Reblog @${cleanAuthor}/${cleanPermlink}`,
          (response) => {
            if (response?.success) invalidateAccountContentCache(cleanUser);
            resolve(response || { success: false, error: 'No response from Keychain' });
          }
        );
      } catch (err: any) {
        resolve({
          success: false,
          error: err?.message || 'Error executing Keychain reblog'
        });
      }
    });
  }

  /**
   * Subscribe or unsubscribe a Hive community.
   * Broadcasts custom_json id "community" with the posting key.
   */
  static async subscribeCommunity(
    username: string,
    community: string,
    subscribe: boolean = true
  ): Promise<KeychainResponse> {
    if (this.isDemoSession()) return this.demoReadOnlyResponse();
    const json = JSON.stringify([
      subscribe ? 'subscribe' : 'unsubscribe',
      { community }
    ]);

    if (!this.isInstalled()) {
      return {
        success: false,
        message: 'Hive Keychain is required to subscribe on chain.'
      };
    }

    return new Promise((resolve) => {
      window.hive_keychain!.requestCustomJson!(
        username,
        'community',
        'Posting',
        json,
        `${subscribe ? 'Subscribe' : 'Unsubscribe'} ${community}`,
        (response) => {
          if (response.success) {
            apiCache.invalidate(`subscriptions:${username.replace(/^@/, '').trim().toLowerCase()}`);
            apiCache.invalidate(`community:${community}`);
            apiCache.invalidatePattern(/^ranked_posts:[^:]+:my:/);
          }
          resolve(response);
        }
      );
    });
  }

  /**
   * Follow or unfollow a user via Keychain custom_json
   */
  static async followUser(
    follower: string,
    following: string,
    follow: boolean = true
  ): Promise<KeychainResponse> {
    if (this.isDemoSession()) return this.demoReadOnlyResponse();
    const json = JSON.stringify([
      'follow',
      {
        follower,
        following,
        what: follow ? ['blog'] : []
      }
    ]);

    if (!this.isInstalled() || !window.hive_keychain?.requestCustomJson) return this.unavailableResponse();

    return new Promise((resolve) => {
      window.hive_keychain!.requestCustomJson!(
        follower,
        'follow',
        'Posting',
        json,
        `${follow ? 'Follow' : 'Unfollow'} @${following}`,
        (response) => {
          if (response.success) {
            invalidateFollowingCache(follower);
            invalidateFollowingCache(following);
          }
          resolve(response);
        }
      );
    });
  }

  static async updateModerationList(
    follower: string,
    following: string,
    action: 'blacklist' | 'unblacklist' | 'follow_blacklist' | 'unfollow_blacklist' | 'follow_muted' | 'unfollow_muted'
  ): Promise<KeychainResponse> {
    if (this.isDemoSession()) return this.demoReadOnlyResponse();
    if (!this.isInstalled() || !window.hive_keychain?.requestCustomJson) return this.unavailableResponse();
    return new Promise(resolve => {
      window.hive_keychain!.requestCustomJson!(follower, 'follow', 'Posting',
        JSON.stringify(['follow', { follower, following, what: [action] }]),
        `${action.replaceAll('_', ' ')} @${following}`, resolve);
    });
  }

  static async publishShortEvents(username: string, operations: any[]): Promise<KeychainResponse> {
    if (this.isDemoSession()) return this.demoReadOnlyResponse();
    try {
      if (!operations.length || operations.length > 4) throw new Error();
      for (const operation of operations) {
        const value = operation?.[1];
        const event = JSON.parse(value?.json);
        if (operation[0] !== 'custom_json' || event.app !== 'nebulosa-shorts' || event.version !== 1 || event.actor !== username ||
            !['snap', 'vote', 'resnap', 'channel'].includes(event.type) || !Array.isArray(value.required_auths) || value.required_auths.length ||
            !Array.isArray(value.required_posting_auths) || value.required_posting_auths.length !== 1 || value.required_posting_auths[0] !== username ||
            typeof value.id !== 'string' || !/^(nebulosa\.(shorts|channels)\.v1|neb\.(thread|channel)\.[a-f0-9]{20})$/.test(value.id) ||
            new TextEncoder().encode(value.id).length > 32 || new TextEncoder().encode(value.json).length > 8192) throw new Error();
      }
    } catch { return { success: false, error: 'Invalid no-rewards snap operation.' }; }
    if (!this.isInstalled() || !window.hive_keychain?.requestBroadcast) return this.unavailableResponse();
    return new Promise(resolve => {
      try { window.hive_keychain!.requestBroadcast!(username, operations, 'Posting', response => resolve(response || { success: false, error: 'No response from Keychain.' })); }
      catch { resolve({ success: false, error: 'Keychain could not publish the snap event.' }); }
    });
  }

  static async encodeMemoMessage(username: string, receiver: string, plaintext: string): Promise<KeychainResponse> {
    if (this.isDemoSession()) return this.demoReadOnlyResponse();
    if (!this.isInstalled() || !window.hive_keychain?.requestEncodeMessage) return { success: false, error: 'Hive Keychain with memo encryption support is required.' };
    return new Promise(resolve => {
      try { window.hive_keychain!.requestEncodeMessage!(username, receiver, `#${plaintext}`, 'Memo', response => resolve(response || { success: false, error: 'No response from Keychain.' })); }
      catch { resolve({ success: false, error: 'Keychain could not encrypt this message.' }); }
    });
  }

  static async decodeMemoMessage(username: string, ciphertext: string): Promise<KeychainResponse> {
    if (this.isDemoSession()) return this.demoReadOnlyResponse();
    if (!/^#[1-9A-HJ-NP-Za-km-z]{50,}$/.test(ciphertext)) return { success: false, error: 'Invalid encrypted memo.' };
    if (!this.isInstalled() || !window.hive_keychain?.requestVerifyKey) return { success: false, error: 'Hive Keychain with your private memo key is required.' };
    return new Promise(resolve => {
      try { window.hive_keychain!.requestVerifyKey!(username, ciphertext, 'Memo', response => resolve(response || { success: false, error: 'No response from Keychain.' })); }
      catch { resolve({ success: false, error: 'Keychain could not decrypt this message.' }); }
    });
  }

  static async broadcastChatMessage(username: string, recipient: string, json: string): Promise<KeychainResponse> {
    if (this.isDemoSession()) return this.demoReadOnlyResponse();
    try {
      const value = JSON.parse(json);
      if (value.app !== 'nebulosa-chat' || value.version !== 1 || !/^[a-f0-9-]{36}$/.test(value.id) ||
          !/^[a-z][a-z0-9.-]{2,15}$/.test(username) || !/^[a-z][a-z0-9.-]{2,15}$/.test(recipient) || username === recipient ||
          value.from !== username || value.to !== recipient || typeof value.memo !== 'string' || !/^#[1-9A-HJ-NP-Za-km-z]{100,}$/.test(value.memo) ||
          Object.keys(value).some(key => !['app', 'version', 'id', 'from', 'to', 'memo'].includes(key)) || new TextEncoder().encode(json).length > 8192) {
        return { success: false, error: 'Refusing to publish an invalid encrypted chat message.' };
      }
    } catch { return { success: false, error: 'Invalid encrypted chat message.' }; }
    if (!this.isInstalled() || !window.hive_keychain?.requestBroadcast) return this.unavailableResponse();
    const operations = [...new Set([username, recipient])].map(account => ['custom_json', {
      required_auths: [], required_posting_auths: [username], id: `nebulosa.chat.${account}`, json
    }]);
    return new Promise(resolve => {
      try { window.hive_keychain!.requestBroadcast!(username, operations, 'Posting', response => resolve(response || { success: false, error: 'No response from Keychain.' })); }
      catch { resolve({ success: false, error: 'Keychain could not publish this encrypted message.' }); }
    });
  }

  static async publishSavedList(username: string, id: string, json: string, title: string): Promise<KeychainResponse> {
    if (this.isDemoSession()) return this.demoReadOnlyResponse();
    if (!id || new TextEncoder().encode(id).length > 32 || new TextEncoder().encode(json).length > 8192) return { success: false, error: 'Invalid list payload size.' };
    if (!this.isInstalled() || !window.hive_keychain?.requestCustomJson) return this.unavailableResponse();
    return new Promise(resolve => {
      try {
        window.hive_keychain!.requestCustomJson!(username, id, 'Posting', json, title,
          response => resolve(response || { success: false, error: 'No response from Keychain.' }));
      } catch (error) { resolve({ success: false, error: error instanceof Error ? error.message : 'Keychain failed.' }); }
    });
  }

  static async unfollowUser(follower: string, following: string): Promise<KeychainResponse> {
    return this.followUser(follower, following, false);
  }

  /**
   * Mute or unmute a user on the Hive blockchain (ignore list)
   */
  static async muteUser(
    follower: string,
    following: string,
    mute: boolean = true
  ): Promise<KeychainResponse> {
    if (this.isDemoSession()) return this.demoReadOnlyResponse();
    const json = JSON.stringify([
      'follow',
      {
        follower,
        following,
        what: mute ? ['ignore'] : []
      }
    ]);

    if (!this.isInstalled() || !window.hive_keychain?.requestCustomJson) return this.unavailableResponse();

    return new Promise((resolve) => {
      window.hive_keychain!.requestCustomJson!(
        follower,
        'follow',
        'Posting',
        json,
        `${mute ? 'Mute' : 'Unmute'} @${following}`,
        (response) => {
          if (response.success) apiCache.invalidate(`muted_list:${follower.replace(/^@/, '').trim().toLowerCase()}`);
          resolve(response);
        }
      );
    });
  }

  static async unmuteUser(follower: string, following: string): Promise<KeychainResponse> {
    return this.muteUser(follower, following, false);
  }

  /**
   * Update Hive profile metadata on chain via account_update2 (Posting key)
   */
  static async updateProfile(
    username: string,
    profileData: {
      name?: string;
      about?: string;
      profile_image?: string;
      cover_image?: string;
      website?: string;
      location?: string;
      theme_id?: string;
      [key: string]: any;
    }
  ): Promise<KeychainResponse> {
    if (this.isDemoSession()) return this.demoReadOnlyResponse();
    const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();
    const op = [
      'account_update2',
      {
        account: cleanUsername,
        json_metadata: '',
        posting_json_metadata: JSON.stringify({
          profile: {
            ...profileData,
            version: 2
          }
        }),
        extensions: []
      }
    ];

    if (!this.isInstalled() || !window.hive_keychain?.requestBroadcast) {
      return { success: false, error: 'Updating your profile requires Hive Keychain with broadcast support.' };
    }

    return new Promise((resolve) => {
      window.hive_keychain!.requestBroadcast!(cleanUsername, [op], 'Posting', response => {
        if (response.success) {
          apiCache.invalidate(`account:${cleanUsername}`);
          apiCache.invalidate(`profile:${cleanUsername}`);
          invalidateProfileCache(cleanUsername);
        }
        resolve(response);
      });
    });
  }

  /**
   * Broadcast arbitrary custom_json operation via Hive Keychain
   */
  static async broadcastCustomJson(
    username: string,
    id: string,
    keyType: 'Posting' | 'Active' = 'Posting',
    json: string,
    displayName: string = 'Broadcast Custom JSON'
  ): Promise<KeychainResponse> {
    if (this.isDemoSession()) return this.demoReadOnlyResponse();
    if (!this.isInstalled() || !window.hive_keychain?.requestCustomJson) return this.unavailableResponse();

    return new Promise((resolve) => {
      window.hive_keychain!.requestCustomJson!(
        username,
        id,
        keyType,
        json,
        displayName,
        (response) => {
          resolve(response);
        }
      );
    });
  }

  /**
   * Send tip / transfer HIVE or HBD to an author
   */
  static async tip(
    username: string,
    to: string,
    amount: string,
    memo: string,
    currency: 'HIVE' | 'HBD' = 'HIVE'
  ): Promise<KeychainResponse> {
    if (this.isDemoSession()) return this.demoReadOnlyResponse();
    if (!this.isInstalled() || !window.hive_keychain?.requestTransfer) return this.unavailableResponse();

    return new Promise((resolve) => {
      window.hive_keychain!.requestTransfer!(
        username,
        to,
        amount,
        memo,
        currency,
        (response) => {
          resolve(response);
        }
      );
    });
  }
}
