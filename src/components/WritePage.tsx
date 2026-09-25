import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bold,
  Check,
  Code,
  Eye,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  Quote,
  Send,
  Sparkles,
  Trash2
} from 'lucide-react';
import { CATEGORY_DEFINITIONS } from '../data/categorySubtopics';
import { CurrentUser, KeychainService } from '../services/keychain';
import { HiveCommunity, listCommunities } from '../services/hiveApi';
import { listKnownLanguages } from '../utils/communityTaxonomy';
import { markdownToSafeHtml } from '../utils/sanitize';

interface WritePageProps {
  onClose: () => void;
  currentUser: CurrentUser | null;
  onRequireLogin: () => void;
  defaultCommunity?: string;
  joinedCommunities?: Record<string, boolean>;
}

type PayoutOption = '50-50' | '100-hp' | 'decline';

const TEMPLATES: Array<{ id: string; label: string; hint: string; title?: string; body: string; tags?: string }> = [
  {
    id: 'story',
    label: 'Story',
    hint: 'What happened, why it matters, what is next',
    body: '## What happened\n\n\n## Why it matters\n\n\n## What comes next\n\n',
    tags: 'hive storytelling'
  },
  {
    id: 'photo',
    label: 'Photo',
    hint: 'Image, caption, and where it was taken',
    body: '![describe the photo](https://)\n\n*Caption*\n\nWhere and when:\n\n',
    tags: 'photography'
  },
  {
    id: 'question',
    label: 'Question',
    hint: 'Context first, then the question',
    title: 'Question: ',
    body: '**Context**\n\n\n**The question**\n\n\n',
    tags: 'hive question'
  },
  {
    id: 'link',
    label: 'Link',
    hint: 'Share a source and your take',
    body: 'Source: [title](https://)\n\n**What I think**\n\n',
    tags: 'hive links'
  },
  {
    id: 'list',
    label: 'List',
    hint: 'A short roundup',
    body: '1. \n2. \n3. \n\n**How to choose**\n\n',
    tags: 'hive'
  }
];

const SHORTCUTS = [
  { keys: 'Ctrl/⌘ B', label: 'Bold' },
  { keys: 'Ctrl/⌘ I', label: 'Italic' },
  { keys: 'Ctrl/⌘ K', label: 'Link' },
  { keys: 'Ctrl/⌘ Enter', label: 'Publish' },
  { keys: 'Ctrl/⌘ Shift E', label: 'Preview' }
];

