import DOMPurify from 'dompurify';

// Configure DOMPurify hook to automatically secure external links
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer nofollow');
  }
  if (node.tagName === 'IMG') {
    node.setAttribute('loading', 'lazy');
    // Ensure image source is http or https
    const src = node.getAttribute('src');
    if (src && !src.startsWith('https://') && !src.startsWith('http://')) {
      node.removeAttribute('src');
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
  'a', 'span', 'div'
];

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel',
  'width', 'height', 'align', 'loading'
];

/**
 * Sanitize raw HTML from blockchain posts against XSS injections
 */
export function sanitizeHtml(dirtyHtml: string): string {
  if (!dirtyHtml) return '';
  return DOMPurify.sanitize(dirtyHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|hive):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    ADD_ATTR: ['target', 'rel']
  });
}

/**
 * Parses markdown body to sanitized HTML with XSS prevention
 */
export function markdownToSafeHtml(markdown: string): string {
  if (!markdown) return '';

  let html = markdown
    // Escape dangerous raw script tags first
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Images: ![alt](url)
    .replace(/!\[(.*?)\]\((https?:\/\/[^\s\)]+)\)/g, '<img src="$2" alt="$1" class="rounded-xl max-h-[550px] w-auto max-w-full my-4 border border-gray-200" />')
    // Standard links: [text](url)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2" class="text-blue-600 font-semibold hover:underline">$1</a>')
    // Bold: **text** or __text__
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    // Italics: *text* or _text_
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    // Headers
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-gray-900 mt-6 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-gray-900 mt-8 mb-3">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-gray-900 mt-8 mb-4">$1</h1>')
    // Blockquotes
    .replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-blue-500 pl-4 py-2 my-3 italic text-gray-700 bg-blue-50/40 rounded-r-lg">$1</blockquote>')
    // Code blocks
    .replace(/```([a-z]*)\n([\s\S]*?)```/g, '<pre class="bg-gray-900 text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-x-auto my-4 border border-gray-800"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-rose-600 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>')
    // Unordered lists
    .replace(/^\s*[-*+]\s+(.*$)/gim, '<li class="ml-4 list-disc text-gray-700">$1</li>')
    // Paragraphs / newlines
    .replace(/\n\s*\n/g, '</p><p class="mb-4 leading-relaxed text-gray-800">');

  html = `<div class="prose prose-slate max-w-none text-sm sm:text-base leading-relaxed"><p class="mb-4 leading-relaxed text-gray-800">${html}</p></div>`;

  // Always run through DOMPurify to strip any remaining malicious constructs or injection attempts
  return sanitizeHtml(html);
}
