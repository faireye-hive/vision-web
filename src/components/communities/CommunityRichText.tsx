import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { markdownToSafeHtml } from '../../utils/sanitize';
import { handleImageFallback } from '../../utils/imageFallback';
import { ExternalLinkWarningModal } from '../ExternalLinkWarningModal';

/** Community descriptions are untrusted content, using the same final sanitizer as posts. */
export function CommunityRichText({ text }: { text: string }) {
  const html = useMemo(() => markdownToSafeHtml(text), [text]);
  const navigate = useNavigate();
  const [external, setExternal] = useState<string | null>(null);
  return <>
    <div className="article-content min-w-0 break-words text-sm [&_img]:max-w-full [&_pre]:overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }}
      onErrorCapture={(event) => { if (event.target instanceof HTMLImageElement) handleImageFallback({ currentTarget: event.target } as React.SyntheticEvent<HTMLImageElement>); }}
      onClick={(event) => {
        const anchor = (event.target as Element).closest('a');
        if (!anchor) return;
        event.preventDefault();
        const href = anchor.getAttribute('href');
        if (!href) return;
        try {
          const url = new URL(href, window.location.origin);
          if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return;
          if (url.origin === window.location.origin) navigate(`${url.pathname}${url.search}${url.hash}`);
          else setExternal(url.href);
        } catch { /* A malformed destination stays inert. */ }
      }} />
    <ExternalLinkWarningModal href={external} onCancel={() => setExternal(null)} onContinue={(href) => { setExternal(null); window.open(href, '_blank', 'noopener,noreferrer'); }} />
  </>;
}
