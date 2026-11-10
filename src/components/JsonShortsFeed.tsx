import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Hash, Plus, RefreshCw, Send, Search, Sparkles, ChevronRight, Radio, PenLine } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useContentFilter } from '../context/ContentFilterContext';
import { useI18n } from '../i18n/I18nContext';
import { channelSlug, contentRef, encodeJsonShortEvent, IndexedEvent, JSON_SHORTS_FEED, JsonChannel, JsonContent, JsonShortEvent, jsonChannelId, jsonSnapLink, loadJsonChannels, loadJsonEventPage, mergeJsonEvents, newJsonEvent, parseSnapRef, publishJsonShortEvent, snapRefKey, SnapRef, validChannelKey, validJsonShortEvent } from '../services/jsonShorts';
import { getCleanSnapTextLength } from '../utils/snapText';
import { JsonShortThread } from './JsonShortThread';
const panel = 'rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#111827] sm:p-5';
const control = 'rounded-xl border border-slate-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 disabled:opacity-50';
const pendingKey = (actor: string) => `nebulosa:json-shorts:published:v1:${actor}`;
function readLocal(actor: string): IndexedEvent[] {
  try {
    const rows = JSON.parse(localStorage.getItem(pendingKey(actor)) || '[]');
    if (!Array.isArray(rows)) return [];
    return rows.filter(row => validJsonShortEvent(row?.event) && row.event.actor === actor && typeof row.timestamp === 'string' && Number.isFinite(Date.parse(row.timestamp)))
      .map(row => ({ event: row.event, timestamp: row.timestamp, operationId: `pending:${row.event.actor}/${row.event.id}`, pending: true }));
  } catch { return []; }
}
interface Props { blockedWords?: string[]; blockedAuthors?: string[]; filterEnabled?: boolean }
export function JsonShortsFeed({ blockedWords = [], blockedAuthors = [], filterEnabled = true }: Props) {
  const { locale } = useI18n();
  const pt = locale === 'pt';
  const { currentUser, mutedUsersLoading } = useAuth();
  const { isAuthorHidden } = useContentFilter();
  const actor = currentUser?.username.toLowerCase() || '';
  const actorRef = useRef(actor); actorRef.current = actor;
  const [params, setParams] = useSearchParams();
  const channel = params.get('channel') || '';
  const channelsView = params.get('view') === 'channels';
  const validChannel = !channel || validChannelKey(channel);
  const selected = params.get('snap') || '';
  const reference = useMemo(() => parseSnapRef(selected), [selected]);
  const focus = params.get('focus') || '';
  const [local, setLocal] = useState<IndexedEvent[]>(() => actor ? readLocal(actor) : []);
  const [feed, setFeed] = useState<{ channel: string; rows: IndexedEvent[] }>({ channel, rows: [] });
  const [channels, setChannels] = useState<IndexedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelLoading, setChannelLoading] = useState(true);
  const [error, setError] = useState('');
  const [channelError, setChannelError] = useState('');
  const [notice, setNotice] = useState('');
  const [cursor, setCursor] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false);
  const request = useRef(0);
  const pageLock = useRef(false);
  const alive = useRef(true);
  const [body, setBody] = useState('');
  const [search, setSearch] = useState('');
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [channelTitle, setChannelTitle] = useState('');
  const [description, setDescription] = useState('');
  const composer = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current++; }; }, []);
  useEffect(() => { setLocal(actor ? readLocal(actor) : []); setBody(''); setNotice(''); }, [actor]);
  useEffect(() => { if (!channelsView) setShowChannelForm(false); }, [channelsView]);
  const hidden = useCallback((name: string) => isAuthorHidden(name) || (filterEnabled && blockedAuthors.some(value => value.toLowerCase().replace(/^@/, '') === name.toLowerCase())), [isAuthorHidden, blockedAuthors, filterEnabled]);
  useEffect(() => {
    const id = ++request.current; setLoading(true); setError(''); setCursor(''); setHasMore(false); setSearch('');
    setFeed({ channel, rows: [] }); pageLock.current = true;
    if (!validChannel) { setError('Invalid channel.'); setLoading(false); pageLock.current = false; return; }
    void (async () => {
      try {
        const customId = channel ? await jsonChannelId(channel) : JSON_SHORTS_FEED;
        const result = await loadJsonEventPage(customId);
        if (id !== request.current || !alive.current) return;
        setFeed({ channel, rows: result.events }); setCursor(result.cursor); setHasMore(result.hasMore);
      } catch (err) { if (id === request.current && alive.current) setError(err instanceof Error ? err.message : 'Could not load snaps.'); }
      finally { if (id === request.current && alive.current) { setLoading(false); pageLock.current = false; } }
    })();
  }, [channel, validChannel, revision]);
  useEffect(() => {
    let active = true; setChannelLoading(true); setChannelError('');
    loadJsonChannels().then(rows => { if (active) setChannels(rows); }).catch(err => { if (active) setChannelError(err.message); })
      .finally(() => { if (active) setChannelLoading(false); });
    return () => { active = false; };
  }, [revision]);
  const loadMore = async () => {
    if (pageLock.current || !hasMore || !validChannel) return;
    const id = request.current; pageLock.current = true; setLoading(true); setError('');
    try {
      const result = await loadJsonEventPage(channel ? await jsonChannelId(channel) : JSON_SHORTS_FEED, cursor);
      if (id !== request.current || !alive.current) return;
      setFeed(previous => ({ channel, rows: mergeJsonEvents(previous.rows, result.events) })); setCursor(result.cursor); setHasMore(result.hasMore);
    } catch (err) { if (id === request.current && alive.current) setError(err instanceof Error ? err.message : 'Could not load older snaps.'); }
    finally { if (id === request.current && alive.current) { setLoading(false); pageLock.current = false; } }
  };
  const publish = async (event: JsonShortEvent): Promise<IndexedEvent> => {
    if (!actor) { window.dispatchEvent(new CustomEvent('nebulosa:open-login')); throw new Error('Sign in with Hive Keychain to publish.'); }
    if (actionLock.current) throw new Error('Please finish the current Keychain request.');
    if (event.actor !== actor || mutedUsersLoading) throw new Error('Please wait for your account preferences.');
    encodeJsonShortEvent(event); actionLock.current = true; setBusy(true); setNotice('');
    try {
      const result = await publishJsonShortEvent(event, () => alive.current && actorRef.current === actor);
      const own = mergeJsonEvents(readLocal(actor), [result]).slice(-500);
      try { localStorage.setItem(pendingKey(actor), JSON.stringify(own)); } catch { /* Chain publication succeeded. */ }
      if (alive.current && actorRef.current === actor) { setLocal(own); setNotice('Published on Hive. The public index may take a moment to update.'); }
      return result;
    } finally { actionLock.current = false; if (alive.current) setBusy(false); }
  };
  const allRows = useMemo(() => mergeJsonEvents(feed.channel === channel ? feed.rows : [], local), [feed, local, channel]);
  const roots = allRows.filter(row => {
    const event = row.event;
    return (event.type === 'resnap' || event.type === 'snap' && !event.parent) && (!channel || event.channel === channel);
  }).reverse();
  const visible = mutedUsersLoading ? [] : roots.filter(row => {
    const event = row.event as JsonContent;
    if (hidden(event.actor)) return false;
    const text = event.type === 'snap' ? event.body : '';
    if (filterEnabled && blockedWords.some(word => word.trim() && text.toLowerCase().includes(word.trim().toLowerCase()))) return false;
    const query = search.trim().toLowerCase(); return !query || `${event.actor} ${text}`.toLowerCase().includes(query);
  });
  const channelMap = new Map<string, JsonChannel>();
  for (const row of mergeJsonEvents(channels, local)) if (row.event.type === 'channel' && !hidden(row.event.actor)) channelMap.set(`${row.event.actor}/${row.event.slug}`, row.event);
  const activeChannel = channelMap.get(channel);
  const updateChannel = (next: string) => { const query = new URLSearchParams(); if (next) query.set('channel', next); setParams(query); };
  const openSnap = (ref: SnapRef) => { const query = new URLSearchParams(params); query.set('snap', snapRefKey(ref)); query.delete('focus'); setParams(query); };
  const focusReply = (ref: SnapRef | null) => { const query = new URLSearchParams(params); if (ref) query.set('focus', snapRefKey(ref)); else query.delete('focus'); setParams(query); };
  const share = async (ref: SnapRef) => {
    const url = new URL(jsonSnapLink(ref, channel), window.location.origin).href;
    try { await navigator.clipboard.writeText(url); setNotice('Snap link copied.'); } catch { setNotice(url); }
  };
  const resnap = (ref: SnapRef) => {
    const base = newJsonEvent(actor);
    void publish({ ...base, type: 'resnap', root: { author: actor, id: base.id }, target: ref, channel: channel || null }).catch(err => setNotice(err.message));
  };
  const renderThread = (ref: SnapRef, seed?: IndexedEvent) => <JsonShortThread key={snapRefKey(ref)} reference={ref} seed={seed} localEvents={local} refreshKey={revision} viewer={actor} busy={busy} expanded={!!reference} focus={focus} hidden={hidden} publish={publish} onOpen={() => openSnap(ref)} onFocus={focusReply} onResnap={resnap} onShare={() => void share(ref)} />;
  return <div className="grid min-w-0 items-start gap-5 text-slate-900 dark:text-slate-100 lg:grid-cols-[210px_minmax(0,620px)] xl:grid-cols-[210px_minmax(0,620px)_280px]">
    <aside className="sticky top-16 z-10 flex min-w-0 gap-2 overflow-x-auto lg:top-20 lg:block lg:space-y-4">
      <div className="hidden rounded-3xl border border-cyan-100 bg-gradient-to-br from-white via-white to-cyan-50 p-4 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-900 lg:block">
        <div className="flex items-center gap-2.5"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20"><Sparkles className="h-5 w-5" /></span><div><p className="text-sm font-black tracking-tight">Nebulosa</p><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">{pt ? 'Sem recompensas' : 'No Rewards'}</p></div></div>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">{pt ? 'Converse em uma linha social aberta, publicada diretamente na Hive.' : 'Join an open social feed published directly to Hive.'}</p>
      </div>
      <nav aria-label="Nebulosa Snaps" className="flex min-w-max gap-1 rounded-3xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:block lg:space-y-1">
        <Link to="/snaps" aria-current={!channelsView ? 'page' : undefined} className={!channelsView ? 'flex items-center gap-3 rounded-2xl bg-cyan-50 px-3 py-2.5 text-sm font-bold text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200' : 'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}><Sparkles className="h-[18px] w-[18px]" />Snaps</Link>
        <Link to="/snaps" className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"><PenLine className="h-[18px] w-[18px]" />{pt ? 'Escrever Snap' : 'Write a Snap'}</Link>
        <Link to="/snaps?view=channels" aria-current={channelsView ? 'page' : undefined} className={channelsView ? 'flex items-center gap-3 rounded-2xl bg-cyan-50 px-3 py-2.5 text-sm font-bold text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200' : 'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}><Radio className="h-[18px] w-[18px]" />{pt ? 'Canais' : 'Channels'}</Link>
      </nav>
      <div className="hidden px-2 text-[10px] leading-relaxed text-slate-400 lg:block">{pt ? <>Nebulosa Snaps · identidade social independente<br />Conteúdo público e permanente na Hive.</> : <>Nebulosa Snaps · an independent social space<br />Public content stored on Hive.</>}</div>
    </aside>
    <main className="min-w-0 space-y-3.5">
    <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#111827]"><div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-cyan-50 via-white to-blue-50 px-4 py-4 dark:from-cyan-950/35 dark:via-slate-900 dark:to-blue-950/25 sm:px-5"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20"><Sparkles className="h-5 w-5" /></span><div><h1 className="text-xl font-black tracking-tight">{channelsView ? (pt ? 'Canais' : 'Channels') : 'Nebulosa Snaps'}</h1><p className="mt-0.5 text-[11px] text-slate-500">{channelsView ? (pt ? 'Descubra canais e crie um espaço para sua comunidade.' : 'Discover channels and create a space for your community.') : (pt ? 'Uma conversa aberta na Hive, sem reward pool.' : 'An open conversation on Hive, without a reward pool.')}</p></div></div><button disabled={loading || busy} className={`${control} rounded-full border border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900`} onClick={() => setRevision(value => value + 1)} aria-label="Refresh Nebulosa Snaps"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div>
      <div className={channelsView ? 'hidden' : 'flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5'}><Hash className="h-4 w-4 text-cyan-600" /><label className="sr-only" htmlFor="json-short-channel">Channel</label><select id="json-short-channel" value={channel} disabled={busy} onChange={event => updateChannel(event.target.value)} className={`${control} min-w-0 flex-1 rounded-full bg-white dark:bg-slate-900`}><option value="">All channels</option>{channel && !channelMap.has(channel) && <option value={channel}>{channel}</option>}{[...channelMap].map(([key, item]) => <option key={key} value={key}>{item.title} · @{item.actor}</option>)}</select>{channel && <button onClick={() => {
        const url = new URL(`/snaps?${new URLSearchParams({ channel })}`, window.location.origin).href;
        void navigator.clipboard.writeText(url).then(() => setNotice('Channel link copied.')).catch(() => setNotice(url));
      }} className={`${control} rounded-full`}>Share channel</button>}</div>
      {activeChannel?.description && !channelsView && <p className="mt-2 break-words text-xs text-slate-500">{activeChannel.description}</p>}
      {!channelsView && channelLoading && <p role="status" className="mt-2 text-xs text-slate-400">Loading channels…</p>}{!channelsView && channelError && <p role="alert" className="mt-2 text-xs text-rose-500">{channelError}</p>}
      {channelsView && showChannelForm && <form className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800" onSubmit={event => {
        event.preventDefault(); const slug = channelSlug(channelTitle);
        if (channelMap.has(`${actor}/${slug}`)) { setNotice('You already have a channel with this name.'); return; }
        void publish({ ...newJsonEvent(actor), type: 'channel', slug, title: channelTitle.trim(), description: description.trim() }).then(() => {
          if (!alive.current || actorRef.current !== actor) return;
          setShowChannelForm(false); setChannelTitle(''); setDescription(''); setParams(new URLSearchParams({ view: 'channels' }));
        }).catch(err => setNotice(err.message));
      }}><label className="block text-xs font-semibold">Channel name<input value={channelTitle} onChange={event => setChannelTitle(event.target.value)} maxLength={80} disabled={busy} className={`${control} mt-1 block w-full bg-transparent`} /></label><label className="block text-xs font-semibold">Description<textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={300} disabled={busy} rows={2} className={`${control} mt-1 block w-full bg-transparent`} /></label><p className="text-xs text-slate-500">Open public channel. Anyone can post. The name belongs to its creator’s namespace.</p><button disabled={busy || channelLoading || !!channelError || !channelTitle.trim()} className={`${control} bg-blue-600 text-white`}>Publish channel</button></form>}
    </header>
    {busy && <p role="status" className="px-2 text-xs text-blue-500">Confirm the operation in Hive Keychain…</p>}
    {notice && <p role="status" className={`${panel} break-words text-sm`}>{notice}</p>}
    {channelsView ? <>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">{pt ? 'Canais públicos' : 'Public channels'}</h2><p className="mt-1 text-xs text-slate-500">{pt ? 'Explore conversas ou crie um canal.' : 'Explore conversations or create a channel.'}</p></div><button disabled={busy || channelLoading || !!channelError} onClick={() => { setShowChannelForm(value => !value); setNotice(''); }} className={control + ' inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 px-4 text-white'}><Plus className="h-4 w-4" />{pt ? 'Criar canal' : 'Create channel'}</button></div>
      {channelError && <p role="alert" className={panel + ' text-sm text-rose-500'}>{channelError} <button onClick={() => setRevision(value => value + 1)} className="underline">{pt ? 'Tentar novamente' : 'Retry'}</button></p>}
      {channelLoading && <p role="status" className={panel + ' text-center text-sm text-slate-500'}>{pt ? 'Carregando canais…' : 'Loading channels…'}</p>}
      {!channelLoading && !channelError && <div className="grid gap-3 sm:grid-cols-2">{[...channelMap].map(([key, item]) => <article key={key} className={panel}><p className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">#{item.slug} · @{item.actor}</p><h3 className="mt-1 break-words text-lg font-extrabold">{item.title}</h3>{item.description && <p className="mt-2 break-words text-sm text-slate-500">{item.description}</p>}<button onClick={() => updateChannel(key)} className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-cyan-700 dark:text-cyan-300">{pt ? 'Abrir canal' : 'Open channel'} <ChevronRight className="h-3.5 w-3.5" /></button></article>)}{!channelMap.size && <p className={panel + ' text-center text-sm text-slate-500 sm:col-span-2'}>{pt ? 'Nenhum canal publicado ainda. Você pode criar o primeiro.' : 'No channels yet. You can create the first one.'}</p>}</div>}
    </> : selected ? <>
      <button disabled={busy} onClick={() => { const query = new URLSearchParams(params); query.delete('snap'); query.delete('focus'); setParams(query); }} className={`${control} text-blue-500`}>← Back to Nebulosa Snaps</button>
      {!reference ? <p className={panel}>Invalid snap link.</p> : mutedUsersLoading ? <p role="status" className={panel}>Loading moderation preferences…</p> : hidden(reference.author) ? <p className={panel}>This author is hidden by your filters.</p> : renderThread(reference, roots.find(row => row.event.actor === reference.author && row.event.id === reference.id))}
    </> : <>
      <form className={panel} onSubmit={event => {
        event.preventDefault(); const base = newJsonEvent(actor);
        void publish({ ...base, type: 'snap', root: { author: actor, id: base.id }, parent: null, channel: channel || null, body: body.trim() }).then(() => { if (alive.current && actorRef.current === actor) setBody(''); }).catch(err => setNotice(err.message));
      }}><div className="flex items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-100 to-blue-100 text-cyan-700 dark:from-cyan-900 dark:to-blue-900 dark:text-cyan-200"><PenLine className="h-4 w-4" /></div><label htmlFor="json-short-body" className="text-sm font-bold">{channel ? `${pt ? 'Publicar em' : 'Post in'} ${activeChannel?.title || channel}` : pt ? 'Compartilhe uma ideia' : 'Share an idea'}</label></div><textarea ref={composer} id="json-short-body" placeholder={pt ? 'O que está acontecendo? Markdown, links e imagens são bem-vindos.' : 'What’s happening? Markdown, links and images are welcome.'} value={body} onChange={event => setBody(event.target.value)} rows={3} maxLength={6000} disabled={busy} className="mt-3 block w-full resize-y rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-950/60 dark:focus:ring-cyan-950" /><div className="mt-3 flex items-center justify-between gap-3"><span className={`text-xs ${getCleanSnapTextLength(body) > 300 ? 'text-rose-500' : 'text-slate-400'}`}>{getCleanSnapTextLength(body)}/300 · Links and images excluded</span><button disabled={busy || mutedUsersLoading || !validChannel || !body.trim() || getCleanSnapTextLength(body) > 300} className={`${control} inline-flex shrink-0 items-center gap-2 rounded-full border-transparent bg-gradient-to-r from-cyan-600 to-blue-600 px-4 text-white shadow-md shadow-cyan-700/15 hover:from-cyan-700 hover:to-blue-700`}><Send className="h-4 w-4" />{pt ? 'Publicar' : 'Publish'}</button></div></form>
      <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 dark:border-slate-700"><Search className="h-4 w-4 text-slate-400" /><input aria-label="Search loaded no-rewards snaps" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search loaded snaps…" className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" /></label>
      {mutedUsersLoading ? <p role="status" className={panel}>Loading moderation preferences…</p> : visible.map(row => renderThread(contentRef(row.event as JsonContent), row))}
      {!loading && !mutedUsersLoading && !error && !visible.length && <p className={`${panel} text-center text-sm text-slate-500`}>No snaps loaded here yet. {hasMore ? 'Load older snaps to explore more.' : 'Start the conversation above.'}</p>}
      {loading && <p role="status" className="py-6 text-center text-sm text-slate-500">Loading Nebulosa Snaps…</p>}
      {error && <p role="alert" className={`${panel} text-sm text-rose-500`}>{error} <button onClick={() => setRevision(value => value + 1)} className="underline">Retry</button></p>}
      {hasMore && <button disabled={loading || busy} onClick={() => void loadMore()} className={`${control} w-full`}>Load older snaps</button>}
    </>}
    </main>
    <aside className="sticky top-20 hidden space-y-4 xl:block">
      <div className={channelsView ? "hidden" : "rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"}><div className="flex items-center justify-between"><h2 className="text-sm font-extrabold">{pt ? 'Canais em destaque' : 'Channels to explore'}</h2><Radio className="h-4 w-4 text-cyan-600" /></div><p className="mt-1 text-[11px] text-slate-500">{pt ? 'Encontre conversas por assunto.' : 'Find conversations by topic.'}</p><div className="mt-3 space-y-1">{[...channelMap].slice(0, 5).map(([key, item]) => <button key={key} onClick={() => updateChannel(key)} className={`group flex w-full items-center justify-between gap-2 rounded-2xl px-2.5 py-2 text-left transition hover:bg-cyan-50 dark:hover:bg-slate-800 ${channel === key ? 'bg-cyan-50 dark:bg-cyan-950/40' : ''}`}><span className="min-w-0"><span className="block truncate text-xs font-bold">{item.title}</span><span className="mt-0.5 block truncate text-[10px] text-slate-500">#{item.slug} · @{item.actor}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-cyan-600" /></button>)}{!channelMap.size && <p className="rounded-2xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500 dark:bg-slate-800">{pt ? 'Ainda não há canais indexados. Crie um espaço aberto para iniciar uma conversa.' : 'No channels are indexed yet. Create an open space to start a conversation.'}</p>}</div><Link to="/snaps?view=channels" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-cyan-700 hover:text-blue-700 dark:text-cyan-300">{pt ? "Ver todos os canais" : "Browse all channels"} <ChevronRight className="h-3.5 w-3.5" /></Link></div>
      <div className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-blue-50 p-4 dark:border-slate-800 dark:from-cyan-950/40 dark:to-blue-950/30"><div className="flex items-center gap-2 text-xs font-extrabold"><span className="grid h-7 w-7 place-items-center rounded-xl bg-white text-cyan-700 shadow-sm dark:bg-slate-900 dark:text-cyan-300"><Sparkles className="h-3.5 w-3.5" /></span>{pt ? 'Feito para conversas' : 'Built for conversation'}</div><p className="mt-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{pt ? 'Publicações, respostas, votos sociais e resnaps são registrados como custom_json. Sem reward pool; a publicação ainda usa Resource Credits da Hive.' : 'Posts, replies, social votes and resnaps are recorded as custom_json. No reward pool; publishing still uses Hive Resource Credits.'}</p><Link to="/shorts" className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-cyan-800 dark:text-cyan-200">{pt ? 'Conheça os Shorts com rewards' : 'Explore reward-based Shorts'} <ChevronRight className="h-3.5 w-3.5" /></Link></div>
    </aside>
  </div>;
}
