import React from 'react';
import { ProfileTheme, ThemeProps } from './themeTypes';
import { ProfileHeaderSection } from '../components/ProfileHeaderSection';
import { ProfileBioSection } from '../components/ProfileBioSection';
import { ProfileFeedSection, ProfileTab } from '../components/ProfileFeedSection';
import { DEFAULT_PROFILE_STYLE } from '../profileStyleTypes';

const JournalistLayout: React.FC<ThemeProps> = (props) => {
  const { account, profile, posts, comments, replies, isOwner, isFollowing, onFollowToggle, onOpenCustomizer, activeTab, setActiveTab, history, loadingMore, onLoadMore, onSelectPost, onVote, onReblog } = props;
  const themeStyle = { ...DEFAULT_PROFILE_STYLE, structure: 'editorial-magazine' as const };
  return (
    <div className="space-y-8">
      <ProfileHeaderSection currentUser={account?.name || ''} account={account} metaProfile={profile?.metadata?.profile} style={themeStyle} isOwner={isOwner} isFollowing={isFollowing} onFollowToggle={onFollowToggle} onOpenCustomizer={onOpenCustomizer} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <ProfileFeedSection currentUser={account?.name || ''} activeTab={activeTab as ProfileTab} setActiveTab={setActiveTab} posts={posts} comments={comments} history={history} loadingMore={loadingMore} onLoadMore={onLoadMore} onSelectPost={onSelectPost} style={themeStyle} onClearTagFilter={() => {}} selectedTag={null} selectedTopic={null} onClearTopicFilter={() => {}} onSelectTag={() => {}} />
        </div>
        <div>
          <ProfileBioSection account={account} metaProfile={profile?.metadata?.profile} profileStats={profile?.stats} style={themeStyle} />
        </div>
      </div>
    </div>
  );
};

export const journalistTheme: ProfileTheme = {
  id: 'journalist-news',
  name: 'Modern Journalist',
  badge: '📰 Editorial',
  description: 'Clean magazine layout with focus on recent stories and high-impact typography',
  previewColor: '#0f172a',
  light: {
    ...DEFAULT_PROFILE_STYLE,
    structure: 'editorial-magazine',
  },
  dark: {
    ...DEFAULT_PROFILE_STYLE,
    structure: 'editorial-magazine',
  },
  Layout: JournalistLayout
};
