import {
  ProfileCustomStyle,
  DEFAULT_PROFILE_STYLE,
  DEFAULT_SECTION_ORDER,
  ProfileSectionId,
  ProfileStructureLayout,
  ProfileHeaderLayout,
  ProfileAvatarShape,
  ProfileAvatarSize,
  ProfileAvatarBorder,
  ProfileFeedViewMode,
  ProfilePostImagePosition,
  ProfilePostImageRatio,
  ProfilePostTitlePosition,
  ProfilePostVotePosition
} from '../features/profile/profileStyleTypes';
import { getThemeById } from '../features/profile/themes';
import { getLatestAccountCustomJson, getAccount } from './hiveApi';
import { KeychainService } from './keychain';

export const PROFILE_STYLE_CUSTOM_JSON_ID = 'nebulosa_profile_style';
const LOCAL_STORAGE_PREFIX = 'nebulosa_profile_custom_style:';

function getStorageKey(username: string): string {
  return `${LOCAL_STORAGE_PREFIX}${username.replace(/^@/, '').trim().toLowerCase()}`;
}

/**
 * Validates and merges loaded style payload with defaults to guarantee all fields exist.
 * Now it respects the selected themeId if provided.
 */
export function sanitizeProfileStyle(raw: any): ProfileCustomStyle {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_PROFILE_STYLE };
  }

  const themeId = typeof raw.themeId === 'string' ? raw.themeId : 'clean-slate';
  const theme = getThemeById(themeId);
  // Default base for this theme (using light as baseline for sanitation, mode handled at render)
  const baseDefaults = theme.light;

  // Ensure sectionsOrder contains all valid sections and no duplicates
  const rawOrder = Array.isArray(raw.sectionsOrder) ? raw.sectionsOrder : [];
  const validSections: ProfileSectionId[] = ['header', 'bio', 'stats', 'badges', 'feed'];
  const sanitizedOrder: ProfileSectionId[] = [];

  for (const sec of rawOrder) {
    if (validSections.includes(sec) && !sanitizedOrder.includes(sec)) {
      sanitizedOrder.push(sec);
    }
  }

  // Append any missing sections to the end
  for (const sec of DEFAULT_SECTION_ORDER) {
    if (!sanitizedOrder.includes(sec)) {
      sanitizedOrder.push(sec);
    }
  }

  const rawHidden = Array.isArray(raw.hiddenSections) ? raw.hiddenSections : [];
  const sanitizedHidden: ProfileSectionId[] = rawHidden.filter((s: any) =>
    validSections.includes(s)
  );

  const validStructures: ProfileStructureLayout[] = [
    'hero-wide',
    'bento-grid',
    'split-columns',
    'compact-centered',
    'editorial-magazine',
    'floating-avatar',
    'sidebar-portrait',
    'minimalist-canvas'
  ];

  const rawHeader = raw.headerConfig || {};
  const sanitizedHeader = {
    layout: ['standard', 'card-floating', 'no-banner', 'split-masthead', 'minimal-banner'].includes(rawHeader.layout)
      ? rawHeader.layout
      : baseDefaults.headerConfig.layout,
    avatarShape: ['circle', 'rounded-square', 'squircle', 'hexagon'].includes(rawHeader.avatarShape)
      ? rawHeader.avatarShape
      : baseDefaults.headerConfig.avatarShape,
    avatarSize: ['sm', 'md', 'lg', 'xl'].includes(rawHeader.avatarSize)
      ? rawHeader.avatarSize
      : baseDefaults.headerConfig.avatarSize,
    avatarBorder: ['none', 'ring-accent', 'glow', 'double'].includes(rawHeader.avatarBorder)
      ? rawHeader.avatarBorder
      : baseDefaults.headerConfig.avatarBorder,
    showVotingRing: typeof rawHeader.showVotingRing === 'boolean'
      ? rawHeader.showVotingRing
      : baseDefaults.headerConfig.showVotingRing,
    bannerHeight: ['compact', 'normal', 'tall', 'hidden'].includes(rawHeader.bannerHeight)
      ? rawHeader.bannerHeight
      : baseDefaults.headerConfig.bannerHeight
  };

  const rawStats = raw.statsConfig || {};
  const sanitizedStats = {
    showReputation: typeof rawStats.showReputation === 'boolean' ? rawStats.showReputation : true,
    showVotingPower: typeof rawStats.showVotingPower === 'boolean' ? rawStats.showVotingPower : true,
    showFollowerCounts: typeof rawStats.showFollowerCounts === 'boolean' ? rawStats.showFollowerCounts : true,
    showHiveBalance: typeof rawStats.showHiveBalance === 'boolean' ? rawStats.showHiveBalance : true,
    showHbdBalance: typeof rawStats.showHbdBalance === 'boolean' ? rawStats.showHbdBalance : true,
    showSavingsBalance: typeof rawStats.showSavingsBalance === 'boolean' ? rawStats.showSavingsBalance : true,
    styleVariant: ['cards', 'pills', 'minimal-row'].includes(rawStats.styleVariant)
      ? rawStats.styleVariant
      : baseDefaults.statsConfig.styleVariant
  };

  const rawBadges = raw.badgesConfig || {};
  const sanitizedBadges = {
    showTopics: typeof rawBadges.showTopics === 'boolean' ? rawBadges.showTopics : true,
    showCommunities: typeof rawBadges.showCommunities === 'boolean' ? rawBadges.showCommunities : true,
    maxTopicsCount: typeof rawBadges.maxTopicsCount === 'number' ? Math.max(4, Math.min(32, rawBadges.maxTopicsCount)) : 16,
    styleVariant: ['grid', 'pills', 'compact-list'].includes(rawBadges.styleVariant)
      ? rawBadges.styleVariant
      : baseDefaults.badgesConfig.styleVariant
  };

  const rawPosts = raw.postsLayout || {};
  const sanitizedPosts = {
    feedView: ['list', 'grid-2', 'grid-3', 'magazine', 'compact'].includes(rawPosts.feedView)
      ? rawPosts.feedView
      : baseDefaults.postsLayout.feedView,
    imagePosition: ['right', 'left', 'top', 'hidden'].includes(rawPosts.imagePosition)
      ? rawPosts.imagePosition
      : baseDefaults.postsLayout.imagePosition,
    imageRatio: ['16/9', '4/3', '1/1', 'wide'].includes(rawPosts.imageRatio)
      ? rawPosts.imageRatio
      : baseDefaults.postsLayout.imageRatio,
    titlePosition: ['above-image', 'below-image'].includes(rawPosts.titlePosition)
      ? rawPosts.titlePosition
      : baseDefaults.postsLayout.titlePosition,
    showSnippet: typeof rawPosts.showSnippet === 'boolean' ? rawPosts.showSnippet : true,
    snippetLines: [1, 2, 3, 4].includes(rawPosts.snippetLines) ? rawPosts.snippetLines : 2,
    votePosition: ['bottom', 'top-right', 'hidden'].includes(rawPosts.votePosition)
      ? rawPosts.votePosition
      : baseDefaults.postsLayout.votePosition,
    showTags: typeof rawPosts.showTags === 'boolean' ? rawPosts.showTags : true,
    showPayout: typeof rawPosts.showPayout === 'boolean' ? rawPosts.showPayout : true
  };

  return {
    version: 1,
    themeId,
    structure: validStructures.includes(raw.structure) ? raw.structure : baseDefaults.structure,
    sectionsOrder: sanitizedOrder,
    hiddenSections: sanitizedHidden,
    headerConfig: sanitizedHeader,
    headerAlignment: ['left', 'center', 'right'].includes(raw.headerAlignment)
      ? raw.headerAlignment
      : baseDefaults.headerAlignment,
    backgroundUrl: typeof raw.backgroundUrl === 'string' ? raw.backgroundUrl : '',
    backgroundColor:
      typeof raw.backgroundColor === 'string' && (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(raw.backgroundColor) || raw.backgroundColor === '')
        ? raw.backgroundColor
        : baseDefaults.backgroundColor || '',
    backgroundOverlayOpacity:
      typeof raw.backgroundOverlayOpacity === 'number'
        ? Math.max(0, Math.min(100, raw.backgroundOverlayOpacity))
        : baseDefaults.backgroundOverlayOpacity,
    backgroundBlur:
      typeof raw.backgroundBlur === 'number'
        ? Math.max(0, Math.min(24, raw.backgroundBlur))
        : baseDefaults.backgroundBlur,
    cardBackgroundColor:
      typeof raw.cardBackgroundColor === 'string' && (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(raw.cardBackgroundColor) || raw.cardBackgroundColor === '')
        ? raw.cardBackgroundColor
        : baseDefaults.cardBackgroundColor || '',
    headerBackgroundColor:
      typeof raw.headerBackgroundColor === 'string' && (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(raw.headerBackgroundColor) || raw.headerBackgroundColor === '')
        ? raw.headerBackgroundColor
        : baseDefaults.headerBackgroundColor || '',
    textColor:
      typeof raw.textColor === 'string' && (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(raw.textColor) || raw.textColor === '')
        ? raw.textColor
        : baseDefaults.textColor || '',
    textSecondaryColor:
      typeof raw.textSecondaryColor === 'string' && (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(raw.textSecondaryColor) || raw.textSecondaryColor === '')
        ? raw.textSecondaryColor
        : baseDefaults.textSecondaryColor || '',
    cardStyle: ['solid', 'glass', 'outline'].includes(raw.cardStyle)
      ? raw.cardStyle
      : baseDefaults.cardStyle,
    accentColor:
      typeof raw.accentColor === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw.accentColor)
        ? raw.accentColor
        : baseDefaults.accentColor,
    fontFamily: ['system', 'serif', 'mono', 'display'].includes(raw.fontFamily)
      ? raw.fontFamily
      : baseDefaults.fontFamily,
    borderRadius: ['none', 'md', 'xl', '3xl'].includes(raw.borderRadius)
      ? raw.borderRadius
      : baseDefaults.borderRadius,
    statsConfig: sanitizedStats,
    badgesConfig: sanitizedBadges,
    postsLayout: sanitizedPosts,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : undefined
  };
}

