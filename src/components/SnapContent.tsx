import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
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

interface SnapContentProps {
  body: string;
  jsonMetadata?: HivePost['json_metadata'];
  author: string;
  permlink: string;
  onSelectTag?: (tag: string) => void;
  onOpenImage?: (url: string) => void;
  onOpenDetail?: () => void;
  textClassName?: string;
  charLimit?: number;
  enableTruncation?: boolean;
}

function ResnapCard({ link }: { link: HivePostLink }) {
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

  const href = link.raw.startsWith('http') ? link.raw : `https://${link.raw}`;
  const title = post?.title?.trim() || `Post by @${link.author}`;
  const description = post ? getPostSnippet(post.body, 180) : 'Loading post from Hive…';

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 block rounded-2xl border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-950/40 hover:border-blue-300 dark:hover:border-blue-700 transition"
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
    </a>
  );
}

export function SnapContent({
  body,
  jsonMetadata,
  author,
  permlink,
  onSelectTag,
  onOpenImage,
  onOpenDetail,
  textClassName = '',
  charLimit = 300,
  enableTruncation = true,
}: SnapContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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

  const shownImages = images.filter((url) => !failed[imageIdentity(url)]);

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
  const displayHtml = useMemo(() => onSelectTag ? linkifyHashtags(safeHtml) : safeHtml, [safeHtml, onSelectTag]);

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

              if (!isTrustedSnapLink(destination)) {
                const shouldContinue = window.confirm(
                  `This link will take you outside Nebulosa.\n\nDestination: ${destination.hostname}\n${destination.href}\n\nContinue only if you trust this site.`
                );
                if (!shouldContinue) return;
              }

              window.open(destination.href, '_blank', 'noopener,noreferrer');
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
        <ResnapCard key={`${link.author}/${link.permlink}`} link={link} />
      ))}

      {shownImages.length > 0 && (
        <div className={`mt-3 ${shownImages.length === 1 ? '' : 'grid gap-2 grid-cols-2'}`}>
          {shownImages.map((url) => (
            <div
              key={imageIdentity(url)}
              onClick={(event) => {
                event.stopPropagation();
                onOpenImage?.(url);
              }}
              className="relative rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 cursor-pointer"
            >
              <SafeSnapImage
                src={url}
                alt="Snap attachment"
                className="w-full h-full max-h-96"
                imgClassName="w-full h-full object-cover max-h-80"
                aspectRatio="16/9"
                onStatus={(status) => {
                  if (status !== 'error') return;
                  const key = imageIdentity(url);
                  setFailed((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
