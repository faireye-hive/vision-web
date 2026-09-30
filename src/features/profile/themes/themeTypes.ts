import React from 'react';
import { HiveAccount, HivePost } from '../../../services/hiveApi';
import { ProfileCustomStyle } from '../profileStyleTypes';

export interface ThemeProps {
  // Raw Data
  account: HiveAccount | null;
  profile: any;
  blog?: HivePost[];
  blogPosts?: HivePost[];
  posts: HivePost[];
  comments: HivePost[];
  replies: HivePost[];
  mentions?: any[];
  history: any[];
  
  // Computed Stats (for convenience)
  reputation: number;
  votingPower: number;
  followerCount: number;
  followingCount: number;
  postCount: number;
  
  // App State & Callbacks
  isOwner: boolean;
  isFollowing: boolean;
  onFollowToggle: () => void;
  isMuted?: boolean;
  onMuteToggle?: () => void;
  onCommentReply?: (post: HivePost, body: string) => Promise<boolean>;
  onOpenCustomizer: () => void;
  onSelectPost: (post: HivePost) => void;
  onOpenUser: (username: string) => void;
  onOpenCommunity?: (communityName: string) => void;
  onVote?: (post: HivePost, weight: number) => Promise<void>;
  onReblog?: (post: HivePost) => Promise<void>;
  
  // Navigation
  activeTab: string;
  setActiveTab: (tab: 'blog' | 'posts' | 'comments' | 'replies' | 'mentions' | 'history' | any) => void;
  loadingMore: boolean;
  onLoadMore: () => void;
  hasMore?: boolean;
  tabLoading?: boolean;
}

export interface ProfileTheme {
  id: string;
  name: string;
  badge: string;
  description: string;
  previewColor: string;
  
  // Handcrafted style baselines for ProfilePage root variables
  light: ProfileCustomStyle;
  dark: ProfileCustomStyle;
  
  // The layout component that defines the ENTIRE HTML/CSS for this theme
  Layout: React.FC<ThemeProps>;
}
