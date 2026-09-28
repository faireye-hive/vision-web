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
  Zap,
  Sun,
  Moon,
  Settings,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  SlidersHorizontal
} from 'lucide-react';
import {
  getAllHiveNodes,
  getCustomHiveNodes,
  getActiveNode,
  setActiveNode,
  pingNode,
  addCustomHiveNode,
  removeCustomHiveNode
} from '../services/hiveApi';
import { CurrentUser, KeychainService } from '../services/keychain';
import { useNotifications } from '../context/NotificationsContext';

interface NavbarProps {
  currentSort: 'trending' | 'hot' | 'created' | 'payout' | 'muted' | 'promoted';
  onSortChange: (sort: 'trending' | 'hot' | 'created' | 'payout' | 'muted' | 'promoted') => void;
  currentTag: string;
  onTagChange: (tag: string) => void;
  onOpenAccount: (username: string) => void;
  onOpenStats: () => void;
  onOpenCommunities: () => void;
  onOpenManageCommunities?: () => void;
  onOpenWrite?: () => void;
  onOpenNotifications?: () => void;
  onOpenManageFollowing?: () => void;
  activeNav?: 'feed' | 'discover' | 'shorts' | 'communities' | 'waves';
  onNavChange?: (nav: 'feed' | 'discover' | 'shorts' | 'communities') => void;
  currentUser: CurrentUser | null;
  onLogin: (user: CurrentUser) => void;
  onLogout: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
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
  onOpenWrite,
  onOpenNotifications,
  onOpenManageFollowing,
  activeNav = 'discover',
  onNavChange,
  currentUser,
  onLogin,
  onLogout,
  isDark = false,
  onToggleTheme
}) => {
  const { unreadCount: unreadNotificationsCount } = useNotifications();
  const [searchInput, setSearchInput] = useState('');
  const [activeNodeUrl, setActiveNodeUrl] = useState(getActiveNode());
  const [nodePing, setNodePing] = useState<number | null>(null);
  const [showNodeMenu, setShowNodeMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [pings, setPings] = useState<Record<string, number>>({});

  // Custom RPC addition inside Navbar
  const [customNodeInput, setCustomNodeInput] = useState('');
  const [customNodeAdding, setCustomNodeAdding] = useState(false);
  const [customNodeError, setCustomNodeError] = useState<string | null>(null);
  const [customNodeSuccess, setCustomNodeSuccess] = useState<string | null>(null);
  const [showAddNodeForm, setShowAddNodeForm] = useState(false);
  const [, setNodesListVersion] = useState(0);

  // Keychain Login Modal state
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [keychainInstalled, setKeychainInstalled] = useState(false);

  useEffect(() => {
    const handleNodeChange = () => {
      setActiveNodeUrl(getActiveNode());
      setNodesListVersion(v => v + 1);
    };
    window.addEventListener('nebulosa:node_changed', handleNodeChange);
    return () => window.removeEventListener('nebulosa:node_changed', handleNodeChange);
  }, []);

  useEffect(() => {
    const openLogin = () => setShowLoginModal(true);
    window.addEventListener('nebulosa:open-login', openLogin);
    return () => window.removeEventListener('nebulosa:open-login', openLogin);
  }, []);

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

  useEffect(() => {
    if (!showNodeMenu && !showUserMenu) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (showNodeMenu) {
        const menu = document.getElementById('node-dropdown-menu');
        const trigger = document.getElementById('rpc-nodes-trigger');
        if (!menu?.contains(target) && !trigger?.contains(target)) setShowNodeMenu(false);
      }
      if (showUserMenu) {
        const menu = document.getElementById('user-menu-dropdown');
        const trigger = document.getElementById('user-avatar-btn');
        if (!menu?.contains(target) && !trigger?.contains(target)) setShowUserMenu(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setShowNodeMenu(false);
      setShowUserMenu(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [showNodeMenu, showUserMenu]);

  // Ping all nodes when node menu is opened
  useEffect(() => {
    if (showNodeMenu) {
      const nodes = getAllHiveNodes();
      nodes.forEach(n => {
        pingNode(n).then(ms => {
          setPings(prev => ({ ...prev, [n]: ms }));
        });
      });
    }
  }, [showNodeMenu]);

  const handleSelectNode = (node: string) => {
    setActiveNode(node);
    setActiveNodeUrl(node);
    setShowNodeMenu(false);
  };

  const handleAddCustomNode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomNodeError(null);
    setCustomNodeSuccess(null);
    const trimmed = customNodeInput.trim().replace(/\/+$/, '');
    if (!trimmed) {
      setCustomNodeError('Enter an RPC URL.');
      return;
    }
    setCustomNodeAdding(true);
    try {
      const pingMs = await pingNode(trimmed);
      if (pingMs < 0) {
        setCustomNodeError('Node unreachable or invalid Hive endpoint.');
        setCustomNodeAdding(false);
        return;
      }
      const res = addCustomHiveNode(trimmed);
      if (res.success) {
        setCustomNodeInput('');
        setCustomNodeSuccess(`Saved! Connected (${pingMs}ms)`);
        setShowAddNodeForm(false);
        setPings(prev => ({ ...prev, [trimmed]: pingMs }));
        setTimeout(() => setCustomNodeSuccess(null), 3000);
      } else {
        setCustomNodeError(res.error || 'Failed to add node.');
      }
    } catch (err: any) {
      setCustomNodeError(err.message || 'Validation error.');
    } finally {
      setCustomNodeAdding(false);
    }
  };

  const handleRemoveCustomNode = (node: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeCustomHiveNode(node);
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
    <>
    <header id="app-navbar" className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-gray-100 dark:border-slate-800 shadow-[0_1px_4px_rgba(0,0,0,0.03)] dark:shadow-none transition-colors duration-200">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-4">

          {/* Left section: Hamburger, Nebulosa Logo, Nav links */}
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              id="navbar-hamburger-btn"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-1.5 -ml-1.5 text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer lg:hidden"
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
              <span className="font-extrabold text-base tracking-tight text-gray-900 dark:text-white hidden sm:inline">
                Nebulosa
              </span>
            </button>

            {/* Primary Nav Links: Feed, Discover, Waves, Communities */}
            <nav className="hidden md:flex items-center gap-1 sm:gap-2">
              <button
                id="nav-feed-btn"
                onClick={() => {
                  if (onNavChange) onNavChange('feed');
                }}
                title="Feed: Stories and updates from authors and accounts you follow"
                className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition cursor-pointer ${activeNav === 'feed'
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 font-bold'
                  : 'text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}
              >
                Feed
              </button>

              <button
                id="nav-discover-btn"
                onClick={() => {
                  if (onNavChange) onNavChange('discover');
                }}
                title="Discover: Global Hive feed ranked by Hot, Trending, and New"
                className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition cursor-pointer ${activeNav === 'discover'
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 font-bold'
                  : 'text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}
              >
                Discover
              </button>

              <button
                id="nav-shorts-btn"
                onClick={() => { if (onNavChange) onNavChange('shorts'); }}
                title="Shorts: Microblogging & instant community snaps via @peak.snaps"
                className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition cursor-pointer ${activeNav === 'shorts' || activeNav === 'waves'
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 font-bold'
                  : 'text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-slate-800'
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
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 font-bold'
                  : 'text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}
              >
                Communities
              </button>
            </nav>
          </div>

          {/* Right section: Search, Theme Toggle, RPC Node Status, Write, Keychain Login / User Avatar */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* Dark Mode / Night Mode Toggle */}
            {onToggleTheme && (
              <button
                id="theme-toggle-btn"
                type="button"
                onClick={onToggleTheme}
                className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-slate-300 dark:hover:text-amber-400 dark:hover:bg-slate-800 rounded-full transition cursor-pointer"
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode (Night Mode)"}
                aria-label="Toggle dark mode"
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-amber-400 animate-in zoom-in-75 duration-200" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-600 hover:text-slate-900 transition" />
                )}
              </button>
            )}

            {/* RPC Node & Stats Helper icon */}
            <button
              id="help-btn"
              onClick={onOpenStats}
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 rounded-full transition hidden sm:flex"
              title="Hive Blockchain Nodes & RPC Settings (Add Custom Nodes)"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Search Pill */}
            <div className="relative w-36 sm:w-52 md:w-60">
              <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <div className="absolute left-2 w-5 h-5 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-400 dark:text-slate-400">
                  <Search className="w-3 h-3" />
                </div>
                <input
                  id="search-input"
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search Hive or @user"
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 rounded-full text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-800 transition"
                />
              </form>
            </div>

            {/* Write Button */}
            <button
              id="write-btn"
              onClick={() => onOpenWrite?.()}
              title="Write a post. Press N from anywhere outside a text field."
              className="flex items-center gap-1.5 bg-[#3577f1] hover:bg-blue-600 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1.5 rounded-full shadow-sm transition cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Write</span>
            </button>

            {/* Quick Notifications Bell Button */}
            {currentUser && onOpenNotifications && (
              <button
                id="notifications-btn"
                onClick={onOpenNotifications}
                title={unreadNotificationsCount > 0 ? `${unreadNotificationsCount} unread notifications` : 'View Notifications'}
                className={`relative p-2 rounded-full border transition cursor-pointer flex items-center justify-center ${
                  unreadNotificationsCount > 0
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-700 ring-2 ring-rose-400/20'
                    : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-800 hover:border-blue-300'
                }`}
              >
                <Bell className={`w-4 h-4 ${unreadNotificationsCount > 0 ? 'animate-bounce' : ''}`} />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white border-2 border-white dark:border-slate-900">
                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                  </span>
                )}
              </button>
            )}

            {/* Keychain Login Button OR User Profile Avatar */}
            {!currentUser ? (
              <button
                id="keychain-login-btn"
                onClick={() => setShowLoginModal(true)}
                title="Connect Hive Keychain wallet for keyless signing"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Key className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden md:inline">Keychain Login</span>
              </button>
            ) : (
              <div className="relative">
                <button
                  id="user-avatar-btn"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  title={`Signed in as @${currentUser.username}${unreadNotificationsCount > 0 ? ` (${unreadNotificationsCount} unread notifications)` : ''}`}
                  className={`flex items-center gap-2 p-1 pr-2 rounded-full border transition focus:outline-none cursor-pointer ${
                    unreadNotificationsCount > 0
                      ? 'border-rose-300 dark:border-rose-700 bg-rose-50/70 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 ring-2 ring-rose-400/30'
                      : 'border-gray-200 dark:border-slate-700 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="relative">
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.username}
                      className={`w-7 h-7 object-cover rounded-full border ${
                        unreadNotificationsCount > 0 ? 'border-rose-300 ring-1 ring-rose-400' : 'border-gray-100 dark:border-slate-700'
                      }`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
                      }}
                    />
                    {unreadNotificationsCount > 0 ? (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 border border-white dark:border-slate-900"></span>
                      </span>
                    ) : (
                      <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                    )}
                  </div>
                  <span className={`text-xs font-bold hidden sm:inline max-w-[100px] truncate ${
                    unreadNotificationsCount > 0 ? 'text-rose-700 dark:text-rose-300 font-extrabold' : 'text-gray-800 dark:text-slate-200'
                  }`}>
                    @{currentUser.username}
                  </span>
                  {unreadNotificationsCount > 0 && (
                    <span className="text-[10px] font-black bg-rose-500 text-white px-1.5 py-0.2 rounded-full hidden sm:inline">
                      {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                    </span>
                  )}
                  <ChevronDown className={`w-3 h-3 ${unreadNotificationsCount > 0 ? 'text-rose-500' : 'text-gray-400'}`} />
                </button>

                {/* User Dropdown */}
                {showUserMenu && (
                  <div
                    id="user-menu-dropdown"
                    className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-gray-800 dark:text-slate-200"
                  >
                    <div className="flex items-center gap-3 p-2 border-b border-gray-100 dark:border-slate-800">
                      <img
                        src={currentUser.avatar}
                        alt={currentUser.username}
                        className="w-10 h-10 rounded-full border border-gray-200 dark:border-slate-700 object-cover"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">@{currentUser.username}</p>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Hive Keychain Active</p>
                      </div>
                    </div>

                    <div className="py-2 space-y-1">
                      {onOpenNotifications && (
                        <button
                          onClick={() => { onOpenNotifications(); setShowUserMenu(false); }}
                          className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-xl flex items-center justify-between transition cursor-pointer ${
                            unreadNotificationsCount > 0
                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                              : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Bell className={`w-4 h-4 ${unreadNotificationsCount > 0 ? 'text-rose-600 dark:text-rose-400 animate-bounce' : 'text-rose-500'}`} />
                            <span>Notifications</span>
                          </div>
                          {unreadNotificationsCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
                              {unreadNotificationsCount} new
                            </span>
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => { onOpenAccount(currentUser.username); setShowUserMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2 cursor-pointer"
                      >
                        <UserIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>Profile & Wallet</span>
                      </button>

                      {onOpenManageFollowing && (
                        <button
                          onClick={() => { onOpenManageFollowing(); setShowUserMenu(false); }}
                          className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2 cursor-pointer"
                        >
                          <SlidersHorizontal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span>Manage Following</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          if (onOpenManageCommunities) onOpenManageCommunities();
                          else onOpenCommunities();
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2 cursor-pointer"
                      >
                        <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Manage Communities</span>
                      </button>

                      <button
                        onClick={() => { onOpenCommunities(); setShowUserMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2 cursor-pointer"
                      >
                        <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span>Explore Communities</span>
                      </button>

                      {/* Night / Light Mode toggle in user menu */}
                      {onToggleTheme && (
                        <button
                          onClick={() => { onToggleTheme(); setShowUserMenu(false); }}
                          className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            {isDark ? (
                              <Sun className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Moon className="w-4 h-4 text-slate-600" />
                            )}
                            <span>{isDark ? 'Switch to Light Mode' : 'Night Mode (Dark)'}</span>
                          </div>
                          <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">
                            {isDark ? 'On' : 'Off'}
                          </span>
                        </button>
                      )}

                      <button
                        id="rpc-nodes-trigger"
                        onClick={() => { setShowNodeMenu(!showNodeMenu); setShowUserMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Wifi className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                          <span>RPC Nodes</span>
                        </div>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded-full">
                          {nodePing ? `${nodePing}ms` : 'active'}
                        </span>
                      </button>

                      <hr className="border-gray-100 dark:border-slate-800 my-1" />

                      <button
                        onClick={() => { onLogout(); setShowUserMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400" />
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
                className="absolute right-4 top-16 mt-2 w-80 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl p-3 z-50 text-gray-800 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="px-2 py-1.5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">Hive RPC Nodes</p>
                    <p className="text-[10px] text-gray-500 dark:text-slate-400">Direct Client-Side Connection & Cache</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {nodePing !== null && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-semibold">
                        {nodePing}ms
                      </span>
                    )}
                    <Wifi className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>

                {customNodeSuccess && (
                  <div className="my-2 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                    {customNodeSuccess}
                  </div>
                )}

                <div className="py-2 space-y-1 max-h-56 overflow-y-auto pr-0.5">
                  {getAllHiveNodes().map((node) => {
                    const isActive = node === activeNodeUrl;
                    const isCustom = getCustomHiveNodes().includes(node);
                    const ping = pings[node];

                    return (
                      <div
                        key={node}
                        onClick={() => handleSelectNode(node)}
                        className={`w-full px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition cursor-pointer group ${
                          isActive
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium'
                            : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                          <span className="font-mono text-[11px] truncate">{node.replace(/^https?:\/\//, '')}</span>
                          {isCustom && (
                            <span className="text-[9px] uppercase px-1 py-0.2 rounded font-mono font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                              Custom
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {ping !== undefined && (
                            <span className={`text-[10px] font-mono ${
                              ping < 300 ? 'text-emerald-500' : ping < 800 ? 'text-amber-500' : 'text-rose-500'
                            }`}>
                              {ping}ms
                            </span>
                          )}
                          {isActive && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                          {isCustom && (
                            <button
                              type="button"
                              onClick={(e) => handleRemoveCustomNode(node, e)}
                              className="p-1 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition opacity-60 group-hover:opacity-100"
                              title="Remove custom node from cache"
                            >
                              <Trash2 className="w-3 h-3 text-rose-500" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Inline Add Custom RPC Node Form */}
                <div className="pt-2 border-t border-gray-100 dark:border-slate-800 space-y-2">
                  {!showAddNodeForm ? (
                    <button
                      type="button"
                      onClick={() => setShowAddNodeForm(true)}
                      className="w-full text-left py-1.5 px-2.5 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Custom RPC Node</span>
                    </button>
                  ) : (
                    <form onSubmit={handleAddCustomNode} className="space-y-2 p-2 rounded-xl bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700">
                      <div className="flex items-center justify-between text-[11px] font-bold text-gray-700 dark:text-slate-300">
                        <span>New Hive RPC Node URL</span>
                        <button
                          type="button"
                          onClick={() => { setShowAddNodeForm(false); setCustomNodeError(null); }}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input
                        type="url"
                        value={customNodeInput}
                        onChange={(e) => setCustomNodeInput(e.target.value)}
                        placeholder="https://rpc.ausbit.dev"
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                      {customNodeError && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 leading-tight">
                          {customNodeError}
                        </p>
                      )}
                      <div className="flex items-center gap-2 justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => { setShowAddNodeForm(false); setCustomNodeError(null); }}
                          className="px-2.5 py-1 text-xs text-gray-600 dark:text-slate-400 hover:bg-gray-200/60 dark:hover:bg-slate-700 rounded-lg transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={customNodeAdding || !customNodeInput.trim()}
                          className="px-3 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          {customNodeAdding ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            'Save Node'
                          )}
                        </button>
                      </div>
                    </form>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowNodeMenu(false);
                      onOpenStats();
                    }}
                    className="w-full text-center py-1.5 px-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Blockchain Stats & RPC Details</span>
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Mobile Navigation Drawer */}
        {showMobileMenu && (
          <div id="mobile-nav-drawer" className="md:hidden border-t border-gray-100 dark:border-slate-800 py-3 px-1 space-y-1 bg-white dark:bg-slate-900">
            <button
              onClick={() => {
                if (onNavChange) onNavChange('feed');
                setShowMobileMenu(false);
              }}
              title="Feed: Stories and updates from creators and accounts you follow"
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer ${
                activeNav === 'feed'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
            >
              <span>Feed (Following)</span>
              {activeNav === 'feed' && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />}
            </button>

            <button
              onClick={() => {
                if (onNavChange) onNavChange('discover');
                setShowMobileMenu(false);
              }}
              title="Discover: Global Hive feed ranked by Hot, Trending, and New"
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer ${
                activeNav === 'discover'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
            >
              <span>Discover (Global)</span>
              {activeNav === 'discover' && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />}
            </button>

            <button
              onClick={() => {
                if (onNavChange) onNavChange('shorts');
                setShowMobileMenu(false);
              }}
              title="Shorts: Microblogging & instant community snaps via @peak.snaps"
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer ${
                activeNav === 'shorts' || activeNav === 'waves'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
            >
              <span>Shorts</span>
              {(activeNav === 'shorts' || activeNav === 'waves') && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />}
            </button>

            <button
              onClick={() => {
                if (onNavChange) onNavChange('communities');
                setShowMobileMenu(false);
              }}
              title="Communities: Explore Hive communities and specialized groups"
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer ${
                activeNav === 'communities'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
            >
              <span>Communities</span>
              {activeNav === 'communities' && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />}
            </button>

            {currentUser && onOpenNotifications && (
              <button
                onClick={() => {
                  onOpenNotifications();
                  setShowMobileMenu(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer ${
                  unreadNotificationsCount > 0
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                    : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-rose-500" />
                  <span>Notifications</span>
                </div>
                {unreadNotificationsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                    {unreadNotificationsCount} new
                  </span>
                )}
              </button>
            )}

            {currentUser && onOpenManageFollowing && (
              <button
                onClick={() => {
                  onOpenManageFollowing();
                  setShowMobileMenu(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Manage Following</span>
              </button>
            )}

            <button
              onClick={() => {
                onOpenWrite?.();
                setShowMobileMenu(false);
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Write a post
            </button>
            <button
              onClick={() => {
                onOpenCommunities();
                setShowMobileMenu(false);
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Explore Communities
            </button>
            <button
              onClick={() => {
                onOpenManageCommunities?.();
                setShowMobileMenu(false);
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Manage Communities
            </button>

            <div className="pt-2 mt-2 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between px-3">
              <button
                type="button"
                onClick={onToggleTheme}
                className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-slate-300 py-1.5 cursor-pointer"
              >
                {isDark ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span>Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-slate-600" />
                    <span>Dark Mode</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileMenu(false);
                  onOpenStats();
                }}
                className="text-xs text-blue-600 dark:text-blue-400 font-semibold py-1.5 cursor-pointer flex items-center gap-1"
              >
                <Wifi className="w-3.5 h-3.5" />
                <span>RPC Nodes ({nodePing ? `${nodePing}ms` : 'active'})</span>
              </button>
            </div>
          </div>
        )}
      </div>

    </header>
    {showLoginModal && (
      <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto">
        <div className="mt-8 sm:mt-0 my-auto bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 w-full max-w-md border border-gray-100 dark:border-slate-800 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 text-gray-900 dark:text-slate-100">

          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-gray-900 dark:text-white">Connect Hive Keychain</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">Secure keyless sign-in for Hive blockchain</p>
              </div>
            </div>

            <button
              onClick={() => setShowLoginModal(false)}
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Keychain Extension Detection Indicator */}
          <div className={`p-3 rounded-2xl text-xs flex items-center gap-2.5 border ${keychainInstalled
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
            : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300'
            }`}>
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            <span>
              {keychainInstalled
                ? 'Hive Keychain extension detected in browser.'
                : 'Extension not detected. You can still login to test or install the extension.'}
            </span>
          </div>

          {loginError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs text-rose-700 dark:text-rose-300 font-medium">
              {loginError}
            </div>
          )}

          <form onSubmit={handleKeychainLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-slate-300 block mb-1.5">
                Hive Username
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-sm font-bold">@</span>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''))}
                  placeholder="yourusername"
                  className="w-full pl-8 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>
            </div>

            {/* Quick test accounts */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-gray-400 dark:text-slate-500">Try demo:</span>
              {['ecency', 'good-karma'].map(acc => (
                <button
                  key={acc}
                  type="button"
                  onClick={() => setLoginUsername(acc)}
                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-2 py-0.5 rounded-lg transition border border-blue-100 dark:border-blue-900/50"
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
    </>
  );
};
