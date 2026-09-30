import React from 'react';
import { ProfileTheme, ThemeProps } from './themeTypes';
import { ProfileHeaderSection } from '../components/ProfileHeaderSection';
import { ProfileBioSection } from '../components/ProfileBioSection';
import { ProfileFeedSection, ProfileTab } from '../components/ProfileFeedSection';
import { DEFAULT_PROFILE_STYLE } from '../profileStyleTypes';

const AuthorLayout: React.FC<ThemeProps> = (props) => {
  const { account, profile, posts, comments, replies, isOwner, isFollowing, onFollowToggle, onOpenCustomizer, activeTab, setActiveTab, history, loadingMore, onLoadMore, onSelectPost, onVote, onReblog } = props;
  const themeStyle = { ...DEFAULT_PROFILE_STYLE, structure: 'compact-centered' as const, fontFamily: 'serif' as const };
  return (
    <div className="max-w-4xl mx-auto space-y-12 py-10 font-serif">
      <ProfileHeaderSection currentUser={account?.name || ''} account={account} metaProfile={profile?.metadata?.profile} style={themeStyle} isOwner={isOwner} isFollowing={isFollowing} onFollowToggle={onFollowToggle} onOpenCustomizer={onOpenCustomizer} />
      <div className="prose dark:prose-invert mx-auto">
        <ProfileBioSection account={account} metaProfile={profile?.metadata?.profile} profileStats={profile?.stats} style={themeStyle} />
      </div>
      <ProfileFeedSection currentUser={account?.name || ''} activeTab={activeTab as ProfileTab} setActiveTab={setActiveTab} posts={posts} comments={comments} history={history} loadingMore={loadingMore} onLoadMore={onLoadMore} onSelectPost={onSelectPost} style={themeStyle} onClearTagFilter={() => {}} selectedTag={null} selectedTopic={null} onClearTopicFilter={() => {}} onSelectTag={() => {}} />
    </div>
  );
};

export const authorTheme: ProfileTheme = {
  id: 'author-essayist',
  name: 'Author & Novelist',
  badge: '✍️ Writer',
  description: 'Centered reading focus without image distractions, warm tones and classic serif',
  previewColor: '#d97706',
  light: {
    ...DEFAULT_PROFILE_STYLE,
    structure: 'compact-centered',
    fontFamily: 'serif',
  },
  dark: {
    ...DEFAULT_PROFILE_STYLE,
    structure: 'compact-centered',
    fontFamily: 'serif',
    backgroundColor: '#1c1917',
    cardBackgroundColor: '#292524',
    headerBackgroundColor: '#292524',
    textColor: '#fef3c7',
    textSecondaryColor: '#d6d3d1',
  },
  Layout: AuthorLayout
};
