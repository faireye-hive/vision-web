import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Settings, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCommunityFeatures } from '../hooks/useCommunityFeatures';
import { canConfigureCommunity, CommunityOption, saveCommunitySettings } from '../services/communityFeatures';
import { listSlug } from '../services/savedLists';

export function CommunityAdminButton({ communityName }: { communityName: string }) {
  const { currentUser } = useAuth();
  const { data, error, retry } = useCommunityFeatures(communityName);
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState('');
  const [flairs, setFlairs] = useState('');
  const [subtags, setSubtags] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState('');
  const allowed = !!data && !!currentUser && canConfigureCommunity(data.community, currentUser.username);
  useEffect(() => {
    if (!open || !data) return;
    const text = (options: CommunityOption[]) => options.map(item => `${item.id} | ${item.label}`).join('\n');
    setCategories(text(data.settings.categories)); setFlairs(text(data.settings.flairs)); setSubtags(data.settings.subtags.join('\n'));
  }, [open, data]);
  useEffect(() => { setOpen(false); }, [communityName]);
  if (!communityName) return null;
  if (error) return <button type="button" onClick={retry} className="text-[11px] text-slate-500">Retry community tools</button>;
  if (!allowed) return null;
  const save = async () => {
    if (!currentUser || busy) return;
    setBusy(true); setNotice(''); setFailure('');
    try {
      const options = (text: string) => text.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
        const [id, ...label] = line.split('|');
        return { id: label.length ? id.trim() : listSlug(id), label: (label.length ? label.join('|') : id).trim() };
      });
      await saveCommunitySettings(currentUser.username, communityName, { categories: options(categories), flairs: options(flairs), subtags: subtags.split(/[\s,]+/).filter(Boolean).map(tag => tag.replace(/^#/, '').toLowerCase()) });
      setNotice('Community settings saved.');
    } catch (error: any) { setFailure(error.message); } finally { setBusy(false); }
  };
  const inputClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800';
  return <>
    <button type="button" onClick={() => { setNotice(''); setFailure(''); setOpen(true); }} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><Settings className="h-3.5 w-3.5" />Community settings</button>
    {open && createPortal(<div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/50 p-3" onClick={() => { if (!busy) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-label="Community settings" className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-xl dark:bg-slate-900 dark:text-white" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-bold">Community settings</h2><button type="button" aria-label="Close community settings" disabled={busy} onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div>
        <p className="mt-1 text-sm text-slate-500">{data.community.title}</p>
        <p className="mt-3 text-xs text-slate-500">Categories are required when publishing. Members can choose a post flair; the community team can remove it.</p>
        <label htmlFor="admin-categories" className="mt-4 block text-xs font-bold">Categories · one per line</label>
        <textarea id="admin-categories" rows={6} value={categories} onChange={event => setCategories(event.target.value)} disabled={busy} className={inputClass} />
        <p className="mt-1 text-[11px] text-slate-500">Use a name, or “stable-id | Display name”. Keep the ID when renaming an existing option.</p>
        <label htmlFor="admin-flairs" className="mt-4 block text-xs font-bold">Post flairs · one per line</label>
        <textarea id="admin-flairs" rows={5} value={flairs} onChange={event => setFlairs(event.target.value)} disabled={busy} className={inputClass} />
        <label htmlFor="admin-subtags" className="mt-4 block text-xs font-bold">Featured subtags</label>
        <textarea id="admin-subtags" rows={3} value={subtags} onChange={event => setSubtags(event.target.value)} disabled={busy} placeholder="tutorial\nnews\nshowcase" className={inputClass} />
        <p className="mt-1 text-[11px] text-slate-500">Choose the topic tags shown in the community sidebar. Leave empty to show tags from the feed.</p>
        {notice && <p role="status" className="mt-3 text-xs text-emerald-600">{notice}</p>}
        {failure && <p role="alert" className="mt-3 text-xs text-rose-600">{failure}</p>}
        <div className="mt-4 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setOpen(false)} className="px-3 py-2 text-xs font-semibold">Close</button><button type="button" disabled={busy} onClick={save} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save with Keychain'}</button></div>
      </section>
    </div>, document.body)}
  </>;
}
