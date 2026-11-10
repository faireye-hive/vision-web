import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useSavedLists } from '../context/SavedListsContext';
export function SavedListsPicker() {
  const { picker, closePicker, lists, loading, busy, error, refresh, togglePost } = useSavedLists();
  const [message, setMessage] = useState('');
  useEffect(() => { setMessage(''); }, [picker]);
  useEffect(() => {
    if (!picker) return;
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') closePicker(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [picker, closePicker]);
  if (!picker) return null;
  return createPortal(<div className="fixed inset-0 z-[200]" onClick={closePicker}>
    <section role="dialog" aria-label="Save post to lists" onClick={event => event.stopPropagation()} className="fixed w-[min(320px,calc(100vw-24px))] rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-white" style={{ left: Math.max(12, Math.min(picker.x - 320, window.innerWidth - 332)), top: Math.max(12, Math.min(picker.y + 8, window.innerHeight - 360)), maxHeight: 'calc(100vh - 24px)', overflowY: 'auto' }}>
      <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-bold">Save to lists</h2><button autoFocus type="button" aria-label="Close list picker" onClick={closePicker} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button></div>
      <p className="mb-3 text-xs text-slate-500">Public lists · Each change is signed with Keychain.</p>
      {loading ? <p role="status" className="py-4 text-sm">Loading lists…</p> : error ? <p role="alert" className="text-sm text-rose-500">{error} <button onClick={refresh} className="underline">Retry</button></p> : !lists.length ? <p className="py-3 text-sm text-slate-500">Create your first list to save this post.</p> : <div className="max-h-48 space-y-1 overflow-y-auto">{lists.map(list => <label key={list.id} className="flex items-center gap-3 rounded-xl px-2 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"><input type="checkbox" disabled={busy || !!list.pendingRegistration} checked={list.posts.some(post => post.author === picker.post.author && post.permlink === picker.post.permlink)} onChange={event => { setMessage(''); void togglePost(list.id, picker.post, event.currentTarget.checked).then(() => setMessage('Saved to Hive.')).catch(err => setMessage(err.message)); }} /><span className="min-w-0 flex-1 break-words">{list.title}{list.pendingRegistration ? ' · Publication pending' : ''}</span><span className="text-xs text-slate-500">{list.posts.length}</span></label>)}</div>}
      {busy && <p role="status" className="mt-2 text-xs text-blue-500">Confirm the change in Hive Keychain…</p>}
      {message && <p role="status" className="mt-2 text-xs">{message}</p>}
      <Link to="/lists" onClick={closePicker} className="mt-3 block rounded-xl border border-slate-200 p-2 text-center text-sm font-semibold text-blue-600 dark:border-slate-700">Create or manage lists</Link>
    </section>
  </div>, document.body);
}
