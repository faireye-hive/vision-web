import React, { Suspense, lazy, useState, useEffect, useCallback } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BookmarksProvider } from './context/BookmarksContext';
import { ContentFilterProvider, useContentFilter } from './context/ContentFilterContext';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import { NotificationsProvider, useNotifications } from './context/NotificationsContext';

// First-screen pages stay eager. The rest load when the route opens.
import { FeedPage } from './pages/FeedPage';
import { DiscoverPage } from './pages/DiscoverPage';

import { Navbar } from './components/Navbar';
import { LeftSidebar } from './components/LeftSidebar';
import { PostSidebar } from './components/PostSidebar';
import { ContentFilterModal } from './components/ContentFilterModal';
import { NotificationToastHost } from './components/NotificationToastHost';
import { RightRail } from './components/RightRail';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MobileSideDrawer } from './components/MobileSideDrawer';

import { HivePost } from './services/hiveApi';
import { syncRecommendationsInBackground } from './services/recommendationService';
import { requestLogin } from './utils/authEvents';
import { ThemeMode, getInitialTheme, applyTheme } from './utils/theme';
import { applyReadingStyle, readReadingStyle } from './utils/readingStyle';
import { useShortsWordFilter } from './hooks/useShortsWordFilter';
import { ProfileReaderAppearance } from './features/profile/profileStyleTypes';

