import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Search,
  HelpCircle,
  Edit3,
  Bell,
  Wifi,
  Check,
  ChevronDown,
  Layers,
  User as UserIcon,
  X,
  Key,
  LogOut,
  Sun,
  Moon,
  Trash2,
  Plus,
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
  unreadNotificationsCount?: number;
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
  unreadNotificationsCount = 0,
  activeNav = 'discover',
  onNavChange,
  currentUser,
  onLogin,
  onLogout,
  isDark = false,
  onToggleTheme
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [activeNodeUrl, setActiveNodeUrl] = useState(getActiveNode());
  const [nodePing, setNodePing] = useState<number | null>(null);
  const [showNodeMenu, setShowNodeMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [pings, setPings] = useState<Record<string, number>>({});

  // Custom RPC state
  const [customNodeInput, setCustomNodeInput] = useState('');
  const [customNodeAdding, setCustomNodeAdding] = useState(false);
  const [customNodeError, setCustomNodeError] = useState<string | null>(null);
  const [customNodeSuccess, setCustomNodeSuccess] = useState<string | null>(null);
  const [showAddNodeForm, setShowAddNodeForm] = useState(false);

  // Keychain Login Modal state
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [keychainInstalled, setKeychainInstalled] = useState(false);

  // Trava para evitar disparo continuo de pings
  const isPingingActiveRef = useRef(false);
  const isPingingMenuRef = useRef(false);

  useEffect(() => {
    const handleNodeChange = () => {
      setActiveNodeUrl(getActiveNode());
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
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Ping controlado apenas para o nó ativo (com trava de execução)
  const pingActiveNodeControlled = (url: string) => {
    if (isPingingActiveRef.current) return;
    isPingingActiveRef.current = true;

    pingNode(url)
      .then(ms => {
        setNodePing(ms);
      })
      .finally(() => {
        isPingingActiveRef.current = false;
      });
  };

  useEffect(() => {
    pingActiveNodeControlled(activeNodeUrl);

    // Intervalo estendido para 2 minutos (120.000ms) evitando sobrecarga de rede
    const interval = setInterval(() => {
      pingActiveNodeControlled(activeNodeUrl);
    }, 120000);

    return () => clearInterval(interval);
  }, [activeNodeUrl]);

  // Ping dos nós apenas quando o menu for aberto
  useEffect(() => {
    if (showNodeMenu && !isPingingMenuRef.current) {
      isPingingMenuRef.current = true;
      const nodes = getAllHiveNodes();
      
      Promise.all(
        nodes.map(async (n) => {
          const ms = await pingNode(n);
          return { n, ms };
        })
      )
        .then((results) => {
          const pingMap: Record<string, number> = {};
          results.forEach(({ n, ms }) => {
            pingMap[n] = ms;
          });
          setPings((prev) => ({ ...prev, ...pingMap }));
        })
        .finally(() => {
          isPingingMenuRef.current = false;
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
        setPings((prev) => ({ ...prev, [trimmed]: pingMs }));
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

            {/* Primary Nav Links */}
            <nav className="hidden md:flex items-center gap-1 sm:gap-2">
              <button
                id="nav-feed-btn"
                onClick={() => { if (onNavChange) onNavChange('feed'); }}
                className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition cursor-pointer ${
                  activeNav === 'feed'
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 font-bold'
                    : 'text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                Feed
              </button>

              <button
                id="nav-discover-btn"
                onClick={() => { if (onNavChange) onNavChange('discover'); }}
                className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition cursor-pointer ${
                  activeNav === 'discover'
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 font-bold'
                    : 'text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                Discover
              </button>

              <button
                id="nav-shorts-btn"
                onClick={() => { if (onNavChange) onNavChange('shorts'); }}
                className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition cursor-pointer ${
                  activeNav === 'shorts' || activeNav === 'waves'
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 font-bold'
                    : 'text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                Shorts
              </button>

              <button
                id="nav-communities-btn"
                onClick={() => { if (onNavChange) onNavChange('communities'); }}
                className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition cursor-pointer ${
                  activeNav === 'communities'
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 font-bold'
                    : 'text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                Communities
              </button>
            </nav>
          </div>

          {/* Right section */}
          <div className="flex items-center gap-2 sm:gap-3">
            {onToggleTheme && (
              <button
                id="theme-toggle-btn"
                type="button"
                onClick={onToggleTheme}
                className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-slate-300 dark:hover:text-amber-400 dark:hover:bg-slate-800 rounded-full transition cursor-pointer"
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-amber-400 animate-in zoom-in-75 duration-200" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-600 hover:text-slate-900 transition" />
                )}
              </button>
            )}

            <button
              id="help-btn"
              onClick={onOpenStats}
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 rounded-full transition hidden sm:flex"
              title="Hive Blockchain Nodes & RPC Settings"
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
              className="flex items-center gap-1.5 bg-[#3577f1] hover:bg-blue-600 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1.5 rounded-full shadow-sm transition cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Write</span>
            </button>

            {/* Notifications Bell */}
            {currentUser && onOpenNotifications && (
              <button
                id="notifications-btn"
                onClick={onOpenNotifications}
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
                      className="w-7 h-7 object-cover rounded-full border border-gray-100 dark:border-slate-700"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold hidden sm:inline max-w-[100px] truncate text-gray-800 dark:text-slate-200">
                    @{currentUser.username}
                  </span>
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </button>

                {/* User Dropdown */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl p-3 z-50 text-gray-800 dark:text-slate-200">
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
                      <button
                        onClick={() => { onOpenAccount(currentUser.username); setShowUserMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2 cursor-pointer"
                      >
                        <UserIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>Profile & Wallet</span>
                      </button>

                      <button
                        onClick={() => { setShowNodeMenu(!showNodeMenu); setShowUserMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl flex items-center justify-between cursor-pointer"
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
                        className="w-full text-left px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl flex items-center gap-2 cursor-pointer"
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
                className="absolute right-4 top-16 mt-2 w-80 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl p-3 z-50 text-gray-800 dark:text-slate-200"
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
                              title="Remove custom node"
                            >
                              <Trash2 className="w-3 h-3 text-rose-500" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};