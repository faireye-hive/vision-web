import React, { useState } from 'react';
import {
  X,
  Plus,
  Shield,
  ShieldAlert,
  UserX,
  FileText,
  Trash2,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  Info
} from 'lucide-react';
import { getHiveAvatarUrl } from '../services/hiveApi';
import { RECOMMENDED_WORD_PRESETS } from '../utils/contentFilter';

export interface ContentFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  words: string[];
  authors: string[];
  enabled: boolean;
  onAddWord: (word: string) => void;
  onRemoveWord: (word: string) => void;
  onClearWords: () => void;
  onAddAuthor: (author: string) => void;
  onRemoveAuthor: (author: string) => void;
  onClearAuthors: () => void;
  onToggleEnabled: () => void;
  currentHiddenCount?: number;
}

export const ContentFilterModal: React.FC<ContentFilterModalProps> = ({
  isOpen,
  onClose,
  words,
  authors,
  enabled,
  onAddWord,
  onRemoveWord,
  onClearWords,
  onAddAuthor,
  onRemoveAuthor,
  onClearAuthors,
  onToggleEnabled,
  currentHiddenCount = 0
}) => {
  const [activeTab, setActiveTab] = useState<'words' | 'authors'>('words');
  const [wordInput, setWordInput] = useState('');
  const [authorInput, setAuthorInput] = useState('');
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  if (!isOpen) return null;

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

  const handleAddPreset = (preset: string) => {
    onAddWord(preset);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="content-filter-modal"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 w-full max-w-lg shadow-2xl border border-gray-100 dark:border-slate-800 space-y-5 animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 shadow-2xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-gray-900 dark:text-white leading-tight">
                Content & Spam Filters
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Saved in your local cache for Feed & Discover
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            title="Close modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Master Enabled / Disabled Toggle Banner */}
        <div className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
          enabled
            ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-200/80 dark:border-blue-900/60 text-blue-950 dark:text-blue-200'
            : 'bg-gray-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-2 h-2 rounded-full ${enabled ? 'bg-blue-600 animate-pulse' : 'bg-gray-400 dark:bg-slate-600'}`} />
            <div>
              <span className="font-bold text-xs block text-gray-900 dark:text-white">
                {enabled ? 'Content Filter is Active' : 'Content Filter is Paused'}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-slate-400">
                {enabled
                  ? `${currentHiddenCount} posts currently filtered from this view`
                  : 'Filters are paused. All posts are visible.'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleEnabled}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition shadow-2xs cursor-pointer flex items-center gap-1.5 ${
              enabled
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700'
            }`}
          >
            {enabled ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{enabled ? 'Enabled' : 'Disabled'}</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-1 bg-gray-100/90 dark:bg-slate-800/80 rounded-2xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('words')}
            className={`flex-1 py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'words'
                ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-2xs'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Blocked Words</span>
            <span className="ml-1 text-[11px] px-1.5 py-0.2 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 font-semibold">
              {words.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('authors')}
            className={`flex-1 py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'authors'
                ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-2xs'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <UserX className="w-3.5 h-3.5" />
            <span>Muted Authors</span>
            <span className="ml-1 text-[11px] px-1.5 py-0.2 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 font-semibold">
              {authors.length}
            </span>
          </button>
        </div>

        {/* Tab 1: Blocked Words */}
        {activeTab === 'words' && (
          <div className="space-y-4 overflow-y-auto pr-1 flex-1 min-h-[220px]">
            <div>
              <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed mb-3">
                Hide posts containing these words or phrases in their title, body, or tags.
              </p>

              <form onSubmit={handleAddWordSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={wordInput}
                  onChange={(e) => setWordInput(e.target.value)}
                  placeholder="Type word or phrase (e.g. giveaway, casino)..."
                  className="flex-1 min-w-0 px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-slate-800 rounded-2xl text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 border border-gray-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-850 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition shadow-2xs"
                />
                <button
                  type="submit"
                  disabled={!wordInput.trim()}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Word</span>
                </button>
              </form>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-slate-500 font-semibold">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Quick spam presets:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {RECOMMENDED_WORD_PRESETS.map((preset) => {
                  const isAdded = words.includes(preset.toLowerCase());
                  return (
                    <button
                      key={preset}
                      type="button"
                      disabled={isAdded}
                      onClick={() => handleAddPreset(preset)}
                      className={`text-[11px] px-2.5 py-1 rounded-xl transition cursor-pointer font-medium ${
                        isAdded
                          ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-600 cursor-default'
                          : 'bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 hover:text-blue-900 border border-blue-200/60 dark:border-blue-900/40'
                      }`}
                    >
                      {isAdded ? `✓ ${preset}` : `+ ${preset}`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Words Chips List */}
            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-slate-400">
                <span>Active Blocked Words ({words.length})</span>
                {words.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearWords}
                    className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 text-xs font-semibold hover:underline transition cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {words.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {words.map((w) => (
                    <span
                      key={w}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200/80 dark:hover:bg-slate-700/80 text-gray-800 dark:text-slate-200 text-xs font-medium transition shadow-2xs"
                    >
                      <span className="font-semibold text-gray-900 dark:text-white">{w}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveWord(w)}
                        className="text-gray-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer p-0.5"
                        title={`Remove "${w}"`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/40 text-center text-xs text-gray-400 dark:text-slate-500">
                  No blocked words yet. Add keywords above to filter unwanted topics.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Muted Authors */}
        {activeTab === 'authors' && (
          <div className="space-y-4 overflow-y-auto pr-1 flex-1 min-h-[220px]">
            <div>
              <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed mb-3">
                Completely hide posts authored by these Hive accounts across Feed and Discover.
              </p>

              <form onSubmit={handleAddAuthorSubmit} className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-xs font-bold">@</span>
                  <input
                    type="text"
                    value={authorInput}
                    onChange={(e) => setAuthorInput(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''))}
                    placeholder="username (e.g. spammer123)"
                    className="w-full pl-7 pr-3.5 py-2.5 text-xs bg-gray-50 dark:bg-slate-800 rounded-2xl text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 border border-gray-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-850 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition shadow-2xs font-medium"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!authorInput.trim()}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
                >
                  <UserX className="w-4 h-4" />
                  <span>Mute Author</span>
                </button>
              </form>
            </div>

            {/* Authors List */}
            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-slate-400">
                <span>Muted Authors ({authors.length})</span>
                {authors.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearAuthors}
                    className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 text-xs font-semibold hover:underline transition cursor-pointer"
                  >
                    Unmute All
                  </button>
                )}
              </div>

              {authors.length > 0 ? (
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                  {authors.map((author) => {
                    const avatar = getHiveAvatarUrl(author, 'small');
                    return (
                      <span
                        key={author}
                        className="inline-flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200/80 dark:hover:bg-slate-700/80 text-gray-800 dark:text-slate-200 text-xs font-medium transition shadow-2xs"
                      >
                        <img
                          src={avatar}
                          alt={author}
                          className="w-5 h-5 rounded-full object-cover bg-gray-300 dark:bg-slate-700 ring-1 ring-gray-300 dark:ring-slate-700"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/small';
                          }}
                        />
                        <span className="font-bold text-gray-900 dark:text-white">@{author}</span>
                        <button
                          type="button"
                          onClick={() => onRemoveAuthor(author)}
                          className="text-gray-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer p-0.5 ml-0.5"
                          title={`Unmute @${author}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/40 text-center text-xs text-gray-400 dark:text-slate-500">
                  No authors muted yet. Add spammers or unwanted accounts above.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-slate-500">
            <Info className="w-3.5 h-3.5 text-blue-500" />
            <span>Changes take effect immediately on your feed</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-2xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
