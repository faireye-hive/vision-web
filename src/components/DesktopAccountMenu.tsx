import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Bell, Bookmark, ChevronDown, ChevronRight, Compass, Layers, LogOut, MessageSquare, Moon, Settings, ShieldCheck, SlidersHorizontal, Sun, Wifi, Zap } from 'lucide-react';
import { useBlacklistFlair } from '../context/BlacklistFlairContext';
import { useI18n } from '../i18n/I18nContext';
import { CurrentUser } from '../services/keychain';
import { getHiveAvatarUrl } from '../utils/hiveAvatar';
import { handleImageFallback } from '../utils/imageFallback';
import { UiLanguagePicker } from './UiLanguagePicker';

interface DesktopAccountMenuProps {
  user: CurrentUser;
  unreadCount: number;
  nodePing: number | null;
  isDark: boolean;
  onClose: () => void;
  onOpenProfile: () => void;
  onOpenCommunities: () => void;
  onOpenManageCommunities: () => void;
  onOpenManageFollowing?: () => void;
  onOpenNotifications?: () => void;
  onOpenNodes: () => void;
  onOpenStats: () => void;
  onToggleTheme?: () => void;
  onLogout: () => void;
}

const row = 'flex min-h-8 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start text-xs font-medium transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-[#151719]';
const icon = 'h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400';

export function DesktopAccountMenu({ user, unreadCount, nodePing, isDark, onClose, onOpenProfile, onOpenCommunities, onOpenManageCommunities, onOpenManageFollowing, onOpenNotifications, onOpenNodes, onOpenStats, onToggleTheme, onLogout }: DesktopAccountMenuProps) {
  const { t } = useI18n();
  const blacklist = useBlacklistFlair();
  const profileRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { profileRef.current?.focus(); }, []);

  const activate = (action: () => void) => {
    onClose();
    action();
  };

  return (
    <div
      id="user-menu-dropdown"
      aria-label={t('menu.quickLinks')}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && !event.currentTarget.contains(next) && next !== document.getElementById('user-avatar-btn')) onClose();
      }}
      className="absolute end-0 z-50 mt-2 flex max-h-[calc(100dvh-5rem)] w-80 max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-xl animate-in fade-in zoom-in-95 duration-150 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
    >
      <button ref={profileRef} type="button" onClick={() => activate(onOpenProfile)} title={t('menu.viewProfile')} className={`${row} shrink-0 gap-3 px-2 py-2`}>
        <img src={user.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover bg-slate-100 dark:bg-slate-800" onError={(event) => handleImageFallback(event, getHiveAvatarUrl(user.username))} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">@{user.username}</span>
          <span className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400"><ShieldCheck className="h-3 w-3" />{user.isDemo ? t('menu.demo') : t('menu.keychain')}</span>
        </span>
        <ChevronRight className={icon} />
      </button>

      <div className="min-h-0 overflow-y-auto overscroll-contain border-y border-slate-100 py-1 dark:border-slate-800">
        <nav aria-label={t('menu.quickLinks')}>
          {onOpenNotifications && <button type="button" onClick={() => activate(onOpenNotifications)} className={row} title={t('menu.notificationsHint')}>
            <Bell className={icon} /><span className="flex-1">{t('menu.notifications')}</span>
            {unreadCount > 0 && <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>}
          <Link to="/snaps" onClick={onClose} className={row}><Zap className={icon} /><span className="flex-1">Nebulosa Snaps</span><span className="text-[10px] text-slate-500 dark:text-slate-400">No rewards</span></Link>
          <Link to="/chat" onClick={onClose} className={row} title="Encrypted chat"><MessageSquare className={icon} /><span>Messages</span></Link>
          <Link to="/lists" onClick={onClose} className={row} title="Saved posts"><Bookmark className={icon} /><span>My lists</span></Link>
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
          <button type="button" onClick={() => activate(onOpenCommunities)} className={row}><Compass className={icon} /><span>{t('menu.exploreCommunities')}</span></button>
          <button type="button" onClick={() => activate(onOpenManageCommunities)} className={row}><Layers className={icon} /><span>{t('menu.manageCommunities')}</span></button>
          {onOpenManageFollowing && <button type="button" onClick={() => activate(onOpenManageFollowing)} className={row}><SlidersHorizontal className={icon} /><span>{t('menu.manageFollowing')}</span></button>}
        </nav>

        <div className="mt-1 border-t border-slate-100 pt-1 dark:border-slate-800">
          {onToggleTheme && <button type="button" onClick={() => activate(onToggleTheme)} className={row}>
            {isDark ? <Sun className="h-4 w-4 shrink-0 text-amber-500" /> : <Moon className={icon} />}
            <span className="flex-1">{t('menu.appearance')}</span><span className="text-[11px] text-slate-500 dark:text-slate-400">{isDark ? t('menu.darkMode') : t('menu.lightMode')}</span>
          </button>}
          <UiLanguagePicker compact />
          <details className="group/network">
            <summary className={`${row} list-none [&::-webkit-details-marker]:hidden`}>
              <Settings className={icon} /><span className="flex-1">{t('menu.network')}</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-open/network:rotate-180" />
            </summary>
            <div className="ms-2 border-s border-slate-200 ps-2 dark:border-slate-800">
              <button id="rpc-nodes-trigger" type="button" onClick={() => activate(onOpenNodes)} className={row}>
                <Wifi className={icon} /><span className="flex-1">{t('menu.rpcNodes')}</span><span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">{nodePing ? `${nodePing}ms` : t('menu.active')}</span>
              </button>
              <button type="button" onClick={() => activate(onOpenStats)} className={row}><Activity className={icon} /><span>{t('menu.chainStats')}</span></button>
              <button type="button" role="switch" aria-checked={blacklist.enabled} onClick={blacklist.toggle} title="Your blacklist and lists you follow" className={row}>
                <ShieldCheck className={icon} /><span className="flex-1">Show blacklist badges</span>
                <span aria-hidden="true" className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${blacklist.enabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}><span className={`absolute start-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${blacklist.enabled ? 'translate-x-3 rtl:-translate-x-3' : 'translate-x-0'}`} /></span>
              </button>
              {blacklist.enabled && (blacklist.loading || blacklist.error) && <div role="status" className="px-2 py-1 text-[10px] text-slate-500 dark:text-slate-400">{blacklist.loading ? 'Loading blacklist badges…' : <>{blacklist.error} <button type="button" className="underline" onClick={blacklist.refresh}>Retry</button></>}</div>}
            </div>
          </details>
        </div>
      </div>

      <button type="button" onClick={() => activate(onLogout)} title={t('menu.disconnectHint')} className={`${row} mt-1 shrink-0 text-rose-600 dark:text-rose-400`}><LogOut className="h-4 w-4 shrink-0" /><span>{t('menu.disconnect')}</span></button>
    </div>
  );
}
