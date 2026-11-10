import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tag, X } from 'lucide-react';
import { HivePost } from '../services/hiveApi';
import { canModerateCommunity, COMMUNITY_FLAIR_CHANGED, communityPostMetadata, loadPostFlair, postCommunity, savePostFlair } from '../services/communityFeatures';
import { useCommunityFeatures } from '../hooks/useCommunityFeatures';
import { useAuth } from '../context/AuthContext';

export function PostCommunityLabels({ post }: { post: HivePost }) {
  const name = postCommunity(post);
  const { currentUser } = useAuth();
  const { data, loading, error, retry } = useCommunityFeatures(name);
  const [flairState, setFlairState] = useState<{ key: string; value: string | null } | null>(null);
  const [flairError, setFlairError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const key = `${name}/${post.author}/${post.permlink}`;
  useEffect(() => {
    let active = true;
    setFlairState(null);
    setFlairError('');
    if (data) loadPostFlair(post, data.community).then(value => {
      if (active) setFlairState({ key, value });
    }).catch(error => { if (active) setFlairError(error.message); });
    const onChange = (event: Event) => { if ((event as CustomEvent).detail === key) setAttempt(value => value + 1); };
    window.addEventListener(COMMUNITY_FLAIR_CHANGED, onChange);
    return () => { active = false; window.removeEventListener(COMMUNITY_FLAIR_CHANGED, onChange); };
  }, [data, key, attempt, name, post.json_metadata]);
  useEffect(() => { setOpen(false); }, [key]);
  const isAuthor = currentUser?.username === post.author;
  const mayRemove = !!data && !!currentUser && canModerateCommunity(data.community, currentUser.username);
  const value = flairState?.key === key ? flairState.value : null;
  const flair = data?.settings.flairs.find(item => item.id === value);
  const category = data?.settings.categories.find(item => item.id === communityPostMetadata(post).category);
  if (!name || post.parent_author) return null;
  if (!category && !flair && !isAuthor && !mayRemove) return null;
  const save = async (next: string | null) => {
    if (!currentUser || saving) return;
    setSaving(true); setSaveError('');
    try {
      await savePostFlair(currentUser.username, post, next);
      setFlairState({ key, value: next }); setOpen(false);
    } catch (error: any) { setSaveError(error.message); } finally { setSaving(false); }
  };
  return <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 text-[11px] sm:px-4" onClick={event => event.stopPropagation()}>
    {category && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">#{category.label}</span>}
    {flair && <span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">{flair.label}</span>}
    {(isAuthor || mayRemove) && <button type="button" disabled={loading} onClick={() => { setChoice(value || ''); setSaveError(''); setOpen(true); }} className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"><Tag className="h-3 w-3" />{isAuthor ? 'Post flair' : 'Moderate flair'}</button>}
    {open && createPortal(<div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/50 p-4" onClick={event => { event.stopPropagation(); if (!saving) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-label="Post flair" className="w-full max-w-sm rounded-2xl bg-white p-5 text-slate-900 shadow-xl dark:bg-slate-900 dark:text-white" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="font-bold">Post flair</h2><button type="button" aria-label="Close flair selector" disabled={saving} onClick={() => setOpen(false)}><X className="h-4 w-4" /></button></div>
        <p className="mt-2 text-xs text-slate-500">{isAuthor ? 'Choose a flair for this community post.' : 'Community moderators can remove the flair from this post.'}</p>
        {(error || flairError) ? <div className="mt-3 text-xs text-rose-600">{error || flairError}<button type="button" className="ml-2 underline" onClick={() => { retry(); setAttempt(value => value + 1); }}>Retry</button></div> : !data || !flairState ? <p className="mt-3 text-xs">Loading flairs…</p> : <>
          {isAuthor && <><label htmlFor="post-flair-choice" className="mt-4 block text-xs font-semibold">Flair</label><select id="post-flair-choice" value={choice} onChange={event => setChoice(event.target.value)} disabled={saving} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="">No flair</option>{data.settings.flairs.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></>}
          <div className="mt-4 flex justify-end gap-2">
            {(value !== null || mayRemove) && <button type="button" disabled={saving || value === null} onClick={() => save(null)} className="rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 disabled:opacity-50">Remove flair</button>}
            {isAuthor && <button type="button" disabled={saving} onClick={() => save(choice || null)} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save flair'}</button>}
          </div>
        </>}
        {saveError && <p role="alert" className="mt-3 text-xs text-rose-600">{saveError}</p>}
      </section>
    </div>, document.body)}
  </div>;
}
