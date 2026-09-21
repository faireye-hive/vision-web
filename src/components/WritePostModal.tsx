import React, { useState, useEffect } from 'react';
import {
  X,
  Edit3,
  Eye,
  Bold,
  Italic,
  Heading1,
  Heading2,
  Quote,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  List,
  Send,
  Check,
  Sparkles,
  Layers,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { CurrentUser, KeychainService } from '../services/keychain';
import { markdownToSafeHtml } from '../utils/sanitize';

interface WritePostModalProps {
  onClose: () => void;
  currentUser: CurrentUser | null;
  onRequireLogin: () => void;
  defaultCommunity?: string;
}

const POPULAR_TAGS = ['hive', 'ecency', 'photography', 'crypto', 'art', 'travel', 'food', 'lifestyle', 'gaming'];

export const WritePostModal: React.FC<WritePostModalProps> = ({
  onClose,
  currentUser,
  onRequireLogin,
  defaultCommunity
}) => {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [title, setTitle] = useState(() => localStorage.getItem('hive_draft_title') || '');
  const [body, setBody] = useState(() => localStorage.getItem('hive_draft_body') || '');
  const [tagsInput, setTagsInput] = useState(() => localStorage.getItem('hive_draft_tags') || 'hive');
  const [payoutOption, setPayoutOption] = useState<'50-50' | '100-hp' | 'decline'>('50-50');
  const [selectedCommunity, setSelectedCommunity] = useState(defaultCommunity || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Auto-save draft
  useEffect(() => {
    localStorage.setItem('hive_draft_title', title);
    localStorage.setItem('hive_draft_body', body);
    localStorage.setItem('hive_draft_tags', tagsInput);
  }, [title, body, tagsInput]);

  const insertMarkdown = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('post-editor-textarea') as HTMLTextAreaElement | null;
    if (!textarea) {
      setBody(prev => prev + prefix + suffix);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = body.substring(start, end);
    const replacement = prefix + (selected || 'text') + suffix;

    const newBody = body.substring(0, start) + replacement + body.substring(end);
    setBody(newBody);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selected || 'text').length);
    }, 50);
  };

  const handleAddTag = (tag: string) => {
    const current = tagsInput.split(/\s+/).filter(Boolean);
    if (!current.includes(tag)) {
      setTagsInput([...current, tag].join(' '));
    }
  };

  const handlePublish = async () => {
    if (!currentUser) {
      onRequireLogin();
      return;
    }

    if (!title.trim()) {
      setErrorMessage('Please provide a title for your post.');
      return;
    }

    if (!body.trim()) {
      setErrorMessage('Post content cannot be empty.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const cleanTags = tagsInput
        .toLowerCase()
        .replace(/#/g, '')
        .split(/\s+/)
        .filter(t => /^[a-z0-9-]+$/.test(t))
        .slice(0, 10);

      const parentPermlink = selectedCommunity || cleanTags[0] || 'hive';
      const permlink = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80) + `-${Date.now().toString().slice(-5)}`;

      const jsonMetadata = JSON.stringify({
        app: 'nebulosa-web/0.0.1',
        format: 'markdown',
        tags: cleanTags
      });

      if (!KeychainService.isInstalled()) {
        // Fallback for environment without extension
        setSuccessMessage('Draft recorded! (Hive Keychain browser extension is needed to broadcast to mainnet)');
        setTimeout(() => {
          onClose();
        }, 2000);
        return;
      }

      window.hive_keychain!.requestPost!(
        currentUser.username,
        title,
        body,
        parentPermlink,
        '',
        jsonMetadata,
        permlink,
        '',
        (response) => {
          setIsSubmitting(false);
          if (response.success) {
            setSuccessMessage('Your story was published successfully to Hive!');
            // Clear drafts
            localStorage.removeItem('hive_draft_title');
            localStorage.removeItem('hive_draft_body');
            setTimeout(() => {
              onClose();
              window.location.reload();
            }, 1800);
          } else {
            setErrorMessage(response.message || response.error || 'Failed to broadcast post via Keychain.');
          }
        }
      );
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err.message || 'Error creating post.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div
        className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-blue-50 text-blue-600">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Create Hive Story</h2>
              <p className="text-xs text-gray-500">Decentralized, immutable publishing on the Hive blockchain</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View switcher: Write vs Preview */}
            <div className="flex items-center bg-gray-100 p-1 rounded-full text-xs font-semibold">
              <button
                onClick={() => setActiveTab('edit')}
                className={`px-3 py-1 rounded-full transition flex items-center gap-1.5 ${activeTab === 'edit' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                  }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Write</span>
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 rounded-full transition flex items-center gap-1.5 ${activeTab === 'preview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                  }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">

          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-700 text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Title Input */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title of your post..."
              className="w-full text-lg sm:text-xl font-bold text-gray-900 placeholder-gray-400 px-4 py-3 bg-gray-50/70 rounded-2xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition"
            />
          </div>

          {/* Edit Mode vs Preview Mode */}
          {activeTab === 'edit' ? (
            <div className="space-y-2">
              {/* Markdown Toolbar */}
              <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50/80 rounded-2xl border border-gray-100">
                <button
                  type="button"
                  onClick={() => insertMarkdown('**', '**')}
                  className="p-1.5 rounded-lg text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-xs transition"
                  title="Bold"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown('*', '*')}
                  className="p-1.5 rounded-lg text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-xs transition"
                  title="Italic"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown('# ')}
                  className="p-1.5 rounded-lg text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-xs transition"
                  title="Heading 1"
                >
                  <Heading1 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown('## ')}
                  className="p-1.5 rounded-lg text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-xs transition"
                  title="Heading 2"
                >
                  <Heading2 className="w-4 h-4" />
                </button>
                <div className="w-px h-5 bg-gray-200 mx-1" />
                <button
                  type="button"
                  onClick={() => insertMarkdown('> ')}
                  className="p-1.5 rounded-lg text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-xs transition"
                  title="Blockquote"
                >
                  <Quote className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown('```\n', '\n```')}
                  className="p-1.5 rounded-lg text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-xs transition"
                  title="Code block"
                >
                  <Code className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown('[', '](https://)')}
                  className="p-1.5 rounded-lg text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-xs transition"
                  title="Insert Link"
                >
                  <LinkIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown('![Image description](', ')')}
                  className="p-1.5 rounded-lg text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-xs transition"
                  title="Insert Image"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown('- ')}
                  className="p-1.5 rounded-lg text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-xs transition"
                  title="Bulleted list"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Textarea */}
              <textarea
                id="post-editor-textarea"
                rows={12}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your story in Markdown or HTML. Supports images, code formatting, quotes, and links..."
                className="w-full p-4 bg-gray-50/50 rounded-2xl text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 resize-none font-sans leading-relaxed transition"
              />
            </div>
          ) : (
            /* Live Sanitized Preview */
            <div className="p-6 bg-gray-50/50 rounded-2xl min-h-[320px] max-h-[460px] overflow-y-auto space-y-4">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                {title || 'Story Title Preview'}
              </h1>
              <div
                className="prose prose-slate max-w-none text-sm text-gray-800 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: markdownToSafeHtml(body || '*No content written yet...*') }}
              />
            </div>
          )}

          {/* Tags & Community Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">

            {/* Tags Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 block">
                Tags (space separated, max 10)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g. hive photography crypto"
                className="w-full px-3.5 py-2 bg-gray-50/70 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {POPULAR_TAGS.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleAddTag(t)}
                    className="text-[10px] font-medium bg-gray-100 hover:bg-blue-50 text-gray-600 hover:text-blue-600 px-2 py-0.5 rounded-lg transition"
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </div>

            {/* Payout Options */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 block">
                Reward Payout Option
              </label>
              <select
                value={payoutOption}
                onChange={(e) => setPayoutOption(e.target.value as any)}
                className="w-full px-3.5 py-2 bg-gray-50/70 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:bg-white transition"
              >
                <option value="50-50">50% HBD / 50% Hive Power (Recommended)</option>
                <option value="100-hp">100% Hive Power</option>
                <option value="decline">Decline Payout</option>
              </select>
              <p className="text-[11px] text-gray-400">
                Direct on-chain reward distribution after 7 days.
              </p>
            </div>

          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50/90 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Draft auto-saved</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-semibold text-gray-600 hover:bg-gray-200/60 transition"
            >
              Cancel
            </button>

            <button
              onClick={handlePublish}
              disabled={isSubmitting || !title.trim() || !body.trim()}
              className="flex items-center gap-2 px-6 py-2 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Signing with Keychain...' : 'Publish to Hive'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
