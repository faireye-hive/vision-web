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
  X,
  LockKeyhole,
  Languages,
  Copy,
  Loader2
} from 'lucide-react';
import { CATEGORY_DEFINITIONS } from '../data/categorySubtopics';
import { CurrentUser, KeychainService } from '../services/keychain';
import { getSubscriptions, getTrendingTags, HiveCommunity, hiveRpcCall, listCommunities } from '../services/hiveApi';
import { invalidateAccountContentCache } from '../services/profileCache';
import { listKnownLanguages } from '../utils/communityTaxonomy';
import { markdownToSafeHtml } from '../utils/sanitize';
import { useCommunityFeatures } from '../hooks/useCommunityFeatures';
import { communityPublishMetadata, loadCommunityFeatures } from '../services/communityFeatures';
import { POPULAR_TRANSLATION_LANGUAGES, translateText } from '../services/translationService';

interface WritePageProps {
  onClose: () => void;
  currentUser: CurrentUser | null;
  onRequireLogin: () => void;
  /** Set only when the user explicitly chooses the community's Write button. */
  defaultCommunity?: string;
  joinedCommunities?: Record<string, boolean>;
}

type PayoutOption = '50-50' | '100-hp' | 'decline';

const PAYOUT_LABELS: Record<PayoutOption, string> = {
  '50-50': '50% HBD / 50% HP',
  '100-hp': '100% Hive Power',
  decline: 'Payout declined'
};

const MAX_TAGS = 10;

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

// Chaves de rascunho. A comunidade NÃO é mais salva: cada post começa em "Personal Blog".
const DRAFT_KEYS = {
  title: 'hive_draft_title',
  body: 'hive_draft_body',
  tags: 'hive_draft_tags',
  category: 'hive_draft_category',
  payout: 'hive_draft_payout',
  lang: 'hive_draft_lang',
  permlink: 'hive_draft_permlink',
  encryptBody: 'hive_draft_encrypt_body',
  encryptRecipient: 'hive_draft_encrypt_recipient'
} as const;
const LEGACY_COMMUNITY_KEY = 'hive_draft_community';

function readDraft(key: string, fallback = '') {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeDraft(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage cheio/desativado: o rascunho só fica em memória
  }
}

function removeDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
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

const selectClass =
  'w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-gray-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40';

