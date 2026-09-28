import { useRef, useState } from 'react';
import { CaseSensitive, Check, ChevronDown } from 'lucide-react';
import {
  ReadingAmbient,
  ReadingFamily,
  ReadingSize,
  ReadingStyle,
  ReadingTone,
  applyReadingStyle,
  readReadingStyle,
} from '../utils/readingStyle';
const OPEN_KEY = 'nebulosa_reading_open';

const SIZES: { id: ReadingSize; label: string }[] = [
  { id: 'sm', label: 'S' },
  { id: 'md', label: 'M' },
  { id: 'lg', label: 'L' },
  { id: 'xl', label: 'XL' },
];

const FAMILIES: { id: ReadingFamily; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'serif', label: 'Serif' },
  { id: 'mono', label: 'Mono' },
];

const TONES: { id: ReadingTone; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'ink', label: 'Ink' },
  { id: 'warm', label: 'Warm' },
  { id: 'contrast', label: 'Contrast' },
];

const DAY_AMBIENTS: { id: ReadingAmbient; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'paper', label: 'Paper' },
  { id: 'mist', label: 'Mist' },
  { id: 'pine', label: 'Pine' },
  { id: 'sand', label: 'Sand' },
  { id: 'rose', label: 'Rose' },
  { id: 'sky', label: 'Sky' },
];

const NIGHT_AMBIENTS: { id: ReadingAmbient; label: string }[] = [
  { id: 'ink', label: 'Ink' },
  { id: 'ember', label: 'Ember' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'violet', label: 'Violet' },
];

function ChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (id: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => {
          const active = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ReadingStyleCard() {
  const [style, setStyle] = useState<ReadingStyle>(() => readReadingStyle());
  const styleRef = useRef(style);
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(OPEN_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(OPEN_KEY, String(next));
      } catch {
        // Ignore storage failures.
      }
      return next;
    });
  };

  const update = (patch: Partial<ReadingStyle>) => {
    const next = { ...styleRef.current, ...patch };
    styleRef.current = next;
    const mode = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    setStyle(next);
    applyReadingStyle(next, mode);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none border border-gray-100/60 dark:border-slate-800 space-y-3 text-gray-900 dark:text-slate-100">
      <button
        type="button"
        onClick={toggleOpen}
        className="w-full flex items-center justify-between gap-2 cursor-pointer"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <CaseSensitive className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">Reading</h3>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-3">
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
            <Check className="w-3 h-3" />
            Saved in this browser
          </span>
          <ChoiceRow label="Size" value={style.size} options={SIZES} onChange={(size) => update({ size })} />
          <ChoiceRow label="Font" value={style.family} options={FAMILIES} onChange={(family) => update({ family })} />
          <ChoiceRow label="Text color" value={style.tone} options={TONES} onChange={(tone) => update({ tone })} />
          <ChoiceRow label="Background" value={style.ambient} options={DAY_AMBIENTS} onChange={(ambient) => update({ ambient })} />
          <ChoiceRow label="Dark backgrounds" value={style.ambient} options={NIGHT_AMBIENTS} onChange={(ambient) => update({ ambient })} />
        </div>
      )}
    </div>
  );
}
