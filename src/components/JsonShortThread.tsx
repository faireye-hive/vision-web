import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Repeat2, Share2, ThumbsDown } from 'lucide-react';
import { getHiveAvatarUrl } from '../services/hiveApi';
import { getCleanSnapTextLength } from '../utils/snapText';
import { contentRef, IndexedEvent, JsonContent, JsonShortEvent, loadJsonThread, mergeJsonEvents, newJsonEvent, projectJsonThread, snapRefKey, SnapRef } from '../services/jsonShorts';
import { SnapContent } from './SnapContent';
import { BlacklistFlair } from './BlacklistFlair';
import { useI18n } from '../i18n/I18nContext';
import { translateMarkdown } from '../services/translationService';
import { handleImageFallback } from '../utils/imageFallback';
const control = 'inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold hover:bg-cyan-50 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:hover:bg-slate-800 dark:hover:text-cyan-300 disabled:opacity-40';
interface Props {
  reference: SnapRef; seed?: IndexedEvent; localEvents: IndexedEvent[]; refreshKey: number;
  viewer: string; busy: boolean; expanded?: boolean; focus?: string;
  hidden: (author: string) => boolean; publish: (event: JsonShortEvent) => Promise<IndexedEvent>;
  onOpen: () => void; onFocus: (ref: SnapRef | null) => void; onResnap: (ref: SnapRef) => void; onShare: () => void;
}
export function JsonShortThread(props: Props) {
  const { reference, seed, localEvents, refreshKey, viewer, busy, expanded, focus, hidden, publish, onOpen, onFocus, onResnap, onShare } = props;
  const key = snapRefKey(reference);
  const [remote, setRemote] = useState<IndexedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [replyTo, setReplyTo] = useState<SnapRef | null>(null);
  const [reply, setReply] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    loadJsonThread(reference).then(events => { if (active) setRemote(events); })
      .catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [key, refreshKey, retry]);
  const history = useMemo(() => mergeJsonEvents(seed ? [seed] : [], [...remote, ...localEvents.filter(row => {
    const event = row.event;
    return event.type !== 'channel' && (snapRefKey(event.root) === key || event.type === 'resnap' && snapRefKey(event.target) === key);
  })]), [remote, localEvents, seed, key]);
  const thread = useMemo(() => projectJsonThread(reference, history), [key, history]);
  if (!thread) return <article className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-[#111827]">{loading ? 'Loading snap…' : error || 'Snap not found or still being indexed.'}{!loading && <button className="ml-2 text-blue-500 underline" onClick={() => setRetry(value => value + 1)}>Retry</button>}</article>;
  if (hidden(thread.root.actor)) return null;
  const focused = focus && thread.contents.get(focus);
  const main = expanded && focused ? focused : thread.root;
  const visibleCount = () => {
    const queue = [...(thread.replies.get(key) || [])]; let count = 0;
    while (queue.length) { const node = queue.pop()!; if (hidden(node.actor)) continue; count++; queue.push(...(thread.replies.get(snapRefKey(contentRef(node))) || [])); }
    return count;
  };
  const vote = (target: SnapRef, value: -1 | 0 | 1) => {
    setNotice('');
    void publish({ ...newJsonEvent(viewer), type: 'vote', root: reference, target, value }).catch(err => setNotice(err.message));
  };
  const renderNode = (content: JsonContent, depth: number): React.ReactNode => {
    if (hidden(content.actor)) return null;
    const ref = contentRef(content); const refKey = snapRefKey(ref);
    const rawVotes = thread.votes.get(refKey) || new Map<string, number>();
    const votes = [...rawVotes].filter(([actor]) => !hidden(actor));
    const mine = viewer ? rawVotes.get(viewer) || 0 : 0;
    const children = (thread.replies.get(refKey) || []).filter(child => !hidden(child.actor));
    const timestamp = history.find(row => row.event.actor === content.actor && row.event.id === content.id)?.timestamp;
    return <div key={refKey} className={depth ? 'ml-2 border-l border-slate-200 pl-3 pt-4 dark:border-slate-700 sm:ml-4' : ''}>
      <div className="flex flex-wrap items-center gap-2 text-sm"><Link to={`/profile/@${content.actor}`} className="flex min-w-0 items-center gap-2 font-bold hover:text-blue-500"><img src={getHiveAvatarUrl(content.actor, 'small')} alt="" loading="lazy" onError={handleImageFallback} className="h-8 w-8 rounded-full bg-slate-100" />@{content.actor}</Link><BlacklistFlair username={content.actor} />{timestamp && <time dateTime={timestamp} className="text-[11px] text-slate-400">{new Date(timestamp).toLocaleString()}</time>}{content.channel && <span className="ml-auto max-w-full truncate text-[10px] text-slate-500">#{content.channel.split('/')[1]}</span>}</div>
      {content.type === 'resnap' ? <div className="mt-3"><p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold text-purple-500"><Repeat2 className="h-4 w-4" />Resnapped</p><QuotedJsonSnap reference={content.target} hidden={hidden} /></div> : <JsonSnapBody key={refKey} body={content.body} author={content.actor} permlink={content.id} />}
      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-slate-100 pt-2 text-slate-500 dark:border-slate-800">
        <button disabled={busy || loading || !!error} aria-pressed={mine === 1} aria-label={`Like snap by @${content.actor}`} onClick={() => vote(ref, mine === 1 ? 0 : 1)} className={`${control} ${mine === 1 ? 'text-rose-500' : ''}`}><Heart className={`h-4 w-4 ${mine === 1 ? 'fill-current' : ''}`} />{votes.filter(([, value]) => value === 1).length}</button>
        <button disabled={busy || loading || !!error} aria-pressed={mine === -1} aria-label={`Dislike snap by @${content.actor}`} onClick={() => vote(ref, mine === -1 ? 0 : -1)} className={`${control} ${mine === -1 ? 'text-amber-600' : ''}`}><ThumbsDown className="h-4 w-4" />{votes.filter(([, value]) => value === -1).length}</button>
        <button disabled={busy || loading || !!error} onClick={() => { if (!expanded) onOpen(); else { setReplyTo(ref); setReply(''); setNotice(''); } }} className={control}><MessageCircle className="h-4 w-4" />{!depth ? visibleCount() : children.length}<span>Reply</span></button>
        {refKey === key && <button disabled={busy || loading || !!error || !!viewer && thread.resnaps.has(viewer)} aria-pressed={!!viewer && thread.resnaps.has(viewer)} onClick={() => onResnap(ref)} className={control}><Repeat2 className="h-4 w-4" />{thread.resnaps.size}<span>{viewer && thread.resnaps.has(viewer) ? 'Resnapped' : 'Resnap'}</span></button>}
        {!depth && <button onClick={onShare} className={`${control} ml-auto`} aria-label="Share snap"><Share2 className="h-4 w-4" /></button>}
      </div>
      {expanded && replyTo && snapRefKey(replyTo) === refKey && <form className="mt-3 space-y-2" onSubmit={event => {
        event.preventDefault(); setNotice('');
        void publish({ ...newJsonEvent(viewer), type: 'snap', root: reference, parent: ref, channel: thread.root.channel, body: reply.trim() })
          .then(() => { setReply(''); setReplyTo(null); }).catch(err => setNotice(err.message));
      }}><label className="block text-xs font-semibold">Reply to @{content.actor}<textarea autoFocus aria-label={`Reply to @${content.actor}`} value={reply} onChange={event => setReply(event.target.value)} rows={3} maxLength={6000} disabled={busy} className="mt-2 block w-full resize-y rounded-xl border border-slate-200 bg-transparent p-3 text-sm dark:border-slate-700" /></label><div className="flex items-center justify-between gap-2 text-xs text-slate-500"><span>{getCleanSnapTextLength(reply)}/300</span><div className="flex gap-2"><button disabled={busy} type="button" className={control} onClick={() => setReplyTo(null)}>Cancel</button><button disabled={busy || !reply.trim() || getCleanSnapTextLength(reply) > 300} className={`${control} bg-blue-600 text-white`}>Publish reply</button></div></div></form>}
      {expanded && children.length > 0 && (depth < 4 ? children.map(child => renderNode(child, depth + 1)) : <button onClick={() => onFocus(ref)} className="mt-3 text-xs font-semibold text-blue-500">Continue this thread ({children.length} replies)</button>)}
    </div>;
  };
  return <article className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-[#111827] sm:p-5">
    {expanded && focused && <button onClick={() => onFocus(null)} className="mb-4 text-xs text-blue-500">← Back to original snap</button>}
    {renderNode(main, 0)}
    {loading && <p role="status" className="mt-2 text-[11px] text-slate-400">Loading conversation and reactions…</p>}
    {error && <p role="alert" className="mt-3 text-xs text-rose-500">{error} <button className="underline" onClick={() => setRetry(value => value + 1)}>Retry</button></p>}
    {notice && <p role="status" className="mt-3 text-xs text-slate-500">{notice}</p>}
  </article>;
}
function JsonSnapBody({ body, author, permlink }: { body: string; author: string; permlink: string }) {
  const { locale } = useI18n();
  const [translation, setTranslation] = useState<{ locale: string; body: string } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const text = translation?.locale === locale ? translation.body : body;
  useEffect(() => { setTranslation(null); setError(''); }, [locale, body]);
  return <div className="mt-3 min-w-0"><SnapContent body={text} author={author} permlink={permlink} enableTruncation={false} /><button disabled={busy} className="mt-2 text-[11px] font-semibold text-slate-400 hover:text-blue-500" onClick={() => {
    if (translation?.locale === locale) { setTranslation(null); return; }
    setBusy(true); setError('');
    void translateMarkdown(body, locale).then(value => setTranslation({ locale, body: value })).catch(() => setError('Could not translate this snap.')).finally(() => setBusy(false));
  }}>{busy ? 'Translating…' : translation?.locale === locale ? 'Original' : 'Translate'}</button>{error && <span role="status" className="ml-2 text-xs text-slate-500">{error}</span>}</div>;
}
function QuotedJsonSnap({ reference, hidden }: { reference: SnapRef; hidden: (author: string) => boolean }) {
  const [root, setRoot] = useState<JsonContent | null>(null); const [error, setError] = useState('');
  const key = snapRefKey(reference);
  useEffect(() => { let active = true; setRoot(null); setError(''); loadJsonThread(reference).then(events => { if (active) { const thread = projectJsonThread(reference, events); if (thread) setRoot(thread.root); else setError('Original snap is not indexed yet.'); } }).catch(() => { if (active) setError('Could not load the original snap.'); }); return () => { active = false; }; }, [key]);
  if (hidden(reference.author)) return <p className="rounded-xl border border-slate-200 p-3 text-xs text-slate-500 dark:border-slate-700">Original author is hidden by your filters.</p>;
  return <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><Link to={`/snaps?${new URLSearchParams({ snap: key })}`} className="text-xs font-semibold text-blue-500">Original by @{reference.author}</Link>{root?.type === 'snap' ? <JsonSnapBody body={root.body} author={root.actor} permlink={root.id} /> : <p className="mt-2 text-xs text-slate-500">{error || (root ? 'Open the original resnap' : 'Loading original snap…')}</p>}</div>;
}
