import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigationType, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Check, ChevronRight, Globe2, Link2, Loader2, PenLine, Shield, Users, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { useI18n } from '../i18n/I18nContext';
import { communityPageCopy } from '../i18n/communityPage';
import { getAccount, getCommunity, getHiveAvatarUrl, HiveCommunity, HivePost, resolveHiveAvatarUrl } from '../services/hiveApi';
import { getCommunityTeam } from '../services/communityMembers';
import { communityNameFromPath, communityPath } from '../utils/communityRoutes';
import { getSafeImageUrl } from '../utils/sanitize';
import { handleImageFallback } from '../utils/imageFallback';
import { requestLogin } from '../utils/authEvents';
import { CommunityAdminButton } from '../components/CommunityAdminButton';
import { CommunityTopicsCard } from '../components/CommunityTopicsCard';
import { CommunityMembersSection, CommunityPerson } from '../components/communities/CommunityMembersSection';
import { CommunityRichText } from '../components/communities/CommunityRichText';
import { DiscoverPage } from './DiscoverPage';

const panel = 'rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const secondary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-[#222628]';
type View = 'posts' | 'about' | 'members';

export function CommunityPage() {
  const location = useLocation();
  const { pathname } = location;
  const navigationType = useNavigationType();
  const name = communityNameFromPath(pathname);
  const { locale } = useI18n();
  const copy = communityPageCopy(locale);
  const [params, setParams] = useSearchParams();
  const view: View = params.get('view') === 'about' ? 'about' : params.get('view') === 'members' ? 'members' : 'posts';
  const { currentUser, joinedCommunities, toggleJoinCommunity } = useAuth();
  const { openWritePage, tag } = useNavigation();
  const [community, setCommunity] = useState<HiveCommunity | null>(null);
  const [media, setMedia] = useState({ cover: '', avatar: '', created: '' });
  const [loading, setLoading] = useState(Boolean(name));
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const [posts, setPosts] = useState<HivePost[]>([]);
  const [feedVisited, setFeedVisited] = useState(view === 'posts');
  const [membersVisited, setMembersVisited] = useState(view === 'members');
  const canonicalUrl = `${window.location.origin}${communityPath(name)}`;
  const subscribed = Boolean(joinedCommunities[name]);

  useLayoutEffect(() => {
    if (navigationType === 'PUSH' && location.state?.communityLanding) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [navigationType, location.key, loading]);

  useEffect(() => {
    let active = true;
    if (!name) return;
    setLoading(true); setFailed(false);
    getCommunity(name, attempt > 0).then(result => { if (active) setCommunity(result); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    // Account artwork is optional and must not delay the community itself.
    getAccount(name).then(account => {
      if (!active || !account) return;
      let profile: Record<string, unknown> = {};
      for (const raw of [account.json_metadata, account.posting_json_metadata]) {
        try { const next = JSON.parse(raw || '{}')?.profile; if (next && typeof next === 'object') profile = { ...profile, ...next }; } catch { /* Malformed metadata has no artwork. */ }
      }
      setMedia({
        cover: typeof profile.cover_image === 'string' ? getSafeImageUrl(profile.cover_image, { width: 1600 }) || '' : '',
        avatar: typeof profile.profile_image === 'string' ? getSafeImageUrl(resolveHiveAvatarUrl(profile.profile_image, name), { width: 200 }) || '' : '',
        created: account.created,
      });
    }).catch(() => { /* The neutral cover and Hive avatar remain available. */ });
    return () => { active = false; };
  }, [name, attempt]);

  useEffect(() => {
    if (!community) return;
    const previous = document.title;
    document.title = `${community.title || community.name} · Nebulosa`;
    return () => { document.title = previous; };
  }, [community]);

  useEffect(() => {
    if (view === 'posts') setFeedVisited(true);
    if (view === 'members') setMembersVisited(true);
  }, [view]);
  useEffect(() => {
    if (shareState !== 'copied') return;
    const timer = window.setTimeout(() => setShareState('idle'), 3000);
    return () => window.clearTimeout(timer);
  }, [shareState]);

  const team = useMemo(() => community ? getCommunityTeam(community) : [], [community]);
  const goView = (next: View) => setParams(current => {
    const query = new URLSearchParams(current);
    if (next === 'posts') query.delete('view'); else query.set('view', next);
    return query;
  });
  const selectTopic = (topic: string) => setParams(current => {
    const query = new URLSearchParams(current);
    query.delete('view');
    if (topic) query.set('topic', topic); else query.delete('topic');
    return query;
  });
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(canonicalUrl); setShareState('copied'); }
    catch { setShareState('manual'); }
  };
  const join = async () => {
    if (!currentUser) { requestLogin(); return; }
    if (joining) return;
    setJoining(true); setJoinError('');
    try { setJoinError(await toggleJoinCommunity(name) || ''); }
    catch (error) { setJoinError(error instanceof Error ? error.message : copy.error); }
    finally { setJoining(false); }
  };

  if (!name || (!loading && !failed && !community)) return <section className={`${panel} mx-auto max-w-2xl p-8 text-center`}><Users className="mx-auto mb-3 h-9 w-9 text-slate-400" /><h1 className="text-xl font-bold">{copy.invalid}</h1><p className="mt-2 text-sm text-slate-500">{copy.invalidHint}</p><Link to="/communities?tab=explore" className="mt-5 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">{copy.discover}</Link></section>;
  if (failed) return <section className={`${panel} mx-auto max-w-2xl p-8 text-center`}><h1 className="text-xl font-bold">{copy.error}</h1><button type="button" onClick={() => setAttempt(value => value + 1)} className={`${secondary} mt-4`}>{copy.retry}</button></section>;
  if (loading || !community) return <div role="status" aria-label={copy.loading} className="mx-auto max-w-6xl space-y-4"><div className={`${panel} overflow-hidden animate-pulse`}><div className="h-48 bg-slate-100 dark:bg-slate-800" /><div className="space-y-3 p-6"><div className="h-7 w-1/2 rounded bg-slate-100 dark:bg-slate-800" /><div className="h-4 w-3/4 rounded bg-slate-100 dark:bg-slate-800" /></div></div><p className="text-center text-sm text-slate-500">{copy.loading}</p></div>;

  const avatar = (community.avatar_url && getSafeImageUrl(resolveHiveAvatarUrl(community.avatar_url, name), { width: 200 })) || media.avatar || getHiveAvatarUrl(name);
  const created = community.created_at || media.created;
  const date = created ? new Date(/Z$|[+-]\d\d:\d\d$/.test(created) ? created : `${created.replace(' ', 'T')}Z`) : null;
  const dateLabel = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  let language = community.lang || '—';
  try { if (community.lang) language = new Intl.DisplayNames([locale], { type: 'language' }).of(community.lang) || community.lang; } catch { /* Show the published language code. */ }

  return <div id="community-page" className="mx-auto w-full max-w-6xl space-y-4 text-slate-800 dark:text-slate-200">
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 px-1 text-xs text-slate-500 dark:text-slate-400"><Link to="/communities?tab=explore" className="inline-flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400"><ArrowLeft className="h-3.5 w-3.5" />{copy.directory}</Link><ChevronRight className="h-3 w-3" /><span className="truncate">{community.title || name}</span></nav>

    <header className={`${panel} overflow-hidden`}>
      <div className="relative h-40 overflow-hidden bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300 sm:h-52 lg:h-60 dark:from-[#222628] dark:via-[#101214] dark:to-[#070809]">
        {media.cover && <img src={media.cover} alt="" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
        <span className="absolute end-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-sm"><Globe2 className="h-3.5 w-3.5" />{copy.public}</span>
      </div>
      <div className="relative px-4 pb-4 sm:px-6 sm:pb-5">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <img src={avatar} alt={community.title} className="-mt-10 h-20 w-20 rounded-2xl border-4 border-white bg-slate-100 object-cover shadow-sm sm:-mt-12 sm:h-24 sm:w-24 dark:border-[#070809] dark:bg-slate-800" onError={(event) => handleImageFallback(event, getHiveAvatarUrl(name))} />
          <div className="flex flex-wrap items-center gap-2 pt-3">
            <CommunityAdminButton communityName={name} />
            <button type="button" onClick={() => void copyLink()} className={secondary}><Link2 className="h-4 w-4" /><span>{shareState === 'copied' ? copy.copied : copy.share}</span></button>
            <button type="button" disabled={joining} onClick={() => void join()} aria-pressed={subscribed} title={subscribed ? copy.leave : copy.join} className={subscribed ? secondary : 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50'}>{joining ? <Loader2 className="h-4 w-4 animate-spin" /> : subscribed ? <Check className="h-4 w-4" /> : <Users className="h-4 w-4" />}{joining ? copy.saving : subscribed ? copy.joined : copy.join}</button>
          </div>
        </div>
        <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 max-w-3xl"><div className="flex flex-wrap items-center gap-2"><h1 className="break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">{community.title || name}</h1>{community.is_nsfw && <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{copy.sensitive}</span>}</div><p className="mt-1 font-mono text-[11px] text-slate-400">{name}</p>{community.about && <p className="mt-2 break-words text-sm leading-relaxed text-slate-600 dark:text-slate-300">{community.about}</p>}</div>
          <div className="flex shrink-0 gap-6 text-xs"><div><p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{(community.subscribers || 0).toLocaleString(locale)}</p><p className="text-slate-500 dark:text-slate-400">{copy.subscribers}</p></div><div><p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{(community.num_authors || 0).toLocaleString(locale)}</p><p className="text-slate-500 dark:text-slate-400">{copy.authors}</p></div></div>
        </div>
        {joinError && <p role="alert" className="mt-3 text-xs text-rose-600 dark:text-rose-400">{joinError}</p>}
        {shareState === 'copied' && <span role="status" className="sr-only">{copy.copied}</span>}
        {shareState === 'manual' && <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><div className="mb-2 flex items-center justify-between gap-2 text-xs"><label htmlFor="community-share-link">{copy.copyFallback}</label><button type="button" aria-label="Close" onClick={() => setShareState('idle')}><X className="h-4 w-4" /></button></div><input id="community-share-link" readOnly value={canonicalUrl} onFocus={event => event.currentTarget.select()} className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-900" /></div>}
      </div>
      <nav aria-label={community.title || name} className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 sm:px-5 dark:border-slate-800">{(['posts', 'about', 'members'] as const).map(item => <Link key={item} to={{ pathname, search: (() => { const query = new URLSearchParams(params); if (item === 'posts') query.delete('view'); else query.set('view', item); return query.toString(); })() }} aria-current={view === item ? 'page' : undefined} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition ${view === item ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}>{copy[item]}</Link>)}</nav>
    </header>

    <details className={`${panel} p-4 lg:hidden`}><summary className="cursor-pointer text-sm font-semibold">{copy.details}</summary><p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{community.about || copy.noAbout}</p><dl className="my-3 flex flex-wrap gap-x-5 gap-y-2 text-xs"><div><dt className="text-slate-500">{copy.language}</dt><dd>{language}</dd></div>{dateLabel && <div><dt className="text-slate-500">{copy.created}</dt><dd>{dateLabel}</dd></div>}</dl><button type="button" onClick={() => goView('about')} className="mb-3 text-xs font-semibold text-blue-600 dark:text-blue-400">{copy.guidelines}<ChevronRight className="ms-1 inline h-3 w-3" /></button><CommunityTopicsCard communityPosts={posts} currentTag={name} onSelectTopic={selectTopic} title={copy.topics} /></details>
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-4">
        <div hidden={view !== 'posts'} className="space-y-4">
          <button type="button" onClick={() => currentUser ? openWritePage(name) : requestLogin()} className={`${panel} flex w-full items-center gap-3 p-4 text-start text-sm text-slate-500 transition hover:border-blue-300 dark:text-slate-400 dark:hover:border-blue-700`}><span className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"><PenLine className="h-4 w-4" /></span>{copy.publish}</button>
          {feedVisited && tag === name && <DiscoverPage isCommunitiesFeed communityPage onPostsLoaded={setPosts} onClearSubTopic={() => selectTopic('')} />}
        </div>
        {view === 'about' && <div className={`${panel} space-y-6 p-5 sm:p-6`}>
          <section><h2 className="mb-3 text-lg font-bold text-slate-900 dark:text-white">{copy.about}</h2>{community.about ? <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">{community.about}</p> : <p className="text-sm text-slate-500">{copy.noAbout}</p>}</section>
          <section className="space-y-4 border-t border-slate-100 pt-5 dark:border-slate-800"><h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white"><Shield className="h-4 w-4" />{copy.guidelines}</h2>{community.description && <CommunityRichText text={community.description} />}{community.flag_text && community.flag_text !== community.description && <CommunityRichText text={community.flag_text} />}{!community.description && !community.flag_text && <p className="text-sm text-slate-500 dark:text-slate-400">{copy.noRules}</p>}</section>
        </div>}
        {membersVisited && <div hidden={view !== 'members'} className={`${panel} p-5 sm:p-6`}><CommunityMembersSection community={community} copy={copy} /></div>}
      </div>

      <aside className="hidden space-y-4 lg:sticky lg:top-20 lg:block">
        <section className={`${panel} p-4`}><h2 className="text-sm font-bold text-slate-900 dark:text-white">{copy.details}</h2><dl className="mt-4 space-y-3 text-xs"><div className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-slate-400" /><dt className="text-slate-500 dark:text-slate-400">{copy.language}</dt><dd className="ms-auto text-end font-medium">{language}</dd></div>{dateLabel && <div className="flex items-start gap-2"><CalendarDays className="h-4 w-4 shrink-0 text-slate-400" /><dt className="text-slate-500 dark:text-slate-400">{copy.created}</dt><dd className="ms-auto text-end font-medium">{dateLabel}</dd></div>}<div className="border-t border-slate-100 pt-3 dark:border-slate-800"><dt className="mb-1 text-slate-500 dark:text-slate-400">{copy.account}</dt><dd><Link to={`/profile/@${name}`} className="font-mono text-blue-600 hover:underline dark:text-blue-400">@{name}</Link></dd></div></dl></section>
        {team.length > 0 && <section className={`${panel} p-4`}><h2 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">{copy.team}</h2><div className="space-y-2">{team.slice(0, 3).map(([user, role, title]) => <CommunityPerson key={user} name={user} role={role} title={title} copy={copy} />)}</div><button type="button" onClick={() => goView('members')} className="mt-3 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">{copy.seeTeam}<ChevronRight className="ms-1 inline h-3 w-3" /></button></section>}
        <CommunityTopicsCard communityPosts={posts} currentTag={name} onSelectTopic={selectTopic} title={copy.topics} />
      </aside>
    </div>
  </div>;
}
