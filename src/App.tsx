import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BookmarksProvider } from './context/BookmarksContext';
import { ContentFilterProvider, useContentFilter } from './context/ContentFilterContext';
import { NavigationProvider, useNavigation } from './context/NavigationContext';

// Pages
import { FeedPage } from './pages/FeedPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { ShortsPage } from './pages/ShortsPage';
import { CommunitiesPage } from './pages/CommunitiesPage';
import { ProfilePage } from './pages/ProfilePage';
import { WritePage } from './pages/WritePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { FollowingManagerPage } from './pages/FollowingManagerPage';

// Components
import { Navbar } from './components/Navbar';
import { LeftSidebar } from './components/LeftSidebar';
import { PostReader } from './components/PostReader';
import { PostSidebar } from './components/PostSidebar';
import { BlockchainStatsModal } from './components/BlockchainStatsModal';
import { ContentFilterModal } from './components/ContentFilterModal';
import { GhostNotificationToast } from './components/GhostNotificationToast';
import { ShortsWordFilterCard } from './components/ShortsWordFilterCard';
import { TrendingTopicsCard } from './components/TrendingTopicsCard';
import { RecommendedUsersCard } from './components/RecommendedUsersCard';

import { HivePost } from './services/hiveApi';
import { CommunityInfoCard } from './components/CommunityInfoCard';
import { CommunityTopicsCard } from './components/CommunityTopicsCard';
import { SubscribedCommunitiesCard } from './components/SubscribedCommunitiesCard';
import { ThemeMode, getInitialTheme, applyTheme } from './utils/theme';

