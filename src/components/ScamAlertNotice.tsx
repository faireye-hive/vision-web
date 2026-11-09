import React from 'react';
import { AlertCircle } from 'lucide-react';

export const ScamAlertNotice: React.FC = () => (
  <div
    role="alert"
    className="mb-2 flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-rose-950 dark:border-rose-900/80 dark:bg-rose-950/40 dark:text-rose-100"
  >
    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700 dark:text-rose-300" aria-hidden="true" />
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-wide">Scam Alert</p>
      <p className="mt-0.5 text-xs leading-relaxed">
        This comment combines a suspicious crypto offer with an external link. The link is disabled to help prevent accidental clicks.
      </p>
    </div>
  </div>
);
