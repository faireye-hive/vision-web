import DOMPurify from 'dompurify';
import { buildVideoFacadeHtml, transformVideoEmbedsInMarkdown } from './videoEmbeds';

export const ALLOWED_IMAGE_DOMAINS = [
  'hive.blog',
  'ecency.com',
  'peakd.com',
  'steemitimages.com',
  'ipfs.io',
  'inleo.io',
  'leopedia.io',
  'liketu.com',
  'tenor.com',
  'giphy.com',
  'giphyusercontent.com',
  'static.klipy.com',
  'static1.klipy.com',
  'static2.klipy.com',
  'imgur.com',
  'ytimg.com',
  '3speak.tv',
  '3speak.online',
  'ipfs-3speak.b-cdn.net',
  'actifit.io',
  'skatehype.com',
  'img.truvvle.com'
];

function getValidatedProxySource(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.toLowerCase() !== 'wsrv.nl' || parsed.protocol !== 'https:') return null;
    const source = parsed.searchParams.get('url');
    if (!source) return null;
    const sourceUrl = /^https?:\/\//i.test(source) ? new URL(source) : new URL(`https://${source}`);
    const host = sourceUrl.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(sourceUrl.protocol) || host === 'wsrv.nl') return null;
    const allowed = ALLOWED_IMAGE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
    return allowed ? sourceUrl.toString() : null;
  } catch {
    return null;
  }
}

export function isAllowedImageHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    // Video facades may already contain a wsrv.nl URL. Trust it only when its
    // source parameter points to one of our allowlisted image hosts.
    if (host === 'wsrv.nl') {
      return Boolean(getValidatedProxySource(url));
    }
    return ALLOWED_IMAGE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export function getSafeImageUrl(url: string | null, options?: { width?: number }): string | null {
  if (!url || !isAllowedImageHost(url)) return null;
  // 3Speak's own image service already serves optimized WebP posters. Sending
  // these through a second image proxy has caused broken video thumbnails.
  try {
    if (new URL(url).hostname.toLowerCase() === 'images.3speak.tv') return url;
  } catch {
    return null;
  }
  if (/^https:\/\/wsrv\.nl\//i.test(url)) {
    const sourceUrl = getValidatedProxySource(url);
    return sourceUrl ? buildProxiedImageUrl(sourceUrl) : null;
  }
  if (!IMAGE_PROXY_ENABLED) return url;

  const stripped = url.replace(/^https?:\/\//, '');
  const params = new URLSearchParams({
    url: stripped,
    w: String(options?.width ?? 800), // miniatura não precisa de 1600px como o corpo do post
    output: 'webp',
    default: url
  });
  return `https://wsrv.nl/?${params.toString()}`;
}

// Ativa/desativa o proxy globalmente — útil pra debug ou fallback rápido
export const IMAGE_PROXY_ENABLED = true;

/**
 * Reescreve a URL pra passar pelo wsrv.nl (ex-images.weserv.nl).
 * IMPORTANTE: só chame isso DEPOIS de confirmar isAllowedImageHost(url) === true.
 * O wsrv.nl busca qualquer URL passada a ele, então nunca proxyie uma URL
 * que ainda não passou pelo whitelist — isso anularia a proteção.
 */
function buildProxiedImageUrl(originalUrl: string): string {
  // wsrv.nl exige o host+path sem o "https://" no parâmetro url=
  const stripped = originalUrl.replace(/^https?:\/\//, '');
  const params = new URLSearchParams({
    url: stripped,
    w: '1600',        // teto de largura: também reduz payload / risco de imagem gigante
    output: 'webp',   // reencoda; some formatos maliciosos disfarçados de imagem falham aqui
    default: originalUrl // fallback do próprio wsrv.nl se a busca falhar
  });
  return `https://wsrv.nl/?${params.toString()}`;
}

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    const href = node.getAttribute('href') || '';
    const isInternalHiveRoute = href.startsWith('/post/@') || href.startsWith('/profile/@');
    if (isInternalHiveRoute) {
      node.removeAttribute('target');
      node.removeAttribute('rel');
    } else {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    }
  }

  if (node.tagName === 'IMG') {
    node.setAttribute('loading', 'lazy');
    const src = node.getAttribute('src');

    if (!src || !isAllowedImageHost(src)) {
      if (src) node.setAttribute('data-blocked-src', src);
      node.removeAttribute('src');
      node.setAttribute('alt', node.getAttribute('alt') || 'Imagem bloqueada (origem não confiável)');
      node.classList.add('nebulosa-blocked-image');
    } else {
      // Domínio confiável: agora sim pode passar pelo proxy com segurança
      const isValidatedProxy = /^https:\/\/wsrv\.nl\//i.test(src);
      const is3SpeakPoster = (() => {
        try { return new URL(src).hostname.toLowerCase() === 'images.3speak.tv'; } catch { return false; }
      })();
      const finalSrc = IMAGE_PROXY_ENABLED && !isValidatedProxy && !is3SpeakPoster ? buildProxiedImageUrl(src) : src;
      node.setAttribute('src', finalSrc);
      node.setAttribute('data-original-src', src); // guarda o original, útil pra debug/"abrir original"
    }
  }
});

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'blockquote', 'pre', 'code',
  'ul', 'ol', 'li',
  'strong', 'b', 'em', 'i', 'u', 's', 'del', 'strike', 'mark', 'sub', 'sup',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img', 'figure', 'figcaption',
  'a', 'span', 'div', 'center',
];

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel',
  'width', 'height', 'align', 'loading', 'data-video-placeholder'
];

