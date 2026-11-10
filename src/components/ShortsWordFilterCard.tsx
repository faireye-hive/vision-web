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
      className="space-y-3 rounded-2xl border border-slate-200/70 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
      style={{ marginTop: '0px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
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
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
              : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              filterEnabled ? 'bg-slate-600 dark:bg-slate-300' : 'bg-gray-400 dark:bg-slate-600'
            }`}
          />
          <span>{filterEnabled ? 'Active' : 'Off'}</span>
        </button>
      </div>

      {/* Hidden items badge */}
      {filterEnabled && hiddenCount > 0 && (
        <div className="flex items-center gap-1.5 border-y border-slate-100 py-2 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <EyeOff className="h-3 w-3 flex-shrink-0 text-slate-400 dark:text-slate-500" />
          <span>
            <span className="font-semibold text-slate-600 dark:text-slate-300">{hiddenCount}</span>{' '}
            {hiddenCount === 1 ? 'Snap hidden by filters' : 'Snaps hidden by filters'}
          </span>
        </div>
      )}

      {/* Add Keyword Input */}
      <form onSubmit={handleAdd} className="flex gap-1.5">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Block word, phrase, or #tag..."
          className="min-w-0 flex-1 rounded-xl border border-transparent bg-gray-50 px-3 py-1.5 text-xs text-gray-800 transition placeholder:text-gray-400 focus:border-slate-400 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:bg-slate-800"
        />
        <button
          type="submit"
          disabled={!inputValue.trim()}
          className="flex items-center gap-1 rounded-xl bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300"
          title="Add to blacklist"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>
      </form>

      {/* Blocked Words Chips */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 dark:text-slate-500">
          <span>Blocked terms ({blockedWords.length})</span>
          {blockedWords.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white text-[11px] font-normal transition cursor-pointer"
            >
              Clear all
            </button>
          )}
        </div>

        {blockedWords.length > 0 ? (
          <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto pr-1 py-0.5">
            {blockedWords.map((word) => (
              <span
                key={word}
                className="group inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-800 transition hover:bg-gray-200/80 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/80"
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
          <div className="rounded-xl bg-gray-50/70 p-2.5 text-center text-[11px] text-gray-400 dark:bg-slate-800/40 dark:text-slate-500">
            No words blocked yet. Any short containing your added words will be hidden.
          </div>
        )}
      </div>

      {/* Quick Spam Presets */}
      <div className="space-y-1 border-t border-gray-100 pt-2 dark:border-slate-800">
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-slate-500">
          <Sparkles className="w-3 h-3 text-slate-500 dark:text-slate-400" />
          <span>Common spam presets:</span>
        </div>
        <div className="flex flex-wrap gap-1">
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
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 opacity-70 cursor-default'
                    : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white'
                }`}
                title={isAlreadyAdded ? 'Already added' : `Add "${preset}" to filter`}
              >
                {isAlreadyAdded && <Check className="w-2.5 h-2.5 text-slate-600 dark:text-slate-300" />}
                <span>{preset}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
