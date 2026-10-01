import React, { useState } from 'react';
import {
  ShieldAlert,
  Plus,
  X,
  EyeOff,
  Sparkles,
  RotateCcw,
  Check
} from 'lucide-react';

interface ShortsWordFilterCardProps {
  blockedWords: string[];
  onAddWord: (word: string) => void;
  onRemoveWord: (word: string) => void;
  onClearAll: () => void;
  filterEnabled: boolean;
  onToggleFilter: () => void;
  hiddenCount?: number;
}

const COMMON_SPAM_PRESETS = ['airdrop', 'giveaway', 't.me/', 'scrobblelife', 'dashboard/games', 'wordle', 'hivegrove', '#mydempire'];

export const ShortsWordFilterCard: React.FC<ShortsWordFilterCardProps> = ({
  blockedWords,
  onAddWord,
  onRemoveWord,
  onClearAll,
  filterEnabled,
  onToggleFilter,
  hiddenCount = 0
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputValue.trim().toLowerCase();
    if (!clean) return;
    onAddWord(clean);
    setInputValue('');
  };

  const handleAddPreset = (word: string) => {
    onAddWord(word.toLowerCase());
  };

  return (
    <div
      id="shorts-word-filter-card"
      className="bg-white dark:bg-slate-900 rounded-[15px] p-2.5 space-y-4 border border-slate-100 dark:border-slate-800"
      style={{ marginTop: '0px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-gray-900 dark:text-white leading-tight">Word & Spam Filter</h3>
            <p className="text-[11px] text-gray-400 dark:text-slate-500">Hide unwanted terms or tags</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleFilter}
          title={filterEnabled ? 'Pause spam filter' : 'Enable spam filter'}
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
            filterEnabled
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
              : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              filterEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400 dark:bg-slate-600'
            }`}
          />
          <span>{filterEnabled ? 'Active' : 'Off'}</span>
        </button>
      </div>

      {/* Hidden items badge */}
      {filterEnabled && hiddenCount > 0 && (
        <div className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 rounded-2xl p-2.5 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <EyeOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="font-medium">
              <span className="font-bold">{hiddenCount}</span> {hiddenCount === 1 ? 'short' : 'shorts'} hidden
            </span>
          </div>
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wider">Filtered</span>
        </div>
      )}

      {/* Add Keyword Input */}
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Block word, phrase, or #tag..."
          className="flex-1 min-w-0 px-3 py-2 text-xs bg-gray-50 dark:bg-slate-800 rounded-xl text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 border border-transparent dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 focus:outline-none transition"
        />
        <button
          type="submit"
          disabled={!inputValue.trim()}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer disabled:cursor-not-allowed"
          title="Add to blacklist"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>
      </form>

      {/* Blocked Words Chips */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 dark:text-slate-500">
          <span>Blocked terms ({blockedWords.length})</span>
          {blockedWords.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-gray-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 text-[11px] font-normal transition cursor-pointer"
            >
              Clear all
            </button>
          )}
        </div>

        {blockedWords.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1 py-1">
            {blockedWords.map((word) => (
              <span
                key={word}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200/80 dark:hover:bg-slate-700/80 text-gray-800 dark:text-slate-200 text-xs font-medium transition group"
              >
                <span className="truncate max-w-[140px] font-medium text-gray-900 dark:text-white">{word}</span>
                <button
                  type="button"
                  onClick={() => onRemoveWord(word)}
                  className="text-gray-400 dark:text-slate-500 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition cursor-pointer"
                  title={`Remove "${word}" from filter`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className="p-3 bg-gray-50/70 dark:bg-slate-800/40 rounded-2xl text-center text-xs text-gray-400 dark:text-slate-500">
            No words blocked yet. Any short containing your added words will be hidden.
          </div>
        )}
      </div>

      {/* Quick Spam Presets */}
      <div className="pt-2 border-t border-gray-100 dark:border-slate-800 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-slate-500">
          <Sparkles className="w-3 h-3 text-blue-500" />
          <span>Common spam presets:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_SPAM_PRESETS.map((preset) => {
            const isAlreadyAdded = blockedWords.includes(preset);
            return (
              <button
                key={preset}
                type="button"
                onClick={() => !isAlreadyAdded && handleAddPreset(preset)}
                disabled={isAlreadyAdded}
                className={`text-[11px] px-2 py-0.5 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                  isAlreadyAdded
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 opacity-60 cursor-default'
                    : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white'
                }`}
                title={isAlreadyAdded ? 'Already added' : `Add "${preset}" to filter`}
              >
                {isAlreadyAdded && <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />}
                <span>{preset}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
