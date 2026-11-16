import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useContentFilter } from '../context/ContentFilterContext';
import { useI18n } from '../i18n/I18nContext';
import { getHiveAvatarUrl } from '../utils/hiveAvatar';
import { handleImageFallback } from '../utils/imageFallback';
import { getContentCommunity, isNsfwContent } from '../utils/nsfw';

interface NsfwGateProps {
  sensitive: boolean;
  pending?: boolean;
  children: ReactNode | (() => ReactNode);
  onBack?: () => void;
  hiddenHeader?: ReactNode;
}

const hiddenCard = 'rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900';

function useNsfwCopy() {
  const { locale } = useI18n();
  if (locale === 'pt') return { hide: 'Ocultar', show: 'Mostrar', hidden: 'Conteúdo NSFW oculto', back: 'Voltar', content: 'conteúdo NSFW' };
  if (locale === 'es') return { hide: 'Ocultar', show: 'Mostrar', hidden: 'Contenido NSFW oculto', back: 'Volver', content: 'contenido NSFW' };
  return { hide: 'Hide', show: 'Show', hidden: 'NSFW content hidden', back: 'Back', content: 'NSFW content' };
}

function Content({ children }: Pick<NsfwGateProps, 'children'>) {
  return <>{typeof children === 'function' ? children() : children}</>;
}

export function NsfwGate({ sensitive, pending, children, onBack, hiddenHeader }: NsfwGateProps) {
  const { showNsfw } = useContentFilter();
  if (showNsfw || (!sensitive && !pending)) return <Content>{children}</Content>;
  if (!sensitive && pending) return (
    <div className={`min-w-0 space-y-2 ${hiddenHeader ? hiddenCard : ''}`}>
      {hiddenHeader}
      <div aria-busy="true" className="h-10 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
    </div>
  );
  return <NsfwDisclosure onBack={onBack} hiddenHeader={hiddenHeader}>{children}</NsfwDisclosure>;
}

type PostLabels = Parameters<typeof isNsfwContent>[0];

export function usePostNsfw(post: PostLabels) {
  const { showNsfw, nsfwCommunities } = useContentFilter();
  const community = getContentCommunity(post);
  return {
    sensitive: isNsfwContent(post) || Boolean(community && nsfwCommunities?.has(community)),
    pending: !showNsfw && Boolean(community) && nsfwCommunities === null,
  };
}

export function PostNsfwGate({ post, bodyOnly, ...props }: Omit<NsfwGateProps, 'sensitive' | 'pending'> & {
  post: (NonNullable<PostLabels> & { author?: string; permlink?: string }) | null | undefined;
  bodyOnly?: boolean;
}) {
  const labels = usePostNsfw(post);
  const hiddenHeader = !bodyOnly && post?.author ? <NsfwAuthor author={post.author} /> : undefined;
  return <NsfwGate key={`${post?.author}/${post?.permlink}`} hiddenHeader={hiddenHeader} {...props} {...labels} />;
}

export function NsfwAuthor({ author }: { author: string }) {
  const username = author.replace(/^@/, '').trim();
  if (!username) return null;

  return (
    <Link
      to={`/profile/@${encodeURIComponent(username)}`}
      className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-lg px-1.5 text-sm font-semibold text-slate-800 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-slate-100 dark:hover:text-blue-400"
    >
      <img
        src={getHiveAvatarUrl(username, 'small')}
        alt=""
        loading="lazy"
        onError={handleImageFallback}
        className="h-8 w-8 shrink-0 rounded-full bg-slate-100 object-cover dark:bg-slate-800"
      />
      <span className="truncate">@{username}</span>
    </Link>
  );
}

function NsfwDisclosure({ children, onBack, hiddenHeader }: Pick<NsfwGateProps, 'children' | 'onBack' | 'hiddenHeader'>) {
  const [revealed, setRevealed] = useState(false);
  const copy = useNsfwCopy();
  const contentId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const Icon = revealed ? Eye : EyeOff;
  return (
    <div className={`min-w-0 space-y-2 ${hiddenHeader && !revealed ? hiddenCard : ''}`}>
      {!revealed && hiddenHeader}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
        <span className="flex-1">{revealed ? 'NSFW' : copy.hidden}</span>
        {onBack && !revealed && <button type="button" onClick={onBack} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 hover:bg-slate-200 dark:hover:bg-slate-800"><ArrowLeft aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />{copy.back}</button>}
        <button
          ref={toggleRef}
          type="button"
          aria-label={`${revealed ? copy.hide : copy.show} ${copy.content}`}
          aria-expanded={revealed}
          aria-controls={contentId}
          onClick={(event) => {
            event.stopPropagation();
            setRevealed(!revealed);
            toggleRef.current?.focus();
          }}
          className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 font-semibold transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          {revealed ? copy.hide : copy.show}
        </button>
      </div>
      <div id={contentId} hidden={!revealed}>{revealed && <Content>{children}</Content>}</div>
    </div>
  );
}

export function NsfwPreference({ className = '' }: { className?: string }) {
  const { showNsfw, setShowNsfw } = useContentFilter();
  const copy = useNsfwCopy();
  return (
    <div role="group" aria-label="NSFW" className={`flex min-h-10 items-center gap-2 text-sm text-slate-700 dark:text-slate-200 ${className}`}>
      <EyeOff aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" />
      <span className="flex-1">NSFW</span>
      <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
        {[false, true].map((show) => (
          <button
            key={String(show)}
            type="button"
            aria-pressed={showNsfw === show}
            onClick={() => setShowNsfw(show)}
            className={`min-h-9 rounded-md px-2.5 transition focus-visible:outline-2 focus-visible:outline-blue-500 ${showNsfw === show ? 'bg-white font-semibold text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'}`}
          >
            {show ? copy.show : copy.hide}
          </button>
        ))}
      </div>
    </div>
  );
}
