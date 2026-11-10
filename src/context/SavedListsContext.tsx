import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { HivePost } from '../services/hiveApi';
import { KeychainService } from '../services/keychain';
import { customListId, encodeListPayload, listPayload, listSlug, loadSavedLists, SavedList, validList } from '../services/savedLists';

interface SavedListsState {
  lists: SavedList[]; loading: boolean; busy: boolean; error: string; refresh: () => void;
  create: (title: string) => Promise<void>; register: () => Promise<void>;
  togglePost: (id: string, post: Pick<HivePost, 'author' | 'permlink' | 'title'>, selected?: boolean) => Promise<void>;
  picker: { post: HivePost; x: number; y: number } | null;
  openPicker: (post: HivePost, rect?: DOMRect) => void; closePicker: () => void;
}
const Context = createContext<SavedListsState | null>(null);
const cacheKey = (owner: string) => `nebulosa:saved-lists:v1:${owner}`;
export function SavedListsProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const owner = currentUser?.username.toLowerCase() || '';
  const ownerRef = useRef(owner); ownerRef.current = owner;
  const snapshot = useRef<{ owner: string; lists: SavedList[] }>({ owner: '', lists: [] });
  const [state, setState] = useState(snapshot.current);
  const [loadedFor, setLoadedFor] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [picker, setPicker] = useState<SavedListsState['picker']>(null);
  const commit = useCallback((account: string, lists: SavedList[]) => {
    if (account !== ownerRef.current) return;
    snapshot.current = { owner: account, lists };
    setState(snapshot.current);
    try { localStorage.setItem(cacheKey(account), JSON.stringify(lists)); } catch { /* Blockchain remains authoritative. */ }
  }, []);
  useEffect(() => {
    let active = true;
    setPicker(null); setError(''); setLoadedFor('');
    if (!owner) { snapshot.current = { owner: '', lists: [] }; setState(snapshot.current); return; }
    let cached: SavedList[] = [];
    try {
      const value = JSON.parse(localStorage.getItem(cacheKey(owner)) || '[]');
      if (Array.isArray(value)) cached = value.filter(item => validList(item) && item.owner === owner && Number.isSafeInteger(item.revision));
    } catch { /* Ignore malformed local cache. */ }
    commit(owner, cached);
    loadSavedLists(owner).then(remote => {
      if (!active) return;
      const merged = new Map(remote.map(list => [list.id, list]));
      for (const local of snapshot.current.lists) {
        const indexed = merged.get(local.id);
        if (!indexed || local.revision > indexed.revision) merged.set(local.id, local);
      }
      commit(owner, [...merged.values()]); setLoadedFor(owner);
    }).catch(err => { if (active) { setError(err instanceof Error ? err.message : 'Could not load lists.'); setLoadedFor(owner); } });
    return () => { active = false; };
  }, [owner, revision, commit]);
  const lists = state.owner === owner ? state.lists : [];
  const loading = !!owner && loadedFor !== owner;
  const run = async (action: (account: string) => Promise<void>) => {
    if (!owner) { window.dispatchEvent(new CustomEvent('nebulosa:open-login')); throw new Error('Sign in to manage your lists.'); }
    if (lock.current || loading) throw new Error('Please wait for the current operation.');
    if (error) throw new Error('Reload your lists before making changes.');
    lock.current = true; setBusy(true);
    try {
      const remote = await loadSavedLists(owner);
      if (ownerRef.current !== owner) throw new Error('The signed-in account changed. Please try again.');
      const merged = new Map(remote.map(list => [list.id, list]));
      for (const local of snapshot.current.lists) {
        const indexed = merged.get(local.id);
        if (!indexed || local.revision > indexed.revision) merged.set(local.id, local);
      }
      commit(owner, [...merged.values()]);
      await action(owner);
    } finally { lock.current = false; setBusy(false); }
  };
  const publish = async (account: string, id: string, payload: unknown, label: string) => {
    if (ownerRef.current !== account) throw new Error('The signed-in account changed. Please try again.');
    const response = await KeychainService.publishSavedList(account, id, encodeListPayload(payload), label);
    if (!response.success) throw new Error(response.message || response.error || 'Keychain did not complete the operation.');
  };
  const registerFor = async (account: string) => {
    const all = snapshot.current.lists;
    await publish(account, await customListId(account), {
      app: 'nebulosa', version: 1, kind: 'catalog', owner: account, revision: Date.now(),
      lists: all.map(({ id, slug, title }) => ({ id, slug, title }))
    }, 'Publish your Nebulosa list directory');
    commit(account, all.map(list => ({ ...list, pendingRegistration: false })));
  };
  const create = (title: string) => run(async account => {
    const cleanTitle = title.trim(); const slug = listSlug(cleanTitle);
    if (!slug || cleanTitle.length > 80) throw new Error('Use a name of up to 80 characters, including letters or numbers.');
    if (snapshot.current.lists.some(list => list.slug === slug)) throw new Error('A list with this name already exists.');
    const list: SavedList = { id: await customListId(account, slug), owner: account, slug, title: cleanTitle, posts: [], revision: Date.now(), pendingRegistration: true };
    // Validate both operations before asking for the first signature.
    encodeListPayload({ app: 'nebulosa', version: 1, kind: 'catalog', owner: account, revision: Date.now(), lists: [...snapshot.current.lists, list].map(({ id, slug, title }) => ({ id, slug, title })) });
    await publish(account, list.id, listPayload(list), `Create public list: ${cleanTitle}`);
    commit(account, [...snapshot.current.lists, list]);
    try { await registerFor(account); } catch (err) { throw new Error(`List created. Its directory entry is still pending: ${err instanceof Error ? err.message : 'Please retry registration.'}`); }
  });
  const togglePost: SavedListsState['togglePost'] = (id, post, selected) => run(async account => {
    const list = snapshot.current.lists.find(item => item.id === id);
    if (!list || list.pendingRegistration) throw new Error('Finish publishing this list first.');
    const exists = list.posts.some(item => item.author === post.author && item.permlink === post.permlink);
    const shouldInclude = selected ?? !exists;
    if (shouldInclude === exists) return;
    const next: SavedList = { ...list, revision: Math.max(Date.now(), list.revision + 1), posts: !shouldInclude
      ? list.posts.filter(item => item.author !== post.author || item.permlink !== post.permlink)
      : [...list.posts, { author: post.author, permlink: post.permlink, title: post.title?.slice(0, 300) || '' }] };
    if (!validList(next)) throw new Error('This post cannot be saved to a list.');
    await publish(account, next.id, listPayload(next), `${shouldInclude ? 'Save post to' : 'Remove post from'} ${list.title}`);
    commit(account, snapshot.current.lists.map(item => item.id === id ? next : item));
  });
  return <Context.Provider value={{ lists, loading, busy, error, refresh: () => { if (!lock.current) setRevision(value => value + 1); }, create, register: () => run(registerFor), togglePost,
    picker, openPicker: (post, rect) => {
      if (!owner) { window.dispatchEvent(new CustomEvent('nebulosa:open-login')); return; }
      setPicker({ post, x: rect?.right || window.innerWidth / 2 + 140, y: rect?.bottom || 120 });
    }, closePicker: () => setPicker(null) }}>{children}</Context.Provider>;
}
export function useSavedLists() {
  const value = useContext(Context);
  if (!value) throw new Error('SavedListsProvider is required');
  return value;
}
