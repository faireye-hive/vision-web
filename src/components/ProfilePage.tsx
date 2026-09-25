import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  FileText,
  Hash,
  History,
  Link as LinkIcon,
  MapPin,
  MessageSquare,
  Search
} from 'lucide-react';
import { findCategoryByTag } from '../data/categorySubtopics';
import {
  HiveAccount,
  HivePost,
  calculateReputation,
  calculateVotingPower,
  getAccount,
  getAccountHistory,
  getAccountPosts,
  getDynamicGlobalProperties,
  getHiveAvatarUrl,
  getPostSnippet,
  getPostThumbnail,
  getProfile,
  vestsToHivePower
} from '../services/hiveApi';
import { extractPostTags, isNoiseTag, postCommunity } from '../utils/postTags';

interface ProfilePageProps {
  username: string;
  onClose: () => void;
  onSelectPost: (post: HivePost) => void;
  onOpenUser: (username: string) => void;
  onOpenCommunity?: (communityName: string) => void;
}

type ProfileTab = 'posts' | 'comments' | 'history';

export const ProfilePage: React.FC<ProfilePageProps> = ({
  username,
  onClose,
  onSelectPost,
  onOpenUser,
  onOpenCommunity
}) => {
  const [currentUser, setCurrentUser] = useState(username.replace(/^@/, '').trim().toLowerCase());
  const [lookup, setLookup] = useState('');
  const [account, setAccount] = useState<HiveAccount | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<HivePost[]>([]);
  const [comments, setComments] = useState<HivePost[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [globalProps, setGlobalProps] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentUser(username.replace(/^@/, '').trim().toLowerCase());
    setSelectedTag(null);
    setSelectedTopic(null);
    setActiveTab('posts');
  }, [username]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    setPosts([]);
    setComments([]);

    Promise.all([
      getAccount(currentUser),
      getProfile(currentUser),
      getAccountPosts('posts', currentUser, 20),
      getAccountHistory(currentUser, 25),
      getDynamicGlobalProperties()
    ])
      .then(([acc, prof, userPosts, userHistory, dynProps]) => {
        if (!mounted) return;
        if (!acc) {
          setError(`@${currentUser} was not found on Hive.`);
          setAccount(null);
        } else {
          setAccount(acc);
          setProfile(prof);
          setPosts(userPosts);
          setHistory((userHistory || []).slice().reverse());
          setGlobalProps(dynProps);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err?.message || 'Could not load this profile.');
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [currentUser]);

  useEffect(() => {
    if (activeTab !== 'comments' || comments.length > 0) return;
    let mounted = true;
    getAccountPosts('comments', currentUser, 20)
      .then((items) => {
        if (mounted) setComments(items || []);
      })
      .catch(() => {
        if (mounted) setComments([]);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, comments.length, currentUser]);

  const tagStats = useMemo(() => {
    const counts = new Map<string, number>();
    posts.forEach((post) => {
      extractPostTags(post).forEach((tag) => {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      });
    });
    return [...counts.entries()]
      .map(([tag, count]) => ({
        tag,
        count,
        weight: count * (isNoiseTag(tag) ? 0.25 : 1),
        category: findCategoryByTag(tag)
      }))
      .sort((a, b) => b.weight - a.weight || b.count - a.count);
  }, [posts]);

  const topics = useMemo(() => {
    const groups = new Map<string, { tag: string; label: string; icon: string; count: number }>();
    tagStats.forEach((stat) => {
      if (!stat.category || isNoiseTag(stat.tag)) return;
      const current = groups.get(stat.category.tag) || {
        tag: stat.category.tag,
        label: stat.category.label,
        icon: stat.category.icon,
        count: 0
      };
      current.count += stat.count;
      groups.set(stat.category.tag, current);
    });
    return [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 6);
  }, [tagStats]);

  const communities = useMemo(() => {
    const groups = new Map<string, { name: string; title: string; count: number }>();
    posts.forEach((post) => {
      const community = postCommunity(post);
      if (!community) return;
      const current = groups.get(community.name) || { ...community, count: 0 };
      current.count += 1;
      if (community.title !== community.name) current.title = community.title;
      groups.set(community.name, current);
    });
    return [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 6);
  }, [posts]);

  const visiblePosts = useMemo(() => {
    return posts.filter((post) => {
      const tags = extractPostTags(post);
      if (selectedTag && !tags.includes(selectedTag)) return false;
      if (selectedTopic) {
        const matchesTopic = tags.some((tag) => findCategoryByTag(tag)?.tag === selectedTopic);
        if (!matchesTopic) return false;
      }
      return true;
    });
  }, [posts, selectedTag, selectedTopic]);

  const maxTagCount = tagStats[0]?.count || 1;

  const lookupUser = (event: React.FormEvent) => {
    event.preventDefault();
    const clean = lookup.replace(/^@/, '').trim().toLowerCase();
    if (!clean) return;
    setLookup('');
    onOpenUser(clean);
  };

  const loadMore = async () => {
    const source = activeTab === 'comments' ? comments : posts;
    const last = source[source.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    try {
      const sort = activeTab === 'comments' ? 'comments' : 'posts';
      const more = await getAccountPosts(sort, currentUser, 20, true, last.author, last.permlink);
      const fresh = more.filter((post) => post.permlink !== last.permlink || post.author !== last.author);
      if (activeTab === 'comments') setComments((prev) => [...prev, ...fresh]);
      else setPosts((prev) => [...prev, ...fresh]);
    } finally {
      setLoadingMore(false);
    }
  };

  let metaProfile: any = profile?.metadata?.profile || {};
  if (!metaProfile.name && account?.posting_json_metadata) {
    try {
      metaProfile = JSON.parse(account.posting_json_metadata)?.profile || {};
    } catch {
      metaProfile = {};
    }
  }

  const reputation = account ? calculateReputation(account.reputation) : 25;
  const hivePower = account && globalProps
    ? vestsToHivePower(account.vesting_shares, globalProps.total_vesting_shares, globalProps.total_vesting_fund_hive)
    : 0;
  const votingPower = account ? calculateVotingPower(account.voting_power, account.last_vote_time) : 100;

  return (
    <div id="profile-page" className="animate-in fade-in duration-150">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <form onSubmit={lookupUser} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={lookup}
              onChange={(event) => setLookup(event.target.value)}
              placeholder="Another @account"
              className="pl-8 pr-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-xs w-44"
            />
          </div>
          <button type="submit" className="text-xs font-bold px-3 py-1.5 rounded-full bg-gray-100 dark:bg-slate-800">
            Open
          </button>
        </form>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-16 text-center text-sm text-gray-500">
          Loading @{currentUser}...
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center space-y-3">
          <p className="text-sm text-rose-600">{error}</p>
          <button type="button" onClick={() => onOpenUser('ecency')} className="text-xs font-bold text-blue-600">
            Open @ecency
          </button>
        </div>
      ) : account && (
        <div className="space-y-4">
          <section className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl overflow-hidden">
              <div className="relative h-28 sm:h-40 bg-slate-950">
                {metaProfile.cover_image ? (
                  <img
                    src={metaProfile.cover_image}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(event) => { (event.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#1d4ed8,transparent_42%),linear-gradient(120deg,#0f172a,#1e293b)]" />
                )}
              </div>
              <div className="px-5 sm:px-8 pb-6">
                <div className="flex items-end justify-between">
                  <img
                    src={getHiveAvatarUrl(currentUser, 'large')}
                    alt=""
                    className="-mt-10 h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover ring-4 ring-white dark:ring-slate-900 bg-slate-200"
                  />
                  <a
                    href={`https://hive.blog/@${currentUser}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-blue-600"
                  >
                    hive.blog <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <h1 className="text-[1.65rem] font-bold tracking-tight leading-none">{metaProfile.name || currentUser}</h1>
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full">{reputation}</span>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">@{currentUser}</p>
                {metaProfile.about && (
                  <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-gray-700 dark:text-slate-200">{metaProfile.about}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-slate-400">
                  {metaProfile.location && (
                    <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{metaProfile.location}</span>
                  )}
                  {metaProfile.website && (
                    <a
                      href={metaProfile.website.startsWith('http') ? metaProfile.website : `https://${metaProfile.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600"
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      {String(metaProfile.website).replace(/^https?:\/\//, '')}
                    </a>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Joined {new Date(`${account.created}Z`).toLocaleDateString()}
                  </span>
                  <span><strong className="text-gray-800 dark:text-slate-100">{profile?.stats?.followers || 0}</strong> followers</span>
                  <span><strong className="text-gray-800 dark:text-slate-100">{profile?.stats?.following || 0}</strong> following</span>
                </div>
                <dl className="mt-5 grid grid-cols-2 sm:grid-cols-4 overflow-hidden rounded-2xl border border-gray-100 dark:border-slate-800">
                  <Stat label="HIVE" value={account.balance} />
                  <Stat label="HBD" value={account.hbd_balance} />
                  <Stat label="Hive Power" value={`${hivePower.toFixed(0)} HP`} />
                  <Stat label="Voting power" value={`${votingPower}%`} />
                </dl>
              </div>
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
            <div className="min-w-0 space-y-4 order-2 xl:order-1">
            <div className="flex gap-2">
              <TabButton active={activeTab === 'posts'} onClick={() => setActiveTab('posts')} icon={<FileText className="w-3.5 h-3.5" />} label={`Posts (${posts.length})`} />
              <TabButton active={activeTab === 'comments'} onClick={() => setActiveTab('comments')} icon={<MessageSquare className="w-3.5 h-3.5" />} label="Comments" />
              <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History className="w-3.5 h-3.5" />} label="Chain" />
            </div>

            {activeTab === 'posts' && (
              <div className="space-y-3">
                {(selectedTag || selectedTopic) && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-slate-400">
                      {visiblePosts.length} loaded {visiblePosts.length === 1 ? 'post' : 'posts'}
                      {selectedTag ? ` tagged #${selectedTag}` : ''}
                      {selectedTopic ? ` in ${topics.find((topic) => topic.tag === selectedTopic)?.label || selectedTopic}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setSelectedTag(null); setSelectedTopic(null); }}
                      className="font-bold text-blue-600"
                    >
                      Clear
                    </button>
                  </div>
                )}
                {visiblePosts.length === 0 ? (
                  <EmptyNote text="No loaded posts match this tag yet. Load more, or clear the filter." />
                ) : (
                  <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl divide-y divide-gray-100 dark:divide-slate-800">
                    {visiblePosts.map((post) => (
                      <ProfilePostCard
                        key={`${post.author}/${post.permlink}`}
                        post={post}
                        onOpen={() => onSelectPost(post)}
                        onTag={(tag) => { setSelectedTag(tag); setSelectedTopic(null); }}
                      />
                    ))}
                  </div>
                )}
                {posts.length > 0 && (
                  <div className="text-center">
                    <button type="button" onClick={loadMore} disabled={loadingMore} className="px-5 py-2 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-xs font-bold">
                      {loadingMore ? 'Loading...' : 'Load more posts'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <EmptyNote text="No recent comments loaded for this account." />
                ) : comments.map((post) => (
                  <button
                    key={`${post.author}/${post.permlink}`}
                    type="button"
                    onClick={() => onSelectPost(post)}
                    className="w-full text-left bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-4 hover:border-blue-200"
                  >
                    <p className="text-sm text-gray-700 dark:text-slate-200 line-clamp-3">{getPostSnippet(post.body, 220)}</p>
                    <p className="mt-2 text-[11px] text-gray-400">
                      {post.created ? new Date(`${post.created}Z`).toLocaleString() : ''} · {post.children || 0} replies
                    </p>
                  </button>
                ))}
                {comments.length > 0 && (
                  <div className="text-center">
                    <button type="button" onClick={loadMore} disabled={loadingMore} className="px-5 py-2 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-xs font-bold">
                      {loadingMore ? 'Loading...' : 'Load more comments'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl divide-y divide-gray-100 dark:divide-slate-800">
                {history.length === 0 ? (
                  <EmptyNote text="No recent chain operations were returned." />
                ) : history.map((entry, index) => {
                  const item = Array.isArray(entry) ? entry[1] : entry;
                  const opType = item?.op?.[0] || 'operation';
                  const opData = item?.op?.[1] || {};
                  const detail = opType === 'vote'
                    ? `voted @${opData.author}/${opData.permlink}`
                    : opType === 'transfer'
                      ? `sent ${opData.amount} to @${opData.to}`
                      : opType === 'comment'
                        ? `published ${opData.permlink}`
                        : opType === 'claim_reward_balance'
                          ? 'claimed rewards'
                          : '';
                  return (
                    <div key={`${item?.timestamp || index}`} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <span className="font-mono uppercase text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800">{opType}</span>
                        <span className="ml-2 text-gray-600 dark:text-slate-300 truncate">{detail}</span>
                      </div>
                      <span className="text-gray-400 flex-shrink-0">
                        {item?.timestamp ? new Date(`${item.timestamp}Z`).toLocaleString() : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <aside className="order-1 xl:order-2 xl:sticky xl:top-20 space-y-4">
            <section className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-4">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold">From these posts</h2>
              </div>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
                Tags on the {posts.length} posts loaded from this account.
              </p>
              {topics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {topics.map((topic) => (
                    <button
                      key={topic.tag}
                      type="button"
                      onClick={() => {
                        setSelectedTopic(selectedTopic === topic.tag ? null : topic.tag);
                        setSelectedTag(null);
                        setActiveTab('posts');
                      }}
                      className={`text-[11px] px-2 py-1 rounded-full font-semibold ${
                        selectedTopic === topic.tag
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200'
                      }`}
                    >
                      {topic.icon} {topic.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tagStats.filter((stat) => !isNoiseTag(stat.tag)).slice(0, 16).map((stat) => (
                  <button
                    key={stat.tag}
                    type="button"
                    onClick={() => {
                      setSelectedTag(selectedTag === stat.tag ? null : stat.tag);
                      setSelectedTopic(null);
                      setActiveTab('posts');
                    }}
                    className={`rounded-full px-2.5 py-1 font-semibold ${
                      selectedTag === stat.tag
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700'
                    }`}
                    style={{ fontSize: stat.count >= maxTagCount * 0.6 ? 13 : 12 }}
                  >
                    #{stat.tag}
                    <span className="ml-1 opacity-60">{stat.count}</span>
                  </button>
                ))}
              </div>
              {tagStats.some((stat) => isNoiseTag(stat.tag)) && (
                <p className="mt-3 text-[11px] text-gray-400">
                  Also on most posts: {tagStats.filter((stat) => isNoiseTag(stat.tag)).slice(0, 4).map((stat) => `#${stat.tag}`).join(' ')}
                </p>
              )}
            </section>

            {communities.length > 0 && (
              <section className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-4">
                <h2 className="text-sm font-bold mb-2">Communities in these posts</h2>
                <div className="space-y-1">
                  {communities.map((community) => (
                    <button
                      key={community.name}
                      type="button"
                      onClick={() => onOpenCommunity?.(community.name)}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 text-left"
                    >
                      <span className="text-xs font-semibold truncate">{community.title}</span>
                      <span className="text-[11px] text-gray-400">{community.count}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </aside>
          </div>
        </div>
      )}
    </div>
  );
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50/80 dark:bg-slate-900 px-3 py-3 border-r border-b border-gray-100 dark:border-slate-800 last:border-r-0">
      <dt className="text-[10px] uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums truncate">{value}</dd>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
        active ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-sm text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-3xl p-8 text-center">{text}</p>;
}

function ProfilePostCard({
  post,
  onOpen,
  onTag
}: {
  post: HivePost;
  onOpen: () => void;
  onTag: (tag: string) => void;
}) {
  const thumb = getPostThumbnail(post);
  const tags = extractPostTags(post).filter((tag) => !isNoiseTag(tag)).slice(0, 4);
  const payout = post.pending_payout_value || (post.is_paidout ? 'paid' : '');

  return (
    <article className="flex gap-4 px-4 py-4 sm:px-5">
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onOpen} className="text-left">
          <h3 className="text-lg font-semibold leading-snug hover:text-blue-600">{post.title || 'Untitled'}</h3>
        </button>
        <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-slate-300 line-clamp-2">{getPostSnippet(post.body, 160)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
          {tags.map((tag) => (
            <button key={tag} type="button" onClick={() => onTag(tag)} className="font-semibold text-blue-600 dark:text-blue-400">
              #{tag}
            </button>
          ))}
          <span>
            {post.created ? new Date(`${post.created}Z`).toLocaleDateString() : ''}
            {' · '}
            {post.children || 0} comments
            {payout ? ` · ${payout}` : ''}
          </span>
        </div>
      </div>
      {thumb && (
        <button type="button" onClick={onOpen} className="hidden sm:block flex-shrink-0">
          <img src={thumb} alt="" className="h-24 w-36 rounded-xl object-cover bg-gray-100" />
        </button>
      )}
    </article>
  );
}
