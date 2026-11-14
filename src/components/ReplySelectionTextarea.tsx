import { useEffect, useId, useLayoutEffect, useRef, useState, type ComponentPropsWithoutRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Languages, Loader2, LockKeyhole, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { encodeDraftMemo } from '../services/draftMemo';
import { POPULAR_TRANSLATION_LANGUAGES, translateText } from '../services/translationService';
import { copyTextToClipboard } from '../utils/clipboard';

type Selection = { start: number; end: number; text: string; draft: string };
type Action = 'encode' | 'translate';

interface Props extends Omit<ComponentPropsWithoutRef<'textarea'>, 'value' | 'defaultValue' | 'onChange'> {
  value: string;
  onValueChange: (value: string) => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  memoSender?: string;
  defaultRecipient?: string;
}

const actionClass = 'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-slate-200 dark:hover:bg-slate-800';
const fieldClass = 'w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export function ReplySelectionTextarea({ value, onValueChange, textareaRef, memoSender, defaultRecipient = '', ...props }: Props) {
  const { locale } = useI18n();
  const localRef = useRef<HTMLTextAreaElement>(null);
  const editor = textareaRef ?? localRef;
  const panel = useRef<HTMLDivElement>(null);
  const request = useRef(0);
  const selectionRef = useRef<Selection | null>(null);
  const fieldId = useId();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [recipient, setRecipient] = useState('');
  const [language, setLanguage] = useState<string>(locale);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [message, setMessage] = useState('');
  const activeSelection = selection?.draft === value ? selection : null;
  const visible = Boolean(activeSelection);

  const reset = (next: Selection | null) => {
    request.current++;
    selectionRef.current = next;
    setSelection(next);
    setAction(null);
    setBusy(false);
    setResult('');
    setMessage('');
  };

  const capture = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const { value: draft, selectionStart: start, selectionEnd: end } = event.currentTarget;
    const text = draft.slice(start, end);
    if (!text.trim()) {
      if (selectionRef.current) reset(null);
      return;
    }
    const previous = selectionRef.current;
    if (previous?.draft === draft && previous.start === start && previous.end === end) return;
    reset({ start, end, text, draft });
  };

  useLayoutEffect(() => {
    const textarea = editor.current;
    const menu = panel.current;
    if (!visible || !textarea || !menu) return;

    const position = () => {
      const rect = textarea.getBoundingClientRect();
      const viewport = window.visualViewport;
      const top = (viewport?.offsetTop ?? 0) + 8;
      const bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 8;
      const left = (viewport?.offsetLeft ?? 0) + 8;
      const right = (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth) - 8;
      const gap = 6;
      const above = rect.top - top - gap;
      const below = bottom - rect.bottom - gap;

      // Keep the entire panel outside the field, including for multiline selections.
      menu.style.maxWidth = `${Math.max(0, right - left)}px`;
      const height = menu.scrollHeight + 2;
      const placeAbove = above >= height || (below < height && above >= below);
      const space = placeAbove ? above : below;
      const offscreen = rect.bottom < top || rect.top > bottom || rect.right < left || rect.left > right;
      menu.style.visibility = offscreen || space < 36 ? 'hidden' : 'visible';
      menu.style.maxHeight = `${Math.max(0, space)}px`;
      menu.style.top = `${placeAbove ? rect.top - gap - menu.offsetHeight : rect.bottom + gap}px`;
      menu.style.left = `${Math.max(left, Math.min(rect.left, right - menu.offsetWidth))}px`;
    };

    position();
    const observer = new ResizeObserver(position);
    observer.observe(textarea);
    observer.observe(menu);
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    window.visualViewport?.addEventListener('resize', position);
    window.visualViewport?.addEventListener('scroll', position);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('scroll', position);
    };
  }, [editor, visible, action, result, message]);

  useEffect(() => {
    if (!visible) return;
    const closeOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || editor.current?.contains(event.target) || panel.current?.contains(event.target)) return;
      reset(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      reset(null);
      editor.current?.focus();
    };
    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('keydown', closeOnEscape, true);
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('keydown', closeOnEscape, true);
    };
  }, [editor, visible]);

  const open = (next: Action) => {
    setRecipient(defaultRecipient);
    setLanguage(locale);
    setAction(next);
  };

  const run = async () => {
    if (!activeSelection || !action || busy) return;
    const id = ++request.current;
    setBusy(true);
    setResult('');
    setMessage('');
    try {
      const before = activeSelection.text.match(/^\s*/)?.[0] ?? '';
      const after = activeSelection.text.match(/\s*$/)?.[0] ?? '';
      const text = activeSelection.text.trim();
      const output = action === 'encode'
        ? await encodeDraftMemo(text, recipient, memoSender)
        : await translateText(text, language);
      if (request.current === id) {
        const needsSeparator = action === 'encode' && /[1-9A-HJ-NP-Za-km-z]/.test(value.charAt(activeSelection.end));
        setResult(before + output + (after || (needsSeparator ? ' ' : '')));
      }
    } catch (error) {
      if (request.current === id) setMessage(error instanceof Error ? error.message : 'Could not process the selected text.');
    } finally {
      if (request.current === id) setBusy(false);
    }
  };

  const replace = () => {
    if (!activeSelection || !result) return;
    const { start, end } = activeSelection;
    onValueChange(value.slice(0, start) + result + value.slice(end));
    reset(null);
    requestAnimationFrame(() => {
      editor.current?.focus();
      editor.current?.setSelectionRange(start + result.length, start + result.length);
    });
  };

  return (
    <>
      <textarea
        {...props}
        ref={editor}
        value={value}
        onChange={(event) => {
          reset(null);
          onValueChange(event.target.value);
        }}
        onSelect={capture}
        onMouseUp={capture}
        onKeyUp={capture}
      />
      {activeSelection && createPortal(
        <div
          ref={panel}
          role={action ? 'dialog' : 'group'}
          aria-label={action === 'encode' ? 'Encode selection' : action === 'translate' ? 'Translate selection' : 'Selected text actions'}
          onClick={(event) => event.stopPropagation()}
          className={`invisible fixed z-[110] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-950 ${action ? 'w-[min(19rem,calc(100vw-16px))] space-y-2 p-2.5' : 'flex w-max gap-0.5 p-0.5'}`}
        >
          {!action ? (
            <>
              <button type="button" className={actionClass} onMouseDown={(event) => event.preventDefault()} onClick={() => open('encode')}>
                <LockKeyhole className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" /> Encode
              </button>
              <button type="button" className={actionClass} onMouseDown={(event) => event.preventDefault()} onClick={() => open('translate')}>
                <Languages className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" /> Translate
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={fieldId} className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {action === 'encode' ? 'Recipient Hive account' : 'Translate to'}
                </label>
                <button type="button" className={actionClass} aria-label="Close selection tools" onClick={() => reset(null)}>
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              {action === 'encode' ? (
                <input id={fieldId} className={fieldClass} autoFocus autoComplete="off" placeholder="@username" value={recipient} disabled={busy} onChange={(event) => { setRecipient(event.target.value); setResult(''); setMessage(''); }} />
              ) : (
                <select id={fieldId} className={fieldClass} autoFocus value={language} disabled={busy} onChange={(event) => { setLanguage(event.target.value); setResult(''); setMessage(''); }}>
                  {POPULAR_TRANSLATION_LANGUAGES.map((entry) => <option key={entry.code} value={entry.code}>{entry.nativeName}</option>)}
                </select>
              )}
              <button type="button" onClick={() => void run()} disabled={busy || (action === 'encode' && !recipient.trim())} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {busy ? (action === 'encode' ? 'Encoding…' : 'Translating…') : (action === 'encode' ? 'Encode selection' : 'Translate selection')}
              </button>
              {action === 'translate' && !result && <p className="text-xs text-slate-500 dark:text-slate-400">Only the selection is sent to the translation service.</p>}
              {result && (
                <>
                  <textarea readOnly rows={2} value={result} className={fieldClass} aria-label={action === 'encode' ? 'Encoded text' : 'Translated text'} />
                  <div className="flex flex-wrap gap-1">
                    <button type="button" className={actionClass} onClick={replace}>Replace selected text</button>
                    <button type="button" className={actionClass} onClick={() => void copyTextToClipboard(result).then(() => setMessage('Copied.'), () => setMessage('Could not copy the result.'))}>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy
                    </button>
                  </div>
                </>
              )}
              {message && <p role="status" className="break-words text-xs text-slate-600 dark:text-slate-300">{message}</p>}
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
