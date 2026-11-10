import React, { useMemo } from 'react';
import { Hash, X } from 'lucide-react';
import { HivePost } from '../services/hiveApi';
import { useNavigation } from '../context/NavigationContext';
import { useCommunityFeatures } from '../hooks/useCommunityFeatures';

interface CommunityTopicsCardProps {
  communityPosts: HivePost[];
  currentTag: string;
}

export const CommunityTopicsCard: React.FC<CommunityTopicsCardProps> = ({
  communityPosts,
  currentTag
}) => {
  const { communitySubTopic, setCommunitySubTopic } = useNavigation();
  const { data } = useCommunityFeatures(currentTag.startsWith('hive-') ? currentTag : '');
  // Extract topics from loaded community posts. Frequency is used only to order
  // discovery chips; no post or engagement counts are shown in the interface.
  const rankedTopics = useMemo(() => {
    if (data?.configured) return [...new Set([...data.settings.categories.map(item => item.id), ...data.settings.subtags])].map(name => ({ name, count: 0 }));
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
  }, [communityPosts, currentTag, data]);

  return (
    <div className="w-full rounded-2xl border border-slate-200/70 bg-white p-3 text-gray-900 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-slate-100 p-1.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Hash className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Topics in this feed</h3>
        </div>

        {communitySubTopic && (
          <button
            onClick={() => setCommunitySubTopic('')}
            className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            <X className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
        Filter community posts by topic.
      </p>

      {rankedTopics.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
        {rankedTopics.map(({ name }) => {
          const isSelected = communitySubTopic.toLowerCase() === name.toLowerCase();

          return (
            <button
              key={name}
              aria-pressed={isSelected}
              onClick={() => {
                if (isSelected) {
                  setCommunitySubTopic('');
                } else {
                  setCommunitySubTopic(name);
                }
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                isSelected
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <span>#{data?.settings.categories.find(item => item.id === name)?.label || name}</span>
            </button>
          );
        })}
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          Topics will appear here as community posts load.
        </p>
      )}
    </div>
  );
};
