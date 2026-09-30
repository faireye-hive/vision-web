import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  Search,
  MessageSquare,
  Settings,
  Loader2
} from 'lucide-react';
import { getSmartTextColors } from '../features/profile/profileColorUtils';
import { getThemeById } from '../features/profile/themes';
import { getInitialTheme } from '../utils/theme';
import {
  HiveAccount,
  HivePost,
  HiveNotification,
  getAccount,
  getAccountPosts,
  getAccountMentions,
  getAccountHistory,
  getProfile,
  getDynamicGlobalProperties,
  getHiveAvatarUrl,
  getPostThumbnail,
  getPostSnippet,
  calculateReputation,
  calculateVotingPower
} from '../services/hiveApi';
import { extractPostTags, isNoiseTag, postCommunity } from '../utils/postTags';
import { findCategoryByTag } from '../data/categorySubtopics';
import { useAuth } from '../context/AuthContext';
import { KeychainService } from '../services/keychain';
import {
  ProfileCustomStyle,
  DEFAULT_PROFILE_STYLE,
  FONT_STACKS,
  BORDER_RADIUS_CLASSES,
  ProfileSectionId
} from '../features/profile/profileStyleTypes';
import {
  loadProfileStyle,
  saveProfileStyleToBlockchain,
  saveProfileStyleLocal,
  resetProfileStyleLocal
} from '../services/profileStyleService';
import { getProfileCache, setProfileCache } from '../services/profileCache';
import { ProfileHeaderSection } from '../features/profile/components/ProfileHeaderSection';
import { ProfileBioSection } from '../features/profile/components/ProfileBioSection';
import { ProfileStatsSection } from '../features/profile/components/ProfileStatsSection';
import { ProfileBadgesSection } from '../features/profile/components/ProfileBadgesSection';
import { ProfileFeedSection, ProfileTab } from '../features/profile/components/ProfileFeedSection';
import { ProfileCustomizerDrawer, ProfileMetadataForm } from '../features/profile/components/ProfileCustomizerDrawer';