/**
 * Loads the user's custom profile styling:
 * 1. Checks localStorage for instant hydration.
 * 2. Fetches recent `nebulosa_profile_style` custom_json from Hive blockchain history.
 * 3. Syncs and returns the sanitized result.
 */
export async function loadProfileStyle(
  username: string,
  skipNetwork: boolean = false
): Promise<ProfileCustomStyle> {
  const clean = username.replace(/^@/, '').trim().toLowerCase();
  if (!clean) return { ...DEFAULT_PROFILE_STYLE };

  let localCached: ProfileCustomStyle | null = null;

  try {
    const rawLocal = localStorage.getItem(getStorageKey(clean));
    if (rawLocal) {
      localCached = sanitizeProfileStyle(JSON.parse(rawLocal));
    }
  } catch {
    // Ignore storage parse errors
  }

  if (skipNetwork && localCached) {
    return localCached;
  }

  try {
    const chainCustomJson = await getLatestAccountCustomJson<any>(
      clean,
      PROFILE_STYLE_CUSTOM_JSON_ID,
      100
    );

    if (chainCustomJson) {
      const sanitized = sanitizeProfileStyle(chainCustomJson);
      try {
        localStorage.setItem(getStorageKey(clean), JSON.stringify(sanitized));
      } catch {
        // Storage might be full or private
      }
      return sanitized;
    }
  } catch (err) {
    console.warn(`Could not load on-chain profile style for @${clean}:`, err);
  }

  // 3. Fallback: check on-chain posting_json_metadata for profile.theme_id
  try {
    const acc = await getAccount(clean);
    if (acc?.posting_json_metadata) {
      const parsed = JSON.parse(acc.posting_json_metadata);
      if (parsed?.profile?.theme_id) {
        const sanitized = sanitizeProfileStyle({
          ...(localCached || {}),
          themeId: parsed.profile.theme_id
        });
        return sanitized;
      }
    }
  } catch {
    // Ignore JSON parse errors
  }

  return localCached || { ...DEFAULT_PROFILE_STYLE };
}

