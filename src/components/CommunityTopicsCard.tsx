import React, { useMemo } from 'react';
import { Hash, X } from 'lucide-react';
import { HivePost } from '../services/hiveApi';
import { useNavigation } from '../context/NavigationContext';

interface CommunityTopicsCardProps {
  communityPosts: HivePost[];
  currentTag: string;
}

export const CommunityTopicsCard: React.FC<CommunityTopicsCardProps> = ({
  communityPosts,
  currentTag
}) => {
  const { communitySubTopic, setCommunitySubTopic } = useNavigation();
  // Extract and rank topics/hashtags from community posts
  const rankedTopics = useMemo(() => {
    const counts: Record<string, number> = {};

    communityPosts.forEach((post) => {
      let tags: string[] = [];

      if (typeof post.json_metadata === 'object' && post.json_metadata && Array.isArray((post.json_metadata as any).tags)) {
        tags = (post.json_metadata as any).tags;
      } else if (typeof post.json_metadata === 'string') {
        try {
          const parsed = JSON.parse(post.json_metadata);
          if (parsed && Array.isArray(parsed.tags)) {
            tags = parsed.tags;
          }
        } catch {}
      }

      tags.forEach((t) => {
        if (typeof t === 'string') {
          const clean = t.trim().toLowerCase().replace(/^#/, '');
          // Ignore the community name itself or generic hive tags
          if (
            clean &&
            clean !== currentTag.toLowerCase() &&
            !clean.startsWith('hive-') &&
            clean.length > 2 &&
            clean.length < 24
          ) {
            counts[clean] = (counts[clean] || 0) + 1;
          }
        }
      });
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, count]) => ({ name, count }));
  }, [communityPosts, currentTag]);

  if (rankedTopics.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none border border-gray-100/60 dark:border-slate-800 text-gray-900 dark:text-slate-100 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Hash className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">Community Topics</h3>
        </div>

        {communitySubTopic && (
          <button
            onClick={() => setCommunitySubTopic('')}
            className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
          >
            <X className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      <p className="text-[11px] text-gray-400 dark:text-slate-500">
        Filter discussions in this community by trending topic tags:
      </p>

      <div className="flex flex-wrap gap-1.5 pt-1">
        {rankedTopics.map(({ name, count }) => {
          const isSelected = communitySubTopic.toLowerCase() === name.toLowerCase();

          return (
            <button
              key={name}
              onClick={() => {
                if (isSelected) {
                  setCommunitySubTopic('');
                } else {
                  setCommunitySubTopic(name);
                }
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>#{name}</span>
              <span className={`text-[10px] ml-0.5 ${isSelected ? 'text-blue-100' : 'text-gray-400 dark:text-slate-500'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
