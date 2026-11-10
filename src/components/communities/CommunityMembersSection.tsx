import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Users } from 'lucide-react';
import { HiveCommunity, getHiveAvatarUrl } from '../../services/hiveApi';
import { CommunityMember, COMMUNITY_MEMBERS_PAGE_SIZE, getCommunityMembers, getCommunityTeam } from '../../services/communityMembers';
import { handleImageFallback } from '../../utils/imageFallback';
import { CommunityPageCopy } from '../../i18n/communityPage';

export function CommunityPerson({ name, role, title, copy }: { name: string; role: string; title?: string; copy: CommunityPageCopy }) {
  const label = role === 'owner' ? copy.owner : role === 'admin' ? copy.admin : role === 'mod' ? copy.mod : copy.member;
  return <Link to={`/profile/@${encodeURIComponent(name)}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200/70 p-3 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-800 dark:hover:bg-[#151719]">
    <img src={getHiveAvatarUrl(name, 'small')} alt="" loading="lazy" onError={handleImageFallback} className="h-10 w-10 shrink-0 rounded-full bg-slate-100 object-cover dark:bg-slate-800" />
    <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">@{name}</span><span className="block truncate text-xs text-slate-500 dark:text-slate-400">{title || label}</span></span>
    {['owner', 'admin', 'mod'].includes(role) && <span className="ms-auto shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{label}</span>}
  </Link>;
}

export function CommunityMembersSection({ community, copy }: { community: HiveCommunity; copy: CommunityPageCopy }) {
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const cursor = useRef('');
  const busy = useRef(false);
  const live = useRef(true);
  const team = getCommunityTeam(community);
  const load = async (more: boolean) => {
    if (busy.current) return;
    busy.current = true; setLoading(true); setError(false);
    const last = more ? cursor.current : '';
    try {
      const rows = await getCommunityMembers(community.name, last);
      if (!live.current) return;
      const next = rows.at(-1)?.name || '';
      setMembers(previous => [...new Map([...(more ? previous : []), ...rows].map(item => [item.name, item])).values()]);
      setHasMore(rows.length === COMMUNITY_MEMBERS_PAGE_SIZE && next !== last);
      cursor.current = next;
    } catch { if (live.current) setError(true); }
    finally { busy.current = false; if (live.current) setLoading(false); }
  };
  useEffect(() => {
    live.current = true;
    void load(false);
    return () => { live.current = false; };
  }, [community.name, attempt]);
  return <div className="space-y-5">
    {team.length > 0 && <section><h2 className="text-lg font-bold text-slate-900 dark:text-white">{copy.team}</h2><p className="mb-4 mt-1 text-sm text-slate-500 dark:text-slate-400">{copy.teamHint}</p><div className="grid gap-2 sm:grid-cols-2">{team.map(([name, role, title]) => <CommunityPerson key={name} name={name} role={role} title={title} copy={copy} />)}</div></section>}
    <section className="border-t border-slate-100 pt-5 dark:border-slate-800">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white"><Users className="h-5 w-5" />{copy.members}</h2><p className="mb-4 mt-1 text-sm text-slate-500 dark:text-slate-400">{copy.memberHint}</p>
      <div className="grid gap-2 sm:grid-cols-2">{members.map(person => <CommunityPerson key={person.name} {...person} copy={copy} />)}</div>
      {error && <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-400">{copy.memberError} <button type="button" className="underline" onClick={() => members.length ? void load(true) : setAttempt(value => value + 1)}>{copy.retry}</button></p>}
      {loading ? <p role="status" className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />{copy.loadingMembers}</p> : !error && !members.length ? <p className="text-sm text-slate-500">{copy.noMembers}</p> : hasMore && !error ? <button type="button" onClick={() => void load(true)} className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-[#151719]">{copy.loadMore}</button> : null}
    </section>
  </div>;
}
