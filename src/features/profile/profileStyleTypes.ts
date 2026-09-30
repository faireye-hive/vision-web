/**
 * Profile Style & Layout Customization Types
 * Encapsulates modular sections, diverse structural layouts, header & avatar framing,
 * granular stats & badges visibility, post card layouts (grid, list, magazine), and persona presets.
 */

export type ProfileSectionId = 'header' | 'bio' | 'stats' | 'badges' | 'feed';

export type ProfileStructureLayout =
  | 'hero-wide'
  | 'bento-grid'
  | 'split-columns'
  | 'compact-centered'
  | 'editorial-magazine'
  | 'floating-avatar'
  | 'sidebar-portrait'
  | 'minimalist-canvas';

export type ProfileHeaderLayout =
  | 'standard'
  | 'card-floating'
  | 'no-banner'
  | 'split-masthead'
  | 'minimal-banner';

export type ProfileAvatarShape = 'circle' | 'rounded-square' | 'squircle' | 'hexagon';

export type ProfileAvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export type ProfileAvatarBorder = 'none' | 'ring-accent' | 'glow' | 'double';

export type ProfileCardStyle = 'solid' | 'glass' | 'outline';

export type ProfileFontFamily = 'system' | 'serif' | 'mono' | 'display' | 'handwritten';

export type ProfileBorderRadius = 'none' | 'md' | 'xl' | '3xl';

export type ProfileHeaderAlignment = 'left' | 'center' | 'right';

// Post List & Card Layout Customization
export type ProfileFeedViewMode = 'list' | 'grid-2' | 'grid-3' | 'magazine' | 'compact';
export type ProfilePostImagePosition = 'right' | 'left' | 'top' | 'hidden';
export type ProfilePostImageRatio = '16/9' | '4/3' | '1/1' | 'wide';
export type ProfilePostTitlePosition = 'above-image' | 'below-image';
export type ProfilePostVotePosition = 'bottom' | 'top-right' | 'hidden';

export interface ProfilePostsLayoutConfig {
  feedView: ProfileFeedViewMode;
  imagePosition: ProfilePostImagePosition;
  imageRatio: ProfilePostImageRatio;
  titlePosition: ProfilePostTitlePosition;
  showSnippet: boolean;
  snippetLines: 1 | 2 | 3 | 4;
  votePosition: ProfilePostVotePosition;
  showTags: boolean;
  showPayout: boolean;
}

// Granular Stats items toggles
export interface ProfileStatsConfig {
  showReputation: boolean;
  showVotingPower: boolean;
  showFollowerCounts: boolean;
  showHiveBalance: boolean;
  showHbdBalance: boolean;
  showSavingsBalance: boolean;
  styleVariant: 'cards' | 'pills' | 'minimal-row';
}

// Granular Badges / Communities toggles
export interface ProfileBadgesConfig {
  showTopics: boolean;
  showCommunities: boolean;
  maxTopicsCount: number;
  styleVariant: 'grid' | 'pills' | 'compact-list';
}

// Header & Avatar Framing Config
export interface ProfileHeaderConfig {
  layout: ProfileHeaderLayout;
  avatarShape: ProfileAvatarShape;
  avatarSize: ProfileAvatarSize;
  avatarBorder: ProfileAvatarBorder;
  showVotingRing: boolean;
  bannerHeight: 'compact' | 'normal' | 'tall' | 'hidden';
}

export interface ProfileCustomStyle {
  version: 1;
  themeId: string; // ID from PROFILE_THEMES
  structure: ProfileStructureLayout;
  sectionsOrder: ProfileSectionId[];
  hiddenSections: ProfileSectionId[];

  // Header & Avatar Customization
  headerConfig: ProfileHeaderConfig;
  headerAlignment: ProfileHeaderAlignment;

  // Background Wallpaper & Solid Color
  backgroundUrl: string;
  backgroundColor: string; // Custom page background color (hex, e.g. #0f172a), empty = auto
  backgroundOverlayOpacity: number; // 0 to 100
  backgroundBlur: number; // 0 to 24 (px)

  // Custom Colors for Containers, Header and Typography
  cardBackgroundColor: string; // Custom card container background color, empty = auto
  headerBackgroundColor: string; // Custom header area background color, empty = auto
  textColor: string; // Custom primary text color (titles, display name), empty = auto
  textSecondaryColor: string; // Custom secondary text color (bio, stats labels, meta), empty = auto

  // Card Appearance
  cardStyle: ProfileCardStyle;
  accentColor: string; // hex e.g. #2563eb
  fontFamily: ProfileFontFamily;
  borderRadius: ProfileBorderRadius;

  // Granular section configurations
  statsConfig: ProfileStatsConfig;
  badgesConfig: ProfileBadgesConfig;
  postsLayout: ProfilePostsLayoutConfig;

  updatedAt?: number;
}

export const DEFAULT_SECTION_ORDER: ProfileSectionId[] = [
  'header',
  'bio',
  'stats',
  'badges',
  'feed'
];

export const SECTION_METADATA: Record<
  ProfileSectionId,
  { label: string; description: string }
> = {
  header: {
    label: 'Profile Header & Avatar',
    description: 'Cover banner, avatar shape, reputation and action buttons'
  },
  bio: {
    label: 'About & Metadata',
    description: 'Biography text, location, website, and follower counts'
  },
  stats: {
    label: 'Community & Finance Stats',
    description: 'Reputation, voting power, liquid HIVE/HBD and savings'
  },
  badges: {
    label: 'Badges & Communities',
    description: 'Top topics tags and subscribed/posted communities'
  },
  feed: {
    label: 'Publications & Activity',
    description: 'Feed layout (list, grid, magazine) and post items'
  }
};

