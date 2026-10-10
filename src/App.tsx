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

const ShortsPage = lazy(() => import('./pages/ShortsPage').then((m) => ({ default: m.ShortsPage })));
const WritePage = lazy(() => import('./pages/WritePage').then((m) => ({ default: m.WritePage })));
const FollowingManagerPage = lazy(() => import('./pages/FollowingManagerPage').then((m) => ({ default: m.FollowingManagerPage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const CommunitiesPage = lazy(() => import('./pages/CommunitiesPage').then((m) => ({ default: m.CommunitiesPage })));
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
    restoreScrollPosition,
    showStatsModal,
    setShowStatsModal,
    openStatsModal,
    showContentFilterModal,
    setShowContentFilterModal,
    selectedLanguage,
    setSelectedLanguage
  } = useNavigation();

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
        </Suspense>

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
              <Suspense fallback={<RouteFallback />}>
                <PostReader
                  post={selectedPost}
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
            </section>
          </div>
        )}

        {/* ================= RESPONSIVE THREE-COLUMN LAYOUT ================= */}
        <div
          className={`grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,824px)_300px] justify-center gap-5 items-start ${
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
              shortsHashtags={shortsFilter.hashtags}
              selectedShortTag={shortsFilter.selectedTag}
              onSelectShortTag={shortsFilter.setSelectedTag}
              shortsSource={shortsFilter.source}
              onShortsSourceChange={shortsFilter.setSource}
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
          <aside className="hidden xl:block space-y-6 sticky top-20 self-start">
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

      {/* Mobile Swipe-from-Edge Drawer for Trending Topics & Followed Creators */}
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
        disabled={Boolean(selectedPost || standalonePage || activeNav === 'shorts')}
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
        hasStandalonePage={standalonePage !== null}
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