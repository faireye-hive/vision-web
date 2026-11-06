import React from 'react';

interface CommunityFilterRowProps {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}

export const CommunityFilterRow: React.FC<CommunityFilterRowProps> = ({
  active,
  label,
  count,
  onClick
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs transition cursor-pointer ${
        active
          ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100 font-bold border border-slate-200 dark:border-slate-700'
          : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
      }`}
    >
      <span className="truncate">{label}</span>
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
          active
            ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold'
            : 'text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-800'
        }`}
      >
        {count}
      </span>
    </button>
  );
};
