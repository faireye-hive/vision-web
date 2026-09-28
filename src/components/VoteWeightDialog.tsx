import { useEffect, useState } from 'react';
import { KeychainService } from '../services/keychain';

const STORAGE_KEY = 'nebulosa_vote_percent';

function readPercent(): number {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    if (Number.isFinite(value) && value >= 1 && value <= 100) return value;
  } catch {
    // Ignore storage failures.
  }
  return 100;
}

interface VoteWeightDialogProps {
  open: boolean;
  username: string;
  author: string;
  permlink: string;
  onClose: () => void;
  onVoted: () => void;
}

export function VoteWeightDialog({
  open,
  username,
  author,
  permlink,
  onClose,
  onVoted,
}: VoteWeightDialogProps) {
  const [percent, setPercent] = useState(readPercent);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPercent(readPercent());
    setError(null);
    setSending(false);
  }, [open, author, permlink]);

  if (!open) return null;

  const confirm = async () => {
    setSending(true);
    setError(null);
    try {
      localStorage.setItem(STORAGE_KEY, String(percent));
    } catch {
      // The vote can still be sent.
    }
    try {
      const result = await KeychainService.vote(username, author, permlink, percent * 100);
      if (result.success) {
        onVoted();
        onClose();
      } else {
        setError(result.message || result.error || 'Hive Keychain did not accept this vote.');
      }
    } catch (err: any) {
      setError(err?.message || 'Vote failed.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/50" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-2xl p-5 text-gray-900 dark:text-slate-100"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-sm font-bold">Vote weight</h3>
        <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
          Choose how much voting power to use on @{author}.
        </p>
        <div className="mt-4 flex items-end justify-between">
          <span className="text-3xl font-black text-rose-600 dark:text-rose-400">{percent}%</span>
          <span className="text-[10px] text-gray-400">Hive weight {percent * 100}</span>
        </div>
        <input
          type="range"
          min={1}
          max={100}
          value={percent}
          onChange={(event) => setPercent(Number(event.target.value))}
          className="w-full mt-3 accent-rose-600"
        />
        <div className="flex gap-1.5 mt-3">
          {[25, 50, 75, 100].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPercent(value)}
              className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer ${
                percent === value
                  ? 'bg-rose-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300'
              }`}
            >
              {value}%
            </button>
          ))}
        </div>
        {error && <p className="text-[11px] text-rose-600 mt-3">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-semibold text-gray-500 cursor-pointer">
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={sending}
            className="px-4 py-1.5 rounded-full bg-rose-600 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
          >
            {sending ? 'Sending…' : `Vote ${percent}%`}
          </button>
        </div>
      </div>
    </div>
  );
}
