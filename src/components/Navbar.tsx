import React, { useState, useEffect, useRef } from 'react';
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
  ChevronRight,
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
  SlidersHorizontal,
  Users,
  Rss,
  Sparkles
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
import { useNavigation } from '../context/NavigationContext';
import { LanguageDropdown } from './LanguageDropdown';
import { SearchPreviewPopover } from './SearchPreviewPopover';

interface NavbarProps {
  currentSort: 'recommend' | 'trending' | 'hot' | 'created' | 'payout' | 'muted' | 'promoted';
  onSortChange: (sort: 'recommend' | 'trending' | 'hot' | 'created' | 'payout' | 'muted' | 'promoted') => void;
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
  selectedLanguage?: string;
  onSelectLanguage?: (langCode: string) => void;
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
  onToggleTheme,
  selectedLanguage = 'global',
  onSelectLanguage
}) => {
  const { unreadCount: unreadNotificationsCount } = useNotifications();
  const { openCommunity } = useNavigation();
  const [searchInput, setSearchInput] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [showSearchPopover, setShowSearchPopover] = useState(false);
  const desktopSearchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);

  // Close search popover when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | PointerEvent) => {
      const target = e.target as Node;
      if (
        desktopSearchRef.current &&
        !desktopSearchRef.current.contains(target) &&
        mobileSearchRef.current &&
        !mobileSearchRef.current.contains(target)
      ) {
        setShowSearchPopover(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSearchPopover(false);
        setShowLoginModal(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const input = document.getElementById('search-input') as HTMLInputElement | null;
        if (input) {
          input.focus();
          setShowSearchPopover(true);
        }
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  const [activeNodeUrl, setActiveNodeUrl] = useState(getActiveNode());
  const [nodePing, setNodePing] = useState<number | null>(null);
  const [showNodeMenu, setShowNodeMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
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

    setShowSearchPopover(false);
    setMobileSearchOpen(false);

    if (query.startsWith('@')) {
      onOpenAccount(query.replace('@', ''));
    } else if (query.startsWith('#')) {
      onTagChange(query.replace('#', '').toLowerCase());
    } else if (query.toLowerCase().startsWith('hive-')) {
      openCommunity(query.toLowerCase());
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

  const handleDemoLogin = async () => {
    if (!loginUsername.trim()) {
      setLoginError('Enter a Hive username to browse in Demo mode.');
      return;
    }
    setLoginLoading(true);
    setLoginError(null);
    try {
      const result = await KeychainService.loginDemo(loginUsername);
      if (result.success && result.user) {
        onLogin(result.user);
        setShowLoginModal(false);
      } else {
        setLoginError(result.error || 'Could not start Demo mode.');
      }
    } catch (err: any) {
      setLoginError(err?.message || 'Could not start Demo mode.');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <>
    <header 
      id="app-navbar" 
      className="relative md:sticky md:top-0 z-[100] bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors duration-200"
    >
      {/* Ambient top hairline gradient glow */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/60 to-transparent pointer-events-none opacity-80" />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-3 sm:gap-4">

          {/* Left section: Nebulosa Logo, Nav links */}
            <div className="flex items-center gap-2 md:gap-3 lg:gap-5 min-w-0">

            {/* Nebulosa Circular Brand Logo */}
            <button
              id="brand-home-btn"
              onClick={() => {
                onTagChange('');
                onSortChange('hot');
                if (onNavChange) onNavChange('discover');
              }}
              className="flex items-center gap-2.5 focus:outline-none group cursor-pointer"
              title="Home Page"
            >
              <div className="relative">
                <img
                  src="/assets/logo-circle.svg"
                  alt="Nebulosa Logo"
                  className="w-9 h-9 rounded-full shadow-md group-hover:scale-105 group-hover:shadow-blue-500/25 transition-all duration-300 ring-1 ring-black/5 dark:ring-white/10"
                />
                <div className="absolute -inset-1 rounded-full bg-blue-500/20 blur-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg tracking-tight bg-gradient-to-r from-gray-900 via-blue-950 to-gray-800 dark:from-white dark:via-blue-200 dark:to-slate-200 bg-clip-text text-transparent group-hover:from-blue-600 group-hover:to-indigo-600 transition-all duration-300">
                  Nebulosa
                </span>
                <span className="hidden xl:inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-md border border-blue-500/20">
                  <Sparkles className="w-2.5 h-2.5" />
                  Web3
                </span>
              </div>
            </button>

            {/* Primary Nav Links: Segmented Pill bar */}
            <nav className="hidden md:flex items-center gap-0.5 p-1 bg-slate-100/90 dark:bg-slate-800/70 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 shrink-0">
              {[
                { id: 'feed', label: 'Feed', icon: Rss, desc: 'Stories from accounts you follow' },
                { id: 'discover', label: 'Discover', icon: Compass, desc: 'Trending, Hot & New feeds' },
                { id: 'shorts', label: 'Shorts', icon: Zap, desc: 'Microblogging & quick snaps' },
                { id: 'communities', label: 'Communities', icon: Users, desc: 'Specialized Hive groups' }
              ].map(tab => {
                const isActive = (tab.id === 'shorts' && (activeNav === 'shorts' || activeNav === 'waves')) || activeNav === tab.id;
                const useNeutralActive = isActive && tab.id === 'shorts';
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    id={`nav-${tab.id}-btn`}
                    onClick={() => { if (onNavChange) onNavChange(tab.id as any); }}
                    title={`${tab.label}: ${tab.desc}`}
                    className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                      isActive
                        ? useNeutralActive
                          ? 'bg-white dark:bg-[#121829] text-slate-800 dark:text-slate-100 shadow-sm border border-gray-200/70 dark:border-slate-700/70 font-extrabold'
                          : 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-sm border border-blue-200/80 dark:border-blue-900/70 font-bold'
                        : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? (useNeutralActive ? 'text-slate-600 dark:text-slate-300' : 'text-blue-600 dark:text-blue-400') : 'text-gray-400 dark:text-slate-400'}`} />
                    <span className="hidden lg:inline">{tab.label}</span>
                    {isActive && (
                      <span className={`w-1.5 h-1.5 rounded-full ${useNeutralActive ? 'bg-slate-500 dark:bg-slate-400' : 'bg-blue-600 dark:bg-blue-400 shadow-xs shadow-blue-500'}`} />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right section: Network Status, Theme Toggle, Stats, Search, Write, Notifications, User */}
          <div className="flex items-center gap-1 sm:gap-1.5">

            {/* Live RPC Node Latency Pill on Desktop */}
            <button
              id="rpc-nodes-status-badge"
              type="button"
              onClick={() => setShowNodeMenu(!showNodeMenu)}
              className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-800 text-[11px] font-mono text-gray-600 dark:text-slate-300 transition cursor-pointer group/node"
              title="Hive RPC network status — Click to switch nodes"
            >
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${nodePing && nodePing < 300 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${nodePing && nodePing < 300 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              </span>
              <span className="font-semibold">{nodePing ? `${nodePing}ms` : 'RPC'}</span>
            </button>

            {/* Dark Mode / Night Mode Toggle */}
            {onToggleTheme && (
              <button
                id="theme-toggle-btn"
                type="button"
                onClick={onToggleTheme}
                className="p-2 text-gray-500 hover:text-gray-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-amber-300 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer hidden lg:flex active:scale-95"
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode (Night Mode)"}
                aria-label="Toggle dark mode"
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-amber-400 animate-in zoom-in-75 duration-200 hover:rotate-45 transition-transform" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-600 hover:text-slate-900 transition hover:-rotate-12" />
                )}
              </button>
            )}

            {/* RPC Node & Stats Helper icon */}
            <button
              id="help-btn"
              onClick={onOpenStats}
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 rounded-xl transition hidden lg:flex active:scale-95"
              title="Hive Blockchain Nodes & RPC Settings (Add Custom Nodes)"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Mobile Language Selector */}
            {onSelectLanguage && (
              <div className="sm:hidden">
                <LanguageDropdown
                  id="mobile-navbar-language-dropdown"
                  selectedLanguage={selectedLanguage}
                  onSelectLanguage={onSelectLanguage}
                  iconOnly={true}
                />
              </div>
            )}

            {/* Mobile Search Icon Toggle */}
            <button
              id="mobile-search-toggle-btn"
              type="button"
              onClick={() => {
                const next = !mobileSearchOpen;
                setMobileSearchOpen(next);
                setShowSearchPopover(next);
              }}
              className="p-2 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-all duration-200 cursor-pointer sm:hidden active:scale-95"
              title="Search Hive"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Desktop Search Pill with Live Preview Popover */}
            <div ref={desktopSearchRef} className={`relative hidden sm:block sm:w-40 md:w-44 lg:w-56 xl:w-72 transition-all duration-200 focus-within:sm:w-44 focus-within:md:w-52 focus-within:lg:w-64 focus-within:xl:w-80 ${showSearchPopover ? 'z-[70]' : 'z-0'}`}>
              <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <div className="absolute left-2.5 w-5 h-5 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-400 dark:text-slate-400">
                  <Search className="w-3 h-3" />
                </div>
                <input
                  id="search-input"
                  type="text"
                  autoComplete="off"
                  value={searchInput}
                  onFocus={() => setShowSearchPopover(true)}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setShowSearchPopover(true);
                  }}
                  placeholder="Search Hive, @user, #tag"
                  className="w-full pl-9 pr-14 py-1.5 text-xs bg-gray-50/90 dark:bg-slate-800/80 border border-gray-200/80 dark:border-slate-700/80 rounded-full text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-[#0c1222] transition-all duration-200 shadow-2xs"
                />
                {/* Cmd+K Keyboard Hint */}
                {!searchInput && (
                  <kbd className="hidden lg:inline-flex items-center gap-0.5 absolute right-2.5 text-[9px] font-mono font-semibold text-gray-400 dark:text-slate-500 bg-gray-200/60 dark:bg-slate-700/60 px-1.5 py-0.5 rounded-md pointer-events-none">
                    ⌘K
                  </kbd>
                )}
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      setShowSearchPopover(false);
                    }}
                    className="absolute right-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>

              <SearchPreviewPopover
                query={searchInput}
                isOpen={showSearchPopover}
                onClose={() => setShowSearchPopover(false)}
                onSelectCreator={(username) => {
                  onOpenAccount(username);
                  setShowSearchPopover(false);
                }}
                onSelectCommunity={(commName) => {
                  openCommunity(commName);
                  setShowSearchPopover(false);
                }}
                onSelectTag={(tag) => {
                  onTagChange(tag);
                  setShowSearchPopover(false);
                }}
                onSubmitFullSearch={(q) => {
                  if (q.startsWith('@')) {
                    onOpenAccount(q.replace('@', ''));
                  } else if (q.startsWith('#')) {
                    onTagChange(q.replace('#', '').toLowerCase());
                  } else if (q.toLowerCase().startsWith('hive-')) {
                    openCommunity(q.toLowerCase());
                  } else {
                    onTagChange(q.toLowerCase());
                  }
                  setShowSearchPopover(false);
                }}
              />
            </div>

            {/* Write Button with Gradient & Shimmer */}
            <button
              id="write-btn"
              onClick={() => onOpenWrite?.()}
              title="Write a new Hive post (Press N)"
              className="hidden sm:flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3 sm:px-3.5 py-2 rounded-xl shadow-sm hover:shadow-md active:scale-[0.98] transition cursor-pointer relative overflow-hidden group/write"
            >
              <div className="absolute inset-0 -translate-x-full group-hover/write:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
              <Edit3 className="w-3.5 h-3.5 group-hover/write:rotate-12 transition-transform duration-200" />
                  <span className="hidden lg:inline">Write</span>
            </button>

            {/* Quick Notifications Bell Button */}
            {currentUser && onOpenNotifications && (
              <button
                id="notifications-btn"
                onClick={onOpenNotifications}
                title={unreadNotificationsCount > 0 ? `${unreadNotificationsCount} unread notifications` : 'View Notifications'}
                className={`hidden sm:flex relative p-2 rounded-full border transition-all duration-200 cursor-pointer items-center justify-center active:scale-95 group/bell ${
                  unreadNotificationsCount > 0
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-700 ring-2 ring-rose-400/20 shadow-xs'
                    : 'bg-white/80 dark:bg-slate-900/80 text-gray-600 dark:text-slate-300 border-gray-200/80 dark:border-slate-800 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                <Bell className={`w-4 h-4 transition-transform duration-200 ${unreadNotificationsCount > 0 ? 'animate-bounce' : 'group-hover/bell:rotate-12'}`} />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white border-2 border-white dark:border-slate-900 shadow-xs">
                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                  </span>
                )}
              </button>
            )}

            {/* Keychain Login Button (Logged out) OR User Profile Avatar (Logged in) */}
            {!currentUser ? (
              <button
                id="keychain-login-btn"
                onClick={() => setShowLoginModal(true)}
                title="Connect with Hive Keychain"
                className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm hover:shadow-md active:scale-[0.98] transition cursor-pointer group/login"
              >
                <Key className="w-3.5 h-3.5 group-hover/login:rotate-12 transition-transform duration-200" />
                <span className="hidden md:inline">Log in</span>
              </button>
            ) : (
              <div className="relative hidden sm:block">
                <button
                  id="user-avatar-btn"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  title={`Signed in as @${currentUser.username}${unreadNotificationsCount > 0 ? ` (${unreadNotificationsCount} unread notifications)` : ''}`}
                  className={`flex items-center gap-2 p-1 pr-2.5 rounded-xl border transition focus:outline-none cursor-pointer active:scale-[0.98] shadow-sm group/userbtn ${
                    unreadNotificationsCount > 0
                      ? 'border-rose-300 dark:border-rose-700 bg-rose-50/70 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 ring-2 ring-rose-400/30'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-sm'
                  }`}
                >
                  <div className="relative">
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.username}
                      className={`w-7 h-7 object-cover rounded-full border shadow-2xs ${
                        unreadNotificationsCount > 0 ? 'border-rose-300 ring-1 ring-rose-400' : 'border-gray-100 dark:border-slate-700 ring-1 ring-black/5'
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
                  <span className={`text-xs font-bold hidden lg:inline max-w-[100px] truncate ${
                    unreadNotificationsCount > 0 ? 'text-rose-700 dark:text-rose-300 font-extrabold' : 'text-gray-800 dark:text-slate-200'
                  }`}>
                    @{currentUser.username}
                  </span>
                  {unreadNotificationsCount > 0 && (
                    <span className="text-[10px] font-black bg-rose-500 text-white px-1.5 py-0.2 rounded-full hidden sm:inline shadow-xs">
                      {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                    </span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showUserMenu ? 'rotate-180 text-blue-500' : unreadNotificationsCount > 0 ? 'text-rose-500' : 'text-gray-400'}`} />
                </button>

                {/* User Dropdown */}
                {showUserMenu && (
                  <div
                    id="user-menu-dropdown"
                    className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2.5 z-50 text-gray-800 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
                  >
                    {/* Top hairline gradient */}
                    <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 pointer-events-none" />

                    {/* User Header Profile Card */}
                    <div
                      onClick={() => { onOpenAccount(currentUser.username); setShowUserMenu(false); }}
                      className="group/header p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700 cursor-pointer hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-sm transition mb-1.5"
                      title="View your Hive profile"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <img
                            src={currentUser.avatar}
                            alt={currentUser.username}
                            className="w-11 h-11 rounded-2xl border-2 border-white dark:border-slate-700 object-cover shadow-xs group-hover/header:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
                            }}
                          />
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-extrabold text-gray-900 dark:text-white truncate group-hover/header:text-blue-600 dark:group-hover/header:text-blue-400 transition-colors">
                              @{currentUser.username}
                            </p>
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 opacity-0 group-hover/header:opacity-100 transition-opacity flex items-center">
                              Profile <ChevronRight className="w-3 h-3 ml-0.5" />
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${currentUser.isDemo
                              ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border-blue-500/20'
                              : 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500/20'
                              }`}>
                              <ShieldCheck className="w-3 h-3" />
                              <span>{currentUser.isDemo ? 'Demo · read-only' : 'Hive Keychain'}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="max-h-[min(72vh,560px)] space-y-3 overflow-y-auto no-scrollbar py-1">
                      <section aria-label="Shortcuts">
                        <p className="px-1.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Quick links
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => { onOpenCommunities(); setShowUserMenu(false); }}
                            className="group flex min-h-10 items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-2 hover:border-blue-200 hover:bg-blue-50/70 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-900 dark:hover:bg-blue-950/30 transition"
                          >
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">
                              <Compass className="h-3.5 w-3.5" />
                            </span>
                            <span className="truncate text-[11px] font-semibold text-slate-700 group-hover:text-blue-700 dark:text-slate-200 dark:group-hover:text-blue-300">Explore communities</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (onOpenManageCommunities) onOpenManageCommunities();
                              else onOpenCommunities();
                              setShowUserMenu(false);
                            }}
                            className="group flex min-h-10 items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-2 hover:border-blue-200 hover:bg-blue-50/70 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-900 dark:hover:bg-blue-950/30 transition"
                          >
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">
                              <Layers className="h-3.5 w-3.5" />
                            </span>
                            <span className="truncate text-[11px] font-semibold text-slate-700 group-hover:text-blue-700 dark:text-slate-200 dark:group-hover:text-blue-300">Manage communities</span>
                          </button>
                          {onOpenManageFollowing && (
                            <button
                              type="button"
                              onClick={() => { onOpenManageFollowing(); setShowUserMenu(false); }}
                              className="group flex min-h-10 items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-2 hover:border-blue-200 hover:bg-blue-50/70 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-900 dark:hover:bg-blue-950/30 transition"
                            >
                              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">
                                <SlidersHorizontal className="h-3.5 w-3.5" />
                              </span>
                              <span className="truncate text-[11px] font-semibold text-slate-700 group-hover:text-blue-700 dark:text-slate-200 dark:group-hover:text-blue-300">Manage following</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => { onOpenAccount(currentUser.username); setShowUserMenu(false); }}
                            className="group flex min-h-10 items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-2 hover:border-blue-200 hover:bg-blue-50/70 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-900 dark:hover:bg-blue-950/30 transition"
                          >
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">
                              <UserIcon className="h-3.5 w-3.5" />
                            </span>
                            <span className="truncate text-[11px] font-semibold text-slate-700 group-hover:text-blue-700 dark:text-slate-200 dark:group-hover:text-blue-300">Profile</span>
                          </button>
                        </div>
                      </section>

                      {onOpenNotifications && (
                        <section aria-label="Notifications">
                          <button
                            type="button"
                            onClick={() => { onOpenNotifications(); setShowUserMenu(false); }}
                            className={`flex w-full items-center justify-between rounded-xl border px-2.5 py-2 text-left transition ${unreadNotificationsCount > 0
                              ? 'border-rose-200 bg-rose-50/80 dark:border-rose-900/60 dark:bg-rose-950/30'
                              : 'border-slate-200/80 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${unreadNotificationsCount > 0 ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                                <Bell className="h-4 w-4" />
                              </span>
                              <span className="min-w-0">
                                <span className={`block text-xs font-semibold ${unreadNotificationsCount > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-800 dark:text-slate-100'}`}>Notifications</span>
                                <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">Replies, mentions & votes</span>
                              </span>
                            </span>
                            {unreadNotificationsCount > 0 ? (
                              <span className="ml-2 shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                                {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount} new
                              </span>
                            ) : <ChevronRight className="h-4 w-4 text-slate-400" />}
                          </button>
                        </section>
                      )}

                      <section aria-label="Network and preferences" className="border-t border-slate-100 pt-2.5 dark:border-slate-800">
                        <p className="px-1.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Network & preferences
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            id="rpc-nodes-trigger"
                            type="button"
                            onClick={() => { setShowNodeMenu(!showNodeMenu); setShowUserMenu(false); }}
                            className="group flex min-h-10 items-center justify-between gap-1.5 rounded-xl border border-slate-200/80 bg-white px-2 hover:border-emerald-200 hover:bg-emerald-50/50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-900 dark:hover:bg-emerald-950/20 transition"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"><Wifi className="h-3.5 w-3.5" /></span>
                              <span className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">RPC Nodes</span>
                            </span>
                            <span className="shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-mono font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">{nodePing ? `${nodePing}ms` : 'active'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => { onOpenStats(); setShowUserMenu(false); }}
                            className="group flex min-h-10 items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-2 hover:border-blue-200 hover:bg-blue-50/70 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-900 dark:hover:bg-blue-950/30 transition"
                          >
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300"><Activity className="h-3.5 w-3.5" /></span>
                            <span className="truncate text-[11px] font-semibold text-slate-700 group-hover:text-blue-700 dark:text-slate-200 dark:group-hover:text-blue-300">Chain stats</span>
                          </button>
                          {onToggleTheme && (
                            <button
                              type="button"
                              onClick={() => { onToggleTheme(); setShowUserMenu(false); }}
                              className="group col-span-2 flex min-h-10 items-center justify-between rounded-xl border border-slate-200/80 bg-white px-2 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 transition"
                            >
                              <span className="flex items-center gap-2">
                                <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{isDark ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5" />}</span>
                                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Appearance</span>
                              </span>
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{isDark ? 'Dark' : 'Light'} mode</span>
                            </button>
                          )}
                        </div>
                      </section>
                    </div>

                    <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => { onLogout(); setShowUserMenu(false); }}
                        className="group/logout flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"><LogOut className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold">Disconnect account</span>
                          <span className="block text-[10px] text-rose-500/70 dark:text-rose-400/70">Sign out from this session</span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-rose-400 transition-transform group-hover/logout:translate-x-0.5" />
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
                className="absolute right-4 top-16 mt-2.5 w-84 bg-white/95 dark:bg-[#0c1222]/95 backdrop-blur-2xl border border-gray-100 dark:border-slate-800/90 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] p-3 z-50 text-gray-800 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-150 overflow-hidden ring-1 ring-black/5 dark:ring-white/5"
              >
                {/* Top hairline gradient */}
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-teal-500 via-blue-500 to-indigo-500 pointer-events-none" />

                <div className="px-2.5 py-2 border-b border-gray-100 dark:border-slate-800/80 flex items-center justify-between">
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

        {/* Mobile Expandable Search Bar Overlay with Live Preview */}
        {mobileSearchOpen && (
          <div ref={mobileSearchRef} className="sm:hidden px-3 py-2 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 animate-in slide-in-from-top-1 duration-150">
            <form
              onSubmit={(e) => {
                handleSearchSubmit(e);
                setMobileSearchOpen(false);
              }}
              className="relative flex items-center gap-2"
            >
              <div className="relative flex-1">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <input
                  autoFocus
                  type="text"
                  autoComplete="off"
                  value={searchInput}
                  onFocus={() => setShowSearchPopover(true)}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setShowSearchPopover(true);
                  }}
                  placeholder="Search Hive or @user..."
                  className="w-full pl-8 pr-8 py-1.5 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-full text-gray-800 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      setShowSearchPopover(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileSearchOpen(false);
                  setShowSearchPopover(false);
                }}
                className="px-2 py-1 text-xs font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            </form>

            <SearchPreviewPopover
              isMobile
              query={searchInput}
              isOpen={showSearchPopover}
              onClose={() => {
                setShowSearchPopover(false);
                setMobileSearchOpen(false);
              }}
              onSelectCreator={(username) => {
                onOpenAccount(username);
                setShowSearchPopover(false);
                setMobileSearchOpen(false);
              }}
              onSelectCommunity={(commName) => {
                openCommunity(commName);
                setShowSearchPopover(false);
                setMobileSearchOpen(false);
              }}
              onSelectTag={(tag) => {
                onTagChange(tag);
                setShowSearchPopover(false);
                setMobileSearchOpen(false);
              }}
              onSubmitFullSearch={(q) => {
                if (q.startsWith('@')) {
                  onOpenAccount(q.replace('@', ''));
                } else if (q.startsWith('#')) {
                  onTagChange(q.replace('#', '').toLowerCase());
                } else if (q.toLowerCase().startsWith('hive-')) {
                  openCommunity(q.toLowerCase());
                } else {
                  onTagChange(q.toLowerCase());
                }
                setShowSearchPopover(false);
                setMobileSearchOpen(false);
              }}
            />
          </div>
        )}
      </div>

    </header>
    {showLoginModal && (
      <div
        className="fixed inset-0 z-[999] bg-slate-950/55 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowLoginModal(false);
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-modal-title"
          className="mt-4 sm:mt-0 my-auto bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 text-gray-900 dark:text-slate-100"
        >

          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/60 text-blue-600 dark:text-blue-300">
                <Key className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h3 id="login-modal-title" className="font-bold text-base text-gray-900 dark:text-white">Sign in to Hive</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">Connect with Keychain or browse in read-only mode.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowLoginModal(false)}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 rounded-xl transition"
              aria-label="Close login dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Keychain Extension Detection Indicator */}
          <div className={`p-3 rounded-xl text-xs flex items-start gap-2.5 border ${keychainInstalled
            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
            : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/60 text-amber-800 dark:text-amber-300'
            }`}>
            <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              {keychainInstalled
                ? 'Hive Keychain is ready in this browser.'
                : 'Keychain was not detected. You can still browse in read-only Demo mode.'}
            </span>
          </div>

          {loginError && (
            <div role="alert" className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium">
              {loginError}
            </div>
          )}

          <form onSubmit={handleKeychainLogin} className="space-y-3.5">
            <div>
              <label htmlFor="login-hive-username" className="text-xs font-semibold text-gray-700 dark:text-slate-300 block mb-1.5">
                Hive account name
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-sm font-bold">@</span>
                <input
                  id="login-hive-username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''))}
                  placeholder="your-account"
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-gray-500 dark:text-slate-400">Try a demo account</span>
              {['ecency', 'good-karma'].map(acc => (
                <button
                  key={acc}
                  type="button"
                  onClick={() => setLoginUsername(acc)}
                  className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-2.5 py-1 rounded-lg transition border border-blue-200/70 dark:border-blue-900/60"
                >
                  @{acc}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <button
                type="submit"
                disabled={loginLoading || !loginUsername.trim()}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs shadow-sm transition"
              >
                <Key className="w-3.5 h-3.5" aria-hidden="true" />
                {loginLoading ? 'Signing challenge...' : 'Login with Keychain'}
              </button>
              {!keychainInstalled && (
                <a
                  href="https://hive-keychain.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300 transition"
                >
                  Get Hive Keychain
                </a>
              )}
            </div>
          </form>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-gray-800 dark:text-slate-100">Browse without signing</p>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">Demo mode is read-only and uses public Hive data.</p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">Read-only</span>
            </div>
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loginLoading || !loginUsername.trim()}
              className="w-full px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loginLoading ? 'Checking Hive account…' : 'Continue in Demo mode'}
            </button>
          </div>

        </div>
      </div>
    )}
    </>
  );
};
