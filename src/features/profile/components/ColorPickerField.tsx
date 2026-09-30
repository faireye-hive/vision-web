import React, { useRef } from 'react';
import { Pipette, Check, RotateCcw } from 'lucide-react';
import { ColorSwatch, isColorDark } from '../profileColorUtils';

interface ColorPickerFieldProps {
  label: string;
  description?: string;
  value: string;
  onChange: (hex: string) => void;
  onReset?: () => void;
  defaultHex?: string;
  lightSwatches?: ColorSwatch[];
  darkSwatches?: ColorSwatch[];
  allowReset?: boolean;
}

export const ColorPickerField: React.FC<ColorPickerFieldProps> = ({
  label,
  description,
  value,
  onChange,
  onReset,
  defaultHex = '#2563eb',
  lightSwatches = [],
  darkSwatches = [],
  allowReset = true
}) => {
  const colorInputRef = useRef<HTMLInputElement>(null);
  const activeColor = value || defaultHex;
  const isDark = isColorDark(activeColor);

  const handleOpenPicker = () => {
    colorInputRef.current?.click();
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9a-fA-F]/g, '');
    if (raw.length === 0) {
      if (allowReset && onReset) {
        onReset();
      } else {
        onChange('');
      }
    } else {
      onChange(`#${raw}`);
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider block">
            {label}
          </label>
          {description && (
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">{description}</p>
          )}
        </div>
        {value && allowReset && onReset && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 transition cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset to Auto</span>
          </button>
        )}
      </div>

      {/* Main Interactive Color Picker & Input Bar */}
      <div className="flex items-center gap-3 p-2.5 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/60">
        {/* Custom Color Eyedropper Button */}
        <div className="relative">
          <button
            type="button"
            onClick={handleOpenPicker}
            className="w-10 h-10 rounded-xl border-2 transition transform hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer shadow-sm relative group overflow-hidden"
            style={{
              backgroundColor: value || 'transparent',
              backgroundImage: !value ? 'linear-gradient(45deg, #e2e8f0 25%, transparent 25%, transparent 75%, #e2e8f0 75%), linear-gradient(45deg, #e2e8f0 25%, #ffffff 25%, #ffffff 75%, #e2e8f0 75%)' : undefined,
              backgroundSize: '12px 12px',
              borderColor: value ? (isDark ? '#475569' : '#cbd5e1') : '#94a3b8'
            }}
            title="Click to open color picker (choose any color)"
          >
            <Pipette
              className={`w-4 h-4 transition ${
                value
                  ? isDark
                    ? 'text-white/90 drop-shadow-md'
                    : 'text-gray-900/80 drop-shadow-md'
                  : 'text-gray-500'
              }`}
            />
            <span className="sr-only">Choose color</span>
          </button>

          {/* Hidden Native Color Picker triggered by button */}
          <input
            ref={colorInputRef}
            type="color"
            value={value && value.startsWith('#') && value.length === 7 ? value : defaultHex}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
            aria-label={label}
          />
        </div>

        {/* Hex input & live status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <span className="absolute left-2.5 text-xs font-bold text-gray-400">#</span>
              <input
                type="text"
                maxLength={7}
                placeholder={value ? '' : 'Auto'}
                value={value ? value.replace('#', '') : ''}
                onChange={handleTextChange}
                className="w-24 pl-6 pr-2 py-1.5 text-xs font-mono font-bold rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <button
              type="button"
              onClick={handleOpenPicker}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition cursor-pointer flex items-center gap-1.5"
            >
              <Pipette className="w-3.5 h-3.5 text-blue-500" />
              <span>Palette</span>
            </button>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
            {value ? (isDark ? 'Dark tone (auto light text)' : 'Light tone (auto dark text)') : 'Automatic theme-reactive mode'}
          </p>
        </div>
      </div>

      {/* Swatches Collection (Light & Dark Friendly) */}
      {(lightSwatches.length > 0 || darkSwatches.length > 0) && (
        <div className="space-y-2 pt-1">
          {lightSwatches.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  ☀️ Light Tones
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                {lightSwatches.map((color) => {
                  const isSelected = value.toLowerCase() === color.hex.toLowerCase();
                  return (
                    <button
                      key={color.hex + color.label}
                      type="button"
                      onClick={() => onChange(color.hex)}
                      className={`w-7 h-7 rounded-xl border transition transform hover:scale-110 flex items-center justify-center cursor-pointer shadow-xs ${
                        isSelected ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-900' : 'border-gray-200 dark:border-slate-700'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={`${color.label} (${color.hex})`}
                    >
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-gray-900 drop-shadow-xs" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {darkSwatches.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1 mt-2">
                <span className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  🌙 Dark Tones
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                {darkSwatches.map((color) => {
                  const isSelected = value.toLowerCase() === color.hex.toLowerCase();
                  return (
                    <button
                      key={color.hex + color.label}
                      type="button"
                      onClick={() => onChange(color.hex)}
                      className={`w-7 h-7 rounded-xl border transition transform hover:scale-110 flex items-center justify-center cursor-pointer shadow-xs ${
                        isSelected ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-900' : 'border-gray-700'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={`${color.label} (${color.hex})`}
                    >
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-white drop-shadow-xs" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
