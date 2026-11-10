import { createPortal } from 'react-dom';
import { AlertCircle, X } from 'lucide-react';

interface ExternalLinkWarningModalProps {
  href: string | null;
  onCancel: () => void;
  onContinue: (href: string) => void;
}

export function ExternalLinkWarningModal({ href, onCancel, onContinue }: ExternalLinkWarningModalProps) {
  if (!href || typeof document === 'undefined') return null;

  let hostname = href;
  try {
    hostname = new URL(href).hostname;
  } catch {
    // The link has already been validated before opening this dialog.
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      role="presentation"
      onClick={onCancel}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="external-link-warning-title"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertCircle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="external-link-warning-title" className="text-base font-bold text-slate-900 dark:text-white">
              Leaving Nebulosa
            </h2>
            <p className="mt-1.5 text-sm leading-5 text-slate-600 dark:text-slate-300">
              This user-posted link opens an external site. It could lead to a fake airdrop, a wallet connection request, or a request to sign a transaction.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="-mt-1 -mr-1 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close link warning"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/70">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{hostname}</p>
          <p className="mt-1 break-all text-[11px] leading-4 text-slate-500 dark:text-slate-400">{href}</p>
        </div>

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Never enter your private keys or approve transactions you do not understand.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onContinue(href)}
            className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            Continue to site
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
