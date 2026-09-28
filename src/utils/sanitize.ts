import DOMPurify from 'dompurify';

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
  '3speak.tv',
  'actifit.io',
  'skatehype.com',
];

export function isAllowedImageHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_IMAGE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export function getSafeImageUrl(url: string | null, options?: { width?: number }): string | null {
  if (!url || !isAllowedImageHost(url)) return null;
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
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer nofollow');
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
      const finalSrc = IMAGE_PROXY_ENABLED ? buildProxiedImageUrl(src) : src;
      node.setAttribute('src', finalSrc);
      node.setAttribute('data-original-src', src); // guarda o original, útil pra debug/"abrir original"
      node.classList.add(
        'rounded-2xl', 'max-h-[600px]', 'w-auto', 'max-w-full', 'my-4',
        'mx-auto', 'block', 'shadow-xs', 'border', 'border-gray-100', 'dark:border-slate-800'
      );
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
  'a', 'span', 'div', 'center'
];

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel',
  'width', 'height', 'align', 'loading', 'style', 'data-align',
  'data-blocked-src', 'data-original-src'
];

export interface PostHeading {
  id: string;
  text: string;
  level: number;
}

export function sanitizeHtml(dirtyHtml: string): string {
  if (!dirtyHtml) return '';
  return DOMPurify.sanitize(dirtyHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|hive):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    ADD_ATTR: ['target', 'rel']
  });
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

export function markdownToSafeHtmlWithHeadings(markdown: string): { html: string; headings: PostHeading[] } {
  if (!markdown) return { html: '', headings: [] };

  const headings: PostHeading[] = [];
  let headingIndex = 0;
  const tagStore: string[] = [];

  let text = markdown.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  text = text
    .replace(/<center>/gi, '<div class="text-center my-4">')
    .replace(/<\/center>/gi, '</div>')
    .replace(/<div\s+align=["']?justify["']?>/gi, '<div class="text-justify my-2">')
    .replace(/<div\s+class=["']?text-justify["']?>/gi, '<div class="text-justify my-2">');

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

  // Links de texto Markdown [texto](url)
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // 2ª passada: protege as tags <img>/<a> recém-geradas acima, antes do
  // negrito/itálico rodar (evita quebrar URLs com underscore, ex: vin_ales.jpg)
  text = protectRawTags(text, tagStore);

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

  // Tabelas em Markdown
  text = text.replace(
    /^\|(.+)\|\r?\n\|( *[-:]+[-| :]*)\|\r?\n((?:\|.*\|\r?\n?)*)/gim,
    (match, headerRow, dividerRow, bodyRows) => {
      const headers = headerRow.split('|').map((h: string) => h.trim()).filter((h: string) => h !== '');
      const rows = bodyRows.trim().split('\n').map((row: string) =>
        row.split('|').map(cell => cell.trim()).filter(cell => cell !== '')
      );
      const thead = `<thead><tr>${headers.map((h: string) => `<th>${h}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows.map((r: string[]) => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`;
      return `<div class="overflow-x-auto my-6"><table>${thead}${tbody}</table></div>`;
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

  const safeHtml = sanitizeHtml(html);
  return { html: safeHtml, headings };
}

export function markdownToSafeHtml(markdown: string): string {
  return markdownToSafeHtmlWithHeadings(markdown).html;
}