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
  Search,
  CheckCircle2,
  ChevronRight,
  Clock,
  Layers,
  CornerDownRight
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
  getProfile
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
      .then(([acc, prof, userPosts, userHistory]) => {
        if (!mounted) return;
        if (!acc) {
          setError(`@${currentUser} was not found on Hive.`);
          setAccount(null);
        } else {
          setAccount(acc);
          setProfile(prof);
          setPosts(userPosts);
          setHistory((userHistory || []).slice().reverse());
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
  const votingPower = account ? calculateVotingPower(account.voting_power, account.last_vote_time) : 100;

  // Calculo do Circulo SVG para Voting Power em volta do Avatar
  const strokeDasharray = 339.292;
  const strokeDashoffset = strokeDasharray - (strokeDasharray * votingPower) / 100;

  return (
    <div id="profile-page" className="max-w-6xl mx-auto pb-12 animate-in fade-in duration-150">
      
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Feed
        </button>

        <form onSubmit={lookupUser} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={lookup}
              onChange={(event) => setLookup(event.target.value)}
              placeholder="Search @account, post, tag..."
              className="pl-8 pr-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-xs w-60 text-gray-800 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button type="submit" className="text-xs font-bold px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer">
            Open
          </button>
        </form>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-16 text-center text-sm font-semibold text-gray-500 dark:text-slate-400 shadow-xs">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading @{currentUser}...
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-950/50 rounded-3xl p-12 text-center space-y-3 shadow-xs">
          <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{error}</p>
          <button type="button" onClick={() => onOpenUser('ecency')} className="text-xs font-bold text-blue-600 hover:underline">
            Try opening @ecency
          </button>
        </div>
      ) : account && (
        <div className="space-y-6">
          
          {/* Banner & Profile Section */}
          <section className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
            
            {/* Cover Banner */}
            <div className="relative h-44 sm:h-56 bg-slate-950 overflow-hidden">
              {metaProfile.cover_image ? (
                <img
                  src={metaProfile.cover_image}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(event) => { (event.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900" />
              )}
              
              <div className="absolute top-4 right-6 text-right hidden sm:block text-white/80">
                <p className="text-xs font-semibold tracking-wide">Decentralized social.</p>
                <p className="text-xs font-bold">Built on Hive.</p>
              </div>
            </div>

            {/* Profile Info Row */}
            <div className="px-6 sm:px-8 pb-6 relative">
              
              <div className="flex flex-wrap items-end justify-between">
                
                {/* Circular Avatar with Voting Power SVG Ring */}
                <div className="relative -mt-16 sm:-mt-20 flex-shrink-0 group">
                  <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center">
                    
                    {/* SVG Voting Power Ring */}
                    <svg className="absolute inset-0 w-full h-full -rotate-90 transform" viewBox="0 0 120 120">
                      <circle
                        cx="60"
                        cy="60"
                        r="54"
                        className="stroke-gray-100 dark:stroke-slate-800"
                        strokeWidth="5"
                        fill="transparent"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r="54"
                        className="stroke-blue-600 transition-all duration-700 ease-out"
                        strokeWidth="5"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>

                    {/* User Avatar */}
                    <img
                      src={getHiveAvatarUrl(currentUser, 'large')}
                      alt={currentUser}
                      className="h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover bg-slate-100 dark:bg-slate-800 shadow-md p-1"
                    />

                    {/* Verified Badge */}
                    <div className="absolute bottom-1 right-1 p-1 bg-blue-600 text-white rounded-full ring-2 ring-white dark:ring-slate-900" title={`Reputation: ${reputation}`}>
                      <CheckCircle2 className="w-4 h-4 fill-blue-600 text-white" />
                    </div>
                  </div>

                  {/* Tooltip Hover for Voting Power */}
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded-full whitespace-nowrap z-10">
                    Voting Power: {votingPower}%
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700/60 px-3 py-1 rounded-full">
                    VP: {votingPower}%
                  </span>
                </div>
              </div>

              {/* Name & Username */}
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white">
                    {metaProfile.name || currentUser}
                  </h1>
                  <span className="inline-flex items-center text-blue-600 dark:text-blue-400">
                    <CheckCircle2 className="w-5 h-5 fill-blue-600 text-white dark:text-slate-900" />
                  </span>
                </div>
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 mt-0.5">@{currentUser}</p>
              </div>

              {/* User Bio */}
              {metaProfile.about && (
                <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                  {metaProfile.about}
                </p>
              )}

              {/* Metadata Row */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-slate-400">
                {metaProfile.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-blue-500" />
                    {metaProfile.location}
                  </span>
                )}
                {metaProfile.website && (
                  <a
                    href={metaProfile.website.startsWith('http') ? metaProfile.website : `https://${metaProfile.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    {String(metaProfile.website).replace(/^https?:\/\//, '')}
                  </a>
                )}
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  Joined {new Date(`${account.created}Z`).toLocaleDateString()}
                </span>
                <span>
                  <strong className="text-gray-900 dark:text-slate-100 font-bold">{profile?.stats?.followers || 0}</strong> Followers
                </span>
                <span>
                  <strong className="text-gray-900 dark:text-slate-100 font-bold">{profile?.stats?.following || 0}</strong> Following
                </span>
              </div>

            </div>
          </section>

          {/* Main Content Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
            
            {/* Left Column: Posts, Comments, History */}
            <div className="min-w-0 space-y-4">
              
              {/* Tab Selector */}
              <div className="flex items-center gap-6 border-b border-gray-200 dark:border-slate-800 pb-2 px-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('posts')}
                  className={`inline-flex items-center gap-2 text-xs font-bold pb-2 transition border-b-2 cursor-pointer ${
                    activeTab === 'posts'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-800'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Posts ({posts.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('comments')}
                  className={`inline-flex items-center gap-2 text-xs font-bold pb-2 transition border-b-2 cursor-pointer ${
                    activeTab === 'comments'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-800'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Comments
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`inline-flex items-center gap-2 text-xs font-bold pb-2 transition border-b-2 cursor-pointer ${
                    activeTab === 'history'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-800'
                  }`}
                >
                  <History className="w-4 h-4" />
                  Chain History
                </button>
              </div>

              {/* POSTS TAB */}
              {activeTab === 'posts' && (
                <div className="space-y-4">
                  {(selectedTag || selectedTopic) && (
                    <div className="flex items-center justify-between text-xs bg-blue-50 dark:bg-blue-950/40 p-3 rounded-2xl border border-blue-100 dark:border-blue-900/50">
                      <span className="text-blue-800 dark:text-blue-300 font-semibold">
                        Filter: {selectedTag ? `#${selectedTag}` : topics.find((t) => t.tag === selectedTopic)?.label || selectedTopic}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setSelectedTag(null); setSelectedTopic(null); }}
                        className="font-bold text-blue-600 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  )}

                  {visiblePosts.length === 0 ? (
                    <EmptyNote text="No posts found matching this tag." />
                  ) : (
                    <div className="space-y-3">
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
                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="px-6 py-2 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-xs font-bold text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition cursor-pointer"
                      >
                        {loadingMore ? 'Loading...' : 'Load more posts'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* COMMENTS TAB */}
              {activeTab === 'comments' && (
                <div className="space-y-3">
                  {comments.length === 0 ? (
                    <EmptyNote text="No comments found." />
                  ) : (
                    comments.map((comment, index) => {
                      const parentAuthor = comment.parent_author || 'author';
                      const parentPermlink = comment.parent_permlink || '';

                      return (
                        <div
                          key={`comment-${comment.author}-${comment.permlink}-${comment.created || index}`}
                          className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-5 hover:border-blue-500 transition shadow-xs"
                        >
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 mb-2 pb-2 border-b border-gray-100 dark:border-slate-800/80">
                            <CornerDownRight className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                            <span>In reply to</span>
                            <button
                              type="button"
                              onClick={() => onOpenUser(parentAuthor)}
                              className="font-bold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              @{parentAuthor}
                            </button>
                            {parentPermlink && (
                              <span className="truncate max-w-[220px] sm:max-w-[340px] text-gray-400">
                                ({parentPermlink})
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => onSelectPost(comment)}
                            className="w-full text-left cursor-pointer group"
                          >
                            <p className="text-xs sm:text-sm text-gray-800 dark:text-slate-200 line-clamp-3 leading-relaxed group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                              {getPostSnippet(comment.body, 240)}
                            </p>
                          </button>

                          <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400 pt-2 border-t border-gray-100 dark:border-slate-800/60">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {comment.created ? new Date(`${comment.created}Z`).toLocaleString() : ''}
                            </span>
                            <button
                              type="button"
                              onClick={() => onSelectPost(comment)}
                              className="font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                            >
                              View Thread →
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {comments.length > 0 && (
                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="px-6 py-2 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-xs font-bold text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition cursor-pointer"
                      >
                        {loadingMore ? 'Loading...' : 'Load more comments'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* CHAIN HISTORY TAB (Key Única Garantida) */}
              {activeTab === 'history' && (
                <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl divide-y divide-gray-100 dark:divide-slate-800 overflow-hidden shadow-xs">
                  {history.length === 0 ? (
                    <EmptyNote text="No chain operations found." />
                  ) : (
                    history.map((entry, index) => {
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
                      
                      // Chave única para evitar o erro do React
                      const uniqueKey = `history-${item?.trx_id || item?.timestamp || 'time'}-${opType}-${index}`;

                      return (
                        <div key={uniqueKey} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0 flex items-center gap-2">
                            <span className="font-mono uppercase text-[10px] px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 font-bold">
                              {opType}
                            </span>
                            <span className="text-gray-700 dark:text-slate-300 truncate">{detail}</span>
                          </div>
                          <span className="text-gray-400 text-[11px] flex-shrink-0">
                            {item?.timestamp ? new Date(`${item.timestamp}Z`).toLocaleString() : ''}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

            </div>

            {/* Right Column Cards */}
            <aside className="space-y-4 xl:sticky xl:top-20">
              
              {/* Top Topics & Tags Card */}
              <section className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-blue-600" />
                    <h2 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Top Topics & Tags</h2>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tagStats.filter((stat) => !isNoiseTag(stat.tag)).slice(0, 16).map((stat) => (
                    <button
                      key={stat.tag}
                      type="button"
                      onClick={() => {
                        setSelectedTag(selectedTag === stat.tag ? null : stat.tag);
                        setSelectedTopic(null);
                        setActiveTab('posts');
                      }}
                      className={`rounded-xl px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                        selectedTag === stat.tag
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-600'
                      }`}
                    >
                      #{stat.tag}
                    </button>
                  ))}
                </div>
              </section>

              {/* Posted Communities Card */}
              {communities.length > 0 && (
                <section className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-600" />
                      <h2 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Posted Communities</h2>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>

                  <div className="space-y-2">
                    {communities.map((community) => (
                      <button
                        key={community.name}
                        type="button"
                        onClick={() => onOpenCommunity?.(community.name)}
                        className="w-full flex items-center justify-between gap-3 p-1.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 text-left transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={`https://images.ecency.com/u/${community.name}/avatar/small`}
                            alt=""
                            className="w-7 h-7 rounded-lg object-cover bg-gray-100 dark:bg-slate-800 flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
                            }}
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{community.title}</p>
                            <p className="text-[10px] text-gray-400">{community.count} {community.count === 1 ? 'post' : 'posts'}</p>
                          </div>
                        </div>
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

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-8 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 shadow-xs">
      {text}
    </div>
  );
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
  const tags = extractPostTags(post).filter((tag) => !isNoiseTag(tag)).slice(0, 5);
  const payout = post.pending_payout_value || (post.is_paidout ? 'paid' : '0.000 HBD');

  return (
    <article className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-5 shadow-xs hover:border-gray-200 transition">
      
      {/* Header Info */}
      <div className="flex items-center gap-2.5 mb-3">
        <img
          src={getHiveAvatarUrl(post.author, 'small')}
          alt={post.author}
          className="w-7 h-7 rounded-full object-cover bg-gray-100"
        />
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-bold text-gray-900 dark:text-white">{post.author}</span>
          <span className="text-gray-400">@{post.author}</span>
          <span className="text-gray-400">•</span>
          <span className="text-gray-400">{post.created ? new Date(`${post.created}Z`).toLocaleDateString() : ''}</span>
        </div>
      </div>

      {/* Main Content & Thumbnail */}
      <div className="flex gap-4 items-start">
        <div className="min-w-0 flex-1 space-y-2">
          <button type="button" onClick={onOpen} className="text-left group cursor-pointer">
            <h3 className="text-base font-extrabold text-gray-900 dark:text-white leading-snug group-hover:text-blue-600 transition">
              {post.title || 'Untitled Post'}
            </h3>
          </button>

          <p className="text-xs sm:text-sm leading-relaxed text-gray-600 dark:text-slate-300 line-clamp-2">
            {getPostSnippet(post.body, 160)}
          </p>

          {/* Tags & Metadata */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTag(tag)}
                className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition cursor-pointer"
              >
                {tag}
              </button>
            ))}

            <span className="text-[11px] text-gray-400 flex items-center gap-1 ml-2">
              <MessageSquare className="w-3 h-3" />
              {post.children || 0} comments
            </span>

            {payout && (
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-md ml-auto">
                {payout}
              </span>
            )}
          </div>
        </div>

        {thumb && (
          <button type="button" onClick={onOpen} className="flex-shrink-0 cursor-pointer">
            <img src={thumb} alt="" className="h-24 w-36 rounded-2xl object-cover bg-gray-100 dark:bg-slate-800" />
          </button>
        )}
      </div>

    </article>
  );
}