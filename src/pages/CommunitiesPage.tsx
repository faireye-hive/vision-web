import React from 'react';
import { ExploreCommunitiesPage } from './ExploreCommunitiesPage';
import { ManageCommunitiesPage } from './ManageCommunitiesPage';

export interface CommunitiesPageProps {
  mode: 'explore' | 'manage';
  onSwitchMode: (mode: 'explore' | 'manage') => void;
  onSelectCommunity: (communityName: string) => void;
  joinedCommunities: Record<string, boolean>;
  onToggleJoinCommunity: (communityName: string) => Promise<string | null> | string | null;
  account?: string | null;
}

export { ExploreCommunitiesPage } from './ExploreCommunitiesPage';
export { ManageCommunitiesPage } from './ManageCommunitiesPage';

/**
 * CommunitiesPage Router/Facade
 *
 * Provides dedicated, decoupled views for:
 * 1. Explore Communities (src/pages/ExploreCommunitiesPage.tsx)
 * 2. Manage Subscribed Communities (src/pages/ManageCommunitiesPage.tsx)
 */
export const CommunitiesPage: React.FC<CommunitiesPageProps> = ({
  mode,
  onSwitchMode,
  onSelectCommunity,
  joinedCommunities,
  onToggleJoinCommunity,
  account = null
}) => {
  if (mode === 'manage') {
    return (
      <ManageCommunitiesPage
        onSwitchToExplore={() => onSwitchMode('explore')}
        onSelectCommunity={onSelectCommunity}
        joinedCommunities={joinedCommunities}
        onToggleJoinCommunity={onToggleJoinCommunity}
        account={account}
      />
    );
  }

  return (
    <ExploreCommunitiesPage
      onSwitchToManage={() => onSwitchMode('manage')}
      onSelectCommunity={onSelectCommunity}
      joinedCommunities={joinedCommunities}
      onToggleJoinCommunity={onToggleJoinCommunity}
      account={account}
    />
  );
};

export default CommunitiesPage;