const ShortsPage = lazy(() => import('./pages/ShortsPage').then((m) => ({ default: m.ShortsPage })));
const WritePage = lazy(() => import('./pages/WritePage').then((m) => ({ default: m.WritePage })));
const FollowingManagerPage = lazy(() => import('./pages/FollowingManagerPage').then((m) => ({ default: m.FollowingManagerPage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const ExploreCommunitiesPage = lazy(() => import('./pages/ExploreCommunitiesPage').then((m) => ({ default: m.ExploreCommunitiesPage })));
const ManageCommunitiesPage = lazy(() => import('./pages/ManageCommunitiesPage').then((m) => ({ default: m.ManageCommunitiesPage })));
const PostReader = lazy(() => import('./components/PostReader').then((m) => ({ default: m.PostReader })));
const BlockchainStatsModal = lazy(() => import('./components/BlockchainStatsModal').then((m) => ({ default: m.BlockchainStatsModal })));

function RouteFallback() {
  return (
    <div className="py-16 text-center text-sm text-gray-500 dark:text-slate-400">
      Loading…
    </div>
  );
}

function NebulosaApp() {
  const { currentUser, login, logout, joinedCommunities, toggleJoinCommunity, followingUsersList } = useAuth();
  const [communityPosts, setCommunityPosts] = useState<HivePost[]>([]);
  const [discoverPosts, setDiscoverPosts] = useState<HivePost[]>([]);
  const [profileReaderAppearance, setProfileReaderAppearance] = useState<ProfileReaderAppearance | null>(null);

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
    setCommunitySubTopic,
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
    restoreScrollPosition,
    showStatsModal,
    setShowStatsModal,
    openStatsModal,
    showContentFilterModal,
    setShowContentFilterModal,
    selectedLanguage,
    setSelectedLanguage
  } = useNavigation();

  const isEmbeddedCommunitiesPage = activeNav === 'communities' &&
    (standalonePage === 'explore' || standalonePage === 'manage');
  const isCommunityPostOpen = activeNav === 'communities' && Boolean(selectedPost) && !standalonePage;
  const isProfilePostOpen = Boolean(profileReaderAppearance && selectedPost && standalonePage === 'profile');

  useEffect(() => {
    if (!selectedPost) setProfileReaderAppearance(null);
  }, [selectedPost]);
  const [visitedCommunityPages, setVisitedCommunityPages] = useState({ explore: false, manage: false });

  useEffect(() => {
    if (standalonePage === 'explore' || standalonePage === 'manage') {
      setVisitedCommunityPages((visited) => ({ ...visited, [standalonePage]: true }));
    }
  }, [standalonePage]);

  const shortsFilter = useShortsWordFilter();

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

  const { unreadCount: unreadNotificationsCount } = useNotifications();

  // Theme Management
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
    applyReadingStyle(readReadingStyle(), theme);
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  // Scroll restoration when closing a post. Shorts keeps its own offset:
  // this global restore is 0 for that tab and was pulling the list back to the top.
  useEffect(() => {
    if (activeNav === 'shorts') return;
    if (!selectedPost && !standalonePage) {
      const timer = setTimeout(() => {
        restoreScrollPosition();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedPost, standalonePage, restoreScrollPosition, activeNav]);

  // Personalized Recommendation background sync:
  // Starts silently in background the first time the user opens the app each day.
  // Cached in IndexedDB with 24h TTL, zero API spam or overload.
  useEffect(() => {
    if (currentUser?.username) {
      // Fire-and-forget in background; service internally guards against TTL and concurrent runs
      syncRecommendationsInBackground(currentUser.username, false).catch((err) => {
        console.warn('[App] Background recommendation sync check failed:', err);
      });
    }
  }, [currentUser?.username]);



  return (
    <div className="app-shell min-h-screen flex flex-col bg-transparent text-[var(--reading-text,#1e293b)] transition-colors duration-200">
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
        activeNav={activeNav}
        onNavChange={handleNavChange}
        currentUser={currentUser}
        onLogin={login}
        onLogout={logout}
        isDark={theme === 'dark'}
        onToggleTheme={handleToggleTheme}
        selectedLanguage={selectedLanguage}
        onSelectLanguage={setSelectedLanguage}
      />

      {/* Main Container with safe bottom padding for mobile bar */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-1 sm:px-6 py-2 sm:py-6 pb-24 md:pb-6" style={{ paddingTop: '5px' }}>
        <Suspense fallback={<RouteFallback />}>
        {/* ================= STANDALONE PAGES ================= */}
        {standalonePage === 'write' && (
          <WritePage
            onClose={closeStandalonePage}
            currentUser={currentUser}
            onRequireLogin={requestLogin}
            defaultCommunity={tag.startsWith('hive-') ? tag : ''}
            joinedCommunities={joinedCommunities}
          />
        )}

        {standalonePage === 'following' && (
          <FollowingManagerPage
            currentUser={currentUser}
            onClose={closeStandalonePage}
            onOpenProfile={(user) => openStandalonePage('profile', user)}
            onRequireLogin={requestLogin}
          />
        )}

        {standalonePage === 'notifications' && (
          <NotificationsPage
            currentUser={currentUser}
            onClose={closeStandalonePage}
            onOpenPost={(author, permlink) => handleOpenNotificationPost(author, permlink)}
            onOpenUser={(user) => openStandalonePage('profile', user)}
            onRequireLogin={requestLogin}
          />
        )}

        {standalonePage === 'profile' && (
          <ProfilePage
            username={profileUser || currentUser?.username || ''}
            onClose={closeStandalonePage}
            onSelectPost={(post, appearance) => {
              setProfileReaderAppearance(appearance || null);
              handleSelectPost(post, true, false, 'profile');
            }}
            onOpenUser={(user) => openStandalonePage('profile', user)}
            onOpenCommunity={(communityName) => {
              openCommunity(communityName);
            }}
          />
        )}

        {standalonePage === 'explore' && !isEmbeddedCommunitiesPage && (
          <ExploreCommunitiesPage
            onClose={closeStandalonePage}
            onSwitchToManage={() => openStandalonePage('manage')}
            onSwitchToFeed={() => {
              closeStandalonePage();
              handleNavChange('communities');
            }}
            joinedCommunities={joinedCommunities}
            onToggleJoinCommunity={toggleJoinCommunity}
            account={currentUser?.username || null}
            onSelectCommunity={(communityName) => {
              openCommunity(communityName);
            }}
          />
        )}

        {standalonePage === 'manage' && !isEmbeddedCommunitiesPage && (
          <ManageCommunitiesPage
            onClose={closeStandalonePage}
            onSwitchToExplore={() => openStandalonePage('explore')}
            onSwitchToFeed={() => {
              closeStandalonePage();
              handleNavChange('communities');
            }}
            joinedCommunities={joinedCommunities}
            onToggleJoinCommunity={toggleJoinCommunity}
            account={currentUser?.username || null}
            onSelectCommunity={(communityName) => {
              openCommunity(communityName);
            }}
          />
        )}
        </Suspense>

        {isProfilePostOpen && selectedPost && (
          <div
            className="fixed inset-x-0 bottom-0 top-16 z-[90] overflow-y-auto px-2 py-3 sm:px-5 sm:py-5"
            style={{ backgroundColor: profileReaderAppearance?.backgroundColor || 'var(--reading-bg, #f8fafc)' }}
          >
            <div className="mx-auto w-full max-w-[980px]">
              <Suspense fallback={<RouteFallback />}>
                <PostReader
                  post={selectedPost}
                  profileAppearance={profileReaderAppearance}
                  onClose={handleClosePost}
                  onSelectAuthor={handleSelectAuthor}
                  onSelectTag={setTag}
                  currentUser={currentUser}
                  onRequireLogin={requestLogin}
                  onHeadingsExtracted={setPostHeadings}
                  onSelectPost={(post) => handleSelectPost(post, true, false, 'profile')}
                />
              </Suspense>
            </div>
          </div>
        )}

        {/* ================= RESPONSIVE THREE-COLUMN LAYOUT ================= */}
        <div
          className={`${isProfilePostOpen
            ? 'mx-auto grid w-full max-w-[980px] grid-cols-1 items-start justify-center gap-5 rounded-3xl p-1 sm:p-4'
            : 'grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,824px)_300px] items-start justify-center gap-5'
          } ${standalonePage && !isEmbeddedCommunitiesPage ? 'hidden' : 'grid'}`}
          style={isProfilePostOpen && profileReaderAppearance?.backgroundColor
            ? { backgroundColor: profileReaderAppearance.backgroundColor }
            : undefined}
        >
          {/* Left Navigation Sidebar */}
          <aside className={`${isProfilePostOpen ? 'hidden' : 'hidden lg:block sticky top-20 self-start'}`}>
            {selectedPost && !standalonePage && activeNav !== 'shorts' && activeNav !== 'communities' ? (
              <PostSidebar
                post={selectedPost}
                headings={postHeadings}
                onSelectHeading={handleSelectHeading}
                onSelectPost={handleSelectPost}
                onClose={handleClosePost}
              />
            ) : <LeftSidebar
              activeNav={activeNav}
              communitiesSection={standalonePage === 'explore' || standalonePage === 'manage' ? standalonePage : 'feed'}
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
              shortsHashtags={shortsFilter.hashtags}
              selectedShortTag={shortsFilter.selectedTag}
              onSelectShortTag={shortsFilter.setSelectedTag}
              shortsSource={shortsFilter.source}
              onShortsSourceChange={(source) => {
                if (source !== 'all' && !currentUser) requestLogin();
                else {
                  shortsFilter.setSelectedTag('');
                  shortsFilter.setSource(source);
                }
              }}
              onOpenShortsFilters={() => window.dispatchEvent(new CustomEvent('nebulosa:open-shorts-filters'))}
              onOpenShortsComposer={() => window.dispatchEvent(new CustomEvent('nebulosa:open-shorts-composer'))}
            />}
          </aside>

          {/* Center Main Screen Feed Area */}
          <section className="min-w-0 flex-1">
            {selectedPost && !standalonePage && (activeNav !== 'shorts' || isProfilePostOpen) && (activeNav !== 'communities' || isProfilePostOpen) ? (
              <div className="min-w-0 animate-in fade-in duration-150">
                <Suspense fallback={<RouteFallback />}>
                  <PostReader
                    post={selectedPost}
                    profileAppearance={profileReaderAppearance}
                    onClose={handleClosePost}
                    onSelectAuthor={handleSelectAuthor}
                    onSelectTag={(t) => {
                      setTag(t);
                      handleClosePost();
                    }}
                    currentUser={currentUser}
                    onRequireLogin={requestLogin}
                    onHeadingsExtracted={setPostHeadings}
                    onSelectPost={(p) => handleSelectPost(p, true, false)}
                  />
                </Suspense>
              </div>
            ) : (
              <>
                {activeNav === 'feed' && <FeedPage />}
                {activeNav === 'discover' && <DiscoverPage onPostsLoaded={handleDiscoverPostsLoaded} />}
              </>
            )}
            {activeNav === 'communities' && (visitedCommunityPages.explore || standalonePage === 'explore') && (
              <div className={standalonePage === 'explore' ? '' : 'hidden'} aria-hidden={standalonePage !== 'explore'}>
                <Suspense fallback={<RouteFallback />}>
                  <ExploreCommunitiesPage
                    embedded
                    onClose={closeStandalonePage}
                    onSwitchToManage={() => openStandalonePage('manage')}
                    onSwitchToFeed={closeStandalonePage}
                    joinedCommunities={joinedCommunities}
                    onToggleJoinCommunity={toggleJoinCommunity}
                    account={currentUser?.username || null}
                    onSelectCommunity={openCommunity}
                  />
                </Suspense>
              </div>
            )}
            {activeNav === 'communities' && (visitedCommunityPages.manage || standalonePage === 'manage') && (
              <div className={standalonePage === 'manage' ? '' : 'hidden'} aria-hidden={standalonePage !== 'manage'}>
                <Suspense fallback={<RouteFallback />}>
                  <ManageCommunitiesPage
                    embedded
                    onClose={closeStandalonePage}
                    onSwitchToExplore={() => openStandalonePage('explore')}
                    onSwitchToFeed={closeStandalonePage}
                    joinedCommunities={joinedCommunities}
                    onToggleJoinCommunity={toggleJoinCommunity}
                    account={currentUser?.username || null}
                    onSelectCommunity={openCommunity}
                  />
                </Suspense>
              </div>
            )}
            {activeNav === 'communities' && (
              <div className={isEmbeddedCommunitiesPage || isCommunityPostOpen ? 'hidden' : ''} aria-hidden={isEmbeddedCommunitiesPage || isCommunityPostOpen}>
                <DiscoverPage
                  isCommunitiesFeed={true}
                  onPostsLoaded={handleCommunityPostsLoaded}
                />
              </div>
            )}
            {isCommunityPostOpen && !isProfilePostOpen && (
              <div className="min-w-0 animate-in fade-in duration-150">
                <Suspense fallback={<RouteFallback />}>
                  <PostReader
                    post={selectedPost!}
                    onClose={handleClosePost}
                    onSelectAuthor={handleSelectAuthor}
                    onSelectTag={setCommunitySubTopic}
                    currentUser={currentUser}
                    onRequireLogin={requestLogin}
                    onHeadingsExtracted={setPostHeadings}
                    onSelectPost={(post) => handleSelectPost(post, true, false)}
                  />
                </Suspense>
              </div>
            )}
            {activeNav === 'shorts' && !isProfilePostOpen && (
              <Suspense fallback={<RouteFallback />}>
                <ShortsPage
                  selectedTag={shortsFilter.selectedTag}
                  onSelectTag={shortsFilter.setSelectedTag}
                  blockedWords={shortsFilter.blockedWords}
                  blockedAuthors={shortsFilter.blockedAuthors}
                  onAddWord={shortsFilter.addWord}
                  onRemoveWord={shortsFilter.removeWord}
                  onClearWords={shortsFilter.clearWords}
                  onAddAuthor={shortsFilter.addAuthor}
                  onRemoveAuthor={shortsFilter.removeAuthor}
                  onClearAuthors={shortsFilter.clearAuthors}
                  filterEnabled={shortsFilter.filterEnabled}
                  onToggleFilter={shortsFilter.toggleEnabled}
                  onHashtagsExtracted={shortsFilter.setHashtags}
                  onHiddenCountChange={shortsFilter.setHiddenCount}
                  source={shortsFilter.source}
                  onSourceChange={shortsFilter.setSource}
                />
              </Suspense>
            )}
          </section>

          {/* Right Column Contextual Widgets */}
          <aside className={`${isProfilePostOpen ? 'hidden' : 'hidden xl:block space-y-6 sticky top-20 self-start'}`}>
            <RightRail
              discoverPosts={discoverPosts}
              communityPosts={communityPosts}
              blockedWords={shortsFilter.blockedWords}
              shortsFilterEnabled={shortsFilter.filterEnabled}
              shortsHiddenCount={shortsFilter.hiddenCount}
              onAddBlockedWord={shortsFilter.addWord}
              onRemoveBlockedWord={shortsFilter.removeWord}
              onClearBlockedWords={shortsFilter.clearWords}
              onToggleShortsFilter={shortsFilter.toggleEnabled}
            />
          </aside>
        </div>
      </main>

      {/* Blockchain Stats Modal */}
      <Suspense fallback={null}>
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
      </Suspense>

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
      <NotificationToastHost />

      {/* Mobile Swipe-from-Edge Drawer for Trending Topics, Followed Creators & Subscribed Communities */}
      <MobileSideDrawer
        activeNav={activeNav}
        tag={tag}
        setTag={setTag}
        sort={sort}
        feedAuthor={feedAuthor}
        setFeedAuthor={setFeedAuthor}
        currentUser={currentUser}
        followingUsersList={followingUsersList}
        openFollowingManager={openFollowingManager}
        discoverPosts={discoverPosts}
        disabled={Boolean(selectedPost || (standalonePage && !isEmbeddedCommunitiesPage) || activeNav === 'shorts')}
        joinedCommunities={joinedCommunities}
        onOpenCommunities={openCommunitiesModal}
        onOpenManageCommunities={openManageCommunitiesModal}
        onOpenCommunity={openCommunity}
      />

      {/* Mobile Bottom Navigation Bar (Hidden on desktop md:) */}
      <MobileBottomNav
        activeNav={activeNav}
        onNavChange={handleNavChange}
        currentUser={currentUser}
        onOpenWrite={openWritePage}
        onOpenNotifications={openNotificationsPage}
        onOpenStats={openStatsModal}
        onOpenCommunities={openCommunitiesModal}
        onOpenManageCommunities={openManageCommunitiesModal}
        onOpenManageFollowing={openFollowingManager}
        onOpenAccount={(user) => openAuthorProfile(user)}
        onToggleTheme={handleToggleTheme}
        isDark={theme === 'dark'}
        unreadNotificationsCount={unreadNotificationsCount}
        selectedPost={selectedPost}
        onClosePost={handleClosePost}
        onOpenLogin={requestLogin}
        onLogout={logout}
        currentSort={sort}
        onSortChange={(s) => setSort(s)}
        currentTag={tag}
        onSelectTag={(t) => setTag(t)}
        onOpenFilters={() => setShowContentFilterModal(true)}
        hasStandalonePage={Boolean(standalonePage && !isEmbeddedCommunitiesPage)}
      />
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NavigationProvider>
          <NotificationsProvider>
            <ContentFilterProvider>
              <BookmarksProvider>
                <NebulosaApp />
              </BookmarksProvider>
            </ContentFilterProvider>
          </NotificationsProvider>
        </NavigationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
