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
          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-bold border border-blue-200/60 dark:border-blue-900/60'
          : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
      }`}
    >
      <span className="truncate">{label}</span>
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
          active
            ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold'
            : 'text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-800'
        }`}
      >
        {count}
      </span>
    </button>
  );
};
