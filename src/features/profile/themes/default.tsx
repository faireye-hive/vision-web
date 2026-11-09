import React, { useState, useEffect, useRef } from 'react';
import { 
  Palette,
  ArrowRight,
  ChevronDown,
  MapPin, 
  Link as LinkIcon, 
  Calendar,
  Heart,
  MessageCircle,
  Repeat,
  Loader2,
  MessageSquare,
  Undo2,
  AtSign,
  UserPlus,
  UserMinus,
  PenLine,
  Volume2,
  VolumeX,
  Send,
  Rss,
  ExternalLink
} from 'lucide-react';
import { ProfileTheme, ThemeProps } from './themeTypes';
import { getHiveAvatarUrl, getPostThumbnail, getPostSnippet, HivePost } from '../../../services/hiveApi';
import { DEFAULT_PROFILE_STYLE } from '../profileStyleTypes';
import { useNavigation } from '../../../context/NavigationContext';
import { getSafeImageUrl, markdownToSafeHtml } from '../../../utils/sanitize';
import { hasScamCommentSignals, hasSuspiciousCommentLanguage } from '../../../utils/scamAlert';
import { ScamAlertNotice } from '../../../components/ScamAlertNotice';

/**
 * THEME: Clean Slate (Default)
 * Replicates the modern, clean interface with integrated banner info,
 * left sidebar stats, card-based feed layout, infinite scroll,
 * reblog indicators, and inline comment replies.
 */

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const ThemeHeader: React.FC<ThemeProps> = ({
  account, profile, followerCount, followingCount, postCount,
  isOwner, isFollowing, onFollowToggle, isMuted, onMuteToggle, onOpenCustomizer
}) => {
  const meta = profile?.metadata?.profile || {};
  const cover = meta.cover_image ? getSafeImageUrl(meta.cover_image, { width: 1400 }) : null;

  return (
    <header className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-[#111827]">
      <div className="relative h-32 overflow-hidden bg-slate-900 sm:h-40 lg:h-44">
        {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-indigo-950 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
      </div>
      <div className="relative px-4 pb-4 sm:px-6 sm:pb-5">
        <div className="flex items-end justify-between gap-3">
          <img
            src={getHiveAvatarUrl(account?.name || '', 'large')}
            alt={`${account?.name} avatar`}
            className="-mt-9 h-20 w-20 shrink-0 rounded-2xl border-4 border-white bg-slate-100 object-cover shadow-sm dark:border-[#111827] sm:-mt-11 sm:h-24 sm:w-24 sm:rounded-3xl"
          />
          <div className="flex flex-wrap justify-end gap-2 pt-3">
            {isOwner ? (
              <button type="button" onClick={onOpenCustomizer} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
                <Palette className="h-4 w-4 text-blue-500" /> Edit profile
              </button>
            ) : (
              <>
                <button type="button" onClick={onFollowToggle} aria-pressed={isFollowing} className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isFollowing ? 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                  {isFollowing ? <UserMinus className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
                {onMuteToggle && <button type="button" onClick={onMuteToggle} aria-label={isMuted ? 'Unmute account' : 'Mute account'} aria-pressed={isMuted} title={isMuted ? 'Unmute account' : 'Mute account'} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                  {isMuted ? <VolumeX className="h-4 w-4 text-rose-500" /> : <Volume2 className="h-4 w-4" />}
                </button>}
              </>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{meta.name || account?.name}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">@{account?.name}</p>
          </div>
          <dl className="flex flex-wrap gap-x-5 gap-y-2 text-xs sm:gap-x-6">
            {[{ label: 'Posts', value: postCount }, { label: 'Followers', value: followerCount }, { label: 'Following', value: followingCount }].map(stat => (
              <div key={stat.label} className="flex items-baseline gap-1.5 sm:flex-col sm:gap-0.5">
                <dd className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100 sm:text-lg">{stat.value.toLocaleString()}</dd>
                <dt className="text-slate-500 dark:text-slate-400">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </header>
  );
};

const ThemeSidebar: React.FC<ThemeProps> = ({ profile, account, votingPower, reputation, isOwner, onOpenCustomizer }) => {
  const meta = profile?.metadata?.profile || {};
  const [showDetails, setShowDetails] = useState(false);
  const rawWebsite = String(meta.website || '').trim();
  let website: URL | null = null;
  try {
    const candidate = new URL(/^https?:\/\//i.test(rawWebsite) ? rawWebsite : `https://${rawWebsite}`);
    if (rawWebsite && ['https:', 'http:'].includes(candidate.protocol) && !candidate.username && !candidate.password) website = candidate;
  } catch { /* Invalid profile URLs are displayed as text only. */ }

  return (
    <aside className="space-y-3 lg:sticky lg:top-20">
      <section aria-label="About this profile" className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-[#111827]">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">About</h2>
          <button type="button" aria-expanded={showDetails} aria-controls="profile-about-details" onClick={() => setShowDetails(!showDetails)} className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 lg:hidden">Details <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDetails ? 'rotate-180' : ''}`} /></button>
        </div>
        <p className="break-words text-sm leading-relaxed text-slate-600 dark:text-slate-300">{meta.about || 'No bio added yet.'}</p>
        <div id="profile-about-details" className={showDetails ? 'block' : 'hidden lg:block'}>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-3 border-t border-slate-100 pt-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300 lg:flex-col">
          {meta.location && <span className="flex min-w-0 items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="break-words min-w-0">{meta.location}</span></span>}
          {rawWebsite && (website ? <a href={website.href} target="_blank" rel="noopener noreferrer" title={website.href} className="group flex min-w-0 max-w-full items-center gap-2 rounded-md transition hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-blue-400">
            <LinkIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="truncate">{website.hostname.replace(/^www\./, '')}{website.pathname === '/' ? '' : website.pathname}</span><ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />
          </a> : <span className="break-all">{rawWebsite}</span>)}
          {account?.created && <span className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />Joined {formatDate(account.created)}</span>}
        </div>
        <details className="group mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded text-xs font-medium text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 [&::-webkit-details-marker]:hidden">
            Account details <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <dl className="mt-3 space-y-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex justify-between gap-2"><dt>Voting power</dt><dd className="font-semibold text-slate-700 dark:text-slate-200">{votingPower}%</dd></div>
            <div className="flex justify-between gap-2"><dt>Reputation</dt><dd className="font-semibold text-slate-700 dark:text-slate-200">{reputation}</dd></div>
          </dl>
        </details>
        </div>
      </section>
      {isOwner && <button type="button" onClick={onOpenCustomizer} className="group hidden w-full items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/50 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:bg-slate-800 lg:flex">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300"><Palette className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">Make it yours</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Explore profile templates</span></span>
        <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
      </button>}
    </aside>
  );
};

const ThemeFeed: React.FC<ThemeProps> = (props) => {
  const { 
    account, posts, comments, replies, mentions, activeTab, setActiveTab, onSelectPost, 
    onVote, onReblog, loadingMore, onLoadMore, onCommentReply, tabLoading, hasMore 
  } = props;

  const { openAuthorProfile } = useNavigation();

  const blogList = props.blog || props.blogPosts || posts;
  const displayPosts = 
    activeTab === 'comments' 
      ? comments 
      : activeTab === 'replies' 
      ? replies 
      : activeTab === 'posts' 
      ? posts 
      : activeTab === 'mentions'
      ? []
      : blogList;

  const mentionsList = mentions || [];

  // Inline Quick Reply state for Replies tab only
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [submittingReply, setSubmittingReply] = useState<Record<string, boolean>>({});
  const [replyFeedback, setReplyFeedback] = useState<Record<string, string>>({});

  const handleSendReply = async (post: HivePost) => {
    const text = replyTexts[post.permlink]?.trim();
    if (!text || !onCommentReply) return;

    setSubmittingReply(prev => ({ ...prev, [post.permlink]: true }));
    try {
      const success = await onCommentReply(post, text);
      if (success) {
        setReplyTexts(prev => ({ ...prev, [post.permlink]: '' }));
        setReplyFeedback(prev => ({ ...prev, [post.permlink]: 'Reply broadcasted to Hive!' }));
        setTimeout(() => {
          setReplyFeedback(prev => {
            const next = { ...prev };
            delete next[post.permlink];
            return next;
          });
        }, 4000);
      }
    } finally {
      setSubmittingReply(prev => ({ ...prev, [post.permlink]: false }));
    }
  };

  // Infinite Scroll Observer Sentinel with hasMore protection
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sentinelRef.current) return;
    if (hasMore === false) return; // Do not observe or re-trigger if end of feed reached!

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore) {
          onLoadMore();
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadingMore, onLoadMore, hasMore]);

  const showQuickReply = activeTab === 'replies';

  return (
    <div className="space-y-3 w-full min-w-0">
      {/* Tab Navigation with Icons */}
      <nav aria-label="Profile sections" key="feed-tabs" className="sticky top-[72px] z-20 flex w-full min-w-0 items-center gap-1 overflow-x-auto no-scrollbar rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-[#111827]/95">
        {[
          { id: 'blog', label: 'Blog', icon: Rss },
          { id: 'posts', label: 'Posts', icon: PenLine },
          { id: 'comments', label: 'Comments', icon: MessageSquare },
          { id: 'replies', label: 'Replies', icon: Undo2 },
          { id: 'mentions', label: 'Mentions', icon: AtSign }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button 
              key={tab.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => setActiveTab(tab.id as any)}
              className={`text-xs font-semibold transition-all relative min-h-10 flex-shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                isActive 
                ? 'bg-blue-50 text-blue-700 font-bold dark:bg-blue-950/60 dark:text-blue-300'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              <tab.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isActive ? 'text-blue-600 dark:text-blue-300' : 'text-gray-400 dark:text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Feed Content */}
      <div key="feed-content" className="space-y-3 w-full min-w-0">
        {tabLoading ? (
          <div className="space-y-4 w-full min-w-0">
            {[1, 2, 3].map((n) => (
              <div 
                key={n}
                className="bg-white dark:bg-[#161b2e] border border-gray-100 dark:border-slate-800/80 rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:gap-5 w-full min-w-0 animate-pulse"
              >
                <div className="w-full sm:w-48 md:w-56 h-40 sm:h-36 rounded-xl sm:rounded-2xl bg-slate-200 dark:bg-slate-800/70 shrink-0" />
                <div className="flex-1 min-w-0 flex flex-col justify-between py-1 space-y-3">
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                      <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                    </div>
                    <div className="h-5 w-4/5 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                    <div className="h-3.5 w-full bg-slate-200 dark:bg-slate-800 rounded-md" />
                    <div className="h-3.5 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-md" />
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-slate-800/60">
                    <div className="flex gap-2">
                      <div className="h-8 w-14 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                      <div className="h-8 w-14 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                      <div className="h-8 w-10 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                    </div>
                    <div className="h-8 w-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'mentions' ? (
          mentionsList.length === 0 ? (
            <div className="py-20 text-center bg-gray-50/50 dark:bg-[#161b2e] rounded-2xl sm:rounded-3xl border-2 border-dashed border-gray-100 dark:border-slate-800">
              <AtSign className="w-8 h-8 mx-auto mb-2 text-blue-500 opacity-60" />
              <p className="text-gray-500 dark:text-slate-400 font-black uppercase tracking-widest text-xs">
                No mentions found for @{account?.name} yet.
              </p>
            </div>
          ) : (
            mentionsList.map((note: any, index: number) => {
              const actorMatch = (note.msg || '').match(/@([a-z0-9.-]+)/i);
              const actor = actorMatch ? actorMatch[1] : '';
              const cleanMsg = (note.msg || '').replace(/<[^>]*>/g, '').trim();
              
              const urlMatch = (note.url || '').match(/@([a-z0-9.-]+)\/([a-z0-9-]+)/i);
              const postAuthor = urlMatch ? urlMatch[1] : actor;
              const postPermlink = urlMatch ? urlMatch[2] : '';

              return (
                <div 
                  key={note.id || `${note.date}-${index}`}
                  className="bg-white dark:bg-[#161b2e] border border-gray-100 dark:border-slate-800/80 rounded-2xl sm:rounded-3xl p-4 sm:p-5 hover:shadow-xl hover:shadow-blue-500/5 hover:border-blue-400/30 transition-all duration-300 w-full min-w-0 flex flex-col gap-3 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {actor ? (
                        <button
                          type="button"
                          onClick={() => openAuthorProfile(actor)}
                          className="flex items-center gap-2 group/actor cursor-pointer"
                        >
                          <img 
                            src={getHiveAvatarUrl(actor, 'small')} 
                            alt={actor}
                            className="w-6 h-6 rounded-full object-cover border border-gray-200 dark:border-slate-700 group-hover/actor:border-blue-500 transition-colors"
                          />
                          <span className="text-xs font-bold text-gray-800 dark:text-slate-200 group-hover/actor:text-blue-500 transition-colors">
                            @{actor}
                          </span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                          <AtSign className="w-4 h-4" />
                          <span>Mention</span>
                        </div>
                      )}
                      <span className="text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <AtSign className="w-3 h-3" />
                        <span>Mention</span>
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-gray-400 dark:text-slate-400">
                      {note.date ? new Date(note.date).toLocaleDateString() : ''}
                    </span>
                  </div>

                  <p className="text-sm text-gray-700 dark:text-slate-200 font-medium leading-relaxed">
                    {cleanMsg}
                  </p>

                  {postAuthor && postPermlink && (
                    <div className="pt-2 border-t border-gray-100 dark:border-slate-800/60 flex items-center justify-between">
                      <span className="text-xs text-gray-400 dark:text-slate-400 truncate max-w-[280px]">
                        {postPermlink}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectPost({
                            author: postAuthor,
                            permlink: postPermlink,
                            title: postPermlink,
                            body: '',
                            category: '',
                            created: note.date || new Date().toISOString(),
                            depth: 0,
                            children: 0,
                            net_rshares: 0,
                            is_paidout: false,
                            payout: 0,
                            pending_payout_value: '0.000 HBD',
                            author_reputation: 25,
                            post_id: 0,
                            json_metadata: ''
                          });
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                      >
                        <span>View Post</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : displayPosts.length === 0 ? (
          <div className="py-24 text-center bg-gray-50/50 dark:bg-[#161b2e] rounded-2xl sm:rounded-3xl border-2 border-dashed border-gray-100 dark:border-slate-800">
            <p className="text-gray-500 dark:text-slate-400 font-black uppercase tracking-widest text-xs">
              Nothing found here yet.
            </p>
          </div>
        ) : (
          displayPosts.map((post, index) => {
            const rawThumbnail = getPostThumbnail(post);
            const thumbnail = rawThumbnail ? getSafeImageUrl(rawThumbnail, { width: 600 }) : null;
            const snippet = getPostSnippet(post.body || '', 240);
            const isCommentOrReply = activeTab === 'comments' || activeTab === 'replies';
            const isScamAlertComment = isCommentOrReply && hasSuspiciousCommentLanguage(post.body || '')
              && hasScamCommentSignals(post.body || '', markdownToSafeHtml(post.body || ''));
            
            // Check if this post is a reblog
            const isReblog = Boolean(
              (post.reblogged_by && post.reblogged_by.length > 0) ||
              (account?.name && post.author.toLowerCase() !== account.name.toLowerCase() && (activeTab === 'blog' || activeTab === 'posts'))
            );
            
            return (
              <div 
                key={post.post_id || `${post.author}/${post.permlink}-${index}`} 
                className="group/card relative w-full min-w-0 bg-white dark:bg-[#161b2e] border border-gray-100/90 dark:border-slate-800/80 hover:border-blue-300/50 dark:hover:border-blue-500/40 rounded-2xl p-4 sm:p-5 transition-colors duration-200 hover:shadow-sm overflow-hidden"
              >
                {/* Subtle top hairline highlight on hover */}
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <div className="flex flex-col sm:flex-row gap-3.5 sm:gap-5 w-full min-w-0 items-start">
                  {!isCommentOrReply && thumbnail && (
                    <button type="button" onClick={() => onSelectPost(post)} aria-label={`Read ${post.title || 'post'}`} className="order-1 relative aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-slate-900 sm:order-2 sm:aspect-[4/3] sm:w-36 lg:w-44">
                      <img src={thumbnail} alt={post.title || 'Post thumbnail'} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover/card:scale-105" />
                    </button>
                  )}

                  <div className="order-2 flex-1 min-w-0 w-full flex flex-col justify-between self-stretch sm:order-1">
                    <div className="min-w-0 w-full flex flex-col justify-start">
                      {/* Parent Post Context for Comments/Replies */}
                      {isCommentOrReply && post.parent_author && (
                        <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-lg w-fit mb-2 font-bold shrink-0 border border-blue-100 dark:border-blue-900/40">
                          <span>In response to</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAuthorProfile(post.parent_author || '');
                            }}
                            className="font-black hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <img 
                              src={getHiveAvatarUrl(post.parent_author, 'small')} 
                              alt={post.parent_author} 
                              className="w-3.5 h-3.5 rounded-full inline-block object-cover border border-blue-200 dark:border-blue-800" 
                            />
                            <span>@{post.parent_author}</span>
                          </button>
                        </div>
                      )}

                      {/* Reblog Distinction Indicator */}
                      {isReblog && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-1 rounded-lg w-fit mb-2 shrink-0 border border-purple-200 dark:border-purple-800/60">
                          <Repeat className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Reblogged</span>
                          <span className="text-gray-300 dark:text-slate-600">•</span>
                          <span>Original by</span>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAuthorProfile(post.author);
                            }}
                            className="font-black text-purple-700 dark:text-purple-300 hover:underline cursor-pointer flex items-center gap-1 ml-0.5"
                          >
                            <img 
                              src={getHiveAvatarUrl(post.author, 'small')} 
                              alt={post.author} 
                              className="w-3.5 h-3.5 rounded-full inline-block object-cover border border-purple-300 dark:border-purple-700" 
                            />
                            <span>@{post.author}</span>
                          </button>
                        </div>
                      )}

                      {/* Metadata Header Row */}
                      <div className="flex items-center justify-between mb-1.5 shrink-0 min-w-0 gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                           <span className="text-[10px] font-black bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-0.5 rounded-md uppercase shrink-0 border border-blue-500/15">
                              {post.category || 'hive'}
                           </span>
                           <span className="text-[11px] font-medium text-gray-400 dark:text-slate-400 shrink-0">
                             {new Date(post.created).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                           </span>
                        </div>
                        
                        {/* Author Button */}
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAuthorProfile(post.author);
                          }}
                          className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shrink-0 cursor-pointer py-0.5 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
                          title={`View @${post.author}'s profile`}
                        >
                          <img 
                            src={getHiveAvatarUrl(post.author, 'small')} 
                            alt={post.author} 
                            className="w-4 h-4 rounded-full object-cover border border-gray-200 dark:border-slate-700" 
                          />
                          <span className="truncate">@{post.author}</span>
                        </button>
                      </div>

                      <button type="button" onClick={() => onSelectPost(post)} className="block w-full min-w-0 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label={post.title && !post.title.startsWith('RE:') ? `Read ${post.title}` : `Read comment by @${post.author}`}>
                        {post.title && !post.title.startsWith('RE:') && (
                          <h3 className="my-1 line-clamp-2 text-base font-bold leading-snug text-slate-900 transition-colors group-hover/card:text-blue-700 dark:text-white dark:group-hover/card:text-blue-300 sm:text-lg">{post.title}</h3>
                        )}
                        <p className={`mb-3 mt-1.5 min-w-0 break-words text-sm font-normal leading-relaxed ${isScamAlertComment ? 'text-rose-700 dark:text-rose-300' : 'text-slate-600 dark:text-slate-300'} ${isCommentOrReply ? 'line-clamp-4' : 'line-clamp-2'}`}>{snippet || post.body}</p>
                      </button>
                      {isScamAlertComment && <ScamAlertNotice />}
                    </div>

                    {/* Interactions Row - Anchored to bottom */}
                    <div className="mt-auto pt-2.5 sm:pt-3 border-t border-gray-100/90 dark:border-slate-800/70 flex items-center justify-between gap-2 flex-wrap shrink-0 w-full">
                       <div className="flex items-center gap-2 sm:gap-2.5">
                          <button 
                            onClick={(e) => { e.stopPropagation(); onVote?.(post, 10000); }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gray-50 dark:bg-slate-900/80 text-gray-600 dark:text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors font-bold text-xs shrink-0 cursor-pointer"
                            title="Upvote post"
                          >
                             <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />

                          </button>
                          <button 
                            onClick={() => onSelectPost(post)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gray-50 dark:bg-slate-900/80 text-gray-600 dark:text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors font-bold text-xs shrink-0 cursor-pointer"
                            title="Comments"
                          >
                             <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                             <span>{post.children}</span>
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); onReblog?.(post); }}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gray-50 dark:bg-slate-900/80 text-gray-600 dark:text-slate-300 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors font-bold text-xs shrink-0 cursor-pointer ${isReblog ? 'text-purple-500 bg-purple-50/50 dark:bg-purple-950/30' : ''}`}
                            title={isReblog ? 'Reblogged' : 'Reblog to your followers'}
                          >
                             <Repeat className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                       </div>

                    </div>

                    {/* Direct Quick Reply ONLY for Replies Tab */}
                    {showQuickReply && (
                      <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-800/80 w-full" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder={`Reply to @${post.author}...`}
                            value={replyTexts[post.permlink] || ''}
                            onChange={(e) => setReplyTexts(prev => ({ ...prev, [post.permlink]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendReply(post);
                              }
                            }}
                            className="flex-1 bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => handleSendReply(post)}
                            disabled={submittingReply[post.permlink] || !replyTexts[post.permlink]?.trim()}
                            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0 cursor-pointer"
                          >
                            {submittingReply[post.permlink] ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            <span>Reply</span>
                          </button>
                        </div>
                        {replyFeedback[post.permlink] && (
                          <p className="text-[10px] font-bold text-emerald-500 mt-1 animate-in fade-in">
                            {replyFeedback[post.permlink]}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Automatic Infinite Scroll Sentinel with hasMore protection */}
        {hasMore !== false && displayPosts.length > 0 && (
          <div ref={sentinelRef} className="py-8 flex justify-center items-center">
            {loadingMore ? (
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500 dark:text-slate-300">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span>Loading more posts...</span>
              </div>
            ) : (
              <div className="h-4" />
            )}
          </div>
        )}

        {hasMore === false && displayPosts.length > 0 && (
          <div className="py-8 text-center text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
            • All {activeTab} loaded •
          </div>
        )}
      </div>
    </div>
  );
};

const DefaultLayout: React.FC<ThemeProps> = (props) => (
  <div className="mx-auto w-full max-w-[1392px] space-y-4 py-4 sm:space-y-5 sm:py-5">
    <ThemeHeader {...props} />
    <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-5">
      <ThemeSidebar {...props} />
      <main className="min-w-0" aria-label="Profile activity">
        <ThemeFeed {...props} />
      </main>
    </div>
  </div>
);

export const defaultTheme: ProfileTheme = {
  id: 'clean-slate',
  name: 'Clean Slate (Default)',
  badge: '✨ Original',
  description: 'A modern, professional dashboard with clean lines and high density',
  previewColor: '#2563eb',
  light: {
    ...DEFAULT_PROFILE_STYLE,
    backgroundColor: '#f8fafc',
    cardBackgroundColor: '#ffffff',
    textColor: '#0f172a',
    textSecondaryColor: '#64748b',
    accentColor: '#3b82f6'
  },
  dark: {
    ...DEFAULT_PROFILE_STYLE,
    backgroundColor: '#0a0f1d',
    cardBackgroundColor: '#161b2e',
    headerBackgroundColor: '#0a0f1d',
    textColor: '#f8fafc',
    textSecondaryColor: '#94a3b8',
    accentColor: '#3b82f6'
  },
  Layout: DefaultLayout
};
