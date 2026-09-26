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
  Trash2,
  SlidersHorizontal,
  Globe,
  Tag,
  Coins,
  FileText,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  Plus
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

const TEMPLATES = [
  {
    id: 'story',
    label: 'Story',
    hint: 'What happened, why it matters, and what is next',
    body: '## What happened\n\n\n## Why it matters\n\n\n## What comes next\n\n',
    tags: 'storytelling hive'
  },
  {
    id: 'photo',
    label: 'Photography',
    hint: 'Image, caption, and shot context',
    body: '![Describe the photo](https://)\n\n*Photo Caption*\n\n**Where and when:**\n\n',
    tags: 'photography art'
  },
  {
    id: 'question',
    label: 'Question / Discussion',
    hint: 'Context first, followed by your question',
    title: 'Question: ',
    body: '**Context**\n\n\n**The Question**\n\n\n',
    tags: 'askhive discussion'
  },
  {
    id: 'link',
    label: 'Link Review',
    hint: 'Share a source and your thoughts',
    body: 'Source: [Article Title](https://)\n\n**My Take**\n\n',
    tags: 'news analysis'
  }
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
  const [showOptions, setShowOptions] = useState(false);
  
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
    listCommunities('rank', 50)
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
    if (!window.confirm('Are you sure you want to clear this draft?')) return;
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
      setErrorMessage('Please add a title before publishing.');
      return;
    }
    if (!body.trim()) {
      setErrorMessage('Please write some content before publishing.');
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

      const tags = cleanTags.length > 0 ? cleanTags.slice(0, 10) : ['hive'];
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
        setSuccessMessage('Draft saved locally. Install Hive Keychain extension to publish on the Hive blockchain.');
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
            setSuccessMessage('Successfully published to the Hive blockchain!');
            localStorage.removeItem('hive_draft_title');
            localStorage.removeItem('hive_draft_body');
            localStorage.removeItem('hive_draft_tags');
            setTimeout(onClose, 900);
          } else {
            setErrorMessage(response.message || response.error || 'Hive Keychain failed to broadcast the post.');
          }
        }
      );
    } catch (err: unknown) {
      setIsSubmitting(false);
      setErrorMessage(err instanceof Error ? err.message : 'Unable to broadcast your post.');
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
  const previewHtml = markdownToSafeHtml(body || '*Start typing in Markdown to see the real-time article preview here...*');
  const languages = listKnownLanguages();

  return (
    <div id="write-page" className="w-full max-w-[1600px] mx-auto pb-12 animate-in fade-in duration-150">
      
      {/* Sticky Header Navbar */}
      <header className="sticky top-16 z-20 bg-[#f7f8fa]/90 dark:bg-[#0b0f17]/90 backdrop-blur-md py-3 mb-4 border-b border-gray-200/60 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white transition shadow-2xs"
            title="Return to feed"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Article Writer
            </h1>
            <p className="text-[11px] text-gray-500 dark:text-slate-400">
              {currentUser ? `Publishing as @${currentUser.username}` : 'Draft Mode (connect Keychain to publish)'}
            </p>
          </div>
        </div>

        {/* Mobile Pane Toggle */}
        <div className="lg:hidden flex bg-gray-200/70 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMobilePane('edit')}
            className={`px-4 py-1.5 rounded-lg transition ${
              mobilePane === 'edit' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs' : 'text-gray-600 dark:text-slate-400'
            }`}
          >
            Editor
          </button>
          <button
            type="button"
            onClick={() => setMobilePane('preview')}
            className={`px-4 py-1.5 rounded-lg transition ${
              mobilePane === 'preview' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs' : 'text-gray-600 dark:text-slate-400'
            }`}
          >
            Live Preview
          </button>
        </div>

        {/* Right Actions Header */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowOptions(prev => !prev)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold border transition cursor-pointer ${
              showOptions
                ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                : 'bg-white dark:bg-slate-800/80 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Publish Options</span>
            {showOptions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={handlePublish}
            disabled={isSubmitting || !title.trim() || !body.trim()}
            className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-xs hover:shadow-md cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            {isSubmitting ? 'Broadcasting...' : 'Publish'}
          </button>
        </div>
      </header>

      {/* Error & Success Banners */}
      {(errorMessage || successMessage) && (
        <div className={`mb-4 p-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-2xs animate-in fade-in ${
          errorMessage
            ? 'bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/50 dark:border-rose-900 dark:text-rose-300'
            : 'bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-900 dark:text-emerald-300'
        }`}>
          <div className="flex items-center gap-2.5">
            {errorMessage ? <AlertCircle className="w-5 h-5 flex-shrink-0" /> : <Check className="w-5 h-5 flex-shrink-0" />}
            <span>{errorMessage || successMessage}</span>
          </div>
          <button onClick={() => { setErrorMessage(null); setSuccessMessage(null); }} className="p-1 hover:opacity-75">
            ✕
          </button>
        </div>
      )}

      {/* Collapsible Publish Options Drawer */}
      {showOptions && (
        <div className="mb-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-5 shadow-sm animate-in fade-in slide-in-from-top-2 duration-150 text-gray-900 dark:text-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Community */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-slate-300">
                <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Hive Community</span>
              </label>
              <select
                id="write-community"
                value={selectedCommunity}
                onChange={(event) => setSelectedCommunity(event.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 text-xs font-semibold text-gray-800 dark:text-slate-100 border border-gray-200/80 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Personal Blog (No Community)</option>
                {communityOptions.map((community) => (
                  <option key={community.name} value={community.name}>
                    {community.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Payout */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-slate-300">
                <Coins className="w-3.5 h-3.5 text-amber-500" />
                <span>Rewards Payout</span>
              </label>
              <select
                id="write-payout"
                value={payoutOption}
                onChange={(event) => setPayoutOption(event.target.value as PayoutOption)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 text-xs font-semibold text-gray-800 dark:text-slate-100 border border-gray-200/80 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="50-50">50% HBD / 50% Hive Power</option>
                <option value="100-hp">100% Hive Power</option>
                <option value="decline">Decline Payout (0%)</option>
              </select>
            </div>

            {/* Language */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-slate-300">
                <Globe className="w-3.5 h-3.5 text-indigo-500" />
                <span>Language Tag</span>
              </label>
              <select
                id="write-language"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 text-xs font-semibold text-gray-800 dark:text-slate-100 border border-gray-200/80 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No Language Tag</option>
                {languages.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.flag} {item.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Direct Image URL */}
            <div className="space-y-1.5">
              <span className="block text-xs font-bold text-gray-700 dark:text-slate-300">
                Insert Direct Image URL
              </span>
              <div className="flex gap-1.5">
                <input
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  placeholder="https://..."
                  className="min-w-0 flex-1 px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-slate-800 text-xs border border-gray-200/80 dark:border-slate-700 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!imageUrl.trim()) return;
                    insertAtCursor(`![image](${imageUrl.trim()})\n`, '', '');
                    setImageUrl('');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>

          {/* Quick Starter Templates Bar */}
          <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-500 dark:text-slate-400 flex items-center gap-1 mr-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Templates:
            </span>
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template)}
                className="text-xs px-3 py-1 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-gray-700 dark:text-slate-300 hover:text-blue-600 font-semibold transition cursor-pointer"
              >
                + {template.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 50 / 50 Split Screen Grid (Editor & Live Preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        
        {/* LEFT 50%: Markdown Editor */}
        <section className={`bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none flex flex-col justify-between space-y-4 ${
          mobilePane === 'preview' ? 'hidden lg:flex' : 'flex'
        }`}>
          <div className="space-y-4 flex-1 flex flex-col">
            
            {/* Title Input */}
            <input
              id="write-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Article Title..."
              className="w-full text-2xl sm:text-3xl font-extrabold bg-transparent text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-slate-600 focus:outline-none tracking-tight border-b border-gray-100 dark:border-slate-800 pb-3"
            />

            {/* Markdown Toolbar */}
            <div className="flex flex-wrap items-center gap-1 p-1.5 rounded-2xl bg-gray-50 dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700/60">
              <ToolButton label="Bold (⌘B)" onClick={() => insertAtCursor('**', '**', 'bold')}><Bold className="w-4 h-4" /></ToolButton>
              <ToolButton label="Italic (⌘I)" onClick={() => insertAtCursor('*', '*', 'italic')}><Italic className="w-4 h-4" /></ToolButton>
              <div className="w-px h-5 bg-gray-200 dark:bg-slate-700 mx-1" />
              <ToolButton label="Heading 1" onClick={() => insertAtCursor('# ', '', 'Heading')}><Heading1 className="w-4 h-4" /></ToolButton>
              <ToolButton label="Heading 2" onClick={() => insertAtCursor('## ', '', 'Subheading')}><Heading2 className="w-4 h-4" /></ToolButton>
              <div className="w-px h-5 bg-gray-200 dark:bg-slate-700 mx-1" />
              <ToolButton label="Quote" onClick={() => insertAtCursor('> ', '', 'quote')}><Quote className="w-4 h-4" /></ToolButton>
              <ToolButton label="Code Block" onClick={() => insertAtCursor('```\n', '\n```', 'code')}><Code className="w-4 h-4" /></ToolButton>
              <ToolButton label="Insert Link (⌘K)" onClick={() => insertAtCursor('[', '](https://)', 'link text')}><LinkIcon className="w-4 h-4" /></ToolButton>
              <ToolButton label="Insert Image" onClick={() => insertAtCursor('![alt](', ')', 'https://')}><ImageIcon className="w-4 h-4" /></ToolButton>
              <ToolButton label="Bullet List" onClick={() => insertAtCursor('- ', '', 'item')}><List className="w-4 h-4" /></ToolButton>
            </div>

            {/* Main Textarea Area */}
            <textarea
              id="post-editor-textarea"
              ref={textareaRef}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write your article story in Markdown... Supports full formatting, code blocks, and embedded media."
              className="w-full flex-1 min-h-[460px] p-4 bg-gray-50/50 dark:bg-slate-950/40 rounded-2xl text-sm sm:text-base leading-relaxed text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-600 border border-gray-100 dark:border-slate-800 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 transition font-sans"
            />

            {/* Tags Input Section */}
            <div className="pt-2 border-t border-gray-100 dark:border-slate-800 space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-slate-300" htmlFor="write-tags">
                <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Tags (separated by spaces, max 10)</span>
              </label>

              <input
                id="write-tags"
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
                placeholder="e.g. hive photography art crypto"
                className="w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 text-xs font-semibold text-gray-800 dark:text-slate-200 border border-gray-200/80 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {/* Quick Tag Pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {CATEGORY_DEFINITIONS.slice(0, 8).map((category) => (
                  <button
                    key={category.tag}
                    type="button"
                    onClick={() => addTag(category.tag)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-800/80 text-gray-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer font-medium"
                  >
                    {category.icon} #{category.tag}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Bottom Counter Bar */}
          <div className="flex items-center justify-between text-xs text-gray-400 dark:text-slate-500 pt-3 border-t border-gray-100 dark:border-slate-800">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {wordCount} words · est. {readingMinutes} min read
            </span>

            <button
              type="button"
              onClick={clearDraft}
              className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Draft
            </button>
          </div>
        </section>

        {/* RIGHT 50%: Real-Time Live Preview */}
        <section className={`bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-[0_1px_6px_rgba(0,0,0,0.03)] dark:shadow-none flex flex-col justify-between ${
          mobilePane === 'edit' ? 'hidden lg:flex' : 'flex'
        }`}>
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-slate-800 text-xs font-bold text-gray-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Real-Time Article Preview
              </span>
              <span className="text-[10px] bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">
                Live Rendering
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white mb-6 break-words leading-tight">
              {title || 'Untitled Story...'}
            </h1>

            <div
              className="article-body text-sm sm:text-base leading-relaxed text-gray-800 dark:text-slate-200 space-y-4 break-words [&_a]:text-blue-600 [&_img]:rounded-2xl [&_img]:max-w-full [&_pre]:overflow-x-auto [&_pre]:bg-gray-100 [&_pre]:dark:bg-slate-800/80 [&_pre]:p-4 [&_pre]:rounded-2xl [&_blockquote]:border-l-4 [&_blockquote]:border-blue-500 [&_blockquote]:pl-4 [&_blockquote]:py-1"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>

          <div className="mt-8 pt-3 border-t border-gray-100 dark:border-slate-800 text-xs text-gray-400 dark:text-slate-500 text-right">
            WYSIWYG Markdown Preview • Synchronized Real-Time Render
          </div>
        </section>

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
      className="p-2 rounded-xl text-gray-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
    >
      {children}
    </button>
  );
}