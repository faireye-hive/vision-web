import React, { useState, useEffect } from 'react';
import {
  Menu,
  Search,
  HelpCircle,
  Edit3,
  MessageSquare,
  Bell,
  Wifi,
  Check,
  ChevronDown,
  Layers,
  Activity,
  User as UserIcon,
  X,
  Compass,
  Key,
  LogOut,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { PUBLIC_HIVE_NODES, getActiveNode, setActiveNode, pingNode } from '../services/hiveApi';
import { CurrentUser, KeychainService } from '../services/keychain';
import { WritePostModal } from './WritePostModal';

interface NavbarProps {
  currentSort: 'trending' | 'hot' | 'created' | 'payout' | 'muted' | 'promoted';
  onSortChange: (sort: 'trending' | 'hot' | 'created' | 'payout' | 'muted' | 'promoted') => void;
  currentTag: string;
  onTagChange: (tag: string) => void;
  onOpenAccount: (username: string) => void;
  onOpenStats: () => void;
  onOpenCommunities: () => void;
  onOpenManageCommunities?: () => void;
  activeNav?: 'feed' | 'discover' | 'shorts' | 'communities' | 'waves';
  onNavChange?: (nav: 'feed' | 'discover' | 'shorts' | 'communities') => void;
  currentUser: CurrentUser | null;
  onLogin: (user: CurrentUser) => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentSort,
  onSortChange,
  currentTag,
  onTagChange,
  onOpenAccount,
  onOpenStats,
  onOpenCommunities,
  onOpenManageCommunities,
  activeNav = 'discover',
  onNavChange,
  currentUser,
  onLogin,
  onLogout
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [activeNodeUrl, setActiveNodeUrl] = useState(getActiveNode());
  const [nodePing, setNodePing] = useState<number | null>(null);
  const [showNodeMenu, setShowNodeMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [pings, setPings] = useState<Record<string, number>>({});
  const [showWriteModal, setShowWriteModal] = useState(false);

  // Keychain Login Modal state
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [keychainInstalled, setKeychainInstalled] = useState(false);

  useEffect(() => {
    setKeychainInstalled(KeychainService.isInstalled());
    const interval = setInterval(() => {
      setKeychainInstalled(KeychainService.isInstalled());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let isMounted = true;
    pingNode(activeNodeUrl).then(ms => {
      if (isMounted) setNodePing(ms);
    });

    const interval = setInterval(() => {
      pingNode(activeNodeUrl).then(ms => {
        if (isMounted) setNodePing(ms);
      });
    }, 25000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeNodeUrl]);

  const handleSelectNode = (node: string) => {
    setActiveNode(node);
    setActiveNodeUrl(node);
    setShowNodeMenu(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchInput.trim();
    if (!query) return;

    if (query.startsWith('@')) {
      onOpenAccount(query.replace('@', ''));
    } else {
      onTagChange(query.toLowerCase());
    }
  };

  const handleKeychainLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!loginUsername.trim()) {
      setLoginError('Please enter your Hive username.');
      return;
    }

    setLoginLoading(true);
    setLoginError(null);

    try {
      const result = await KeychainService.login(loginUsername.trim());
      if (result.success && result.user) {
        onLogin(result.user);
        setShowLoginModal(false);
      } else {
        setLoginError(result.error || 'Keychain login rejected.');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login error occurred.');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <header id="app-navbar" className="sticky top-0 z-40 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-4">

          {/* Left section: Hamburger, Nebulosa Logo, Nav links */}
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              id="navbar-hamburger-btn"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-1.5 -ml-1.5 text-gray-700 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition cursor-pointer lg:hidden"
              aria-label="Open navigation menu"
              title="Toggle navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Nebulosa Circular Brand Logo */}
            <button
              id="brand-home-btn"
              onClick={() => {
                onTagChange('');
                onSortChange('hot');
                if (onNavChange) onNavChange('discover');
              }}
              className="flex items-center gap-2.5 focus:outline-none group cursor-pointer"
              title="Nebulosa Home - Hive Blockchain Client"
            >
              <img
                src="/assets/logo-circle.svg"
                alt="Nebulosa Logo"
                className="w-9 h-9 rounded-full shadow-sm group-hover:opacity-90 transition-opacity"
              />
              <span className="font-extrabold text-base tracking-tight text-gray-900 hidden sm:inline">
                Nebulosa
              </span>
            </button>

            {/* Primary Nav Links: Feed, Discover, Waves, Communities */}
            <nav className="hidden md:flex items-center gap-1 sm:gap-2">
              <button
                id="nav-feed-btn"
                onClick={() => {
                  if (onNavChange) onNavChange('feed');
                  onTagChange('');
                }}
                title="Feed: Stories and updates from authors and accounts you follow"
                className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition cursor-pointer ${activeNav === 'feed'
                  ? 'bg-blue-50 text-blue-600 font-bold'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                  }`}
              >
                Feed
              </button>

              <button
                id="nav-discover-btn"
                onClick={() => {
                  if (onNavChange) onNavChange('discover');
                  onTagChange('');
                }}
                title="Discover: Global Hive feed ranked by Hot, Trending, and New"
                className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition cursor-pointer ${activeNav === 'discover'
                  ? 'bg-blue-50 text-blue-600 font-bold'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                  }`}
              >
                Discover
              </button>

              <button
                id="nav-shorts-btn"
                onClick={() => { if (onNavChange) onNavChange('shorts'); }}
                title="Shorts: Microblogging & instant community snaps via @peak.snaps"
                className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition cursor-pointer ${activeNav === 'shorts' || activeNav === 'waves'
                  ? 'bg-blue-50 text-blue-600 font-bold'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                  }`}
              >
                Shorts
              </button>

              <button
                id="nav-communities-btn"
                onClick={() => {
                  if (onNavChange) onNavChange('communities');
                }}
                title="Communities: Explore Hive communities and specialized groups"
                className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition cursor-pointer ${activeNav === 'communities'
                  ? 'bg-blue-50 text-blue-600 font-bold'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                  }`}
              >
                Communities
              </button>
            </nav>
          </div>

          {/* Right section: Search, Perks, Write, Keychain Login / User Avatar */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">

            {/* RPC Node & Stats Helper icon */}
            <button
              id="help-btn"
              onClick={onOpenStats}
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition hidden sm:flex"
              title="Hive Blockchain Node & API Stats"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Search Pill */}
            <div className="relative w-36 sm:w-52 md:w-60">
              <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <div className="absolute left-2 w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                  <Search className="w-3 h-3" />
                </div>
                <input
                  id="search-input"
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search Hive or @user"
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-full text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </form>
            </div>

            {/* Write Button */}
            <button
              id="write-btn"
              onClick={() => setShowWriteModal(true)}
              title="Write and publish a new post to the Hive blockchain"
              className="hidden sm:flex items-center gap-1.5 bg-[#3577f1] hover:bg-blue-600 text-white text-xs sm:text-sm font-semibold px-4 py-1.5 rounded-full shadow-sm transition cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Write</span>
            </button>

            {/* Keychain Login Button OR User Profile Avatar */}
            {!currentUser ? (
              <button
                id="keychain-login-btn"
                onClick={() => setShowLoginModal(true)}
                title="Connect Hive Keychain wallet for keyless signing"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Key className="w-3.5 h-3.5 text-rose-600" />
                <span>Keychain Login</span>
              </button>
            ) : (
              <div className="relative">
                <button
                  id="user-avatar-btn"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  title={`Signed in as @${currentUser.username} - click for profile and settings`}
                  className="flex items-center gap-2 p-1 pr-2 rounded-full border border-gray-200 hover:border-blue-300 hover:bg-gray-50 transition focus:outline-none cursor-pointer"
                >
                  <div className="relative">
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.username}
                      className="w-7 h-7 object-cover rounded-full border border-gray-150"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
                      }}
                    />
                    <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                  </div>
                  <span className="text-xs font-bold text-gray-800 hidden sm:inline max-w-[100px] truncate">
                    @{currentUser.username}
                  </span>
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </button>

                {/* User Dropdown */}
                {showUserMenu && (
                  <div
                    id="user-menu-dropdown"
                    className="absolute right-0 mt-2 w-64 bg-white border border-gray-150 rounded-2xl shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                  >
                    <div className="flex items-center gap-3 p-2 border-b border-gray-100">
                      <img
                        src={currentUser.avatar}
                        alt={currentUser.username}
                        className="w-10 h-10 rounded-full border border-gray-200 object-cover"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">@{currentUser.username}</p>
                        <p className="text-[11px] text-emerald-600 font-medium">Hive Keychain Active</p>
                      </div>
                    </div>

                    <div className="py-2 space-y-1">
                      <button
                        onClick={() => { onOpenAccount(currentUser.username); setShowUserMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 rounded-xl flex items-center gap-2"
                      >
                        <UserIcon className="w-4 h-4 text-blue-600" />
                        <span>Profile & Wallet</span>
                      </button>

                      <button
                        onClick={() => {
                          if (onOpenManageCommunities) onOpenManageCommunities();
                          else onOpenCommunities();
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 rounded-xl flex items-center gap-2"
                      >
                        <Layers className="w-4 h-4 text-emerald-600" />
                        <span>Manage Communities</span>
                      </button>

                      <button
                        onClick={() => { if (onNavChange) onNavChange('communities'); setShowUserMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 rounded-xl flex items-center gap-2"
                      >
                        <Layers className="w-4 h-4 text-purple-600" />
                        <span>Explore Communities</span>
                      </button>

                      <button
                        onClick={() => { setShowNodeMenu(!showNodeMenu); setShowUserMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 rounded-xl flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Wifi className="w-4 h-4 text-teal-600" />
                          <span>RPC Nodes</span>
                        </div>
                        <span className="text-[10px] text-emerald-600 font-mono bg-emerald-50 px-1.5 py-0.5 rounded-full">
                          {nodePing ? `${nodePing}ms` : 'active'}
                        </span>
                      </button>

                      <hr className="border-gray-100 my-1" />

                      <button
                        onClick={() => { onLogout(); setShowUserMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4 text-rose-600" />
                        <span>Disconnect Account</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Node Switcher Menu */}
            {showNodeMenu && (
              <div
                id="node-dropdown-menu"
                className="absolute right-4 top-16 mt-2 w-72 bg-white border border-gray-150 rounded-2xl shadow-xl p-3 z-50"
              >
                <div className="px-2 py-1.5 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-900">Public Hive RPC Nodes</p>
                    <p className="text-[10px] text-gray-500">100% Client-Side Direct Connection</p>
                  </div>
                  <Wifi className="w-4 h-4 text-blue-600" />
                </div>
                <div className="py-2 space-y-1 max-h-60 overflow-y-auto">
                  {PUBLIC_HIVE_NODES.map((node) => {
                    const isActive = node === activeNodeUrl;
                    const ping = pings[node];
                    return (
                      <button
                        key={node}
                        onClick={() => handleSelectNode(node)}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition ${isActive
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                          }`}
                      >
                        <span className="font-mono text-[11px] truncate max-w-[170px]">{node.replace('https://', '')}</span>
                        <div className="flex items-center gap-1.5">
                          {isActive && <Check className="w-3.5 h-3.5 text-blue-600" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Mobile Navigation Drawer */}
        {showMobileMenu && (
          <div id="mobile-nav-drawer" className="md:hidden border-t border-gray-150 py-3 px-1 space-y-1 bg-white">
            <button
              onClick={() => {
                if (onNavChange) onNavChange('feed');
                onTagChange('');
                setShowMobileMenu(false);
              }}
              title="Feed: Stories and updates from creators and accounts you follow"
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer ${
                activeNav === 'feed' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>Feed (Following)</span>
              {activeNav === 'feed' && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
            </button>

            <button
              onClick={() => {
                if (onNavChange) onNavChange('discover');
                onTagChange('');
                setShowMobileMenu(false);
              }}
              title="Discover: Global Hive feed ranked by Hot, Trending, and New"
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer ${
                activeNav === 'discover' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>Discover (Global)</span>
              {activeNav === 'discover' && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
            </button>

            <button
              onClick={() => {
                if (onNavChange) onNavChange('shorts');
                setShowMobileMenu(false);
              }}
              title="Shorts: Microblogging & instant community snaps via @peak.snaps"
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer ${
                activeNav === 'shorts' || activeNav === 'waves' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>Shorts</span>
              {(activeNav === 'shorts' || activeNav === 'waves') && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
            </button>

            <button
              onClick={() => {
                if (onNavChange) onNavChange('communities');
                setShowMobileMenu(false);
              }}
              title="Communities: Explore Hive communities and specialized groups"
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer ${
                activeNav === 'communities' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>Communities</span>
              {activeNav === 'communities' && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
            </button>
          </div>
        )}
      </div>

      {/* ================= KEYCHAIN LOGIN MODAL ================= */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 w-full max-w-md border border-gray-150 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">

            <div className="flex items-center justify-between pb-3 border-b border-gray-150">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-50 border border-rose-100 text-rose-600">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900">Connect Hive Keychain</h3>
                  <p className="text-xs text-gray-500">Secure keyless sign-in for Hive blockchain</p>
                </div>
              </div>

              <button
                onClick={() => setShowLoginModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Keychain Extension Detection Indicator */}
            <div className={`p-3 rounded-2xl text-xs flex items-center gap-2.5 border ${keychainInstalled
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span>
                {keychainInstalled
                  ? 'Hive Keychain extension detected in browser.'
                  : 'Extension not detected. You can still login to test or install the extension.'}
              </span>
            </div>

            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-medium">
                {loginError}
              </div>
            )}

            <form onSubmit={handleKeychainLogin} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5">
                  Hive Username
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">@</span>
                  <input
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''))}
                    placeholder="yourusername"
                    className="w-full pl-8 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-medium text-gray-900 focus:outline-none focus:border-rose-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Quick test accounts */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] text-gray-400">Try demo:</span>
                {['ecency', 'good-karma'].map(acc => (
                  <button
                    key={acc}
                    type="button"
                    onClick={() => setLoginUsername(acc)}
                    className="text-[11px] font-semibold text-blue-600 hover:bg-blue-50 px-2 py-0.5 rounded-lg transition border border-blue-100"
                  >
                    @{acc}
                  </button>
                ))}
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <a
                  href="https://hive-keychain.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-gray-500 hover:text-gray-800 underline"
                >
                  Get Keychain Extension
                </a>

                <button
                  type="submit"
                  disabled={loginLoading || !loginUsername.trim()}
                  className="px-6 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition"
                >
                  {loginLoading ? 'Signing challenge...' : 'Login with Keychain'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Robust Write Post Modal */}
      {showWriteModal && (
        <WritePostModal
          onClose={() => setShowWriteModal(false)}
          currentUser={currentUser}
          onRequireLogin={() => {
            setShowWriteModal(false);
            setShowLoginModal(true);
          }}
        />
      )}
    </header>
  );
};