function NebulosaApp() {
  const { currentUser, login, logout, followingUsersList, setFollowingUsersList, joinedCommunities, toggleJoinCommunity } = useAuth();
  const [communityPosts, setCommunityPosts] = useState<HivePost[]>([]);
  const [discoverPosts, setDiscoverPosts] = useState<HivePost[]>([]);

  const handleDiscoverPostsLoaded = useCallback((loaded: HivePost[]) => {
    setDiscoverPosts(loaded);
  }, []);

  const handleCommunityPostsLoaded = useCallback((loaded: HivePost[]) => {
    setCommunityPosts(loaded);
  }, []);
  const {
    activeNav,
    handleNavChange,
    sort,
    setSort,
    tag,
    setTag,
    feedAuthor,
    setFeedAuthor,
    handleSelectAuthor,
    standalonePage,
    profileUser,
    openStandalonePage,
    closeStandalonePage,
    openAuthorProfile,
    openCommunity,
    openWritePage,
    openFollowingManager,
    openNotificationsPage,
    openCommunitiesModal,
    openManageCommunitiesModal,
    selectedPost,
    postHeadings,
    setPostHeadings,
    handleSelectPost,
    handleClosePost,
    handleSelectHeading,
    handleOpenNotificationPost,
    communitySubTopic,
    setCommunitySubTopic,
    restoreScrollPosition,
    showStatsModal,
    setShowStatsModal,
    openStatsModal,
    showContentFilterModal,
    setShowContentFilterModal,
    unreadNotifsCount,
    setUnreadNotifsCount,
    ghostNotification,
    setGhostNotification
  } = useNavigation();

  const {
    config: contentFilterConfig,
    addFilterWord,
    removeFilterWord,
    clearFilterWords,
    addFilterAuthor,
    removeFilterAuthor,
    clearFilterAuthors,
    toggleFilterEnabled
  } = useContentFilter();

  // Theme Management
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  // Scroll restoration logic when closing a post
  useEffect(() => {
    // Only restore when returning to a feed (no post, no standalone page)
    if (!selectedPost && !standalonePage) {
      // Small delay to ensure the 'hidden' class is removed and layout is stable
      const timer = setTimeout(() => {
        restoreScrollPosition();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedPost, standalonePage, restoreScrollPosition]);

  // Shorts state & filtering
  const [shortsHashtags, setShortsHashtags] = useState<{ tag: string; count: number }[]>([]);
  const [selectedShortTag, setSelectedShortTag] = useState<string>('');
  const [shortsHiddenCount, setShortsHiddenCount] = useState<number>(0);

  const [blockedWords, setBlockedWords] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hive_shorts_blocked_words');
      return saved ? JSON.parse(saved) : ['giveaway', 'airdrop'];
    } catch {
      return ['giveaway', 'airdrop'];
    }
  });

  const [shortsFilterEnabled, setShortsFilterEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('hive_shorts_filter_enabled') !== 'false';
    } catch {
      return true;
    }
  });

  const handleAddBlockedWord = (word: string) => {
    const clean = word.trim().toLowerCase();
    if (!clean || blockedWords.includes(clean)) return;
    const next = [...blockedWords, clean];
    setBlockedWords(next);
    localStorage.setItem('hive_shorts_blocked_words', JSON.stringify(next));
  };

  const handleRemoveBlockedWord = (word: string) => {
    const next = blockedWords.filter((w) => w !== word);
    setBlockedWords(next);
    localStorage.setItem('hive_shorts_blocked_words', JSON.stringify(next));
  };

  const handleClearAllBlockedWords = () => {
    setBlockedWords([]);
    localStorage.setItem('hive_shorts_blocked_words', JSON.stringify([]));
  };

  const handleToggleShortsFilterEnabled = () => {
    setShortsFilterEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('hive_shorts_filter_enabled', String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f8fa] dark:bg-[#0b0f17] text-gray-900 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Top Navbar */}
      <Navbar
        currentSort={sort}
        onSortChange={(s) => setSort(s)}
        currentTag={tag}
        onTagChange={(t) => {
          setTag(t);
          setFeedAuthor(null);
          if (selectedPost) handleClosePost();
        }}
        onOpenAccount={(user) => openAuthorProfile(user)}
        onOpenStats={openStatsModal}
        onOpenCommunities={openCommunitiesModal}
        onOpenManageCommunities={openManageCommunitiesModal}
        onOpenWrite={openWritePage}
        onOpenNotifications={openNotificationsPage}
        onOpenManageFollowing={openFollowingManager}
        unreadNotificationsCount={unreadNotifsCount}
        activeNav={activeNav}
        onNavChange={handleNavChange}
        currentUser={currentUser}
        onLogin={login}
        onLogout={logout}
        isDark={theme === 'dark'}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6">
        {/* ================= STANDALONE PAGES ================= */}
        {standalonePage === 'write' && (
          <WritePage
            onClose={closeStandalonePage}
            currentUser={currentUser}
            onRequireLogin={() => {
              window.dispatchEvent(new CustomEvent('nebulosa:open-login'));
            }}
            defaultCommunity={tag.startsWith('hive-') ? tag : ''}
            joinedCommunities={joinedCommunities}
          />
        )}

        {standalonePage === 'following' && (
          <FollowingManagerPage
            currentUser={currentUser}
            onClose={closeStandalonePage}
            onOpenProfile={(user) => openStandalonePage('profile', user)}
            onRequireLogin={() => {
              window.dispatchEvent(new CustomEvent('nebulosa:open-login'));
            }}
          />
        )}

        {standalonePage === 'notifications' && (
          <NotificationsPage
            currentUser={currentUser}
            onClose={closeStandalonePage}
            onOpenPost={(author, permlink) => handleOpenNotificationPost(author, permlink)}
            onOpenUser={(user) => openStandalonePage('profile', user)}
            onRequireLogin={() => {
              window.dispatchEvent(new CustomEvent('nebulosa:open-login'));
            }}
            onNotificationsRead={() => setUnreadNotifsCount(0)}
          />
        )}

        {standalonePage === 'profile' && (
          <ProfilePage
            username={profileUser || currentUser?.username || ''}
            onClose={closeStandalonePage}
            onSelectPost={(post) => handleSelectPost(post)}
            onOpenUser={(user) => openStandalonePage('profile', user)}
            onOpenCommunity={(communityName) => {
              openCommunity(communityName);
            }}
          />
        )}

        {(standalonePage === 'explore' || standalonePage === 'manage') && (
          <CommunitiesPage
            mode={standalonePage}
            onClose={closeStandalonePage}
            onSwitchMode={(mode) => openStandalonePage(mode)}
            joinedCommunities={joinedCommunities}
            onToggleJoinCommunity={toggleJoinCommunity}
            account={currentUser?.username || null}
            onSelectCommunity={(communityName) => {
              openCommunity(communityName);
            }}
          />
        )}

        {/* ================= IN-PLACE POST READER (BOOKMARKS & OUTLINE) ================= */}
        {selectedPost && !standalonePage && activeNav !== 'shorts' && (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start animate-in fade-in duration-150">
            <aside className="hidden lg:block sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
              <PostSidebar
                post={selectedPost}
                headings={postHeadings}
                onSelectHeading={handleSelectHeading}
                onSelectPost={handleSelectPost}
                onClose={handleClosePost}
              />
            </aside>

            <section className="min-w-0 flex-1">
              <PostReader
                post={selectedPost}
                onClose={handleClosePost}
                onSelectAuthor={handleSelectAuthor}
                onSelectTag={(t) => {
                  setTag(t);
                  handleClosePost();
                }}
                currentUser={currentUser}
                onRequireLogin={() => {
                  window.dispatchEvent(new CustomEvent('nebulosa:open-login'));
                }}
                onHeadingsExtracted={setPostHeadings}
                onSelectPost={(p) => handleSelectPost(p, true, false)}
              />
            </section>
          </div>
        )}

        {/* ================= RESPONSIVE THREE-COLUMN LAYOUT ================= */}
        <div
          className={`grid grid-cols-1 lg:grid-cols-[260px_1fr] xl:grid-cols-[260px_1fr_300px] gap-6 items-start ${
            (selectedPost && activeNav !== 'shorts') || standalonePage ? 'hidden' : 'grid'
          }`}
        >
          {/* Left Navigation Sidebar */}
          <aside className="hidden lg:block sticky top-20 self-start">
            <LeftSidebar
              activeNav={activeNav}
              onNavChange={handleNavChange}
              currentSort={sort}
              onSortChange={(s) => setSort(s)}
              currentTag={tag}
              onSelectTag={(t) => {
                setTag(t);
                setFeedAuthor(null);
              }}
              onSelectAuthor={handleSelectAuthor}
              activeAuthor={feedAuthor}
              currentUser={currentUser}
              onOpenManageCommunities={openManageCommunitiesModal}
              onOpenManageFollowing={openFollowingManager}
              joinedCommunities={joinedCommunities}
              shortsHashtags={shortsHashtags}
              selectedShortTag={selectedShortTag}
              onSelectShortTag={setSelectedShortTag}
            />
          </aside>

          {/* Center Main Screen Feed Area */}
          <section className="min-w-0 flex-1">
            {activeNav === 'feed' && <FeedPage />}
            {activeNav === 'discover' && <DiscoverPage onPostsLoaded={handleDiscoverPostsLoaded} />}
            {activeNav === 'communities' && (
              <DiscoverPage
                isCommunitiesFeed={true}
                onPostsLoaded={handleCommunityPostsLoaded}
              />
            )}
            {activeNav === 'shorts' && (
              <ShortsPage
                selectedTag={selectedShortTag}
                onSelectTag={setSelectedShortTag}
                blockedWords={blockedWords}
                filterEnabled={shortsFilterEnabled}
                onToggleFilter={handleToggleShortsFilterEnabled}
                onHashtagsExtracted={setShortsHashtags}
                onHiddenCountChange={setShortsHiddenCount}
              />
            )}
          </section>

          {/* Right Column Contextual Widgets */}
          <aside className="hidden xl:block space-y-6 sticky top-20 self-start">
            {activeNav === 'shorts' ? (
              <>
                <ShortsWordFilterCard
                  blockedWords={blockedWords}
                  onAddWord={handleAddBlockedWord}
                  onRemoveWord={handleRemoveBlockedWord}
                  onClearAll={handleClearAllBlockedWords}
                  filterEnabled={shortsFilterEnabled}
                  onToggleFilter={handleToggleShortsFilterEnabled}
                  hiddenCount={shortsHiddenCount}
                />

                <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none border border-gray-100/60 dark:border-slate-800 space-y-3 text-gray-900 dark:text-slate-100">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white">About Shorts</h3>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed">
                    Shorts brings decentralized microblogging to Hive. Snaps are published by community members directly as comments under container posts by <span className="font-semibold text-gray-800 dark:text-slate-200">@peak.snaps</span>.
                  </p>
                  <div className="pt-2 border-t border-gray-100 dark:border-slate-800 space-y-2 text-xs text-gray-500 dark:text-slate-400">
                    <div className="flex items-center justify-between">
                      <span>Protocol</span>
                      <span className="font-semibold text-gray-800 dark:text-slate-200">PeakD Snaps</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Source</span>
                      <span className="font-semibold text-gray-800 dark:text-slate-200">@peak.snaps</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Feed Type</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">Twitter-like Stream</span>
                    </div>
                  </div>
                </div>
              </>
            ) : activeNav === 'communities' ? (
              tag && tag.startsWith('hive-') ? (
                <>
                  <CommunityInfoCard
                    communityName={tag}
                    onSelectAuthor={handleSelectAuthor}
                  />
                  <CommunityTopicsCard
                    communityPosts={communityPosts}
                    currentTag={tag}
                  />
                </>
              ) : (
                <SubscribedCommunitiesCard
                  onSelectCommunity={(commName) => {
                    openCommunity(commName);
                    setCommunitySubTopic('');
                  }}
                />
              )
            ) : activeNav === 'discover' ? (
              <TrendingTopicsCard
                currentTag={tag}
                currentSort={sort}
                feedPosts={discoverPosts}
                onSelectTag={(newTag) => {
                  setTag(newTag);
                  setFeedAuthor(null);
                }}
              />
            ) : (
              <RecommendedUsersCard
                currentUser={currentUser}
                feedPosts={[]}
                onSelectAuthor={handleSelectAuthor}
                activeAuthor={feedAuthor}
                followingUsers={followingUsersList}
                onFollowChange={(targetUser, isNowFollowing) => {
                  setFollowingUsersList((prev) => {
                    const targetLower = targetUser.toLowerCase();
                    if (isNowFollowing) {
                      return prev.some((u) => u.toLowerCase() === targetLower) ? prev : [...prev, targetUser];
                    } else {
                      return prev.filter((u) => u.toLowerCase() !== targetLower);
                    }
                  });
                }}
              />
            )}
          </aside>
        </div>
      </main>

      {/* Blockchain Stats Modal */}
      {showStatsModal && (
        <BlockchainStatsModal
          onClose={() => {
            if (window.history.state?.type === 'modal') {
              window.history.back();
            } else {
              setShowStatsModal(false);
            }
          }}
        />
      )}

      {/* Content & Mute Filters Modal */}
      <ContentFilterModal
        isOpen={showContentFilterModal}
        onClose={() => {
          if (window.history.state?.type === 'modal') {
            window.history.back();
          } else {
            setShowContentFilterModal(false);
          }
        }}
        words={contentFilterConfig.words}
        authors={contentFilterConfig.authors}
        enabled={contentFilterConfig.enabled}
        onAddWord={addFilterWord}
        onRemoveWord={removeFilterWord}
        onClearWords={clearFilterWords}
        onAddAuthor={addFilterAuthor}
        onRemoveAuthor={removeFilterAuthor}
        onClearAuthors={clearFilterAuthors}
        onToggleEnabled={toggleFilterEnabled}
      />

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-gray-400 dark:text-slate-500 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 mt-12 shadow-[0_-1px_4px_rgba(0,0,0,0.02)] transition-colors">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/assets/logo-circle.svg" alt="Nebulosa" className="w-5 h-5" />
            <span className="font-semibold text-gray-700 dark:text-slate-200">Nebulosa Vision</span>
            <span>• Direct Hive Blockchain Client with Keychain Support</span>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500">
            Zero Server Backend • No Secrets • 100% Client-Side JSON-RPC & DOMPurify XSS Protection
          </p>
        </div>
      </footer>

      {/* Ghost Notification Toast */}
      <GhostNotificationToast
        notification={ghostNotification}
        onClose={() => setGhostNotification(null)}
        onClick={(notif) => {
          setGhostNotification(null);
          if (notif.url) {
            const clean = notif.url.replace(/^@/, '');
            const parts = clean.split('/');
            if (parts.length >= 2) {
              handleOpenNotificationPost(parts[0], parts.slice(1).join('/'));
              return;
            }
          }
          openNotificationsPage();
        }}
      />
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NavigationProvider>
          <ContentFilterProvider>
            <BookmarksProvider>
              <NebulosaApp />
            </BookmarksProvider>
          </ContentFilterProvider>
        </NavigationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;