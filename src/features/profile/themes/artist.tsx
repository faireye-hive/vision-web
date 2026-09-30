import React from 'react';
import { ProfileTheme, ThemeProps } from './themeTypes';
import { ProfileHeaderSection } from '../components/ProfileHeaderSection';
import { ProfileFeedSection, ProfileTab } from '../components/ProfileFeedSection';
import { DEFAULT_PROFILE_STYLE } from '../profileStyleTypes';

const ArtistLayout: React.FC<ThemeProps> = (props) => {
  const { account, profile, posts, comments, replies, isOwner, isFollowing, onFollowToggle, onOpenCustomizer, activeTab, setActiveTab, history, loadingMore, onLoadMore, onSelectPost, onVote, onReblog } = props;
  const themeStyle = { ...DEFAULT_PROFILE_STYLE, structure: 'bento-grid' as const };
  return (
    <div className="space-y-6">
      <ProfileHeaderSection currentUser={account?.name || ''} account={account} metaProfile={profile?.metadata?.profile} style={themeStyle} isOwner={isOwner} isFollowing={isFollowing} onFollowToggle={onFollowToggle} onOpenCustomizer={onOpenCustomizer} />
      <ProfileFeedSection currentUser={account?.name || ''} activeTab={activeTab as ProfileTab} setActiveTab={setActiveTab} posts={posts} comments={comments} history={history} loadingMore={loadingMore} onLoadMore={onLoadMore} onSelectPost={onSelectPost} style={themeStyle} onClearTagFilter={() => {}} selectedTag={null} selectedTopic={null} onClearTopicFilter={() => {}} onSelectTag={() => {}} />
    </div>
  );
};

export const artistTheme: ProfileTheme = {
  id: 'artist-showcase',
  name: 'Creative Artist',
  badge: '🎨 Creative',
  description: 'Bento-style grid with glassmorphism effects and colorful highlights',
  previewColor: '#8b5cf6',
  light: {
    ...DEFAULT_PROFILE_STYLE,
    structure: 'bento-grid',
  },
  dark: {
    ...DEFAULT_PROFILE_STYLE,
    structure: 'bento-grid',
  },
  Layout: ArtistLayout
};