function readDraft(key: string, fallback = '') {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function buildCommentOptions(author: string, permlink: string, payout: PayoutOption) {
  return JSON.stringify({
    author,
    permlink,
    max_accepted_payout: payout === 'decline' ? '0.000 HBD' : '1000000.000 HBD',
    percent_hbd: payout === '100-hp' ? 0 : 10000,
    allow_votes: true,
    allow_curation_rewards: payout !== 'decline',
    extensions: []
  });
}

export const WritePage: React.FC<WritePageProps> = ({
  onClose,
  currentUser,
  onRequireLogin,
  defaultCommunity = '',
  joinedCommunities = {}
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mobilePane, setMobilePane] = useState<'edit' | 'preview'>('edit');
  const [title, setTitle] = useState(() => readDraft('hive_draft_title'));
  const [body, setBody] = useState(() => readDraft('hive_draft_body'));
  const [tagsInput, setTagsInput] = useState(() => readDraft('hive_draft_tags', 'hive'));
  const [payoutOption, setPayoutOption] = useState<PayoutOption>(() => {
    const saved = readDraft('hive_draft_payout', '50-50');
    return saved === '100-hp' || saved === 'decline' ? saved : '50-50';
  });
  const [selectedCommunity, setSelectedCommunity] = useState(
    () => defaultCommunity || readDraft('hive_draft_community')
  );
  const [language, setLanguage] = useState(() => readDraft('hive_draft_lang'));
  const [imageUrl, setImageUrl] = useState('');
  const [communities, setCommunities] = useState<HiveCommunity[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('hive_draft_title', title);
    localStorage.setItem('hive_draft_body', body);
    localStorage.setItem('hive_draft_tags', tagsInput);
    localStorage.setItem('hive_draft_payout', payoutOption);
    localStorage.setItem('hive_draft_community', selectedCommunity);
    localStorage.setItem('hive_draft_lang', language);
  }, [title, body, tagsInput, payoutOption, selectedCommunity, language]);

  useEffect(() => {
    let mounted = true;
    listCommunities('rank', 40)
      .then((data) => {
        if (mounted) setCommunities(data || []);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const communityOptions = useMemo(() => {
    const map = new Map<string, string>();
    communities.forEach((community) => map.set(community.name, community.title || community.name));
    Object.entries(joinedCommunities).forEach(([name, joined]) => {
      if (joined && !map.has(name)) map.set(name, name);
    });
    if (selectedCommunity && !map.has(selectedCommunity)) {
      map.set(selectedCommunity, selectedCommunity);
    }
    return [...map.entries()].map(([name, label]) => ({ name, label }));
  }, [communities, joinedCommunities, selectedCommunity]);

  const insertAtCursor = useCallback((prefix: string, suffix = '', placeholder = '') => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setBody((prev) => prev + prefix + placeholder + suffix);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = body.substring(start, end);
    const inner = selected || placeholder;
    const replacement = prefix + inner + suffix;
    const next = body.substring(0, start) + replacement + body.substring(end);
    setBody(next);
    setMobilePane('edit');
    const cursorStart = start + prefix.length;
    const cursorEnd = cursorStart + inner.length;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorStart, cursorEnd);
    }, 0);
  }, [body]);

  const applyTemplate = (template: typeof TEMPLATES[number]) => {
    setBody((prev) => (prev.trim() ? `${prev.trim()}\n\n${template.body}` : template.body));
    if (template.title && !title.trim()) setTitle(template.title);
    if (template.tags) {
      setTagsInput((prev) => {
        const current = prev.split(/\s+/).filter(Boolean);
        template.tags!.split(/\s+/).forEach((tag) => {
          if (!current.includes(tag)) current.push(tag);
        });
        return current.slice(0, 10).join(' ');
      });
    }
    setMobilePane('edit');
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const addTag = (tag: string) => {
    const clean = tag.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!clean) return;
    setTagsInput((prev) => {
      const current = prev.split(/\s+/).filter(Boolean);
      if (current.includes(clean) || current.length >= 10) return prev;
      return [...current, clean].join(' ');
    });
  };

  const clearDraft = () => {
    setTitle('');
    setBody('');
    setTagsInput('hive');
    setLanguage('');
    setImageUrl('');
    ['hive_draft_title', 'hive_draft_body', 'hive_draft_tags', 'hive_draft_lang'].forEach((key) => {
      localStorage.removeItem(key);
    });
  };

  const handlePublish = useCallback(async () => {
    if (!currentUser) {
      onRequireLogin();
      return;
    }
    if (!title.trim()) {
      setErrorMessage('Add a title before publishing.');
      return;
    }
    if (!body.trim()) {
      setErrorMessage('Write something before publishing.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const cleanTags = tagsInput
        .toLowerCase()
        .replace(/#/g, '')
        .split(/\s+/)
        .filter((tag) => /^[a-z0-9-]+$/.test(tag));

      if (language && /^[a-z]{2}$/.test(language) && !cleanTags.includes(language) && cleanTags.length < 10) {
        cleanTags.push(language);
      }

      const tags = cleanTags.slice(0, 10);
      const parentPermlink = selectedCommunity || tags[0] || 'hive';
      const permlink = `${title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80)}-${Date.now().toString().slice(-5)}`;

      const jsonMetadata = JSON.stringify({
        app: 'nebulosa-web/0.0.1',
        format: 'markdown',
        tags,
        ...(language ? { languages: [language] } : {})
      });

      if (!KeychainService.isInstalled()) {
        setIsSubmitting(false);
        setSuccessMessage('Draft kept on this device. Install Hive Keychain to publish on mainnet.');
        return;
      }

      window.hive_keychain!.requestPost!(
        currentUser.username,
        title.trim(),
        body,
        parentPermlink,
        '',
        jsonMetadata,
        permlink,
        buildCommentOptions(currentUser.username, permlink, payoutOption),
        (response) => {
          setIsSubmitting(false);
          if (response.success) {
            setSuccessMessage('Published to Hive.');
            localStorage.removeItem('hive_draft_title');
            localStorage.removeItem('hive_draft_body');
            localStorage.removeItem('hive_draft_tags');
            setTimeout(onClose, 900);
          } else {
            setErrorMessage(response.message || response.error || 'Keychain did not broadcast this post.');
          }
        }
      );
    } catch (err: unknown) {
      setIsSubmitting(false);
      setErrorMessage(err instanceof Error ? err.message : 'Could not create the post.');
    }
  }, [body, currentUser, language, onClose, onRequireLogin, payoutOption, selectedCommunity, tagsInput, title]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) return;
      const key = event.key.toLowerCase();
      const inEditor = document.activeElement === textareaRef.current;

      if (key === 'enter') {
        event.preventDefault();
        handlePublish();
        return;
      }
      if (key === 'e' && event.shiftKey) {
        event.preventDefault();
        setMobilePane((pane) => (pane === 'preview' ? 'edit' : 'preview'));
        return;
      }
      if (!inEditor) return;
      if (key === 'b') {
        event.preventDefault();
        insertAtCursor('**', '**', 'bold');
      } else if (key === 'i') {
        event.preventDefault();
        insertAtCursor('*', '*', 'italic');
      } else if (key === 'k') {
        event.preventDefault();
        insertAtCursor('[', '](https://)', 'link text');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePublish, insertAtCursor]);

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const readingMinutes = wordCount === 0 ? 0 : Math.max(1, Math.round(wordCount / 200));
  const previewHtml = markdownToSafeHtml(body || '*Nothing to preview yet.*');
  const languages = listKnownLanguages();

  return (
    <div id="write-page" className="animate-in fade-in duration-150">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-2">
          <div className="xl:hidden flex bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-full p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMobilePane('edit')}
              className={`px-3 py-1 rounded-full ${mobilePane === 'edit' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-slate-400'}`}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setMobilePane('preview')}
              className={`px-3 py-1 rounded-full ${mobilePane === 'preview' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-slate-400'}`}
            >
              Preview
            </button>
          </div>
          <button
            type="button"
            onClick={handlePublish}
            disabled={isSubmitting || !title.trim() || !body.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold"
          >
            <Send className="w-3.5 h-3.5" />
            {isSubmitting ? 'Waiting for Keychain...' : 'Publish'}
          </button>
        </div>
      </div>

      {(errorMessage || successMessage) && (
        <div className={`mb-4 px-4 py-3 rounded-2xl text-sm flex items-center gap-2 ${
          errorMessage
            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
        }`}>
          {errorMessage ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          <span>{errorMessage || successMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[250px_minmax(0,1fr)_minmax(300px,420px)] gap-4 items-start">
        <aside className={`space-y-4 ${mobilePane === 'preview' ? 'hidden xl:block' : ''}`}>
          <section className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-4 shadow-[0_1px_6px_rgba(0,0,0,0.03)]">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold">Start faster</h2>
            </div>
            <div className="space-y-1.5">
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className="w-full text-left px-3 py-2 rounded-2xl hover:bg-blue-50 dark:hover:bg-slate-800"
                >
                  <span className="block text-xs font-bold text-gray-900 dark:text-white">{template.label}</span>
                  <span className="block text-[11px] text-gray-500 dark:text-slate-400">{template.hint}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-4">
            <h2 className="text-sm font-bold mb-2">Shortcuts</h2>
            <ul className="space-y-1.5">
              {SHORTCUTS.map((shortcut) => (
                <li key={shortcut.keys} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-gray-500 dark:text-slate-400">{shortcut.label}</span>
                  <kbd className="px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 font-semibold">
                    {shortcut.keys}
                  </kbd>
                </li>
              ))}
            </ul>
          </section>

          <section className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-4 space-y-3">
            <h2 className="text-sm font-bold">Options</h2>
            <label className="block text-[11px] font-bold text-gray-500 dark:text-slate-400">
              Community
              <select
                id="write-community"
                value={selectedCommunity}
                onChange={(event) => setSelectedCommunity(event.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 text-xs font-semibold text-gray-800 dark:text-slate-100"
              >
                <option value="">Personal blog</option>
                {communityOptions.map((community) => (
                  <option key={community.name} value={community.name}>
                    {community.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-[11px] font-bold text-gray-500 dark:text-slate-400">
              Reward
              <select
                id="write-payout"
                value={payoutOption}
                onChange={(event) => setPayoutOption(event.target.value as PayoutOption)}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 text-xs font-semibold text-gray-800 dark:text-slate-100"
              >
                <option value="50-50">50% HBD / 50% Hive Power</option>
                <option value="100-hp">100% Hive Power</option>
                <option value="decline">Decline payout</option>
              </select>
            </label>

            <label className="block text-[11px] font-bold text-gray-500 dark:text-slate-400">
              Language tag
              <select
                id="write-language"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 text-xs font-semibold text-gray-800 dark:text-slate-100"
              >
                <option value="">No extra language tag</option>
                {languages.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.flag} {item.name}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 mb-1">Image URL</p>
              <div className="flex gap-1.5">
                <input
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  placeholder="https://..."
                  className="min-w-0 flex-1 px-2.5 py-1.5 rounded-xl bg-gray-50 dark:bg-slate-800 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!imageUrl.trim()) return;
                    insertAtCursor(`![image](${imageUrl.trim()})\n`, '', '');
                    setImageUrl('');
                  }}
                  className="px-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-xs font-bold"
                >
                  Add
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={clearDraft}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 hover:text-rose-600"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear draft
            </button>
          </section>
        </aside>

        <section className={`min-w-0 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-[0_1px_6px_rgba(0,0,0,0.03)] ${
          mobilePane === 'preview' ? 'hidden xl:block' : ''
        }`}>
          <input
            id="write-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title"
            className="w-full text-2xl font-bold bg-transparent placeholder-gray-300 dark:placeholder-slate-600 focus:outline-none"
          />

          <div className="flex flex-wrap gap-1 my-3 p-1.5 rounded-2xl bg-gray-50 dark:bg-slate-800/80">
            <ToolButton label="Bold" onClick={() => insertAtCursor('**', '**', 'bold')}><Bold className="w-4 h-4" /></ToolButton>
            <ToolButton label="Italic" onClick={() => insertAtCursor('*', '*', 'italic')}><Italic className="w-4 h-4" /></ToolButton>
            <ToolButton label="Heading" onClick={() => insertAtCursor('# ', '', 'Heading')}><Heading1 className="w-4 h-4" /></ToolButton>
            <ToolButton label="Subheading" onClick={() => insertAtCursor('## ', '', 'Subheading')}><Heading2 className="w-4 h-4" /></ToolButton>
            <ToolButton label="Quote" onClick={() => insertAtCursor('> ', '', 'quote')}><Quote className="w-4 h-4" /></ToolButton>
            <ToolButton label="Code" onClick={() => insertAtCursor('```\n', '\n```', 'code')}><Code className="w-4 h-4" /></ToolButton>
            <ToolButton label="Link" onClick={() => insertAtCursor('[', '](https://)', 'link text')}><LinkIcon className="w-4 h-4" /></ToolButton>
            <ToolButton label="Image" onClick={() => insertAtCursor('![', '](https://)', 'alt')}><ImageIcon className="w-4 h-4" /></ToolButton>
            <ToolButton label="List" onClick={() => insertAtCursor('- ', '', 'item')}><List className="w-4 h-4" /></ToolButton>
          </div>

          <textarea
            id="post-editor-textarea"
            ref={textareaRef}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={16}
            placeholder="Write in Markdown. The preview updates as you type."
            className="w-full min-h-[320px] p-3 bg-gray-50/70 dark:bg-slate-950/40 rounded-2xl text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />

          <div className="mt-3">
            <label className="text-[11px] font-bold text-gray-500 dark:text-slate-400" htmlFor="write-tags">
              Tags, separated by spaces (max 10)
            </label>
            <input
              id="write-tags"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 text-sm"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {CATEGORY_DEFINITIONS.slice(0, 10).map((category) => (
                <button
                  key={category.tag}
                  type="button"
                  onClick={() => addTag(category.tag)}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:text-blue-600"
                >
                  {category.icon} {category.tag}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-3 text-[11px] text-gray-400 dark:text-slate-500">
            {wordCount} words · {readingMinutes} min read · draft saved on this device
            {currentUser ? ` · publishing as @${currentUser.username}` : ' · connect Keychain to publish'}
          </p>
        </section>

        <aside className={`${mobilePane === 'edit' ? 'hidden xl:block' : ''}`}>
          <div className="xl:sticky xl:top-20 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-5 min-h-[420px]">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-slate-400 mb-4">
              <Eye className="w-4 h-4" />
              Preview
            </div>
            <h1 className="text-2xl font-extrabold mb-4 break-words">{title || 'Untitled story'}</h1>
            <div
              className="text-sm leading-relaxed text-gray-800 dark:text-slate-200 space-y-3 break-words [&_a]:text-blue-600 [&_img]:rounded-2xl [&_img]:max-w-full [&_pre]:overflow-x-auto [&_pre]:bg-gray-50 [&_pre]:dark:bg-slate-800 [&_pre]:p-3 [&_pre]:rounded-xl [&_blockquote]:border-l-2 [&_blockquote]:border-blue-300 [&_blockquote]:pl-3"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </aside>
      </div>
    </div>
  );
};

function ToolButton({
  label,
  onClick,
  children
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="p-2 rounded-xl text-gray-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700"
    >
      {children}
    </button>
  );
}