export const WritePage: React.FC<WritePageProps> = ({
  onClose,
  currentUser,
  onRequireLogin,
  defaultCommunity = '',
  joinedCommunities = {}
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mobilePane, setMobilePane] = useState<'edit' | 'preview'>('edit');
  const [showOptions, setShowOptions] = useState(!!defaultCommunity);

  const [title, setTitle] = useState(() => readDraft(DRAFT_KEYS.title));
  const [body, setBody] = useState(() => readDraft(DRAFT_KEYS.body));
  const [encryptBody, setEncryptBody] = useState(() => readDraft(DRAFT_KEYS.encryptBody) === 'true');
  const [encryptRecipient, setEncryptRecipient] = useState(() => readDraft(DRAFT_KEYS.encryptRecipient, currentUser?.username || ''));
  const [selectedText, setSelectedText] = useState<{ start: number; end: number; text: string } | null>(null);
  const [selectionMenuPosition, setSelectionMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const [selectionAction, setSelectionAction] = useState<'translate' | 'encode' | null>(null);
  const [selectionTargetLanguage, setSelectionTargetLanguage] = useState('pt');
  const [selectionRecipient, setSelectionRecipient] = useState('');
  const [selectionResult, setSelectionResult] = useState('');
  const [selectionBusy, setSelectionBusy] = useState(false);
  const [selectionError, setSelectionError] = useState('');
  const [tagsInput, setTagsInput] = useState(() => readDraft(DRAFT_KEYS.tags, 'hive'));
  const [blogCategory, setBlogCategory] = useState(() => readDraft(DRAFT_KEYS.category));
  const [customPermlink, setCustomPermlink] = useState(() => readDraft(DRAFT_KEYS.permlink));
  const [payoutOption, setPayoutOption] = useState<PayoutOption>(() => {
    const saved = readDraft(DRAFT_KEYS.payout, '50-50');
    return saved === '100-hp' || saved === 'decline' ? saved : '50-50';
  });
  // The general Write button starts on the blog; an explicit community link selects its destination.
  const [selectedCommunity, setSelectedCommunity] = useState(/^hive-\d+$/.test(defaultCommunity) ? defaultCommunity : '');
  const [communityCategory, setCommunityCategory] = useState('');
  const [postFlair, setPostFlair] = useState('');
  const { data: communityFeatures, loading: communityLoading, error: communityError, retry: retryCommunity } = useCommunityFeatures(selectedCommunity);
  useEffect(() => { setCommunityCategory(''); setPostFlair(''); }, [selectedCommunity]);
  const [language, setLanguage] = useState(() => readDraft(DRAFT_KEYS.lang));
  const [communities, setCommunities] = useState<HiveCommunity[]>([]);
  const [trendingTagNames, setTrendingTagNames] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [subscribedCommunityTitles, setSubscribedCommunityTitles] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Limpa a chave antiga que guardava a comunidade escolhida automaticamente.
  useEffect(() => {
    removeDraft(LEGACY_COMMUNITY_KEY);
  }, []);

  useEffect(() => {
    writeDraft(DRAFT_KEYS.title, title);
    writeDraft(DRAFT_KEYS.body, body);
    writeDraft(DRAFT_KEYS.encryptBody, String(encryptBody));
    writeDraft(DRAFT_KEYS.encryptRecipient, encryptRecipient);
    writeDraft(DRAFT_KEYS.tags, tagsInput);
    writeDraft(DRAFT_KEYS.category, blogCategory);
    writeDraft(DRAFT_KEYS.permlink, customPermlink);
    writeDraft(DRAFT_KEYS.payout, payoutOption);
    writeDraft(DRAFT_KEYS.lang, language);
  }, [title, body, encryptBody, encryptRecipient, tagsInput, blogCategory, customPermlink, payoutOption, language]);

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

  useEffect(() => {
    let mounted = true;
    getTrendingTags(250)
      .then((tags) => {
        if (mounted) setTrendingTagNames(tags.map((item) => item.tag));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!currentUser?.username) {
      setSubscribedCommunityTitles({});
      return () => { mounted = false; };
    }
    getSubscriptions(currentUser.username)
      .then((rows) => {
        if (!mounted) return;
        const titles: Record<string, string> = {};
        rows.forEach(([name, title]) => {
          if (name && title) titles[name] = title;
        });
        setSubscribedCommunityTitles(titles);
      })
      .catch(() => {
        if (mounted) setSubscribedCommunityTitles({});
      });
    return () => { mounted = false; };
  }, [currentUser?.username]);

  const communityOptions = useMemo(() => {
    const communityLabels = new Map(communities.map((community) => [community.name, community.title || community.name]));
    return Object.entries(joinedCommunities)
      .filter(([, joined]) => joined)
      .map(([name]) => ({ name, label: subscribedCommunityTitles[name] || communityLabels.get(name) || name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [communities, joinedCommunities, subscribedCommunityTitles]);

  const communityLabel = useMemo(() => {
    if (!selectedCommunity) return 'Personal Blog';
    return communityFeatures?.community.title || communityOptions.find((c) => c.name === selectedCommunity)?.label || selectedCommunity;
  }, [selectedCommunity, communityOptions, communityFeatures]);

  const tagList = useMemo(() => tagsInput.split(/\s+/).filter(Boolean), [tagsInput]);
  const tagSuggestions = useMemo(() => {
    if (/\s$/.test(tagsInput)) return [];
    const currentToken = tagsInput.trimEnd().split(/\s+/).at(-1) || '';
    const prefix = currentToken.replace(/^#/, '').toLowerCase();
    if (!prefix) return [];
    return trendingTagNames
      .filter((tag) => tag.toLowerCase().startsWith(prefix) && tag.toLowerCase() !== prefix)
      .slice(0, 5);
  }, [tagsInput, trendingTagNames]);

  const insertAtCursor = useCallback(
    (prefix: string, suffix = '', placeholder = '') => {
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
    },
    [body]
  );

  const applyTemplate = (template: (typeof TEMPLATES)[number]) => {
    setBody((prev) => (prev.trim() ? `${prev.trim()}\n\n${template.body}` : template.body));
    if (template.title && !title.trim()) setTitle(template.title);
    if (template.tags) {
      setTagsInput((prev) => {
        const current = prev.split(/\s+/).filter(Boolean);
        template.tags!.split(/\s+/).forEach((tag) => {
          if (!current.includes(tag)) current.push(tag);
        });
        return current.slice(0, MAX_TAGS).join(' ');
      });
    }
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const addTag = (tag: string) => {
    const clean = tag.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!clean) return;
    setTagsInput((prev) => {
      const current = prev.split(/\s+/).filter(Boolean);
      if (current.includes(clean) || current.length >= MAX_TAGS) return prev;
      return [...current, clean].join(' ');
    });
  };

  const handleBlogCategoryChange = (nextCategory: string) => {
    const previousCategory = blogCategory;
    setBlogCategory(nextCategory);
    setTagsInput((current) => {
      const remainingTags = current
        .split(/\s+/)
        .filter((tag) => tag && tag !== previousCategory && tag !== nextCategory);
      if (nextCategory) remainingTags.unshift(nextCategory);
      return remainingTags.slice(0, MAX_TAGS).join(' ');
    });
  };

  const removeTag = (tag: string) => {
    if (!selectedCommunity && blogCategory === tag) setBlogCategory('');
    setTagsInput((prev) =>
      prev
        .split(/\s+/)
        .filter((t) => t && t !== tag)
        .join(' ')
    );
  };

  const selectTagSuggestion = (suggestion: string) => {
    setTagsInput((current) => {
      const parts = current.trimEnd().split(/\s+/).filter(Boolean);
      if (parts.length) parts[parts.length - 1] = suggestion;
      else parts.push(suggestion);
      return `${parts.join(' ')} `;
    });
    setShowTagSuggestions(false);
  };

  const positionSelectionMenu = useCallback((textarea: HTMLTextAreaElement, end: number) => {
    const rect = textarea.getBoundingClientRect();
    const computed = window.getComputedStyle(textarea);
    const mirror = document.createElement('div');
    const copiedStyles = [
      'box-sizing', 'width', 'height', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'font-family',
      'font-size', 'font-weight', 'font-style', 'font-variant', 'line-height', 'letter-spacing', 'word-spacing',
      'text-indent', 'text-transform', 'text-align', 'tab-size'
    ];
    mirror.style.position = 'fixed';
    mirror.style.left = `${rect.left}px`;
    mirror.style.top = `${rect.top}px`;
    mirror.style.width = `${rect.width}px`;
    mirror.style.height = `${rect.height}px`;
    mirror.style.margin = '0';
    mirror.style.visibility = 'hidden';
    mirror.style.overflow = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.overflowWrap = computed.overflowWrap || 'break-word';
    mirror.style.wordBreak = computed.wordBreak;
    copiedStyles.forEach((property) => mirror.style.setProperty(property, computed.getPropertyValue(property)));

    const marker = document.createElement('span');
    marker.textContent = '\u200b';
    marker.style.display = 'inline-block';
    marker.style.width = '0';
    marker.style.height = '1em';
    mirror.append(document.createTextNode(body.slice(0, end)), marker, document.createTextNode(body.slice(end) || ' '));
    document.body.appendChild(mirror);
    mirror.scrollTop = textarea.scrollTop;
    mirror.scrollLeft = textarea.scrollLeft;
    const caretRect = marker.getBoundingClientRect();
    mirror.remove();

    const menuWidth = Math.min(360, window.innerWidth - 24);
    const left = Math.max(12, Math.min(window.innerWidth - menuWidth - 12, caretRect.left + caretRect.width / 2 - menuWidth / 2));
    const top = caretRect.top > 180 ? caretRect.top - 54 : caretRect.bottom + 10;
    setSelectionMenuPosition({ left, top: Math.max(12, Math.min(window.innerHeight - 56, top)) });
  }, [body]);

  const captureEditorSelection = () => {
    const textarea = textareaRef.current;
    if (!textarea || textarea.selectionStart === textarea.selectionEnd) {
      setSelectedText(null);
      setSelectionMenuPosition(null);
      setSelectionAction(null);
      setSelectionResult('');
      setSelectionError('');
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setSelectedText({ start, end, text: body.slice(start, end) });
    positionSelectionMenu(textarea, end);
    setSelectionAction(null);
    setSelectionResult('');
    setSelectionError('');
  };

  useEffect(() => {
    if (!selectedText) return;
    const reposition = () => {
      const textarea = textareaRef.current;
      if (textarea) positionSelectionMenu(textarea, selectedText.end);
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [selectedText, positionSelectionMenu]);

  const runSelectionTranslate = async () => {
    if (!selectedText?.text.trim()) return;
    setSelectionBusy(true);
    setSelectionError('');
    try {
      setSelectionResult(await translateText(selectedText.text, selectionTargetLanguage));
    } catch {
      setSelectionError('Could not translate this selection. Please try again.');
    } finally {
      setSelectionBusy(false);
    }
  };

  const runSelectionEncode = async () => {
    if (!selectedText?.text.trim() || !currentUser) return;
    const recipient = selectionRecipient.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z][a-z0-9.-]{2,15}$/.test(recipient)) {
      setSelectionError('Enter a valid Hive account name.');
      return;
    }
    if (!KeychainService.isInstalled()) {
      setSelectionError('Install Hive Keychain to encode text.');
      return;
    }
    setSelectionBusy(true);
    setSelectionError('');
    setSelectionResult('');
    try {
      const response = await KeychainService.encodeMemoMessage(currentUser.username, recipient, selectedText.text);
      if (!response.success || typeof response.result !== 'string' || !response.result.startsWith('#')) {
        throw new Error(response.message || response.error || 'Hive Keychain could not encode this text.');
      }
      setSelectionResult(response.result);
    } catch (error) {
      setSelectionError(error instanceof Error ? error.message : 'Hive Keychain could not encode this text.');
    } finally {
      setSelectionBusy(false);
    }
  };

  const replaceSelectedText = () => {
    if (!selectedText || !selectionResult) return;
    const next = body.slice(0, selectedText.start) + selectionResult + body.slice(selectedText.end);
    setBody(next);
    setSelectedText(null);
    setSelectionMenuPosition(null);
    setSelectionAction(null);
    setSelectionResult('');
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const copySelectionResult = async () => {
    try {
      await navigator.clipboard.writeText(selectionResult);
    } catch {
      setSelectionError('Could not copy the result to the clipboard.');
    }
  };

  const clearDraft = () => {
    if (!window.confirm('Are you sure you want to clear this draft?')) return;
    setTitle('');
    setBody('');
    setEncryptBody(false);
    setEncryptRecipient(currentUser?.username || '');
    setTagsInput('hive');
    setBlogCategory('');
    setCustomPermlink('');
    setLanguage('');
    setSelectedCommunity('');
    setPayoutOption('50-50');
    Object.values(DRAFT_KEYS).forEach(removeDraft);
  };

  const handlePublish = useCallback(async () => {
    if (isSubmitting) return;
    if (!currentUser) {
      onRequireLogin();
      return;
    }
    if (currentUser.isDemo) {
      setErrorMessage('Demo mode is read-only. Connect with Hive Keychain to publish.');
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
    if (selectedCommunity && !communityCategory) {
      setErrorMessage('Choose a category before publishing to this community.');
      document.getElementById('write-community-category')?.focus();
      return;
    }
    const requestedPermlink = customPermlink.trim();
    if (requestedPermlink && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(requestedPermlink)) {
      setErrorMessage('Permlink must use lowercase letters, numbers, and single hyphens between words.');
      document.getElementById('write-custom-permlink')?.focus();
      return;
    }
    if (requestedPermlink.length > 256) {
      setErrorMessage('Permlink must be 256 characters or fewer.');
      document.getElementById('write-custom-permlink')?.focus();
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (requestedPermlink) {
        let existingPost: { author?: string } | null = null;
        try {
          existingPost = await hiveRpcCall('bridge.get_post', {
            author: currentUser.username,
            permlink: requestedPermlink,
            observer: ''
          });
        } catch (error) {
          if (!(error as { isNotFound?: boolean })?.isNotFound) {
            throw new Error('Could not verify this permlink is available. Please retry before publishing.');
          }
        }
        if (existingPost?.author) throw new Error('You already have a post with this permlink. Choose another one to avoid editing it.');
      }
      const communityMetadata = selectedCommunity
        ? communityPublishMetadata(selectedCommunity, communityCategory, postFlair || null, (await loadCommunityFeatures(selectedCommunity, true)).settings)
        : null;
      const cleanTags = tagsInput
        .toLowerCase()
        .replace(/#/g, '')
        .split(/\s+/)
        .filter((tag) => /^[a-z0-9-]+$/.test(tag));

      if (language && /^[a-z]{2}$/.test(language) && !cleanTags.includes(language) && cleanTags.length < MAX_TAGS) {
        cleanTags.push(language);
      }

      const tags = [...new Set([...(communityMetadata ? [selectedCommunity, communityMetadata.category] : blogCategory ? [blogCategory] : []), ...cleanTags])].slice(0, MAX_TAGS);
      if (!tags.length) tags.push('hive');
      // Só posta em comunidade se o usuário escolheu uma; senão usa a primeira tag como categoria.
      const parentPermlink = selectedCommunity || tags[0] || 'hive';
      const permlink = requestedPermlink || `${title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80)}-${Date.now().toString().slice(-5)}`;

      const jsonMetadata = JSON.stringify({
        app: 'nebulosa-web/0.0.4',
        format: 'markdown',
        tags,
        ...(communityMetadata ? { nebulosa: { community: communityMetadata } } : {}),
        ...(language ? { languages: [language] } : {})
      });

      if (!KeychainService.isInstalled()) {
        setIsSubmitting(false);
        setSuccessMessage('Draft saved locally. Install Hive Keychain extension to publish on the Hive blockchain.');
        return;
      }

      let publishedBody = body;
      if (encryptBody) {
        const recipient = encryptRecipient.trim().replace(/^@/, '').toLowerCase();
        if (!/^[a-z][a-z0-9.-]{2,15}$/.test(recipient)) {
          throw new Error('Enter a valid Hive account to encrypt this post for.');
        }
        const encrypted = await KeychainService.encodeMemoMessage(
          currentUser.username,
          recipient,
          body
        );
        if (!encrypted.success || typeof encrypted.result !== 'string' || !encrypted.result.startsWith('#')) {
          throw new Error(encrypted.message || encrypted.error || 'Hive Keychain could not encrypt the article. Nothing was published.');
        }
        publishedBody = encrypted.result;
      }

      window.hive_keychain!.requestPost!(
        currentUser.username,
        title.trim(),
        publishedBody,
        parentPermlink,
        '',
        jsonMetadata,
        permlink,
        buildCommentOptions(currentUser.username, permlink, payoutOption),
        (response) => {
          setIsSubmitting(false);
          if (response.success) {
            invalidateAccountContentCache(currentUser.username);
            setSuccessMessage('Successfully published to the Hive blockchain!');
            Object.values(DRAFT_KEYS).forEach(removeDraft);
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
  }, [body, encryptBody, encryptRecipient, currentUser, language, onClose, onRequireLogin, payoutOption, selectedCommunity, communityCategory, postFlair, tagsInput, blogCategory, title, customPermlink, isSubmitting]);

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
  const previewHtml = markdownToSafeHtml(
    body || '*Start typing in Markdown to see the real-time article preview here...*'
  );
  const languages = listKnownLanguages();
  const languageLabel = languages.find((l) => l.code === language);

  return (
    <div id="write-page" className="w-full max-w-full mx-auto pb-12 animate-in fade-in duration-150">
      {/* Sticky Header */}
      <header className="sticky top-16 z-20 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md p-2.5 sm:px-4 sm:py-3 mb-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white transition shadow-2xs cursor-pointer"
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
              {currentUser?.isDemo
                ? `Demo mode · read-only as @${currentUser.username}`
                : currentUser
                  ? `Publishing as @${currentUser.username}`
                  : 'Draft Mode (connect Keychain to publish)'}
            </p>
          </div>
        </div>

        {/* Mobile pane toggle */}
        <div className="lg:hidden flex bg-gray-200/70 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMobilePane('edit')}
            className={`px-4 py-1.5 rounded-lg transition cursor-pointer ${
              mobilePane === 'edit'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                : 'text-gray-600 dark:text-slate-400'
            }`}
          >
            Editor
          </button>
          <button
            type="button"
            onClick={() => setMobilePane('preview')}
            className={`px-4 py-1.5 rounded-lg transition cursor-pointer ${
              mobilePane === 'preview'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                : 'text-gray-600 dark:text-slate-400'
            }`}
          >
            Live Preview
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowOptions((prev) => !prev)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
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
            disabled={isSubmitting || !title.trim() || !body.trim() || Boolean(selectedCommunity && (!communityFeatures || communityLoading || communityError || !communityCategory))}
            className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition shadow-sm hover:shadow-md cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            {isSubmitting ? 'Broadcasting...' : 'Publish'}
          </button>
        </div>
      </header>

      {/* Publish summary: sempre visível, mostra exatamente onde o post vai */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setShowOptions(true)}
          title="Change where this post is published"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-semibold transition cursor-pointer ${
            selectedCommunity
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
              : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{communityLabel}</span>
        </button>
        {!selectedCommunity && blogCategory && <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 font-semibold">
          <Tag className="w-3.5 h-3.5" />
          Category: {CATEGORY_DEFINITIONS.find(category => category.tag === blogCategory)?.label || blogCategory}
        </span>}
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 font-medium">
          <Coins className="w-3.5 h-3.5 text-amber-500" />
          {PAYOUT_LABELS[payoutOption]}
        </span>
        {languageLabel && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 font-medium">
            <Globe className="w-3.5 h-3.5 text-indigo-500" />
            {languageLabel.flag} {languageLabel.name}
          </span>
        )}
      </div>

      {/* Banners */}
      {(errorMessage || successMessage) && (
        <div
          className={`mb-4 p-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-2xs animate-in fade-in ${
            errorMessage
              ? 'bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/50 dark:border-rose-900 dark:text-rose-300'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-900 dark:text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {errorMessage ? (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <Check className="w-5 h-5 flex-shrink-0" />
            )}
            <span>{errorMessage || successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className="p-1 hover:opacity-75 cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Publish Options */}
      {showOptions && (
        <div className="mb-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm animate-in fade-in slide-in-from-top-2 duration-150 text-gray-900 dark:text-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-4">
            {selectedCommunity && communityFeatures && communityFeatures.settings.flairs.length > 0 && <div className="space-y-1.5">
              <label htmlFor="write-post-flair" className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-slate-300">
                <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Post Flair</span>
              </label>
              <select id="write-post-flair" value={postFlair} onChange={event => setPostFlair(event.target.value)} className={selectClass} disabled={isSubmitting}>
                <option value="">No flair</option>{communityFeatures.settings.flairs.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </div>}

            {selectedCommunity && !!communityFeatures?.settings.subtags.length && <div className="sm:col-span-2 flex flex-wrap gap-1.5">{communityFeatures.settings.subtags.map(tag => <button type="button" key={tag} onClick={() => addTag(tag)} disabled={isSubmitting} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">+ #{tag}</button>)}</div>}

          </div>

        </div>
      )}

      {/* Editor + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 items-start">
        {/* Editor */}
        <section
          className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm flex-col gap-4 ${
            mobilePane === 'preview' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 flex items-center gap-1 text-xs font-bold text-gray-500 dark:text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" /> Templates:
            </span>
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                title={template.hint}
                onClick={() => applyTemplate(template)}
                className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-blue-50 hover:text-blue-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-blue-950/60"
              >
                + {template.label}
              </button>
            ))}
          </div>

          <label
            htmlFor="write-title"
            className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-slate-300"
          >
            <span>Article title</span>
            <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
              Required
            </span>
          </label>
          <input
            id="write-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Article Title..."
            maxLength={255}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-xl font-bold tracking-tight text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 sm:text-2xl"
          />

          <div className="-mt-2 space-y-1.5">
            <label
              htmlFor="write-custom-permlink"
              className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-slate-300"
            >
              <LinkIcon className="w-3.5 h-3.5 text-indigo-500" />
              <span>Custom Permlink <span className="font-medium text-slate-400">(optional)</span></span>
            </label>
            <input
              id="write-custom-permlink"
              type="text"
              value={customPermlink}
              onChange={(event) => setCustomPermlink(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').slice(0, 256))}
              placeholder="e.g. my-hive-article-title"
              maxLength={256}
              autoComplete="off"
              spellCheck={false}
              className={selectClass}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
            <ToolButton label="Bold (⌘B)" onClick={() => insertAtCursor('**', '**', 'bold')}>
              <Bold className="w-4 h-4" />
            </ToolButton>
            <ToolButton label="Italic (⌘I)" onClick={() => insertAtCursor('*', '*', 'italic')}>
              <Italic className="w-4 h-4" />
            </ToolButton>
            <div className="w-px h-5 bg-gray-200 dark:bg-slate-700 mx-1" />
            <ToolButton label="Heading 1" onClick={() => insertAtCursor('# ', '', 'Heading')}>
              <Heading1 className="w-4 h-4" />
            </ToolButton>
            <ToolButton label="Heading 2" onClick={() => insertAtCursor('## ', '', 'Subheading')}>
              <Heading2 className="w-4 h-4" />
            </ToolButton>
            <div className="w-px h-5 bg-gray-200 dark:bg-slate-700 mx-1" />
            <ToolButton label="Quote" onClick={() => insertAtCursor('> ', '', 'quote')}>
              <Quote className="w-4 h-4" />
            </ToolButton>
            <ToolButton label="Code Block" onClick={() => insertAtCursor('```\n', '\n```', 'code')}>
              <Code className="w-4 h-4" />
            </ToolButton>
            <ToolButton label="Insert Link (⌘K)" onClick={() => insertAtCursor('[', '](https://)', 'link text')}>
              <LinkIcon className="w-4 h-4" />
            </ToolButton>
            <ToolButton label="Insert Image" onClick={() => insertAtCursor('![alt](', ')', 'https://')}>
              <ImageIcon className="w-4 h-4" />
            </ToolButton>
            <ToolButton label="Bullet List" onClick={() => insertAtCursor('- ', '', 'item')}>
              <List className="w-4 h-4" />
            </ToolButton>
          </div>

          {selectedText && (
            <div
              className="fixed z-[70] max-h-[calc(100vh-24px)] w-[min(360px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-slate-200 bg-white/95 p-3 text-slate-900 shadow-xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
              style={selectionMenuPosition ? { left: selectionMenuPosition.left, top: selectionMenuPosition.top } : { left: 12, top: 12 }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">Selected text</span>
                <button type="button" onClick={() => { setSelectionAction(selectionAction === 'translate' ? null : 'translate'); setSelectionResult(''); setSelectionError(''); }} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-blue-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                  <Languages className="h-3.5 w-3.5 text-emerald-600" /> Translate
                </button>
                <button type="button" onClick={() => { setSelectionAction(selectionAction === 'encode' ? null : 'encode'); setSelectionResult(''); setSelectionError(''); }} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-blue-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                  <LockKeyhole className="h-3.5 w-3.5 text-amber-600" /> Encode
                </button>
                <span className="w-full truncate text-[10px] text-slate-500 dark:text-slate-400">{selectedText.text.trim().slice(0, 90)}{selectedText.text.trim().length > 90 ? '…' : ''}</span>
              </div>

              {selectionAction === 'translate' && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label htmlFor="write-selection-language" className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Translate to</label>
                  <select id="write-selection-language" value={selectionTargetLanguage} onChange={event => setSelectionTargetLanguage(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                    {POPULAR_TRANSLATION_LANGUAGES.map(language => <option key={language.code} value={language.code}>{language.flag} {language.name}</option>)}
                  </select>
                  <button type="button" onClick={runSelectionTranslate} disabled={selectionBusy} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                    {selectionBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{selectionBusy ? 'Translating…' : 'Translate selection'}
                  </button>
                  <span className="text-[10px] text-slate-500">Selected text is sent to the translation service.</span>
                </div>
              )}

              {selectionAction === 'encode' && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="min-w-[190px] flex-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300" htmlFor="write-encode-recipient">
                    Recipient Hive account
                    <input id="write-encode-recipient" value={selectionRecipient} onChange={event => setSelectionRecipient(event.target.value)} placeholder="e.g. alice" autoComplete="off" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-normal text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                  </label>
                  <button type="button" onClick={runSelectionEncode} disabled={selectionBusy || !currentUser || currentUser.isDemo} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
                    {selectionBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{selectionBusy ? 'Encoding…' : 'Encode selection'}
                  </button>
                  <p className="w-full text-[10px] text-slate-500 dark:text-slate-400">Keychain needs the recipient’s Hive account name to find their public memo key. They need the matching private memo key to decode it.</p>
                </div>
              )}

              {selectionError && <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">{selectionError}</p>}
              {selectionResult && (
                <div className="mt-3 space-y-2">
                  <textarea readOnly value={selectionResult} aria-label={selectionAction === 'encode' ? 'Encoded selection' : 'Translated selection'} className="min-h-20 w-full resize-y rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={replaceSelectedText} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">Replace selected text</button>
                    <button type="button" onClick={copySelectionResult} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"><Copy className="h-3.5 w-3.5" /> Copy</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className={`rounded-xl border px-3 py-2.5 transition ${encryptBody ? 'border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/20' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40'}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <label htmlFor="write-encrypt-body" className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-gray-800 dark:text-slate-100">
                <input
                  id="write-encrypt-body"
                  type="checkbox"
                  checked={encryptBody}
                  onChange={(event) => {
                    setEncryptBody(event.target.checked);
                    if (event.target.checked && !encryptRecipient && currentUser?.username) setEncryptRecipient(currentUser.username);
                  }}
                  disabled={isSubmitting}
                  className="h-4 w-4 shrink-0 accent-amber-600"
                />
                <LockKeyhole className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                Encrypt article body
              </label>
              {encryptBody && (
                <label htmlFor="write-encrypt-recipient" className="flex min-w-[190px] flex-1 items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <span className="shrink-0">For</span>
                  <input
                    id="write-encrypt-recipient"
                    value={encryptRecipient}
                    onChange={(event) => setEncryptRecipient(event.target.value)}
                    placeholder="Hive account"
                    autoComplete="off"
                    disabled={isSubmitting}
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-normal text-slate-800 focus:border-amber-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
              )}
              {encryptBody && <span className="w-full pl-6 text-[10px] text-slate-500 dark:text-slate-400">Only this account can decrypt the body. Title and tags remain public.</span>}
            </div>
          </div>

          <textarea
            id="post-editor-textarea"
            ref={textareaRef}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onMouseUp={captureEditorSelection}
            onKeyUp={captureEditorSelection}
            onSelect={captureEditorSelection}
            onScroll={() => { if (selectedText && textareaRef.current) positionSelectionMenu(textareaRef.current, selectedText.end); }}
            placeholder="Write your article story in Markdown... Supports full formatting, code blocks, and embedded media."
            className="w-full min-h-[460px] lg:min-h-[calc(100vh-26rem)] p-4 bg-slate-50/70 dark:bg-slate-950/40 rounded-xl text-sm sm:text-base leading-relaxed text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-600 border border-slate-200/70 dark:border-slate-800 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 transition font-sans"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              {selectedCommunity ? (
                <>
                  <label htmlFor="write-community-category" className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-slate-300">
                    <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Community Category <span className="text-rose-500">*</span></span>
                  </label>
                  {communityLoading ? (
                    <p className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-700">Loading categories…</p>
                  ) : communityError ? (
                    <p role="alert" className="text-xs text-rose-600">
                      {communityError} <button type="button" onClick={retryCommunity} className="underline">Retry</button>
                    </p>
                  ) : communityFeatures && (
                    <>
                      <select
                        id="write-community-category"
                        required
                        aria-required="true"
                        value={communityCategory}
                        onChange={event => setCommunityCategory(event.target.value)}
                        className={selectClass}
                        disabled={isSubmitting}
                      >
                        <option value="">Choose a category before publishing</option>
                        {communityFeatures.settings.categories.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                      </select>
                      <p className="text-[11px] text-slate-500">Select where this post belongs in {communityFeatures.community.title || communityFeatures.community.name}.</p>
                    </>
                  )}
                </>
              ) : (
                <>
                  <label htmlFor="write-blog-category" className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-slate-300">
                    <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Post Category <span className="font-medium text-slate-400">(optional)</span></span>
                  </label>
                  <select
                    id="write-blog-category"
                    value={blogCategory}
                    onChange={event => handleBlogCategoryChange(event.target.value)}
                    className={selectClass}
                    disabled={isSubmitting}
                  >
                    <option value="">Use the first tag as category</option>
                    {CATEGORY_DEFINITIONS.map(category => <option key={category.tag} value={category.tag}>{category.icon} {category.label}</option>)}
                  </select>
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="write-community"
                className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-slate-300"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Hive Community</span>
              </label>
              <select
                id="write-community"
                value={selectedCommunity}
                onChange={(event) => setSelectedCommunity(event.target.value)}
                className={selectClass}
                disabled={isSubmitting}
              >
                <option value="">Personal Blog (No Community)</option>
                {selectedCommunity && !communityOptions.some(community => community.name === selectedCommunity) && (
                  <option value={selectedCommunity}>{communityLabel}</option>
                )}
                {communityOptions.map((community) => (
                  <option key={community.name} value={community.name}>
                    {community.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div className="pt-3 border-t border-gray-100 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <label
                className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-slate-300"
                htmlFor="write-tags"
              >
                <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Tags (separated by spaces)</span>
              </label>
              <span
                className={`text-[11px] font-semibold ${
                  tagList.length > MAX_TAGS ? 'text-rose-600' : 'text-gray-400 dark:text-slate-500'
                }`}
              >
                {tagList.length}/{MAX_TAGS}
              </span>
            </div>

            <div className="relative">
              <input
                id="write-tags"
                value={tagsInput}
                onChange={(event) => {
                  setTagsInput(event.target.value);
                  setShowTagSuggestions(true);
                }}
                onFocus={() => setShowTagSuggestions(true)}
                onBlur={() => setShowTagSuggestions(false)}
                placeholder="e.g. hive photography art crypto"
                autoComplete="off"
                aria-autocomplete="list"
                aria-controls="write-tag-suggestions"
                aria-expanded={showTagSuggestions && tagSuggestions.length > 0}
                className="w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 text-xs font-semibold text-gray-800 dark:text-slate-200 border border-gray-200/80 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {showTagSuggestions && tagSuggestions.length > 0 && (
                <div
                  id="write-tag-suggestions"
                  role="listbox"
                  aria-label="Matching Hive tags"
                  className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
                >
                  {tagSuggestions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      role="option"
                      aria-selected="false"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectTagSuggestion(tag)}
                      className="block w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-blue-300"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {tagList.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tagList.map((tag, index) => (
                  <span
                    key={`${tag}-${index}`}
                    className={`inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-lg text-[11px] font-semibold ${
                      index === 0
                        ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
                    }`}
                    title={index === 0 ? 'Main tag (used as category when there is no community)' : undefined}
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 pt-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="write-payout"
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-slate-300"
                >
                  <Coins className="w-3.5 h-3.5 text-amber-500" />
                  <span>Rewards Payout</span>
                </label>
                <select
                  id="write-payout"
                  value={payoutOption}
                  onChange={(event) => setPayoutOption(event.target.value as PayoutOption)}
                  className={selectClass}
                  disabled={isSubmitting}
                >
                  <option value="50-50">50% HBD / 50% Hive Power</option>
                  <option value="100-hp">100% Hive Power</option>
                  <option value="decline">Decline Payout (0%)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="write-language"
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-slate-300"
                >
                  <Globe className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Language Tag</span>
                </label>
                <select
                  id="write-language"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  className={selectClass}
                  disabled={isSubmitting}
                >
                  <option value="">No Language Tag</option>
                  {languages.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.flag} {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

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

        {/* Preview: fica fixa na tela enquanto você escreve */}
        <section
          className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm flex-col lg:sticky lg:top-36 lg:max-h-[calc(100vh-10rem)] overflow-hidden ${
            mobilePane === 'edit' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-b border-gray-100 dark:border-slate-800 text-xs font-bold text-gray-500 dark:text-slate-400 flex-shrink-0">
            <span className="flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Preview
            </span>
            <span className="text-[10px] bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">
              Live
            </span>
          </div>

          <div className="overflow-y-auto px-5 sm:px-6 py-5 flex-1 min-h-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white mb-6 break-words leading-tight">
              {title || 'Untitled Story...'}
            </h1>

            <div
              className="article-body text-sm sm:text-base leading-relaxed text-gray-800 dark:text-slate-200 space-y-4 break-words [&_a]:text-blue-600 [&_img]:rounded-2xl [&_img]:max-w-full [&_pre]:overflow-x-auto [&_pre]:bg-gray-100 [&_pre]:dark:bg-slate-800/80 [&_pre]:p-4 [&_pre]:rounded-2xl [&_blockquote]:border-l-4 [&_blockquote]:border-blue-500 [&_blockquote]:pl-4 [&_blockquote]:py-1"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
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
