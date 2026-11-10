import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, Share2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSavedLists } from '../context/SavedListsContext';
import { useContentFilter } from '../context/ContentFilterContext';
import { accountName, loadSavedLists, SavedList } from '../services/savedLists';
const panel = 'rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-6';
const control = 'rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 disabled:opacity-50';
export function SavedListsPage() {
  const { currentUser } = useAuth();
  const saved = useSavedLists();
  const { isAuthorHidden } = useContentFilter();
  const [params, setParams] = useSearchParams();
  const owner = accountName(params.get('owner') || currentUser?.username || '');
  const own = !!owner && owner === currentUser?.username.toLowerCase();
  const selected = params.get('list');
  const [publicLists, setPublicLists] = useState<SavedList[]>([]);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicError, setPublicError] = useState('');
  const [revision, setRevision] = useState(0);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    setMessage(''); setPublicLists([]); setPublicError('');
    if (own || !owner) return;
    let active = true; setPublicLoading(true);
    if (!/^[a-z][a-z0-9.-]{2,15}$/.test(owner)) { setPublicError('Invalid Hive account.'); setPublicLoading(false); return; }
    loadSavedLists(owner).then(lists => { if (active) setPublicLists(lists); })
      .catch(err => { if (active) setPublicError(err.message); }).finally(() => { if (active) setPublicLoading(false); });
    return () => { active = false; };
  }, [owner, own, revision]);
  const lists = own ? saved.lists : publicLists;
  const loading = own ? saved.loading : publicLoading;
  const error = own ? saved.error : publicError;
  const list = lists.find(item => item.id === selected);
  const retry = () => own ? saved.refresh() : setRevision(value => value + 1);
  const share = async (item: SavedList) => {
    const url = new URL('/lists', window.location.origin);
    url.searchParams.set('owner', owner); url.searchParams.set('list', item.id);
    try { await navigator.clipboard.writeText(url.href); setMessage('List link copied.'); }
    catch { setMessage(url.href); }
  };
  return <section className="mx-auto max-w-5xl space-y-4 text-slate-900 dark:text-slate-100">
    <header className={panel}>
      <Link to={owner ? `/profile/@${owner}` : '/discover'} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft className="h-4 w-4" />{owner ? 'Back to profile' : 'Back to Discover'}</Link>
      <h1 className="flex items-center gap-2 text-2xl font-bold"><Bookmark className="h-6 w-6 text-blue-500" />{own ? 'My lists' : 'Public lists'}</h1>
      <p className="mt-2 text-sm text-slate-500">{owner ? `@${owner} · ` : ''}Collect posts in public lists and share them with anyone.</p>
      {own && <form className="mt-5 flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); setMessage(''); void saved.create(title).then(() => { setTitle(''); setMessage('List published. You can now save posts to it.'); }).catch(err => setMessage(err.message)); }}>
        <input aria-label="List name" placeholder="Name your list" maxLength={80} value={title} onChange={event => setTitle(event.target.value)} disabled={saved.busy || loading || !!error} className={`${control} min-w-0 flex-1 bg-transparent`} />
        <button disabled={saved.busy || loading || !!error || !title.trim()} className={`${control} bg-blue-600 text-white`}>Create list</button>
        <p className="w-full text-xs text-slate-500">Creating a list asks for two Keychain signatures. List names and saved posts are public.</p>
      </form>}
      {owner && <button disabled={loading || saved.busy} onClick={retry} className={`${control} mt-4`}>Refresh lists</button>}
      {!owner && <button onClick={() => window.dispatchEvent(new CustomEvent('nebulosa:open-login'))} className={`${control} mt-4 bg-blue-600 text-white`}>Sign in to create lists</button>}
      {saved.busy && own && <p role="status" className="mt-3 text-sm text-blue-500">Confirm the operation in Hive Keychain…</p>}
      {message && <p role="status" className="mt-3 break-words text-sm">{message}</p>}
    </header>
    {loading && <p role="status" className={panel}>Loading lists from Hive…</p>}
    {error && <div role="alert" className={`${panel} text-rose-500`}>{error} <button className="underline" onClick={retry}>Retry</button></div>}
    {!loading && !error && (selected ? list ? <div className={panel}>
      <button onClick={() => setParams({ owner })} className="mb-4 text-sm text-blue-500">← All lists</button>
      <div className="flex items-center justify-between gap-3"><h2 className="break-words text-xl font-bold">{list.title}</h2><button disabled={!!list.pendingRegistration} onClick={() => void share(list)} className={`${control} flex shrink-0 items-center gap-2`}><Share2 className="h-4 w-4" />Share</button></div>
      <p className="mt-1 text-xs text-slate-500">{list.posts.length} saved posts</p>
      {list.pendingRegistration && <p className="mt-4 text-sm text-amber-600">List created, directory publication pending. <button disabled={saved.busy} className="underline" onClick={() => void saved.register().then(() => setMessage('Directory published.')).catch(err => setMessage(err.message))}>Finish publication</button></p>}
      <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">{list.posts.filter(post => !isAuthorHidden(post.author)).map(post => <div key={`${post.author}/${post.permlink}`} className="flex items-center justify-between gap-3 py-4"><Link to={`/post/@${post.author}/${post.permlink}`} className="min-w-0 hover:text-blue-500"><span className="block break-words text-sm font-semibold">{post.title || post.permlink}</span><span className="mt-1 block text-xs text-slate-500">@{post.author}</span></Link>{own && <button disabled={saved.busy || !!list.pendingRegistration} className={`${control} shrink-0`} onClick={() => void saved.togglePost(list.id, { ...post, title: post.title || '' }, false).catch(err => setMessage(err.message))}>Remove</button>}</div>)}</div>
      {!list.posts.length && <p className="py-8 text-sm text-slate-500">This list is empty. Use Save post in Discover to add posts.</p>}
    </div> : <p className={panel}>List not found. <button onClick={retry} className="text-blue-500 underline">Reload</button></p> : <div className="grid gap-4 sm:grid-cols-2">{lists.map(item => <div key={item.id} className={panel}><Link to={`?owner=${encodeURIComponent(owner)}&list=${encodeURIComponent(item.id)}`} className="block break-words text-lg font-semibold hover:text-blue-500">{item.title}</Link><p className="mt-2 text-sm text-slate-500">{item.posts.length} posts</p>{item.pendingRegistration ? <button disabled={saved.busy} className={`${control} mt-4 text-amber-600`} onClick={() => void saved.register().then(() => setMessage('Directory published.')).catch(err => setMessage(err.message))}>Finish publication</button> : <button onClick={() => void share(item)} className={`${control} mt-4 inline-flex items-center gap-2`}><Share2 className="h-4 w-4" />Share list</button>}</div>)}{!lists.length && <p className={`${panel} sm:col-span-2`}>{own ? 'No lists yet. Create your first one above.' : 'This profile has no published lists yet.'}</p>}</div>)}
  </section>;
}
