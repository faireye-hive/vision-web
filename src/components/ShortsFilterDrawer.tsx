import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldAlert,
  X,
  Plus,
  Hash,
  UserX,
  Sparkles,
  Trash2,
  Check,
  EyeOff,
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { getHiveAvatarUrl } from '../services/hiveApi';

interface ShortsFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  // Word filter props
  blockedWords: string[];
  onAddWord: (word: string) => void;
  onRemoveWord: (word: string) => void;
  onClearWords: () => void;
  // Author filter props
  blockedAuthors: string[];
  onAddAuthor: (author: string) => void;
  onRemoveAuthor: (author: string) => void;
  onClearAuthors: () => void;
  // Master toggle
  filterEnabled: boolean;
  onToggleFilter: () => void;
  // Hashtags frequency
  hashtags: { tag: string; count: number }[];
  selectedTag?: string;
  onSelectTag?: (tag: string) => void;
  // Stats
  hiddenCount?: number;
}

const COMMON_SPAM_PRESETS = [
  'airdrop',
  'giveaway',
  't.me/',
  'scrobblelife',
  'dashboard/games',
  'wordle',
  'hivegrove',
  'splinterlands',
  '#mydempire'
];

export const ShortsFilterDrawer: React.FC<ShortsFilterDrawerProps> = ({
  isOpen,
  onClose,
  blockedWords,
  onAddWord,
  onRemoveWord,
  onClearWords,
  blockedAuthors,
  onAddAuthor,
  onRemoveAuthor,
  onClearAuthors,
  filterEnabled,
  onToggleFilter,
  hashtags,
  selectedTag = '',
  onSelectTag,
  hiddenCount = 0
}) => {
  const [wordInput, setWordInput] = useState('');
  const [authorInput, setAuthorInput] = useState('');
  const [activeTab, setActiveTab] = useState<'hashtags' | 'words' | 'authors'>('hashtags');

  // Swipe-to-dismiss gesture handling
  const touchStartXRef = useRef<number>(0);
  const touchCurrentXRef = useRef<number>(0);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchCurrentXRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const deltaX = touchCurrentXRef.current - touchStartXRef.current;
    // Swiped to the right by more than 70px -> close drawer
    if (deltaX > 70) {
      onClose();
    }
  };

  const handleAddWordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = wordInput.trim().toLowerCase();
    if (!clean) return;
    onAddWord(clean);
    setWordInput('');
  };

  const handleAddAuthorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = authorInput.trim().toLowerCase().replace(/^@/, '');
    if (!clean) return;
    onAddAuthor(clean);
    setAuthorInput('');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200"
      aria-labelledby="shorts-filter-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div
          ref={drawerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="w-screen max-w-md bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-300"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div>
                <h2 id="shorts-filter-title" className="font-bold text-base text-slate-900 dark:text-white">
                  Shorts Filter
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Noise keywords, spam hashtags & muted authors
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleFilter}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  filterEnabled
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
                title={filterEnabled ? 'Disable noise filtering' : 'Enable noise filtering'}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    filterEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400 dark:bg-slate-600'
                  }`}
                />
                <span>{filterEnabled ? 'Active' : 'Paused'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Close filter drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Swipe Hint (Mobile) */}
          <div className="sm:hidden px-4 py-1.5 bg-slate-50 dark:bg-slate-850/60 text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
            <span>Swipe right or tap outside to close</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </div>

          {/* Filter Status Banner */}
          {filterEnabled && hiddenCount > 0 && (
            <div className="mx-4 mt-3 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <EyeOff className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <span className="font-semibold">
                  {hiddenCount} {hiddenCount === 1 ? 'short hidden' : 'shorts hidden'} by active filters
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200/60 dark:bg-amber-900/60 px-2 py-0.5 rounded-md">
                Active
              </span>
            </div>
          )}

          {/* Section Navigation Tabs */}
          <div className="px-4 pt-3 flex gap-1 border-b border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('hashtags')}
              className={`flex-1 py-2 text-xs font-bold transition rounded-t-xl border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'hashtags'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Top #Tags ({hashtags.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('words')}
              className={`flex-1 py-2 text-xs font-bold transition rounded-t-xl border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'words'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Noise Words ({blockedWords.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('authors')}
              className={`flex-1 py-2 text-xs font-bold transition rounded-t-xl border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'authors'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <UserX className="w-3.5 h-3.5" />
              <span>Authors ({blockedAuthors.length})</span>
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* ================= TAB 1: HASHTAGS FREQUENCY ================= */}
            {activeTab === 'hashtags' && (
              <div className="space-y-3">
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    <span>Spam Detection by Hashtag Frequency</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Tags with high occurrence in recent snaps are often automated spam or repetitive campaigns. Click <strong className="text-slate-700 dark:text-slate-200">+ Block</strong> to instantly silence them.
                  </p>
                </div>

                {hashtags.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
                    No hashtags detected in recent snaps yet.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {hashtags.map(({ tag, count }) => {
                      const formattedTag = `#${tag.toLowerCase()}`;
                      const isBlocked = blockedWords.some((w) => {
                        const cleanW = w.toLowerCase();
                        return cleanW === formattedTag || cleanW === tag.toLowerCase();
                      });
                      const isSelected = selectedTag.toLowerCase().replace(/^#/, '') === tag.toLowerCase();

                      return (
                        <div
                          key={tag}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                            isBlocked
                              ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200/60 dark:border-rose-900/40 text-rose-800 dark:text-rose-200'
                              : isSelected
                              ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-900/50 text-blue-800 dark:text-blue-200'
                              : 'bg-white dark:bg-slate-850 border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-slate-200'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (onSelectTag) {
                                onSelectTag(isSelected ? '' : tag);
                                onClose();
                              }
                            }}
                            className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer group"
                            title={`Filter feed by #${tag}`}
                          >
                            <Hash className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                            <span className="font-semibold text-xs truncate group-hover:text-blue-600 transition">
                              #{tag}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                              {count} {count === 1 ? 'snap' : 'snaps'}
                            </span>
                          </button>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isBlocked ? (
                              <button
                                type="button"
                                onClick={() => {
                                  onRemoveWord(formattedTag);
                                  onRemoveWord(tag.toLowerCase());
                                }}
                                className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/50 hover:bg-rose-200 dark:hover:bg-rose-800 text-rose-700 dark:text-rose-300 text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                                title="Unblock this hashtag"
                              >
                                <Check className="w-3 h-3" />
                                <span>Blocked</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onAddWord(formattedTag)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 dark:hover:text-rose-400 text-slate-600 dark:text-slate-300 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1"
                                title={`Add #${tag} to noise filter`}
                              >
                                <Plus className="w-3 h-3" />
                                <span>Block Tag</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ================= TAB 2: NOISE & BLOCKED WORDS ================= */}
            {activeTab === 'words' && (
              <div className="space-y-4">
                {/* Add Custom Word Form */}
                <form onSubmit={handleAddWordSubmit} className="space-y-2">
                  <label htmlFor="noise-word-input" className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Add Noise Word, Phrase, or #Tag
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="noise-word-input"
                      type="text"
                      value={wordInput}
                      onChange={(e) => setWordInput(e.target.value)}
                      placeholder="e.g. giveaway, #airdrop, t.me"
                      className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-850 transition"
                    />
                    <button
                      type="submit"
                      disabled={!wordInput.trim()}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </form>

                {/* Blocked Words Chips */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span>Active Blocked Terms ({blockedWords.length})</span>
                    {blockedWords.length > 0 && (
                      <button
                        type="button"
                        onClick={onClearWords}
                        className="text-[11px] font-normal text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear all</span>
                      </button>
                    )}
                  </div>

                  {blockedWords.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-center text-xs text-slate-400 dark:text-slate-500">
                      No words blocked yet. Snaps containing these terms will be hidden automatically.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1">
                      {blockedWords.map((word) => (
                        <span
                          key={word}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium transition group"
                        >
                          <span className="truncate max-w-[150px]">{word}</span>
                          <button
                            type="button"
                            onClick={() => onRemoveWord(word)}
                            className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                            title={`Remove "${word}"`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Common Presets */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-blue-500" />
                    <span>Quick noise presets:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_SPAM_PRESETS.map((preset) => {
                      const isAdded = blockedWords.some((w) => w.toLowerCase() === preset.toLowerCase());
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            if (!isAdded) onAddWord(preset);
                          }}
                          disabled={isAdded}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                            isAdded
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 opacity-60 cursor-default'
                              : 'bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:text-blue-600'
                          }`}
                        >
                          {isAdded && <Check className="w-3 h-3 text-emerald-600" />}
                          <span>{preset}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 3: HIDDEN AUTHORS ================= */}
            {activeTab === 'authors' && (
              <div className="space-y-4">
                {/* Add Author Form */}
                <form onSubmit={handleAddAuthorSubmit} className="space-y-2">
                  <label htmlFor="hide-author-input" className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Mute / Hide Author from Shorts
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">@</span>
                      <input
                        id="hide-author-input"
                        type="text"
                        value={authorInput}
                        onChange={(e) => setAuthorInput(e.target.value)}
                        placeholder="username"
                        className="w-full pl-7 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-850 transition"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!authorInput.trim()}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Hide</span>
                    </button>
                  </div>
                </form>

                {/* Hidden Authors List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span>Hidden Authors ({blockedAuthors.length})</span>
                    {blockedAuthors.length > 0 && (
                      <button
                        type="button"
                        onClick={onClearAuthors}
                        className="text-[11px] font-normal text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear all</span>
                      </button>
                    )}
                  </div>

                  {blockedAuthors.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-center text-xs text-slate-400 dark:text-slate-500">
                      No authors muted yet. Snaps published by added authors will be hidden from your stream.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto">
                      {blockedAuthors.map((author) => (
                        <div
                          key={author}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={getHiveAvatarUrl(author, 'small')}
                              alt={author}
                              className="w-7 h-7 rounded-full object-cover bg-slate-200 dark:bg-slate-700 flex-shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  'https://images.ecency.com/u/hive/avatar/small';
                              }}
                            />
                            <span className="font-semibold text-slate-900 dark:text-white truncate">
                              @{author}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => onRemoveAuthor(author)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                            title={`Unmute @${author}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              Preferences saved locally
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
