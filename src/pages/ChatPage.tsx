import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LockKeyhole, MessageSquare, RefreshCw, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { KeychainService } from '../services/keychain';
import { ChatMessage, cleanChatAccount, decryptChatMessage, loadChatPage, mergeChatMessages, sendEncryptedChat, validChatAccount, validChatEnvelope } from '../services/encryptedChat';
const panel = 'rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900';
const control = 'rounded-xl border border-slate-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 disabled:opacity-50';
const outboxKey = (owner: string) => `nebulosa:chat:encrypted-outbox:v1:${owner}`;
function readOutbox(owner: string): ChatMessage[] {
  try {
    const rows = JSON.parse(localStorage.getItem(outboxKey(owner)) || '[]');
    if (!Array.isArray(rows)) return [];
    return rows.filter(message => message?.from === owner && validChatEnvelope({ app: message.app, version: message.version, id: message.id, from: message.from, to: message.to, memo: message.memo }) && typeof message.timestamp === 'string' && Number.isFinite(Date.parse(message.timestamp)))
      .map(message => ({ ...message, operationId: `pending:${message.id}` }));
  } catch { return []; }
}
function cacheOutbox(owner: string, message: ChatMessage) {
  try { localStorage.setItem(outboxKey(owner), JSON.stringify(mergeChatMessages(readOutbox(owner), [message]).slice(-200))); }
  catch { /* Encrypted chain history remains available after indexing. */ }
}
export function ChatPage() {
  const { currentUser } = useAuth();
  if (!currentUser) return <section className={`${panel} mx-auto max-w-3xl p-6 text-slate-900 dark:text-white`}><h1 className="text-2xl font-bold">Messages</h1><p className="mt-3 text-sm text-slate-500">Sign in with Hive Keychain to send and read encrypted messages.</p><button onClick={() => window.dispatchEvent(new CustomEvent('nebulosa:open-login'))} className={`${control} mt-4 bg-blue-600 text-white`}>Sign in</button></section>;
  return <ChatSession key={currentUser.username} owner={currentUser.username.toLowerCase()} />;
}
function ChatSession({ owner }: { owner: string }) {
  const { isMuted, mutedUsersLoading } = useAuth();
  const [params, setParams] = useSearchParams();
  const peer = cleanChatAccount(params.get('to') || '');
  const validPeer = validChatAccount(peer) && peer !== owner;
  const hiddenPeer = validPeer && isMuted(peer);
  const [recipient, setRecipient] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => readOutbox(owner));
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const cursor = useRef('');
  const fetchLock = useRef(false);
  const initialized = useRef(false);
  const alive = useRef(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState({ peer: '', text: '' });
  const [unlocked, setUnlocked] = useState<{ peer: string; values: Record<string, string> }>({ peer: '', values: {} });
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false);
  const viewVersion = useRef(0);
  const stillCurrent = () => alive.current && KeychainService.getCurrentUser()?.username.toLowerCase() === owner;
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; viewVersion.current++; };
  }, []);
  useEffect(() => {
    viewVersion.current++; setUnlocked({ peer, values: {} }); setDraft({ peer, text: '' }); setNotice('');
    return () => { viewVersion.current++; };
  }, [peer]);
  const refresh = useCallback(async (older = false) => {
    if (fetchLock.current) return;
    fetchLock.current = true; setLoading(true); setError('');
    try {
      const page = await loadChatPage(owner, older ? cursor.current : '');
      if (!alive.current) return;
      setMessages(previous => mergeChatMessages(previous, page.messages));
      if (older || !initialized.current) { cursor.current = page.cursor; setHasMore(page.hasMore); initialized.current = true; }
    } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : 'Could not refresh messages.'); }
    finally { fetchLock.current = false; if (alive.current) setLoading(false); }
  }, [owner]);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  const peers = [...new Set(messages.map(message => message.from === owner ? message.to : message.from).concat(validPeer ? [peer] : []))]
    .filter(name => !isMuted(name)).sort((a, b) => {
      const latest = (name: string) => messages.filter(message => message.from === name || message.to === name).at(-1)?.timestamp || '';
      return latest(b).localeCompare(latest(a));
    });
  const conversation = validPeer && !hiddenPeer && !mutedUsersLoading ? messages.filter(message => (message.from === owner && message.to === peer) || (message.to === owner && message.from === peer)) : [];
  const text = draft.peer === peer ? draft.text : '';
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (actionLock.current || !validPeer || hiddenPeer || mutedUsersLoading) return;
    actionLock.current = true; setBusy(true); setNotice('');
    const version = viewVersion.current;
    try {
      const envelope = await sendEncryptedChat(owner, peer, text, stillCurrent);
      const message: ChatMessage = { ...envelope, timestamp: new Date().toISOString(), operationId: `pending:${envelope.id}` };
      cacheOutbox(owner, message);
      if (!stillCurrent()) return;
      setMessages(previous => mergeChatMessages(previous, [message]));
      if (version === viewVersion.current) {
        setDraft({ peer, text: '' });
        setUnlocked(previous => ({ peer, values: { ...(previous.peer === peer ? previous.values : {}), [`${owner}/${message.id}`]: text } }));
        setNotice('Encrypted message sent. History may take a moment to update.');
      }
    } catch (err) { if (alive.current && version === viewVersion.current) setNotice(err instanceof Error ? err.message : 'The message was not sent.'); }
    finally { actionLock.current = false; if (alive.current) setBusy(false); }
  };
  const unlock = async (message: ChatMessage) => {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(true); setNotice('');
    const version = viewVersion.current;
    try {
      const body = await decryptChatMessage(owner, message);
      if (stillCurrent() && version === viewVersion.current) setUnlocked(previous => ({ peer, values: { ...(previous.peer === peer ? previous.values : {}), [`${message.from}/${message.id}`]: body } }));
    } catch (err) { if (alive.current && version === viewVersion.current) setNotice(err instanceof Error ? err.message : 'Could not unlock this message.'); }
    finally { actionLock.current = false; if (alive.current) setBusy(false); }
  };
  return <section className="mx-auto max-w-6xl space-y-4 text-slate-900 dark:text-slate-100">
    <header className={`${panel} p-4 sm:p-6`}><div className="flex items-center justify-between gap-3"><h1 className="flex items-center gap-2 text-2xl font-bold"><MessageSquare className="h-6 w-6 text-blue-500" />Messages</h1><button disabled={loading} onClick={() => void refresh()} className={control} aria-label="Refresh encrypted messages"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div><p className="mt-3 flex items-start gap-2 text-sm text-slate-500"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />Only participants with the corresponding memo keys can read the content. Accounts and times are public; encrypted messages remain on Hive.</p></header>
    {error && <p role="alert" className={`${panel} p-4 text-sm text-rose-500`}>{error} <button className="underline" onClick={() => void refresh()}>Retry</button></p>}
    <div className="grid items-start gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
      <aside className={`${panel} p-4`}><h2 className="text-sm font-bold">Conversations</h2><form className="mt-3 flex gap-2" onSubmit={event => { event.preventDefault(); const name = cleanChatAccount(recipient); if (!validChatAccount(name) || name === owner) { setNotice('Choose another valid Hive account.'); return; } if (isMuted(name)) { setNotice('This account is muted.'); return; } setParams({ to: name }); setRecipient(''); }}><input aria-label="Message recipient" placeholder="@username" value={recipient} onChange={event => setRecipient(event.target.value)} disabled={busy || mutedUsersLoading} className={`${control} min-w-0 flex-1 bg-transparent`} /><button disabled={busy || mutedUsersLoading || !recipient.trim()} className={control}>Open</button></form>
      {mutedUsersLoading ? <p role="status" className="mt-4 text-sm text-slate-500">Loading moderation preferences…</p> : <nav aria-label="Conversations" className="mt-4 flex gap-2 overflow-x-auto md:block md:space-y-2">{peers.map(name => <button disabled={busy} key={name} onClick={() => setParams({ to: name })} aria-current={peer === name ? 'page' : undefined} className={`block shrink-0 rounded-xl px-3 py-3 text-left text-sm font-semibold md:w-full ${peer === name ? 'bg-blue-50 text-blue-600 dark:bg-blue-950' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>@{name}</button>)}{!peers.length && <p className="text-sm text-slate-500">Start a conversation above.</p>}</nav>}
      {hasMore && <button disabled={loading} className={`${control} mt-4 w-full`} onClick={() => void refresh(true)}>Load older messages</button>}</aside>
      <main className={`${panel} min-w-0 p-4 sm:p-6`} aria-label="Conversation">
        {!validPeer ? <p className="py-16 text-center text-sm text-slate-500">{peer ? 'Choose another valid Hive account.' : 'Select a conversation or enter a Hive username.'}</p> : hiddenPeer ? <p className="py-16 text-center text-sm text-slate-500">This account is muted.</p> : mutedUsersLoading ? <p role="status" className="py-16 text-center text-sm text-slate-500">Loading moderation preferences…</p> : <>
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800"><Link to={`/profile/@${peer}`} className="font-bold hover:text-blue-500">@{peer}</Link><button disabled={busy} onClick={() => setUnlocked({ peer, values: {} })} className={`${control} text-xs`}>Lock messages</button></div>
          <div className="max-h-[55vh] min-h-64 space-y-3 overflow-y-auto pr-1" aria-live="polite">{conversation.map(message => {
            const key = `${message.from}/${message.id}`;
            const body = unlocked.peer === peer ? unlocked.values[key] : undefined;
            return <article key={key} className={`max-w-[92%] rounded-2xl p-3 sm:max-w-[85%] ${message.from === owner ? 'ml-auto bg-blue-50 dark:bg-blue-950/60' : 'mr-auto bg-slate-100 dark:bg-slate-800'}`}><div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500"><span>{message.from === owner ? 'You' : `@${message.from}`}</span><time dateTime={message.timestamp}>{new Date(message.timestamp).toLocaleString()}</time></div>{body === undefined ? <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg py-2 text-sm text-blue-600 dark:text-blue-400 disabled:opacity-50" onClick={() => void unlock(message)}><LockKeyhole className="h-4 w-4" />Unlock with Keychain</button> : <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{body}</p>}</article>;
          })}{!conversation.length && <p className="py-12 text-center text-sm text-slate-500">{loading ? 'Loading encrypted messages…' : 'No messages loaded in this conversation yet.'}</p>}</div>
          <form onSubmit={send} className="mt-5 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800"><label className="sr-only" htmlFor="chat-message">Message</label><textarea id="chat-message" value={text} onChange={event => setDraft({ peer, text: event.target.value })} disabled={busy} rows={3} maxLength={3000} placeholder="Write an encrypted message…" className={`${control} w-full resize-y bg-transparent`} /><div className="flex items-center justify-between gap-3"><span className="text-[11px] text-slate-500">Memo key to encrypt · Posting key to publish</span><button disabled={busy || !text.trim()} className={`${control} inline-flex shrink-0 items-center gap-2 bg-blue-600 text-white`}><Send className="h-4 w-4" />{busy ? 'Keychain…' : 'Send encrypted'}</button></div></form>
        </>}
        {notice && <p role="status" className="mt-4 break-words text-sm text-slate-500">{notice}</p>}
      </main>
    </div>
  </section>;
}