interface ProfilePageProps {
  username: string;
  onClose: () => void;
  onSelectPost: (post: HivePost) => void;
  onOpenUser: (username: string) => void;
  onOpenCommunity?: (communityName: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  username,
  onClose,
  onSelectPost,
  onOpenUser,
  onOpenCommunity
}) => {
  const { 
    currentUser: authUser, 
    isFollowing, 
    refreshFollowing, 
    isMuted, 
    toggleMuteUser, 
    mutedUsersList 
  } = useAuth();
  const [currentUser, setCurrentUser] = useState(username.replace(/^@/, '').trim().toLowerCase());
  const [lookup, setLookup] = useState('');
  const [account, setAccount] = useState<HiveAccount | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [blogPosts, setBlogPosts] = useState<HivePost[]>([]);
  const [posts, setPosts] = useState<HivePost[]>([]);
  const [comments, setComments] = useState<HivePost[]>([]);
  const [replies, setReplies] = useState<HivePost[]>([]);
  const [mentions, setMentions] = useState<HiveNotification[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>('blog');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [loadingMentions, setLoadingMentions] = useState(false);
  const [hasMoreBlog, setHasMoreBlog] = useState(true);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [hasMoreComments, setHasMoreComments] = useState(true);
  const [hasMoreReplies, setHasMoreReplies] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentHasMore = useMemo(() => {
    if (activeTab === 'comments') return hasMoreComments;
    if (activeTab === 'replies') return hasMoreReplies;
    if (activeTab === 'posts') return hasMorePosts;
    if (activeTab === 'blog') return hasMoreBlog;
    return false;
  }, [activeTab, hasMoreComments, hasMoreReplies, hasMorePosts, hasMoreBlog]);

  // Profile Customizer State
  const [style, setStyle] = useState<ProfileCustomStyle>(DEFAULT_PROFILE_STYLE);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [isSavingStyle, setIsSavingStyle] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isOwner = Boolean(authUser?.username && authUser.username.toLowerCase() === currentUser);
  const isUserFollowing = isFollowing(currentUser);

  // Detect current app theme for dynamic profile adaptation
  const [appTheme, setAppTheme] = useState(getInitialTheme());

  useEffect(() => {
    // Listen for theme changes (e.g. from the customizer or top nav)
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark');
      setAppTheme(isDark ? 'dark' : 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Compute effective style by merging saved style with theme defaults
  const effectiveStyle = useMemo(() => {
    const theme = getThemeById(style.themeId);
    const themeModeStyle = appTheme === 'dark' ? theme.dark : theme.light;
    
    return {
      ...themeModeStyle,
      themeId: style.themeId,
      sectionsOrder: style.sectionsOrder || themeModeStyle.sectionsOrder,
      hiddenSections: style.hiddenSections || themeModeStyle.hiddenSections,
    };
  }, [style, appTheme]);

  useEffect(() => {
    setCurrentUser(username.replace(/^@/, '').trim().toLowerCase());
    setSelectedTag(null);
    setSelectedTopic(null);
    setActiveTab('blog');
  }, [username]);

  const handleTabChange = useCallback((tab: ProfileTab) => {
    setActiveTab(tab);
    // If switching to a tab that is empty, trigger loading immediately if not already loading
    if (tab === 'comments' && comments.length === 0 && !loadingComments) {
      setLoadingComments(true);
    } else if (tab === 'replies' && replies.length === 0 && !loadingReplies) {
      setLoadingReplies(true);
    } else if (tab === 'mentions' && mentions.length === 0 && !loadingMentions) {
      setLoadingMentions(true);
    }
  }, [comments.length, replies.length, mentions.length, loadingComments, loadingReplies, loadingMentions]);

  // Load custom profile style for the active user
  useEffect(() => {
    let active = true;
    loadProfileStyle(currentUser).then((loaded) => {
      if (active) setStyle(loaded);
    });
    return () => {
      active = false;
    };
  }, [currentUser]);

  // Load account data, blog, authored posts, and history with SWR caching
  useEffect(() => {
    let mounted = true;
    setError(null);
    setHasMoreBlog(true);
    setHasMorePosts(true);
    setHasMoreComments(true);
    setHasMoreReplies(true);

    // 1. Instant Cache Check (SWR - render instantly if previously visited)
    const cached = getProfileCache(currentUser);
    if (cached && cached.account) {
      setAccount(cached.account);
      setProfile(cached.profile);
      setBlogPosts(cached.blogPosts || []);
      setPosts(cached.posts || []);
      setComments(cached.comments || []);
      setReplies(cached.replies || []);
      setMentions(cached.mentions || []);
      setLoading(false);
    } else {
      setLoading(true);
      setBlogPosts([]);
      setPosts([]);
      setComments([]);
      setReplies([]);
      setMentions([]);
    }

    setLoadingComments(false);
    setLoadingReplies(false);
    setLoadingMentions(false);

    // 2. Background Revalidation (always fetch fresh blockchain data silently)
    Promise.all([
      getAccount(currentUser, true),
      getProfile(currentUser, true),
      getAccountPosts('blog', currentUser, 20, true),
      getAccountPosts('posts', currentUser, 20, true),
      getAccountHistory(currentUser, 25),
      getDynamicGlobalProperties()
    ])
      .then(([acc, prof, userBlog, userPosts, userHistory]) => {
        if (!mounted) return;
        if (!acc) {
          if (!cached?.account) {
            setError(`@${currentUser} was not found on Hive.`);
            setAccount(null);
          }
        } else {
          setAccount(acc);
          setProfile(prof);
          
          // Deduplicate blog posts
          const seenBlog = new Set<string>();
          const uniqueBlog = (userBlog || []).filter(p => {
            const key = `${p.author}/${p.permlink}`;
            if (seenBlog.has(key)) return false;
            seenBlog.add(key);
            return true;
          });
          setBlogPosts(uniqueBlog);

          // Deduplicate authored posts
          const seenPosts = new Set<string>();
          const uniquePosts = (userPosts || []).filter(p => {
            const key = `${p.author}/${p.permlink}`;
            if (seenPosts.has(key)) return false;
            seenPosts.add(key);
            return true;
          });
          setPosts(uniquePosts);

          setHistory((userHistory || []).slice().reverse());

          // Save fresh snapshot to SWR cache
          setProfileCache(currentUser, {
            account: acc,
            profile: prof,
            blogPosts: uniqueBlog,
            posts: uniquePosts
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        if (!cached?.account) {
          setError(err?.message || 'Could not load this profile.');
        }
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [currentUser]);

  useEffect(() => {
    if (activeTab !== 'posts' || posts.length > 0) return;
    let mounted = true;
    getAccountPosts('posts', currentUser, 20)
      .then((items) => {
        if (mounted) {
          const seen = new Set<string>();
          const unique = (items || []).filter(p => {
            const key = `${p.author}/${p.permlink}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setPosts(unique);
          setProfileCache(currentUser, { posts: unique });
          if (unique.length < 15) setHasMorePosts(false);
        }
      })
      .catch(() => {
        if (mounted) setPosts([]);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, posts.length, currentUser]);

  useEffect(() => {
    if (activeTab !== 'blog' || blogPosts.length > 0) return;
    let mounted = true;
    getAccountPosts('blog', currentUser, 20)
      .then((items) => {
        if (mounted) {
          const seen = new Set<string>();
          const unique = (items || []).filter(p => {
            const key = `${p.author}/${p.permlink}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setBlogPosts(unique);
          setProfileCache(currentUser, { blogPosts: unique });
          if (unique.length < 15) setHasMoreBlog(false);
        }
      })
      .catch(() => {
        if (mounted) setBlogPosts([]);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, blogPosts.length, currentUser]);

  useEffect(() => {
    if (activeTab !== 'comments') return;
    if (comments.length > 0) return;

    // Check SWR cache first for instant render
    const cached = getProfileCache(currentUser);
    if (cached && cached.comments && cached.comments.length > 0) {
      setComments(cached.comments);
      setLoadingComments(false);
    } else {
      setLoadingComments(true);
    }

    let mounted = true;
    getAccountPosts('comments', currentUser, 20, true)
      .then((items) => {
        if (mounted) {
          const seen = new Set<string>();
          const unique = (items || []).filter(p => {
            const key = `${p.author}/${p.permlink}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setComments(unique);
          setProfileCache(currentUser, { comments: unique });
          if (unique.length < 15) setHasMoreComments(false);
        }
      })
      .catch(() => {
        if (mounted && comments.length === 0) setComments([]);
      })
      .finally(() => {
        if (mounted) setLoadingComments(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, currentUser]);

  useEffect(() => {
    if (activeTab !== 'replies') return;
    if (replies.length > 0) return;

    // Check SWR cache first for instant render
    const cached = getProfileCache(currentUser);
    if (cached && cached.replies && cached.replies.length > 0) {
      setReplies(cached.replies);
      setLoadingReplies(false);
    } else {
      setLoadingReplies(true);
    }

    let mounted = true;
    getAccountPosts('replies', currentUser, 20, true)
      .then((items) => {
        if (mounted) {
          const seen = new Set<string>();
          const unique = (items || []).filter(p => {
            const key = `${p.author}/${p.permlink}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setReplies(unique);
          setProfileCache(currentUser, { replies: unique });
          if (unique.length < 15) setHasMoreReplies(false);
        }
      })
      .catch(() => {
        if (mounted && replies.length === 0) setReplies([]);
      })
      .finally(() => {
        if (mounted) setLoadingReplies(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, currentUser]);

  useEffect(() => {
    if (activeTab !== 'mentions') return;
    if (mentions.length > 0) return;

    // Check SWR cache first for instant render
    const cached = getProfileCache(currentUser);
    if (cached && cached.mentions && cached.mentions.length > 0) {
      setMentions(cached.mentions);
      setLoadingMentions(false);
    } else {
      setLoadingMentions(true);
    }

    let mounted = true;
    getAccountMentions(currentUser, 40)
      .then((items) => {
        if (mounted) {
          setMentions(items || []);
          setProfileCache(currentUser, { mentions: items || [] });
        }
      })
      .catch(() => {
        if (mounted && mentions.length === 0) setMentions([]);
      })
      .finally(() => {
        if (mounted) setLoadingMentions(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, currentUser]);

  const tagStats = useMemo(() => {
    const counts = new Map<string, number>();
    const allPosts = [...blogPosts, ...posts];
    allPosts.forEach((post) => {
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
  }, [blogPosts, posts]);

  const communities = useMemo(() => {
    const groups = new Map<string, { name: string; title: string; count: number }>();
    const allPosts = [...blogPosts, ...posts];
    allPosts.forEach((post) => {
      const community = postCommunity(post);
      if (!community) return;
      const current = groups.get(community.name) || { ...community, count: 0 };
      current.count += 1;
      if (community.title !== community.name) current.title = community.title;
      groups.set(community.name, current);
    });
    return [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 6);
  }, [blogPosts, posts]);

  const visibleBlogPosts = useMemo(() => {
    return blogPosts.filter((post) => {
      if (mutedUsersList.includes(post.author.toLowerCase())) return false;
      const tags = extractPostTags(post);
      if (selectedTag && !tags.includes(selectedTag)) return false;
      if (selectedTopic) {
        const matchesTopic = tags.some((tag) => findCategoryByTag(tag)?.tag === selectedTopic);
        if (!matchesTopic) return false;
      }
      return true;
    });
  }, [blogPosts, selectedTag, selectedTopic, mutedUsersList]);

  const visiblePosts = useMemo(() => {
    return posts.filter((post) => {
      if (mutedUsersList.includes(post.author.toLowerCase())) return false;
      const tags = extractPostTags(post);
      if (selectedTag && !tags.includes(selectedTag)) return false;
      if (selectedTopic) {
        const matchesTopic = tags.some((tag) => findCategoryByTag(tag)?.tag === selectedTopic);
        if (!matchesTopic) return false;
      }
      return true;
    });
  }, [posts, selectedTag, selectedTopic, mutedUsersList]);

  const visibleComments = useMemo(() => {
    return comments.filter((c) => !mutedUsersList.includes(c.author.toLowerCase()));
  }, [comments, mutedUsersList]);

  const visibleReplies = useMemo(() => {
    return replies.filter((r) => !mutedUsersList.includes(r.author.toLowerCase()));
  }, [replies, mutedUsersList]);

  const visibleMentions = useMemo(() => {
    return mentions.filter((m) => {
      const actor = (m.msg || '').match(/@([a-z0-9.-]+)/i)?.[1]?.toLowerCase();
      return !actor || !mutedUsersList.includes(actor);
    });
  }, [mentions, mutedUsersList]);

  const isTabLoading = useMemo(() => {
    if (activeTab === 'comments') return loadingComments || (comments.length === 0 && hasMoreComments);
    if (activeTab === 'replies') return loadingReplies || (replies.length === 0 && hasMoreReplies);
    if (activeTab === 'mentions') return loadingMentions;
    return false;
  }, [activeTab, loadingComments, loadingReplies, loadingMentions, comments.length, replies.length, hasMoreComments, hasMoreReplies]);

  const lookupUser = (event: React.FormEvent) => {
    event.preventDefault();
    const clean = lookup.replace(/^@/, '').trim().toLowerCase();
    if (!clean) return;
    onOpenUser(clean);
    setLookup('');
  };

  const loadMore = async () => {
    let list: HivePost[] = [];
    let sort: 'blog' | 'posts' | 'comments' | 'replies' = 'blog';
    if (activeTab === 'comments') {
      list = comments;
      sort = 'comments';
    } else if (activeTab === 'replies') {
      list = replies;
      sort = 'replies';
    } else if (activeTab === 'posts') {
      list = posts;
      sort = 'posts';
    } else {
      list = blogPosts;
      sort = 'blog';
    }

    if (loadingMore || list.length === 0 || !currentHasMore) return;
    const last = list[list.length - 1];
    setLoadingMore(true);
    try {
      const more = await getAccountPosts(sort, currentUser, 20, true, last.author, last.permlink);
      const existingKeys = new Set(list.map(p => `${p.author}/${p.permlink}`));
      const fresh = (more || []).filter((post) => {
        const key = `${post.author}/${post.permlink}`;
        if (existingKeys.has(key)) return false;
        existingKeys.add(key);
        return true;
      });

      if (fresh.length === 0 || (more || []).length < 15) {
        if (activeTab === 'comments') setHasMoreComments(false);
        else if (activeTab === 'replies') setHasMoreReplies(false);
        else if (activeTab === 'posts') setHasMorePosts(false);
        else setHasMoreBlog(false);
      }

      if (fresh.length > 0) {
        if (activeTab === 'comments') {
          setComments((prev) => {
            const next = [...prev, ...fresh];
            setProfileCache(currentUser, { comments: next });
            return next;
          });
        } else if (activeTab === 'replies') {
          setReplies((prev) => {
            const next = [...prev, ...fresh];
            setProfileCache(currentUser, { replies: next });
            return next;
          });
        } else if (activeTab === 'posts') {
          setPosts((prev) => {
            const next = [...prev, ...fresh];
            setProfileCache(currentUser, { posts: next });
            return next;
          });
        } else {
          setBlogPosts((prev) => {
            const next = [...prev, ...fresh];
            setProfileCache(currentUser, { blogPosts: next });
            return next;
          });
        }
      }
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

  const isUserMuted = isMuted(currentUser);

  const handleFollowToggle = async () => {
    if (!authUser) {
      window.dispatchEvent(new CustomEvent('nebulosa:open-login'));
      return;
    }
    const nextFollow = !isUserFollowing;
    const res = await KeychainService.followUser(authUser.username, currentUser, nextFollow);
    if (res.success) {
      refreshFollowing();
    }
  };

  const handleMuteToggle = async () => {
    if (!authUser) {
      window.dispatchEvent(new CustomEvent('nebulosa:open-login'));
      return;
    }
    const err = await toggleMuteUser(currentUser);
    if (err) {
      alert(err);
    }
  };

  const handleCommentReply = async (post: HivePost, body: string): Promise<boolean> => {
    if (!authUser) {
      window.dispatchEvent(new CustomEvent('nebulosa:open-login'));
      return false;
    }
    if (!body.trim()) return false;
    const res = await KeychainService.postComment(authUser.username, post.author, post.permlink, body.trim());
    if (res.success) {
      setTimeout(() => {
        getAccountPosts('replies', currentUser, 20, true).then((items) => {
          if (items) setReplies(items);
        }).catch(() => {});
      }, 2500);
      return true;
    } else {
      alert(res.message || 'Error broadcasting reply to Hive.');
      return false;
    }
  };

  const handleSaveToBlockchain = async (profileData?: ProfileMetadataForm) => {
    if (!authUser || !isOwner) return;
    setIsSavingStyle(true);
    setSaveMessage(null);
    try {
      let profileSuccess = true;
      let profileMsg = '';

      if (profileData) {
        const resProfile = await KeychainService.updateProfile(authUser.username, {
          ...profileData,
          theme_id: style.themeId
        });
        profileSuccess = resProfile.success;
        profileMsg = resProfile.message || '';

        setAccount((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            posting_json_metadata: JSON.stringify({
              profile: {
                ...profileData,
                theme_id: style.themeId,
                version: 2
              }
            })
          };
        });

        setProfile((prev: any) => ({
          ...prev,
          metadata: {
            ...(prev?.metadata || {}),
            profile: {
              ...(prev?.metadata?.profile || {}),
              ...profileData,
              theme_id: style.themeId
            }
          }
        }));
      }

      const resStyle = await saveProfileStyleToBlockchain(authUser.username, style);

      setIsSavingStyle(false);
      const overallSuccess = profileSuccess || resStyle.success;
      setSaveMessage({
        type: overallSuccess ? 'success' : 'error',
        text: overallSuccess
          ? 'Profile & theme published to Hive!'
          : (profileMsg || resStyle.message || 'Failed to publish to Hive.')
      });
      if (overallSuccess) {
        setTimeout(() => setSaveMessage(null), 4000);
      }
    } catch (err: any) {
      setIsSavingStyle(false);
      setSaveMessage({ type: 'error', text: err?.message || 'Error saving profile.' });
    }
  };

  const handleSaveLocalDraft = (profileData?: ProfileMetadataForm) => {
    if (!authUser || !isOwner) return;
    saveProfileStyleLocal(authUser.username, style);
    if (profileData) {
      setProfile((prev: any) => ({
        ...prev,
        metadata: {
          ...(prev?.metadata || {}),
          profile: {
            ...(prev?.metadata?.profile || {}),
            ...profileData,
            theme_id: style.themeId
          }
        }
      }));
    }
    setSaveMessage({
      type: 'success',
      text: 'Saved in local cache!'
    });
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleResetToDefault = () => {
    const def = resetProfileStyleLocal(currentUser);
    setStyle(def);
  };

  const handleVote = async (post: HivePost, weight: number) => {
    if (!authUser) {
      window.dispatchEvent(new CustomEvent('nebulosa:open-login'));
      return;
    }
    const res = await KeychainService.vote(authUser.username, post.author, post.permlink, weight);
    if (!res.success) {
      alert(res.message || 'Error voting');
    }
  };

  const handleReblog = async (post: HivePost) => {
    if (!authUser) {
      window.dispatchEvent(new CustomEvent('nebulosa:open-login'));
      return;
    }
    const confirmed = window.confirm(`Reblog post by @${post.author} to your followers?`);
    if (!confirmed) return;
    const res = await KeychainService.reblog(authUser.username, post.author, post.permlink);
    if (res.success) {
      alert('Post reblogged successfully!');
    } else {
      alert(res.message || 'Error reblogging');
    }
  };

  // Modular Section Renderer (Legacy - themes now build their own)
  const renderSection = useCallback(
    (secId: ProfileSectionId) => {
      // This is kept for backward compatibility if any theme still uses it
      // but new themes should build their own HTML
      return null;
    },
    []
  );

  const smartPageColors = getSmartTextColors(effectiveStyle.textColor, effectiveStyle.textSecondaryColor, effectiveStyle.backgroundColor);

  return (
    <div
      id="profile-page-container"
      className="relative min-h-screen transition-colors duration-200"
      style={
        {
          fontFamily: FONT_STACKS[effectiveStyle.fontFamily as keyof typeof FONT_STACKS] || undefined,
          '--profile-accent': effectiveStyle.accentColor,
          '--profile-bg': effectiveStyle.backgroundColor || undefined,
          '--profile-card-bg': effectiveStyle.cardBackgroundColor || undefined,
          '--profile-header-bg': effectiveStyle.headerBackgroundColor || undefined,
          '--profile-text': smartPageColors.textColor || undefined,
          '--profile-text-muted': smartPageColors.textSecondaryColor || undefined,
          backgroundColor: effectiveStyle.backgroundColor || undefined,
          color: smartPageColors.textColor || undefined
        } as React.CSSProperties
      }
    >
      {/* Solid Background Color Layer if defined */}
      {effectiveStyle.backgroundColor && (
        <div
          className="fixed inset-0 pointer-events-none z-0 transition-colors duration-300"
          style={{ backgroundColor: effectiveStyle.backgroundColor }}
        />
      )}

      {/* Isolated Wallpaper Background Layer for Profile */}
      {effectiveStyle.backgroundUrl && (
        <div
          className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center transition-all duration-300"
          style={{
            backgroundImage: `url(${effectiveStyle.backgroundUrl})`,
            filter: (effectiveStyle.backgroundBlur > 0 && !isCustomizerOpen) ? `blur(${effectiveStyle.backgroundBlur}px)` : undefined,
            transform: (effectiveStyle.backgroundBlur > 0 && !isCustomizerOpen) ? 'scale(1.05)' : undefined
          }}
        >
          <div
            className="absolute inset-0 bg-black transition-opacity duration-300"
            style={{ opacity: effectiveStyle.backgroundOverlayOpacity / 100 }}
          />
        </div>
      )}

      <div className="relative z-10 max-w-full mx-auto px-2 sm:px-6 pb-16 animate-in fade-in duration-150">


        {/* Loading and Error States */}
        {loading ? (
          <div className="w-full max-w-full space-y-6 animate-pulse">
            {/* Cover Skeleton */}
            <div 
              className="w-full bg-slate-200 dark:bg-slate-800/80 min-h-[200px] sm:min-h-[220px] relative overflow-hidden shadow-sm"
              style={{ borderRadius: '15px' }}
            >
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 dark:via-white/5 to-transparent" />
              <div className="absolute bottom-4 left-4 sm:left-6 right-4 sm:right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="flex items-end gap-3.5 sm:gap-5">
                  <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full border-4 border-white dark:border-slate-900 bg-slate-300 dark:bg-slate-700 shrink-0 shadow-lg" />
                  <div className="space-y-2 mb-1">
                    <div className="h-6 sm:h-7 w-36 sm:w-48 bg-slate-300 dark:bg-slate-700 rounded-lg" />
                    <div className="h-4 w-24 sm:w-32 bg-slate-300/80 dark:bg-slate-700/70 rounded-md" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="h-9 w-24 bg-slate-300 dark:bg-slate-700 rounded-xl" />
                </div>
              </div>
            </div>

            {/* Grid Layout: Sidebar & Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-12 items-start">
              {/* Sidebar Skeleton */}
              <div className="space-y-6 pt-4 sm:pt-6">
                <div className="bg-white dark:bg-[#161b2e] border border-gray-100 dark:border-slate-800/80 rounded-[15px] p-6 space-y-4">
                  <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded-md" />
                  <div className="space-y-2">
                    <div className="h-3.5 w-full bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-3.5 w-5/6 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-3.5 w-3/4 bg-slate-200 dark:bg-slate-800 rounded" />
                  </div>
                  <div className="pt-3 border-t border-gray-100 dark:border-slate-800/60 flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800" />
                    <div className="h-3.5 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="bg-white dark:bg-[#161b2e] border border-gray-100 dark:border-slate-800/80 rounded-2xl p-4 text-center space-y-2">
                      <div className="w-4 h-4 mx-auto rounded-full bg-slate-200 dark:bg-slate-800" />
                      <div className="h-5 w-10 mx-auto bg-slate-200 dark:bg-slate-800 rounded" />
                      <div className="h-2.5 w-12 mx-auto bg-slate-200 dark:bg-slate-800 rounded" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Feed Skeleton */}
              <div className="space-y-5 pt-4 sm:pt-6">
                <div className="flex gap-4 border-b border-gray-100 dark:border-slate-800 pb-3">
                  {[1, 2, 3, 4, 5].map((tab) => (
                    <div key={tab} className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-md" />
                  ))}
                </div>

                {[1, 2, 3].map((card) => (
                  <div
                    key={card}
                    className="bg-white dark:bg-[#161b2e] border border-gray-100 dark:border-slate-800/80 rounded-[15px] p-4 flex flex-col sm:flex-row gap-4 h-auto sm:h-[180px] w-full max-w-[894px]"
                  >
                    <div className="w-full sm:w-[262px] h-36 sm:h-full bg-slate-200 dark:bg-slate-800/70 rounded-[15px] shrink-0" />
                    <div className="flex-1 flex flex-col justify-between py-1 space-y-2">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
                          <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded-full" />
                        </div>
                        <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-md" />
                        <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded" />
                        <div className="h-3 w-4/5 bg-slate-200 dark:bg-slate-800 rounded" />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <div className="h-7 w-12 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                        <div className="h-7 w-12 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                        <div className="h-7 w-12 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-rose-100 dark:border-rose-950/50 rounded-3xl p-12 text-center space-y-3 shadow-xs">
            <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{error}</p>
            <button
              type="button"
              onClick={() => onOpenUser('ecency')}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              Try opening @ecency
            </button>
          </div>
        ) : account && (
          <>
            {(() => {
              const theme = getThemeById(style.themeId);
              const ThemeLayout = theme.Layout;
              
              // Pre-calculate stats for the theme
              const reputation = account ? calculateReputation(account.reputation) : 25;
              const votingPower = account ? calculateVotingPower(account.voting_power, account.last_vote_time) : 100;
              const followerCount = profile?.stats?.followers || 0;
              const followingCount = profile?.stats?.following || 0;
              const postCount = profile?.stats?.post_count || account?.post_count || 0;

              return (
                <ThemeLayout
                  account={account}
                  profile={profile}
                  blog={visibleBlogPosts}
                  blogPosts={visibleBlogPosts}
                  posts={visiblePosts}
                  comments={visibleComments}
                  replies={visibleReplies}
                  mentions={visibleMentions}
                  history={history}
                  reputation={reputation}
                  votingPower={votingPower}
                  followerCount={followerCount}
                  followingCount={followingCount}
                  postCount={postCount}
                  isOwner={isOwner}
                  isFollowing={isUserFollowing}
                  onFollowToggle={handleFollowToggle}
                  isMuted={isUserMuted}
                  onMuteToggle={handleMuteToggle}
                  onCommentReply={handleCommentReply}
                  onVote={handleVote}
                  onReblog={handleReblog}
                  onOpenCustomizer={() => setIsCustomizerOpen(true)}
                  onSelectPost={onSelectPost}
                  onOpenUser={onOpenUser}
                  onOpenCommunity={onOpenCommunity}
                  activeTab={activeTab}
                  setActiveTab={handleTabChange}
                  loadingMore={loadingMore}
                  onLoadMore={loadMore}
                  hasMore={currentHasMore}
                  tabLoading={isTabLoading}
                />
              );
            })()}
          </>
        )}
      </div>

      {/* In-Place Profile Customizer Drawer */}
      <ProfileCustomizerDrawer
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        style={style}
        onChange={setStyle}
        initialProfile={{
          name: metaProfile.name || '',
          about: metaProfile.about || '',
          profile_image: metaProfile.profile_image || '',
          cover_image: metaProfile.cover_image || '',
          website: metaProfile.website || '',
          location: metaProfile.location || ''
        }}
        onSaveToBlockchain={handleSaveToBlockchain}
        onSaveLocalDraft={handleSaveLocalDraft}
        isSaving={isSavingStyle}
        saveMessage={saveMessage}
      />
    </div>
  );
};