import React, { useState, useEffect } from 'react';
import {
  Bookmark,
  Sparkles,
  MessageSquare,
  Clock,
  ArrowUp,
  FileText,
  ChevronRight,
  User,
  Heart,
  ExternalLink
} from 'lucide-react';
import { HivePost, getSimilarPosts, getHiveAvatarUrl, getPostThumbnail } from '../services/hiveApi';
import { PostHeading } from '../utils/sanitize';

interface PostSidebarProps {
  post: HivePost;
  headings: PostHeading[];
  activeHeadingId?: string;
  onSelectHeading: (id: string) => void;
  onSelectPost: (post: HivePost) => void;
  onClose: () => void;
}

export const PostSidebar: React.FC<PostSidebarProps> = ({
  post,
  headings,
  activeHeadingId: externalActiveId,
  onSelectHeading,
  onSelectPost,
  onClose
}) => {
  const [internalActiveId, setInternalActiveId] = useState<string>('');
  const [similarPosts, setSimilarPosts] = useState<HivePost[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(true);

  const activeHeadingId = externalActiveId || internalActiveId;

  // Track active heading on scroll locally without re-rendering parent components
  useEffect(() => {
    if (headings.length === 0) return;

    const handleScroll = () => {
      const scrollPos = window.scrollY + 140;
      let currentId = headings[0]?.id;

      for (const h of headings) {
        const el = document.getElementById(h.id);
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY;
          if (top <= scrollPos) {
            currentId = h.id;
          } else {
            break;
          }
        }
      }

      if (currentId && currentId !== internalActiveId) {
        setInternalActiveId(currentId);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [headings, internalActiveId]);

  // Calculate estimated reading time and word count
  const wordCount = (post.body || '').trim().split(/\s+/).filter(Boolean).length;
  const readingTimeMinutes = Math.max(1, Math.round(wordCount / 200));

  useEffect(() => {
    const controller = new AbortController();
    setLoadingSimilar(true);

    getSimilarPosts(post.author, post.permlink, controller.signal)
      .then((data) => {
        setSimilarPosts(data || []);
      })
      .catch(() => {
        setSimilarPosts([]);
      })
      .finally(() => {
        setLoadingSimilar(false);
      });

    return () => {
      controller.abort();
    };
  }, [post.author, post.permlink]);

  return (
    <div className="space-y-4 text-left">
      {/* ================= TABLE OF CONTENTS / BOOKMARKER ================= */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none border border-gray-100/70 dark:border-slate-800">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-gray-800 dark:text-slate-200">
              Bookmarks / Outline
            </h3>
          </div>
          <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">
            {readingTimeMinutes} min read
          </span>
        </div>

        {headings.length > 0 ? (
          <nav className="space-y-1 max-h-[340px] overflow-y-auto pr-1 text-xs">
            {headings.map((h, idx) => {
              const isActive = activeHeadingId === h.id;
              const indentClass =
                h.level <= 1
                  ? 'font-bold text-gray-900 dark:text-slate-100'
                  : h.level === 2
                  ? 'pl-3 font-semibold text-gray-700 dark:text-slate-300'
                  : h.level === 3
                  ? 'pl-5 text-gray-600 dark:text-slate-400'
                  : 'pl-7 text-gray-500 dark:text-slate-400 text-[11px]';

              return (
                <button
                  key={`${h.id}-${idx}`}
                  type="button"
                  onClick={() => onSelectHeading(h.id)}
                  className={`w-full text-left py-1.5 px-2 rounded-xl transition flex items-start gap-1.5 cursor-pointer group ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold shadow-2xs'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-800/70 text-gray-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                  title={h.text}
                >
                  <ChevronRight
                    className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 transition ${
                      isActive ? 'text-blue-600 dark:text-blue-400 rotate-90' : 'text-gray-300 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400'
                    }`}
                  />
                  <span className={`line-clamp-2 leading-snug break-words ${indentClass}`}>
                    {h.text}
                  </span>
                </button>
              );
            })}
          </nav>
        ) : (
          <div className="py-2 space-y-3">
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
              This post has a continuous story format without section headings.
            </p>
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="bg-gray-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-transparent dark:border-slate-800">
                <span className="block font-bold text-gray-800 dark:text-slate-200">{wordCount}</span>
                <span className="text-[10px] text-gray-400 dark:text-slate-500">Words</span>
              </div>
              <div className="bg-gray-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-transparent dark:border-slate-800">
                <span className="block font-bold text-gray-800 dark:text-slate-200">~{readingTimeMinutes} min</span>
                <span className="text-[10px] text-gray-400 dark:text-slate-500">Read Time</span>
              </div>
            </div>
            <button
              onClick={() => {
                const commentBox = document.getElementById('comments-section');
                if (commentBox) {
                  commentBox.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="w-full py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Jump to Comments</span>
            </button>
          </div>
        )}
      </div>

      {/* ================= SIMILAR STORIES (HIVESENSE AI) ================= */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none border border-gray-100/70 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-gray-800 dark:text-slate-200">
              Similar Stories
            </h3>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
            HiveSense
          </span>
        </div>

        {loadingSimilar ? (
          <div className="space-y-3 py-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse space-y-1.5">
                <div className="h-3.5 bg-gray-200 dark:bg-slate-700 rounded w-5/6" />
                <div className="h-2.5 bg-gray-100 dark:bg-slate-800 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : similarPosts.length > 0 ? (
          <div className="space-y-3">
            {similarPosts.map((simPost) => {
              const thumb = getPostThumbnail(simPost);
              return (
                <div
                  key={`${simPost.author}/${simPost.permlink}`}
                  onClick={() => onSelectPost(simPost)}
                  className="group flex gap-2.5 items-start p-2 rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition cursor-pointer"
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={simPost.title}
                      loading="lazy"
                      className="w-12 h-12 rounded-xl object-cover flex-shrink-0 bg-gray-100 dark:bg-slate-800 border border-gray-200/60 dark:border-slate-700"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getHiveAvatarUrl(simPost.author, 'small');
                      }}
                    />
                  ) : (
                    <img
                      src={getHiveAvatarUrl(simPost.author, 'small')}
                      alt={simPost.author}
                      loading="lazy"
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0 bg-gray-100 dark:bg-slate-800"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-xs text-gray-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-2 leading-snug">
                      {simPost.title}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-400 dark:text-slate-500">
                      <span className="truncate">@{simPost.author}</span>
                      {simPost.category && (
                        <>
                          <span>•</span>
                          <span className="truncate text-blue-500 dark:text-blue-400 font-medium">#{simPost.category}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-400 dark:text-slate-500 italic py-1">
            No related stories found for this article.
          </p>
        )}
      </div>
    </div>
  );
};