export interface PostHeading {
  id: string;
  text: string;
  level: number;
}

const CONTENT_CLASSES = new Set([
  'article-content', 'nebulosa-centered-block', 'nebulosa-markdown-table-scroll',
  'text-left', 'text-center', 'text-right', 'text-justify', 'my-2', 'pull-left', 'pull-right'
]);

function sanitizeMarkup(dirtyHtml: string, generatedVideo = false): string {
  return DOMPurify.sanitize(dirtyHtml, {
    ALLOWED_TAGS: generatedVideo ? [...ALLOWED_TAGS, 'svg', 'path'] : ALLOWED_TAGS,
    ALLOWED_ATTR: generatedVideo
      ? [...ALLOWED_ATTR, 'data-video-platform', 'data-video-id', 'data-video-poster', 'role', 'tabindex', 'aria-label', 'viewBox', 'd']
      : ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
  });
}

/** Add safe links to plain text nodes after sanitization, without interpreting
 * post content as HTML or creating links inside existing links/code. */
function linkifyPostTextNodes(root: ParentNode): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  const tokenPattern = /https?:\/\/[^\s<>"']+|@[a-z][a-z0-9.-]{1,14}[a-z0-9]/gi;
  for (const textNode of textNodes) {
    const parent = textNode.parentElement;
    if (!parent || parent.closest('a, code, pre, script, style')) continue;

    const value = textNode.nodeValue || '';
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    let changed = false;
    tokenPattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenPattern.exec(value))) {
      const token = match[0];
      const start = match.index;
      const isUrl = /^https?:\/\//i.test(token);
      let label = token;
      let href = '';

      if (isUrl) {
        // Keep sentence punctuation outside the clickable URL, and retain
        // closing parentheses only when they belong to the URL itself.
        while (/[.,!?;:]$/.test(label)) label = label.slice(0, -1);
        while (label.endsWith(')') && (label.match(/\)/g)?.length || 0) > (label.match(/\(/g)?.length || 0)) {
          label = label.slice(0, -1);
        }
        if (!label) continue;
        try {
          const parsed = new URL(label);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
          href = parsed.href;
        } catch {
          continue;
        }
      } else {
        const previous = value[start - 1] || '';
        const next = value[start + token.length] || '';
        // Do not turn email addresses or longer invalid usernames into links.
        if (/[\w.+-]/.test(previous) || /[\w.-]/.test(next)) continue;
        const username = token.slice(1).toLowerCase();
        href = `/profile/@${encodeURIComponent(username)}`;
      }

      if (start > cursor) fragment.append(document.createTextNode(value.slice(cursor, start)));
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.textContent = label;
      if (isUrl) {
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer nofollow';
      }
      fragment.append(anchor);
      cursor = start + label.length;
      // If punctuation was trimmed from a URL, it will be copied as plain text
      // before processing the next token (or by the final tail below).
      changed = true;
      if (cursor < start + token.length) {
        fragment.append(document.createTextNode(value.slice(cursor, start + token.length)));
        cursor = start + token.length;
      }
    }

    if (!changed) continue;
    if (cursor < value.length) fragment.append(document.createTextNode(value.slice(cursor)));
    textNode.replaceWith(fragment);
  }
}