export const DEFAULT_POSTS_LAYOUT: ProfilePostsLayoutConfig = {
  feedView: 'list',
  imagePosition: 'right',
  imageRatio: '16/9',
  titlePosition: 'above-image',
  showSnippet: true,
  snippetLines: 2,
  votePosition: 'bottom',
  showTags: true,
  showPayout: true
};

export const DEFAULT_STATS_CONFIG: ProfileStatsConfig = {
  showReputation: true,
  showVotingPower: true,
  showFollowerCounts: true,
  showHiveBalance: true,
  showHbdBalance: true,
  showSavingsBalance: true,
  styleVariant: 'cards'
};

export const DEFAULT_BADGES_CONFIG: ProfileBadgesConfig = {
  showTopics: true,
  showCommunities: true,
  maxTopicsCount: 16,
  styleVariant: 'grid'
};

export const DEFAULT_HEADER_CONFIG: ProfileHeaderConfig = {
  layout: 'standard',
  avatarShape: 'circle',
  avatarSize: 'lg',
  avatarBorder: 'ring-accent',
  showVotingRing: true,
  bannerHeight: 'normal'
};

export const DEFAULT_PROFILE_STYLE: ProfileCustomStyle = {
  version: 1,
  themeId: 'clean-slate',
  structure: 'hero-wide',
  sectionsOrder: [...DEFAULT_SECTION_ORDER],
  hiddenSections: [],
  headerConfig: { ...DEFAULT_HEADER_CONFIG },
  headerAlignment: 'left',
  backgroundUrl: '',
  backgroundColor: '',
  backgroundOverlayOpacity: 40,
  backgroundBlur: 0,
  cardBackgroundColor: '',
  headerBackgroundColor: '',
  textColor: '',
  textSecondaryColor: '',
  cardStyle: 'solid',
  accentColor: '#2563eb', // royal blue
  fontFamily: 'system',
  borderRadius: '3xl',
  statsConfig: { ...DEFAULT_STATS_CONFIG },
  badgesConfig: { ...DEFAULT_BADGES_CONFIG },
  postsLayout: { ...DEFAULT_POSTS_LAYOUT }
};

export const ACCENT_PALETTE: { label: string; hex: string }[] = [
  { label: 'Royal Blue', hex: '#2563eb' },
  { label: 'Neon Indigo', hex: '#6366f1' },
  { label: 'Electric Purple', hex: '#8b5cf6' },
  { label: 'Cyber Rose', hex: '#f43f5e' },
  { label: 'Amber Gold', hex: '#d97706' },
  { label: 'Emerald Jade', hex: '#10b981' },
  { label: 'Cyan Ocean', hex: '#06b6d4' },
  { label: 'Sky Azure', hex: '#0ea5e9' },
  { label: 'Crimson Red', hex: '#dc2626' },
  { label: 'Dark Slate', hex: '#334155' }
];

export const FONT_STACKS: Record<ProfileFontFamily, string> = {
  system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Iowan Old Style', 'Palatino Linotype', Palatino, serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  display: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  handwritten: "'Pangolin', 'Handlee', cursive"
};

export const BORDER_RADIUS_CLASSES: Record<ProfileBorderRadius, string> = {
  none: 'rounded-none',
  md: 'rounded-xl',
  xl: 'rounded-2xl',
  '3xl': 'rounded-[32px]'
};

export const BACKGROUND_COLOR_PALETTE: { label: string; hex: string }[] = [
  { label: 'Auto (Default)', hex: '' },
  { label: 'Pitch Black', hex: '#000000' },
  { label: 'Dark Slate', hex: '#0f172a' },
  { label: 'Deep Navy', hex: '#0a0f1d' },
  { label: 'Night Violet', hex: '#160b24' },
  { label: 'Forest Dark', hex: '#0a1a12' },
  { label: 'Clean Paper', hex: '#f8fafc' },
  { label: 'Warm Cream', hex: '#fdfbf7' },
  { label: 'Soft Vanilla', hex: '#fffbeb' }
];

export const CONTAINER_COLOR_PALETTE: { label: string; hex: string }[] = [
  { label: 'Auto (Default)', hex: '' },
  { label: 'Pure Black', hex: '#09090b' },
  { label: 'Dark Slate', hex: '#1e293b' },
  { label: 'Charcoal', hex: '#18181b' },
  { label: 'Midnight Blue', hex: '#0f172a' },
  { label: 'Deep Purple', hex: '#1e1435' },
  { label: 'Crisp White', hex: '#ffffff' },
  { label: 'Soft Gray', hex: '#f1f5f9' },
  { label: 'Warm Card', hex: '#fafaf9' }
];

export const TEXT_COLOR_PALETTE: { label: string; hex: string }[] = [
  { label: 'Auto (Default)', hex: '' },
  { label: 'Pure White', hex: '#ffffff' },
  { label: 'Light Slate', hex: '#f1f5f9' },
  { label: 'Cyber Cyan', hex: '#22d3ee' },
  { label: 'Gold Amber', hex: '#fbbf24' },
  { label: 'Neon Green', hex: '#4ade80' },
  { label: 'Dark Charcoal', hex: '#0f172a' },
  { label: 'Ink Black', hex: '#000000' },
  { label: 'Warm Espresso', hex: '#1c1917' }
];
