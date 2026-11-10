import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { BlacklistSources, loadBlacklistSources } from '../services/blacklistSources';

interface FlairContext {
  enabled: boolean; toggle: () => void; loading: boolean; error: string;
  refresh: () => void; getSources: (username: string) => BlacklistSources | undefined;
}
const Context = createContext<FlairContext | null>(null);
const storageKey = (username: string) => `nebulosa:blacklist-flair:${username}`;
export function BlacklistFlairProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const username = currentUser?.username.toLowerCase() || '';
  const [preference, setPreference] = useState({ username: '', enabled: false });
  const [data, setData] = useState<{ username: string; accounts: Record<string, BlacklistSources> }>({ username: '', accounts: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const enabled = !!username && preference.username === username && preference.enabled;
  useEffect(() => {
    let enabled = false;
    try { enabled = localStorage.getItem(storageKey(username)) === 'true'; } catch { /* Storage may be unavailable. */ }
    setPreference({ username, enabled });
  }, [username]);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    window.addEventListener('nebulosa:blacklists-changed', refresh);
    return () => window.removeEventListener('nebulosa:blacklists-changed', refresh);
  }, [refresh]);
  useEffect(() => {
    if (!enabled) { setLoading(false); setError(''); return; }
    let active = true;
    setLoading(true); setError('');
    loadBlacklistSources(username).then(result => {
      if (!active) return;
      setData({ username, accounts: result.accounts });
      if (result.incomplete) setError('Some followed blacklists could not be loaded.');
    }).catch(() => { if (active) setError('Could not load blacklist badges.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [username, enabled, revision]);
  const toggle = () => {
    const next = !enabled;
    setPreference({ username, enabled: next });
    try { localStorage.setItem(storageKey(username), String(next)); } catch { /* Keep the session preference. */ }
  };
  const getSources = (name: string) => enabled && data.username === username
    ? data.accounts[name.trim().replace(/^@/, '').toLowerCase()] : undefined;
  return <Context.Provider value={{ enabled, toggle, loading, error, refresh, getSources }}>{children}</Context.Provider>;
}
export function useBlacklistFlair() {
  const context = useContext(Context);
  if (!context) throw new Error('BlacklistFlairProvider is required');
  return context;
}