export function sanitizeHtml(dirtyHtml: string): string {
  return sanitizeMarkup(dirtyHtml);
}

function escapeHtmlEntities(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const RAW_TAG_REGEX = /<\/?[a-zA-Z][a-zA-Z0-9]*(?:\s+[^<>]*)?\/?>/g;

function protectRawTags(text: string, store: string[]): string {
  return text.replace(RAW_TAG_REGEX, (tag) => {
    const idx = store.length;
    store.push(tag);
    return `\u0000TAG${idx}\u0000`;
  });
}

function restoreRawTags(text: string, store: string[]): string {
  let result = text;
  store.forEach((tag, i) => {
    result = result.split(`\u0000TAG${i}\u0000`).join(tag);
  });
  return result;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function toInternalHivePath(href: string): string | null {
  const shorthand = href.trim().match(/^\/?@([a-z0-9.-]+)(?:\/([a-z0-9._-]+))?\/?$/i);
  if (shorthand) {
    const author = encodeURIComponent(shorthand[1].toLowerCase());
    return shorthand[2]
      ? `/post/@${author}/${encodeURIComponent(shorthand[2])}`
      : `/profile/@${author}`;
  }

  let candidate = href.trim();
  if (/^(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/|$)/i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const hiveFrontends = new Set(['hive.blog', 'peakd.com', 'ecency.com', 'inleo.io', 'leofinance.io', '3speak.tv']);
    if (!hiveFrontends.has(host)) return null;

    const postPath = url.pathname.match(/(?:^|\/)@([a-z0-9.-]+)\/([a-z0-9._-]+)\/?$/i);
    if (!postPath) return null;
    return `/post/@${encodeURIComponent(postPath[1].toLowerCase())}/${encodeURIComponent(postPath[2])}`;
  } catch {
    return null;
  }
}

function splitMarkdownTableRow(line: string): string[] {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  return row.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function convertMarkdownTables(text: string, tableStore: string[]): string {
  const lines = text.split(/\r?\n/);
  const output: string[] = [];

  for (let index = 0; index < lines.length;) {
    const headerLine = lines[index];
    const separatorLine = lines[index + 1] || '';
    const headers = headerLine.includes('|') ? splitMarkdownTableRow(headerLine) : [];
    const separators = separatorLine.includes('|') ? splitMarkdownTableRow(separatorLine) : [];
    const isSeparator = headers.length > 0 && separators.length === headers.length && separators.every((cell) => /^:?-+:?$/.test(cell));

    if (!isSeparator) {
      output.push(headerLine);
      index += 1;
      continue;
    }

    const rows: string[][] = [];
    index += 2;
    while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
      rows.push(splitMarkdownTableRow(lines[index]));
      index += 1;
    }

    const headHtml = headers.map((cell) => `<th>${escapeHtmlEntities(cell)}</th>`).join('');
    const bodyHtml = rows.map((row) => {
      const cells = headers.map((_header, cellIndex) => `<td>${escapeHtmlEntities(row[cellIndex] || '')}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    const tableHtml = `<div class="nebulosa-markdown-table-scroll"><table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
    const tableIndex = tableStore.push(tableHtml) - 1;
    output.push(`\u0000TABLE${tableIndex}\u0000`);
  }

  return output.join('\n');
}

export interface MarkdownSanitizeOptions {
  threeSpeakThumbnails?: Record<string, string>;
  jsonMetadata?: any;
}

function groupAdjacentImages(root: DocumentFragment): void {
  const contentBlocks = root.querySelectorAll('.article-content');

  contentBlocks.forEach((content) => {
    const collectImages = (node: Node, images: HTMLImageElement[]): boolean => {
      if (node.nodeType === Node.TEXT_NODE) return !node.textContent?.trim();
      if (!(node instanceof HTMLElement)) return false;
      if (node.tagName === 'IMG') {
        if (node.style.display === 'none' || !node.getAttribute('src') || node.closest('.nebulosa-lazy-video-facade, .nebulosa-video-container')) return false;
        images.push(node as HTMLImageElement);
        return true;
      }
      if (node.tagName === 'BR') return true;
      if (!['P', 'FIGURE', 'DIV', 'CENTER'].includes(node.tagName)) return false;
      if (node.matches('.nebulosa-lazy-video-facade, .nebulosa-video-container')) return false;
      return Array.from(node.childNodes).every((child) => collectImages(child, images));
    };

    const children = Array.from(content.childNodes);
    for (let index = 0; index < children.length;) {
      const first = children[index];
      const firstImages: HTMLImageElement[] = [];
      if (!collectImages(first, firstImages) || firstImages.length === 0) {
        index += 1;
        continue;
      }

      const blocks: Node[] = [first];
      const images = [...firstImages];
      let cursor = index + 1;

      while (cursor < children.length) {
        const next = children[cursor];
        if (next.nodeType === Node.TEXT_NODE && !next.textContent?.trim()) {
          blocks.push(next);
          cursor += 1;
          continue;
        }

        const nextImages: HTMLImageElement[] = [];
        if (!collectImages(next, nextImages) || nextImages.length === 0) break;
        blocks.push(next);
        images.push(...nextImages);
        cursor += 1;
      }

      if (images.length > 1) {
        const gallery = document.createElement('div');
        gallery.className = 'nebulosa-image-gallery';
        gallery.setAttribute('role', 'region');
        gallery.setAttribute('aria-label', 'Consecutive post images');
        const track = document.createElement('div');
        track.className = 'nebulosa-gallery-track';
        track.setAttribute('tabindex', '0');
        track.setAttribute('aria-label', 'Swipe or scroll through images');
        const thumbnails = document.createElement('div');
        thumbnails.className = 'nebulosa-gallery-thumbnails';
        thumbnails.setAttribute('role', 'group');
        thumbnails.setAttribute('aria-label', 'Choose an image');
        content.insertBefore(gallery, first);
        images.forEach((image, imageIndex) => {
          track.appendChild(image);

          const thumbnail = document.createElement('button');
          thumbnail.type = 'button';
          thumbnail.className = 'nebulosa-gallery-thumbnail';
          thumbnail.setAttribute('data-gallery-select', String(imageIndex));
          thumbnail.setAttribute('aria-label', `Show image ${imageIndex + 1} of ${images.length}`);
          thumbnail.setAttribute('aria-pressed', String(imageIndex === 0));
          thumbnail.title = `Image ${imageIndex + 1}`;

          const thumbnailImage = document.createElement('img');
          const originalSrc = image.getAttribute('data-original-src') || image.getAttribute('src');
          thumbnailImage.src = getSafeImageUrl(originalSrc, { width: 112 }) || image.getAttribute('src') || '';
          thumbnailImage.alt = '';
          thumbnailImage.loading = 'lazy';
          thumbnailImage.decoding = 'async';
          thumbnail.appendChild(thumbnailImage);
          thumbnails.appendChild(thumbnail);
        });
        gallery.append(track, thumbnails);
        blocks.forEach((block) => block.parentNode?.removeChild(block));
        index = cursor;
      } else {
        index += 1;
      }
    }
  });
}

/** Remove blank paragraphs and line breaks the markdown wrapper can create
 * around legacy centered images. The HTML is already sanitized at this point. */
function compactCenteredImageSpacing(root: DocumentFragment): void {
  root.querySelectorAll<HTMLElement>('.nebulosa-centered-block, center').forEach((block) => {
    if (!block.querySelector('img')) return;

    // A line break inside a centered image block only adds vertical whitespace.
    block.querySelectorAll('br').forEach((lineBreak) => lineBreak.remove());

    const previous = block.previousElementSibling;
    if (previous?.tagName === 'BR') previous.remove();
    const next = block.nextElementSibling;
    if (next?.tagName === 'BR') next.remove();
  });

  root.querySelectorAll<HTMLParagraphElement>('.article-content p').forEach((paragraph) => {
    const hasVisibleText = Boolean(paragraph.textContent?.trim());
    const hasContent = paragraph.querySelector('img, iframe, video, table, ul, ol, blockquote, hr, pre, svg');
    if (!hasVisibleText && !hasContent) paragraph.remove();
  });
}

export function markdownToSafeHtmlWithHeadings(
  markdown: string,
  options?: MarkdownSanitizeOptions
): { html: string; headings: PostHeading[] } {
  if (!markdown || typeof markdown !== 'string') return { html: '', headings: [] };

  const headings: PostHeading[] = [];
  let headingIndex = 0;
  const tagStore: string[] = [];

  let text = markdown.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  text = text
    .replace(/<center\b[^>]*>/gi, '<div class="text-center nebulosa-centered-block">')
    .replace(/<\/center>/gi, '</div>')
    .replace(/<div\s+align=["']?justify["']?>/gi, '<div class="text-justify my-2">')
    .replace(/<div\s+class=["']?text-justify["']?>/gi, '<div class="text-justify my-2">');

  // Convert YouTube, 3Speak, and BitChute links/iframes to click-to-load video facades
  // Keep app-generated player markup separate from the author's HTML.
  const videoFacades = new Map<string, string>();
  let videoPlaceholderPrefix: string | undefined;
  text = transformVideoEmbedsInMarkdown(text, options, (info) => {
    videoPlaceholderPrefix ??= crypto.getRandomValues(new Uint32Array(4)).join('-');
    const key = `${videoPlaceholderPrefix}-${videoFacades.size}`;
    videoFacades.set(key, buildVideoFacadeHtml(info));
    return `<div data-video-placeholder="${key}"></div>`;
  });

  // Protege tags HTML já existentes no post (raw <img>, <div>, <sub>, <iframe> etc.)
  text = protectRawTags(text, tagStore);

  // Protege blocos e trechos de código
  const codeBlocks: string[] = [];
  text = text.replace(/```([a-zA-Z0-9]*)\n?([\s\S]*?)```/g, (_m, lang, code) => {
    const escaped = escapeHtmlEntities(code.replace(/\n$/, ''));
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${escaped}</code></pre>`);
    return `\u0000CODEBLOCK${idx}\u0000`;
  });

  const inlineCodes: string[] = [];
  text = text.replace(/`([^`\n]+)`/g, (_m, code) => {
    const escaped = escapeHtmlEntities(code);
    const idx = inlineCodes.length;
    inlineCodes.push(`<code>${escaped}</code>`);
    return `\u0000INLINECODE${idx}\u0000`;
  });

  // Protege pontuação escapada com "\" (ex: \_, \*, \[) para não disparar
  // negrito/itálico/listas indevidamente — restaura o caractere puro no final
  // Accept escaped-parenthesis links too, as commonly pasted into Hive posts.
  text = text.replace(/(\[[^\]\n]+\])\\\(([^)\s]+)\\?\)/g, '$1($2)');

  const escapedChars: string[] = [];
  text = text.replace(/\\([\\`*_{}\[\]()#+\-.!>~])/g, (_m, ch) => {
    const idx = escapedChars.length;
    escapedChars.push(ch);
    return `\u0000ESC${idx}\u0000`;
  });

  // Imagens em Markdown ![alt](url)
  text = text.replace(
    /!\[([\s\S]*?)\]\((https?:\/\/[^\s\)]+)\)/gi,
    '<img src="$2" alt="$1" />'
  );

  // 🔑 URLs de imagens soltas na linha — agora aceita fronteira de placeholder (\u0000)
  // além de espaço/quebra/">" , cobrindo o caso <center>URL</center>
  text = text.replace(
    /(^|[\s\n>\u0000])(https?:\/\/[^\s<"']+\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?[^\s<"']*)?)(?=$|[\s\n<\u0000])/gi,
    '$1<img src="$2" alt="Hive Image" />'
  );

  // Markdown links: web URLs, bare domains and Hive @author/permlink routes.
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, rawHref: string) => {
    const internalPath = toInternalHivePath(rawHref);
    let href = internalPath || rawHref;
    if (!internalPath && /^(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/|$)/i.test(href)) {
      href = `https://${href}`;
    }
    if (!internalPath && !/^https?:\/\//i.test(href)) return label;
    const safeHref = escapeHtmlAttribute(href);
    return internalPath
      ? `<a href="${safeHref}">${label}</a>`
      : `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  // 2ª passada: protege as tags <img>/<a> recém-geradas acima, antes do
  // negrito/itálico rodar (evita quebrar URLs com underscore, ex: vin_ales.jpg)
  text = protectRawTags(text, tagStore);

  // Protect remaining plain URLs from Markdown emphasis delimiters embedded
  // in their path. Run after Markdown images and links have been parsed.
  const plainUrls: string[] = [];
  text = text.replace(/https?:\/\/[^\s<>"']+/gi, (url) => {
    const idx = plainUrls.length;
    plainUrls.push(url);
    return `\u0000PLAINURL${idx}\u0000`;
  });

  // Markdown tables, including optional edge pipes and compact separators like |-|.
  const tableBlocks: string[] = [];
  text = convertMarkdownTables(text, tableBlocks);

  // Linhas separadoras — aceita marcadores espaçados: "---", "***", "* * *"
  text = text.replace(/^[ \t]*(?:[-*_][ \t]*){3,}$/gim, '<hr />');

  // Listas não-ordenadas
  text = text.replace(/(?:^[ \t]*[-*+] .+$\n?)+/gim, (block) => {
    const items = block
      .trim()
      .split(/\n/)
      .map((line) => line.replace(/^[ \t]*[-*+] /, '').trim())
      .filter(Boolean)
      .map((item) => `<li>${item}</li>`)
      .join('');
    return `<ul>${items}</ul>\n`;
  });

  // Listas ordenadas
  text = text.replace(/(?:^[ \t]*\d+\. .+$\n?)+/gim, (block) => {
    const items = block
      .trim()
      .split(/\n/)
      .map((line) => line.replace(/^[ \t]*\d+\.\s+/, '').trim())
      .filter(Boolean)
      .map((item) => `<li>${item}</li>`)
      .join('');
    return `<ol>${items}</ol>\n`;
  });

  // Blockquotes, com suporte a headings internos
  text = text.replace(
    /^(?:>[\t ]?[^\n]*\n?)+/gim,
    (match) => {
      const processedLines = match
        .split('\n')
        .map((line) => line.replace(/^>[\t ]?/, ''))
        .filter((line) => line.length > 0)
        .map((line) => {
          const headingMatch = line.match(/^(#{1,6})\s*(.*)$/);
          if (headingMatch) {
            const level = headingMatch[1].length;
            return `<h${level}>${headingMatch[2]}</h${level}>`;
          }
          return line;
        });
      return `<blockquote>${processedLines.join('<br />')}</blockquote>`;
    }
  );

  // Títulos de Markdown (h1-h6)
  text = text
    .replace(/^###### (.*$)/gim, '<h6>$1</h6>')
    .replace(/^##### (.*$)/gim, '<h5>$1</h5>')
    .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Ênfase inline
  text = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>');

  text = text.replace(/\u0000PLAINURL(\d+)\u0000/g, (_match, index: string) => plainUrls[Number(index)] || '');

  text = text.replace(/\n\s*\n/g, '</p><p>');
  text = text.replace(/(?<!>)\n(?!<)/g, '<br />\n');

  let html = `<div class="article-content"><p>${text}</p></div>`;

  html = restoreRawTags(html, tagStore);

  html = html.replace(/<h([1-6])([^>]*)>(.*?)<\/h\1>/gi, (match, levelStr, attrs, innerContent) => {
    const level = parseInt(levelStr, 10);
    const cleanText = innerContent.replace(/<[^>]+>/g, '').trim();
    if (!cleanText) return match;
    const id = `post-heading-${headingIndex++}`;
    headings.push({ id, text: cleanText, level });
    const cleanAttrs = attrs.replace(/\sid=(['"][^'"]*['"]|\S+)/gi, '');
    return `<h${level} id="${id}" ${cleanAttrs}>${innerContent}</h${level}>`;
  });

  codeBlocks.forEach((codeHtml, i) => {
    html = html.split(`\u0000CODEBLOCK${i}\u0000`).join(codeHtml);
  });
  inlineCodes.forEach((codeHtml, i) => {
    html = html.split(`\u0000INLINECODE${i}\u0000`).join(codeHtml);
  });
  escapedChars.forEach((ch, i) => {
    html = html.split(`\u0000ESC${i}\u0000`).join(ch);
  });
  tableBlocks.forEach((tableHtml, i) => {
    html = html.split(`\u0000TABLE${i}\u0000`).join(tableHtml);
  });

  const safeHtml = sanitizeHtml(html);
  // Some Hive posts contain an embedded player plus a separate “Watch on
  // 3Speak” link. That link can survive the Markdown conversion as a second
  // facade, so remove the CTA card after sanitization as a final dedupe pass.
  const template = document.createElement('template');
  template.innerHTML = safeHtml;
  for (const node of template.content.querySelectorAll('[class], [id]')) {
    const classes = [...node.classList].filter((name) =>
      CONTENT_CLASSES.has(name) || (node.tagName === 'CODE' && /^language-[a-z0-9]+$/i.test(name))
    );
    if (classes.length) node.setAttribute('class', classes.join(' '));
    else node.removeAttribute('class');

    if (!/^H[1-6]$/.test(node.tagName) || !/^post-heading-\d+$/.test(node.id)) {
      node.removeAttribute('id');
    }
  }
  for (const image of template.content.querySelectorAll('img')) {
    if (image.hasAttribute('src')) {
      image.classList.add('rounded-2xl', 'max-h-[600px]', 'w-auto', 'max-w-full', 'my-4',
        'mx-auto', 'block', 'shadow-xs', 'border', 'border-gray-100', 'dark:border-slate-800');
    } else if (image.hasAttribute('data-blocked-src')) {
      image.classList.add('nebulosa-blocked-image');
    }
  }
  for (const placeholder of template.content.querySelectorAll('[data-video-placeholder]')) {
    const facadeHtml = videoFacades.get(placeholder.getAttribute('data-video-placeholder') || '');
    placeholder.removeAttribute('data-video-placeholder');
    if (!facadeHtml || placeholder.tagName !== 'DIV') continue;
    const facade = document.createElement('template');
    facade.innerHTML = sanitizeMarkup(facadeHtml, true);
    placeholder.replaceWith(facade.content);
  }
  compactCenteredImageSpacing(template.content);
  let found3SpeakPlayer = false;
  template.content.querySelectorAll<HTMLElement>('.nebulosa-lazy-video-facade[data-video-platform="3speak"]').forEach((facade) => {
    const label = (facade.textContent || '').normalize('NFKD').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();
    const isWatchCta = label.includes('watch on 3speak');
    if (found3SpeakPlayer && isWatchCta) {
      facade.closest('.nebulosa-video-container')?.remove();
      return;
    }
    found3SpeakPlayer = true;
  });
  groupAdjacentImages(template.content);
  linkifyPostTextNodes(template.content);
  return { html: template.innerHTML, headings };
}

export function markdownToSafeHtml(
  markdown: string,
  options?: MarkdownSanitizeOptions
): string {
  return markdownToSafeHtmlWithHeadings(markdown, options).html;
}
