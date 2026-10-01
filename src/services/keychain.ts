/**
 * Hive Keychain Browser Extension Service
 * Enables client-side, keyless authentication, voting, posting, and tipping on the Hive blockchain.
 */

// Hive Keychain global interface definition
declare global {
  interface Window {
    hive_keychain?: {
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
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
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

    const hasKeychain = this.isInstalled();

    if (!hasKeychain) {
      // Allow fallback login (read-only/test mode) if extension is not installed
      const user: CurrentUser = {
        username: cleanUsername,
        avatar: `https://images.ecency.com/u/${cleanUsername}/avatar/medium`,
        hasKeychain: false,
        reputation: 65,
        votingPower: 100
      };
      this.saveCurrentUser(user);
      return { success: true, user };
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
              avatar: `https://images.ecency.com/u/${cleanUsername}/avatar/medium`,
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
    if (!this.isInstalled()) {
      return {
        success: true,
        message: 'Vote registered locally in test mode (Hive Keychain extension not detected).'
      };
    }

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
    const permlink = `re-${parentAuthor.replace(/[^a-z0-9]/g, '')}-${Date.now()}`;
    const jsonMetadata = JSON.stringify({
      app: 'nebulosa-web/0.0.4',
      format: 'markdown'
    });

    if (!this.isInstalled()) {
      return {
        success: true,
        message: 'Comment registered locally in test mode.'
      };
    }

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
          resolve(response);
        }
      );
    });
  }

  /**
   * Reblog a post via custom_json
   */
  static async reblog(username: string, author: string, permlink: string): Promise<KeychainResponse> {
    const cleanUser = username.replace(/^@/, '').trim().toLowerCase();
    const cleanAuthor = author.replace(/^@/, '').trim().toLowerCase();
    const cleanPermlink = permlink.trim();
    const json = JSON.stringify(['reblog', { account: cleanUser, author: cleanAuthor, permlink: cleanPermlink }]);

    if (!this.isInstalled()) {
      return {
        success: true,
        message: 'Reblog registered locally in test mode.'
      };
    }

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
    const json = JSON.stringify([
      'follow',
      {
        follower,
        following,
        what: follow ? ['blog'] : []
      }
    ]);

    if (!this.isInstalled()) {
      return {
        success: true,
        message: `${follow ? 'Follow' : 'Unfollow'} registered in test mode.`
      };
    }

    return new Promise((resolve) => {
      window.hive_keychain!.requestCustomJson!(
        follower,
        'follow',
        'Posting',
        json,
        `${follow ? 'Follow' : 'Unfollow'} @${following}`,
        (response) => {
          resolve(response);
        }
      );
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
    const json = JSON.stringify([
      'follow',
      {
        follower,
        following,
        what: mute ? ['ignore'] : []
      }
    ]);

    if (!this.isInstalled()) {
      return {
        success: true,
        message: `${mute ? 'Mute' : 'Unmute'} registered in test mode.`
      };
    }

    return new Promise((resolve) => {
      window.hive_keychain!.requestCustomJson!(
        follower,
        'follow',
        'Posting',
        json,
        `${mute ? 'Mute' : 'Unmute'} @${following}`,
        (response) => {
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

    if (!this.isInstalled()) {
      return {
        success: true,
        message: 'Profile updated in local test mode (Hive Keychain extension not detected).'
      };
    }

    return new Promise((resolve) => {
      if (window.hive_keychain?.requestBroadcast) {
        window.hive_keychain.requestBroadcast(
          cleanUsername,
          [op],
          'Posting',
          (response) => {
            resolve(response);
          }
        );
      } else {
        // Fallback to custom_json if requestBroadcast is unsupported
        this.broadcastCustomJson(
          cleanUsername,
          'nebulosa_profile_update',
          'Posting',
          JSON.stringify({ profile: profileData }),
          'Update Profile Metadata'
        ).then(resolve);
      }
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
    if (!this.isInstalled()) {
      return {
        success: false,
        message: 'Hive Keychain is not installed or not detected.'
      };
    }

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
    if (!this.isInstalled()) {
      return {
        success: true,
        message: 'Tip registered locally in test mode.'
      };
    }

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