/**
 * Saves profile style both to localStorage and broadcasts to Hive blockchain via Keychain.
 */
export async function saveProfileStyleToBlockchain(
  username: string,
  style: ProfileCustomStyle
): Promise<{ success: boolean; message?: string }> {
  const clean = username.replace(/^@/, '').trim().toLowerCase();
  if (!clean) {
    return { success: false, message: 'Invalid username' };
  }

  const payload: ProfileCustomStyle = {
    ...sanitizeProfileStyle(style),
    updatedAt: Date.now()
  };

  // 1. Save locally for instant preview and offline availability
  try {
    localStorage.setItem(getStorageKey(clean), JSON.stringify(payload));
  } catch (err) {
    console.warn('LocalStorage save error:', err);
  }

  // 2. Broadcast custom_json to Hive
  try {
    const jsonString = JSON.stringify(payload);
    const result = await KeychainService.broadcastCustomJson(
      clean,
      PROFILE_STYLE_CUSTOM_JSON_ID,
      'Posting',
      jsonString,
      'Save Profile Layout & Style'
    );

    if (result.success) {
      return { success: true, message: 'Profile layout and style published to Hive!' };
    } else {
      return {
        success: false,
        message: result.message || result.error || 'Failed to broadcast style via Hive Keychain.'
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Error communicating with Hive Keychain.'
    };
  }
}

/**
 * Saves profile style strictly to local storage without blockchain broadcasting (for drafts/previews).
 */
export function saveProfileStyleLocal(username: string, style: ProfileCustomStyle): void {
  const clean = username.replace(/^@/, '').trim().toLowerCase();
  if (!clean) return;
  try {
    localStorage.setItem(getStorageKey(clean), JSON.stringify(sanitizeProfileStyle(style)));
  } catch {
    // Ignore
  }
}

/**
 * Resets local styling to defaults.
 */
export function resetProfileStyleLocal(username: string): ProfileCustomStyle {
  const clean = username.replace(/^@/, '').trim().toLowerCase();
  if (clean) {
    try {
      localStorage.removeItem(getStorageKey(clean));
    } catch {
      // Ignore
    }
  }
  return { ...DEFAULT_PROFILE_STYLE };
}
