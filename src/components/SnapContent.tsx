import { useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { HivePost, getPost, getPostSnippet, getHiveAvatarUrl } from '../services/hiveApi';
import { markdownToSafeHtml } from '../utils/sanitize';
import {
  HivePostLink,
  collapseDuplicateHashtags,
  extractHashtags,
  extractHivePostLinks,
  extractSnapImages,
  imageIdentity,
  stripResolvedSnapUrls,
} from '../services/shortsApi';
import { SafeSnapImage } from './SafeSnapImage';

interface SnapContentProps {
  body: string;
  jsonMetadata?: HivePost['json_metadata'];
  author: string;
  permlink: string;
  onSelectTag?: (tag: string) => void;
  onOpenImage?: (url: string) => void;
  onOpenDetail?: () => void;
  textClassName?: string;
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
}: SnapContentProps) {
  const images = useMemo(() => extractSnapImages(body || '', jsonMetadata), [body, jsonMetadata]);
  const hiveLinks = useMemo(
    () => extractHivePostLinks(body || '', { author, permlink }),
    [body, author, permlink]
  );
  const hashtags = useMemo(() => extractHashtags(body || ''), [body]);
  const [failed, setFailed] = useState<Record<string, true>>({});

  const shownImages = images.filter((url) => !failed[imageIdentity(url)]);
  const safeHtml = useMemo(() => {
    const hidden = [
      ...shownImages,
      ...hiveLinks.map((link) => link.raw),
    ];
    const text = collapseDuplicateHashtags(stripResolvedSnapUrls(body || '', hidden));
    return markdownToSafeHtml(text);
  }, [body, shownImages, hiveLinks]);

  return (
    <div>
      {safeHtml && (
        <div
          onClick={onOpenDetail}
          className={`${textClassName} ${onOpenDetail ? 'cursor-pointer' : ''}`}
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      )}

      {hiveLinks.map((link) => (
        <ResnapCard key={`${link.author}/${link.permlink}`} link={link} />
      ))}

      {hashtags.length > 0 && onSelectTag && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {hashtags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onSelectTag(tag)}
              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50/80 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-2.5 py-1 rounded-full transition cursor-pointer"
              title={`Filter shorts by #${tag}`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

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
