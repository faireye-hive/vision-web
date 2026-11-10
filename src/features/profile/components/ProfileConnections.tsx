import { BlacklistFlair } from '../../../components/BlacklistFlair';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Search, Users } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { getAccount, getHiveAvatarUrl } from '../../../services/hiveApi';
import { KeychainService } from '../../../services/keychain';
import { getProfileRelations, ProfileRelation, RelationAccount, RELATION_LABELS } from '../../../services/profileRelations';

const descriptions: Record<ProfileRelation, string> = {
  followers: 'People who follow this profile.', following: 'People this profile follows.',
  muted: 'Accounts muted directly by this profile.', blacklisted: 'Accounts added to this profile’s blacklist.',
  follow_blacklist: 'Blacklists maintained by other accounts that this profile follows.',
  follow_muted: 'Mute lists maintained by other accounts that this profile follows.'
};
const panel = 'rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-[#111827]';
const control = 'rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';

export const ProfileConnections: React.FC<{ username: string; type: ProfileRelation }> = ({ username, type }) => {
  const [, setParams] = useSearchParams();
  const { currentUser, setFollowingUsersList, setMutedUsersList, refreshMuted } = useAuth();
  const isOwner = currentUser?.username.toLowerCase() === username.toLowerCase();
  const [rows, setRows] = useState<RelationAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const loadingRef = useRef(false);

  useEffect(() => {
    const id = ++generation.current;
    setRows([]); setMore(false); setLoading(true); setError(''); setQuery(''); setMessage(''); setTarget('');
    loadingRef.current = true;
    getProfileRelations(username, type).then(result => {
      if (generation.current !== id) return;
      setRows(result.rows); setMore(result.hasMore);
    }).catch(() => { if (generation.current === id) setError('Could not load this list. Please try again.'); })
      .finally(() => { if (generation.current === id) { setLoading(false); loadingRef.current = false; } });
    return () => { generation.current++; };
  }, [username, type, revision]);

  const loadMore = async () => {
    if (loadingRef.current || !more) return;
    const id = generation.current;
    loadingRef.current = true; setLoading(true); setError('');
    try {
      const result = await getProfileRelations(username, type, rows.at(-1)?.name);
      if (id !== generation.current) return;
      setRows(prev => [...prev, ...result.rows.filter(row => !prev.some(existing => existing.name === row.name))]);
      setMore(result.hasMore && result.rows.length > 0);
    } catch { if (id === generation.current) setError('Could not load more accounts. Please try again.'); }
    finally { if (id === generation.current) { loadingRef.current = false; setLoading(false); } }
  };

  const change = async (name: string, add: boolean) => {
    if (!isOwner || !currentUser || busy) return;
    const clean = name.trim().replace(/^@/, '').toLowerCase();
    setMessage('');
    if (!clean || clean === username.toLowerCase()) { setMessage('Enter another valid Hive account.'); return; }
    const id = generation.current;
    setBusy(true);
    try {
      if (add && !(await getAccount(clean))) throw new Error('Hive account not found.');
      const response = type === 'following' ? await KeychainService.followUser(currentUser.username, clean, add)
        : type === 'muted' ? await KeychainService.muteUser(currentUser.username, clean, add)
        : await KeychainService.updateModerationList(currentUser.username, clean,
          type === 'blacklisted' ? (add ? 'blacklist' : 'unblacklist')
          : type === 'follow_blacklist' ? (add ? 'follow_blacklist' : 'unfollow_blacklist')
          : (add ? 'follow_muted' : 'unfollow_muted'));
      if (!response.success) throw new Error(response.message || response.error || 'Operation was not completed.');
      if (type === 'blacklisted' || type === 'follow_blacklist') window.dispatchEvent(new Event('nebulosa:blacklists-changed'));
      if (type === 'following') setFollowingUsersList(prev => add ? [...new Set([...prev, clean])] : prev.filter(user => user !== clean));
      if (type === 'muted') setMutedUsersList(prev => add ? [...new Set([...prev, clean])] : prev.filter(user => user !== clean));
      if (type === 'follow_muted') void refreshMuted();
      if (id !== generation.current) return;
      setRows(prev => add ? [...prev.filter(row => row.name !== clean), { name: clean }].sort((a, b) => a.name.localeCompare(b.name)) : prev.filter(row => row.name !== clean));
      setTarget(''); setMessage('Saved to Hive.');
    } catch (err) { if (id === generation.current) setMessage(err instanceof Error ? err.message : 'Operation failed. Please try again.'); }
    finally { setBusy(false); }
  };
  const filtered = rows.filter(row => row.name.includes(query.trim().replace(/^@/, '').toLowerCase()));
  const removeLabel = type === 'following' ? 'Unfollow' : type === 'muted' ? 'Unmute' : type === 'blacklisted' ? 'Remove' : 'Unfollow list';
  const addLabel = type === 'following' ? 'Follow' : type === 'muted' ? 'Mute account' : type === 'blacklisted' ? 'Blacklist account' : 'Follow list';

  return <section className="mx-auto max-w-[1392px] space-y-4 py-4 text-slate-900 dark:text-slate-100 sm:py-5">
    <div className={`${panel} p-4 sm:p-6`}>
      <Link to={`/profile/@${username}`} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-500"><ArrowLeft className="h-4 w-4" />Back to profile</Link>
      <h1 className="text-2xl font-bold">Connections & lists</h1>
      <p className="mt-1 text-sm text-slate-500">@{username}</p>
      <nav aria-label="Profile connections" className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {(Object.keys(RELATION_LABELS) as ProfileRelation[]).map(key => <button key={key} disabled={busy} aria-current={type === key ? 'page' : undefined} onClick={() => setParams({ list: key })} className={`${control} shrink-0 ${type === key ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950' : ''}`}>{RELATION_LABELS[key]}</button>)}
      </nav>
    </div>
    <div className={`${panel} p-4 sm:p-6`}>
      <h2 className="text-lg font-semibold">{RELATION_LABELS[type]}</h2>
      <p className="mt-1 text-sm text-slate-500">{descriptions[type]}</p>
      {(type === 'follow_blacklist' || type === 'follow_muted') && <p className="mt-2 text-sm text-slate-500">Following a list adopts its moderation choices as its maintainer updates it.</p>}
      {isOwner && type !== 'followers' && <form onSubmit={event => { event.preventDefault(); void change(target, true); }} className="mt-5 flex flex-wrap gap-2">
        <input aria-label="Hive account to add" placeholder="@username" value={target} onChange={event => setTarget(event.target.value)} disabled={busy || loading} className={`${control} min-w-0 flex-1 bg-transparent`} />
        <button disabled={busy || loading || !target.trim()} className={`${control} bg-blue-600 text-white`}>{busy ? 'Saving…' : addLabel}</button>
      </form>}
      <label className="mt-5 flex items-center gap-2 rounded-xl border border-slate-200 px-3 dark:border-slate-700"><Search className="h-4 w-4 text-slate-400" /><input aria-label="Search loaded accounts" placeholder="Search loaded accounts…" value={query} onChange={event => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" /></label>
      <p className="mt-2 text-xs text-slate-500">{rows.length} accounts loaded{more ? ' · Load more to see the rest' : ''}</p>
      {message && <p role="status" className="mt-3 text-sm">{message}</p>}
      {error && <div role="alert" className="mt-4 text-sm text-rose-500">{error} <button className="underline" onClick={() => rows.length ? void loadMore() : setRevision(value => value + 1)}>Retry</button></div>}
      <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
        {filtered.map(row => <div key={row.name} className="flex items-center justify-between gap-3 py-3">
          <Link to={`/profile/@${row.name}`} className="flex min-w-0 items-center gap-3 rounded-lg hover:text-blue-500"><img src={getHiveAvatarUrl(row.name, 'small')} alt="" loading="lazy" className="h-10 w-10 rounded-xl bg-slate-100" /><div className="min-w-0"><span className="block truncate text-sm font-semibold">@{row.name}<BlacklistFlair username={row.name} /></span>{(row.blacklist_description || row.muted_list_description) && <span className="block text-xs text-slate-500">{type === 'follow_blacklist' ? row.blacklist_description : row.muted_list_description}</span>}</div></Link>
          {isOwner && type !== 'followers' && <button disabled={busy || loading} onClick={() => void change(row.name, false)} className={`${control} shrink-0`}>{removeLabel}</button>}
        </div>)}
      </div>
      {loading && <div role="status" className="flex justify-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading accounts…</div>}
      {!loading && !error && !filtered.length && <div className="py-10 text-center text-sm text-slate-500"><Users className="mx-auto mb-3 h-7 w-7" />{query ? 'No loaded accounts match your search.' : 'No accounts in this list yet.'}</div>}
      {more && !loading && <button disabled={busy} onClick={() => void loadMore()} className={`${control} mt-4 w-full`}>Load more</button>}
    </div>
  </section>;
};
