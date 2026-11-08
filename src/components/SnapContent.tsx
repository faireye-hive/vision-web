import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useNavigation } from '../context/NavigationContext';
import { HivePost, getPost, getPostSnippet, getHiveAvatarUrl } from '../services/hiveApi';
import { markdownToSafeHtml } from '../utils/sanitize';
import { extract3SpeakVideoIds, get3SpeakData, getCached3SpeakData } from '../utils/videoEmbeds';
import {
  HivePostLink,
  collapseDuplicateHashtags,
  extractHivePostLinks,
  extractSnapImages,
  imageIdentity,
  stripResolvedSnapUrls,
  truncateSnapText,
} from '../services/shortsApi';
import { SafeSnapImage } from './SafeSnapImage';

const TRUSTED_SNAP_LINK_HOSTS = [
  'peakd.com',
  'ecency.com',
  'hive.blog',
  '3speak.tv',
  '3speak.com',
  '3speak.online'
];

function isTrustedSnapLink(url: URL): boolean {
  if (url.origin === window.location.origin) return true;
  const host = url.hostname.toLowerCase();
  return TRUSTED_SNAP_LINK_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function linkifyHashtags(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  textNodes.forEach((textNode) => {
    if (textNode.parentElement?.closest('a, button, code, pre')) return;
    const value = textNode.nodeValue || '';
    const matches = Array.from(value.matchAll(/(^|\s)#([a-zA-Z0-9_\u0080-\uFFFF]+)/g));
    if (!matches.length) return;

    const fragment = document.createDocumentFragment();
    let cursor = 0;
    matches.forEach((match) => {
      const start = match.index ?? 0;
      const tagStart = start + match[1].length;
      const tagEnd = tagStart + match[2].length + 1;
      fragment.append(value.slice(cursor, tagStart));

      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.snapTag = match[2];
      button.title = `Filter Shorts by #${match[2]}`;
      button.className = 'font-semibold text-blue-600 hover:underline dark:text-blue-400';
      button.textContent = `#${match[2]}`;
      fragment.append(button);
      cursor = tagEnd;
    });
    fragment.append(value.slice(cursor));
    textNode.replaceWith(fragment);
  });

  return template.innerHTML;
}

/** Turn plain HTTP(S) text into anchors using DOM APIs after sanitization. */
function linkifyPlainUrls(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  textNodes.forEach((textNode) => {
    if (textNode.parentElement?.closest('a, button, code, pre, .nebulosa-video-container, .nebulosa-lazy-video-facade')) return;
    const value = textNode.nodeValue || '';
    const matches = Array.from(value.matchAll(/https?:\/\/[^\s<>"']+/gi));
    if (!matches.length) return;

    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of matches) {
      const start = match.index ?? 0;
      let rawUrl = match[0];
      let trailing = '';
      while (/[),.;!?\]}]$/.test(rawUrl)) {
        trailing = rawUrl.slice(-1) + trailing;
        rawUrl = rawUrl.slice(0, -1);
      }

      let parsed: URL;
      try {
        parsed = new URL(rawUrl);
      } catch {
        continue;
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;

      fragment.append(document.createTextNode(value.slice(cursor, start)));
      const anchor = document.createElement('a');
      anchor.href = parsed.href;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer nofollow';
      anchor.className = 'text-blue-600 dark:text-blue-400 underline underline-offset-2 break-all';
      anchor.textContent = rawUrl;
      fragment.append(anchor, document.createTextNode(trailing));
      cursor = start + match[0].length;
    }

    if (cursor > 0) {
      fragment.append(document.createTextNode(value.slice(cursor)));
      textNode.replaceWith(fragment);
    }
  });

  return template.innerHTML;
}

interface SnapContentProps {
  body: string;
  jsonMetadata?: HivePost['json_metadata'];
  author: string;
  permlink: string;
  onSelectTag?: (tag: string) => void;
  onOpenDetail?: () => void;
  textClassName?: string;
  charLimit?: number;
  enableTruncation?: boolean;
}

function ResnapCard({ link, onOpen }: { link: HivePostLink; onOpen: () => void }) {
  const [post, setPost] = useState<HivePost | null>(null);

  useEffect(() => {
    let active = true;
    getPost(link.author, link.permlink)
      .then((loaded) => {
        if (active) setPost(loaded);
      })
      .catch(() => {
        if (active) setPost(null);
      });
    return () => {
      active = false;
    };
  }, [link.author, link.permlink]);

  const title = post?.title?.trim() || `Post by @${link.author}`;
  const description = post ? getPostSnippet(post.body, 180) : 'Loading post from Hive…';

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-3 block w-full text-left rounded-2xl border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-950/40 hover:border-blue-300 dark:hover:border-blue-700 transition"
    >
      <div className="flex items-center gap-2 mb-1">
        <img
          src={getHiveAvatarUrl(link.author, 'small')}
          className="w-4 h-4 rounded-full border border-slate-100 dark:border-slate-800"
          alt=""
        />
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">@{link.author}</span>
        <ExternalLink className="w-3 h-3 text-slate-400 ml-auto" />
      </div>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">{title}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-3 mt-1">{description}</p>
    </button>
  );
}

export function SnapContent({
  body,
  jsonMetadata,
  author,
  permlink,
  onSelectTag,
  onOpenDetail,
  textClassName = '',
  charLimit = 300,
  enableTruncation = true,
}: SnapContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  const { handleOpenNotificationPost } = useNavigation();

  // Pre-fetch 3Speak embed data and track loaded thumbnails reactively
  const [threeSpeakThumbnails, setThreeSpeakThumbnails] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    const ids = extract3SpeakVideoIds(body, jsonMetadata);
    for (const id of ids) {
      const c = getCached3SpeakData(id);
      if (c?.thumbnail) map[id] = c.thumbnail;
    }
    return map;
  });

  useEffect(() => {
    let active = true;
    const ids = extract3SpeakVideoIds(body, jsonMetadata);
    ids.forEach((id) => {
      get3SpeakData(id).then((data) => {
        if (!active || !data?.thumbnail) return;
        const thumbUrl = data.thumbnail;
        setThreeSpeakThumbnails((prev) => {
          if (prev[id] === thumbUrl) return prev;
          return { ...prev, [id]: thumbUrl };
        });
      });
    });
    return () => {
      active = false;
    };
  }, [body, jsonMetadata]);

  const images = useMemo(
    () => extractSnapImages(body || '', jsonMetadata, threeSpeakThumbnails),
    [body, jsonMetadata, threeSpeakThumbnails]
  );
  const hiveLinks = useMemo(
    () => extractHivePostLinks(body || '', { author, permlink }),
    [body, author, permlink]
  );
  const [failed, setFailed] = useState<Record<string, true>>({});
  const [activeGalleryIndex, setActiveGalleryIndex] = useState<number | null>(null);

  const shownImages = images.filter((url) => !failed[imageIdentity(url)]);

  useEffect(() => {
    if (activeGalleryIndex === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveGalleryIndex(null);
      if (event.key === 'ArrowRight') {
        setActiveGalleryIndex((index) => index === null ? null : (index + 1) % shownImages.length);
      }
      if (event.key === 'ArrowLeft') {
        setActiveGalleryIndex((index) => index === null ? null : (index - 1 + shownImages.length) % shownImages.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeGalleryIndex, shownImages.length]);

  const { isTruncated, truncatedText } = useMemo(() => {
    if (!enableTruncation) {
      return { isTruncated: false, truncatedText: body };
    }
    return truncateSnapText(body || '', charLimit);
  }, [body, enableTruncation, charLimit]);

  const activeText = isTruncated && !isExpanded ? truncatedText : body;

  const safeHtml = useMemo(() => {
    const hidden = [
      ...shownImages,
      ...hiveLinks.map((link) => link.raw),
    ];
    const text = collapseDuplicateHashtags(stripResolvedSnapUrls(activeText || '', hidden));
    return markdownToSafeHtml(text, { jsonMetadata, threeSpeakThumbnails });
  }, [activeText, shownImages, hiveLinks, jsonMetadata, threeSpeakThumbnails]);
  const displayHtml = useMemo(() => {
    const linkedUrls = linkifyPlainUrls(safeHtml);
    return onSelectTag ? linkifyHashtags(linkedUrls) : linkedUrls;
  }, [safeHtml, onSelectTag]);

  return (
    <div>
      {safeHtml && (
        <div
          onClick={(e) => {
            const target = e.target as HTMLElement;
            const tagButton = target.closest<HTMLElement>('[data-snap-tag]');
            if (tagButton) {
              e.preventDefault();
              e.stopPropagation();
              onSelectTag?.(tagButton.dataset.snapTag || '');
              return;
            }
            if (target.closest('.nebulosa-lazy-video-facade, .nebulosa-video-container')) {
              return;
            }
            const anchor = target.closest<HTMLAnchorElement>('a');
            if (anchor) {
              e.preventDefault();
              e.stopPropagation();
              const href = anchor.getAttribute('href');
              if (!href) return;

              let destination: URL;
              try {
                destination = new URL(href, window.location.href);
              } catch {
                return;
              }

              if (destination.protocol !== 'https:' && destination.protocol !== 'http:') return;

              const hivePost = extractHivePostLinks(destination.href)[0];
              if (hivePost) {
                void handleOpenNotificationPost(hivePost.author, hivePost.permlink);
                return;
              }

              if (!isTrustedSnapLink(destination)) {
                const shouldContinue = window.confirm(
                  `This link will take you outside Nebulosa.\n\nDestination: ${destination.hostname}\n${destination.href}\n\nContinue only if you trust this site.`
                );
                if (!shouldContinue) return;
              }

              if (destination.origin === window.location.origin) {
                navigate(`${destination.pathname}${destination.search}${destination.hash}`);
              } else {
                window.open(destination.href, '_blank', 'noopener,noreferrer');
              }
              return;
            }
            onOpenDetail?.();
          }}
          className={`${textClassName} ${onOpenDetail ? 'cursor-pointer' : ''}`}
          dangerouslySetInnerHTML={{ __html: displayHtml }}
        />
      )}

      {isTruncated && (
        <div className="mt-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition cursor-pointer select-none py-0.5"
          >
            <span>{isExpanded ? 'Show less' : 'Show more'}</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      )}

      {hiveLinks.map((link) => (
        <ResnapCard
          key={`${link.author}/${link.permlink}`}
          link={link}
          onOpen={() => void handleOpenNotificationPost(link.author, link.permlink)}
        />
      ))}

      {shownImages.length > 0 && (
        <div className={`mt-3 overflow-hidden rounded-2xl ${shownImages.length === 1 ? '' : 'grid grid-cols-2 gap-1.5'}`}>
          {shownImages.slice(0, shownImages.length === 1 ? 1 : 4).map((url, index) => (
            <button
              key={imageIdentity(url)}
              type="button"
              aria-label={`Open image ${index + 1} of ${shownImages.length}`}
              onClick={(event) => {
                event.stopPropagation();
                setActiveGalleryIndex(index);
              }}
              className={`relative block min-w-0 overflow-hidden border border-slate-100 bg-slate-50 text-left dark:border-slate-800 dark:bg-slate-800/40 ${shownImages.length === 1 ? 'w-full rounded-2xl' : 'aspect-[16/10] rounded-xl'}`}
            >
              <SafeSnapImage
                src={url}
                alt={`Snap image ${index + 1}`}
                className={`${shownImages.length === 1 ? 'max-h-96' : 'h-full'} w-full`}
                imgClassName={`${shownImages.length === 1 ? 'max-h-80' : 'h-full'} w-full object-cover`}
                aspectRatio={shownImages.length === 1 ? '16/9' : undefined}
                onStatus={(status) => {
                  if (status !== 'error') return;
                  const key = imageIdentity(url);
                  setFailed((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
                }}
              />
              {shownImages.length > 4 && index === 3 && (
                <span className="absolute inset-0 flex items-center justify-center bg-slate-950/60 text-2xl font-bold text-white">
                  +{shownImages.length - 4}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {activeGalleryIndex !== null && shownImages[activeGalleryIndex] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Snap image gallery"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 p-4 backdrop-blur-sm"
          onClick={() => setActiveGalleryIndex(null)}
        >
          <button
            type="button"
            aria-label="Close gallery"
            onClick={() => setActiveGalleryIndex(null)}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="absolute left-1/2 top-5 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-xs font-medium text-white">
            {activeGalleryIndex + 1} / {shownImages.length}
          </div>
          {shownImages.length > 1 && (
            <button
              type="button"
              aria-label="Previous image"
              onClick={(event) => {
                event.stopPropagation();
                setActiveGalleryIndex((activeGalleryIndex - 1 + shownImages.length) % shownImages.length);
              }}
              className="absolute left-3 z-10 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 sm:left-6"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          <div className="flex h-[82vh] w-[88vw] max-w-6xl items-center justify-center" onClick={(event) => event.stopPropagation()}>
            <SafeSnapImage
              src={shownImages[activeGalleryIndex]}
              alt={`Snap image ${activeGalleryIndex + 1} of ${shownImages.length}`}
              className="h-full w-full bg-transparent"
              imgClassName="h-full w-full object-contain"
            />
          </div>
          {shownImages.length > 1 && (
            <button
              type="button"
              aria-label="Next image"
              onClick={(event) => {
                event.stopPropagation();
                setActiveGalleryIndex((activeGalleryIndex + 1) % shownImages.length);
              }}
              className="absolute right-3 z-10 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 sm:right-6"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
