import { useEffect, useState } from 'react';
import { AtSign, CornerDownRight, ExternalLink, Heart, Send } from 'lucide-react';
import {
  HiveNotification,
  HivePost,
  getAccountNotifications,
  getAccountPosts,
  getHiveAvatarUrl,
  getMutedAccounts,
  getPost,
  getPostSnippet,
} from '../services/hiveApi';
import { markdownToSafeHtml } from '../utils/sanitize';
import { KeychainService } from '../services/keychain';
import { useAuth } from '../context/AuthContext';
import { requestLogin } from '../utils/authEvents';
import { VoteWeightDialog } from './VoteWeightDialog';

function parseHiveRef(url: string): { author: string; permlink: string } | null {
  const source = (url || '').split('#')[0];
  const match = source.match(/@([a-z0-9.-]+)\/([a-z0-9-]+)/i);
  if (!match) return null;
  return { author: match[1], permlink: match[2] };
}

function RelatedPost({
  author,
  permlink,
  onOpen,
}: {
  author: string;
  permlink: string;
  onOpen: (post: HivePost) => void;
}) {
  const [post, setPost] = useState<HivePost | null>(null);

  useEffect(() => {
    let active = true;
    getPost(author, permlink)
      .then((loaded) => {
        if (active) setPost(loaded);
      })
      .catch(() => {
        if (active) setPost(null);
      });
    return () => {
      active = false;
    };
  }, [author, permlink]);

  const href = `https://peakd.com/@${author}/${permlink}`;

  return (
    <aside className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-3 h-fit">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Post</p>
      <button
        type="button"
        onClick={() => post && onOpen(post)}
        className="mt-1 text-left text-sm font-bold text-slate-900 dark:text-white line-clamp-2 hover:text-blue-600 cursor-pointer"
      >
        {post?.title?.trim() || `@${author}`}
      </button>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-4">
        {post ? getPostSnippet(post.body, 160) : 'Loading title and description…'}
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400"
      >
        Open link
        <ExternalLink className="w-3 h-3" />
      </a>
    </aside>
  );
}

function ReplyCard({
  reply,
  onOpenPost,
}: {
  reply: HivePost;
  onOpenPost: (post: HivePost) => void;
}) {
  const { currentUser } = useAuth();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [voteOpen, setVoteOpen] = useState(false);
  const [voted, setVoted] = useState(false);
  const html = markdownToSafeHtml(reply.body || '');

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    if (!currentUser) {
      requestLogin();
      return;
    }
    setSending(true);
    try {
      const result = await KeychainService.postComment(
        currentUser.username,
        reply.author,
        reply.permlink,
        text.trim()
      );
      if (result.success) {
        setText('');
        setSent(true);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <article className="grid lg:grid-cols-[minmax(0,1fr)_220px] gap-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-5 shadow-xs">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-3">
          <img src={getHiveAvatarUrl(reply.author, 'small')} alt="" className="w-8 h-8 rounded-full" />
          <div>
            <p className="text-sm font-bold">@{reply.author}</p>
            <p className="text-[11px] text-slate-400">replied to you</p>
          </div>
        </div>
        <div
          className="text-sm leading-relaxed text-slate-800 dark:text-slate-100 prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            type="button"
            onClick={() => {
              if (!currentUser) {
                requestLogin();
                return;
              }
              if (!voted) setVoteOpen(true);
            }}
            className={`inline-flex items-center gap-1 text-xs font-bold cursor-pointer ${voted ? 'text-rose-600' : 'text-slate-500 hover:text-rose-600'}`}
          >
            <Heart className={`w-3.5 h-3.5 ${voted ? 'fill-current' : ''}`} />
            {voted ? 'Voted' : 'Vote'}
          </button>
        </div>
        <form onSubmit={send} className="mt-3 flex gap-2">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={`Reply to @${reply.author}`}
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="inline-flex items-center gap-1 px-3 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? 'Sending' : 'Reply'}
          </button>
        </form>
        {sent && <p className="text-[11px] text-emerald-600 mt-2">Reply sent.</p>}
      </div>
      {reply.parent_author && reply.parent_permlink && (
        <RelatedPost author={reply.parent_author} permlink={reply.parent_permlink} onOpen={onOpenPost} />
      )}
      <VoteWeightDialog
        open={voteOpen}
        username={currentUser?.username || ''}
        author={reply.author}
        permlink={reply.permlink}
        onClose={() => setVoteOpen(false)}
        onVoted={() => setVoted(true)}
      />
    </article>
  );
}

function MentionCard({
  note,
  onOpenPost,
}: {
  note: HiveNotification;
  onOpenPost: (post: HivePost) => void;
}) {
  const ref = parseHiveRef(note.url || '');
  return (
    <article className="grid lg:grid-cols-[minmax(0,1fr)_220px] gap-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-5 shadow-xs">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">
          <AtSign className="w-3.5 h-3.5" />
          Mention
        </div>
        <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed">{note.msg}</p>
      </div>
      {ref && <RelatedPost author={ref.author} permlink={ref.permlink} onOpen={onOpenPost} />}
    </article>
  );
}

export function ProfileReplies({
  username,
  onOpenPost,
}: {
  username: string;
  onOpenPost: (post: HivePost) => void;
}) {
  const [replies, setReplies] = useState<HivePost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getAccountPosts('replies', username, 20), getMutedAccounts(username)])
      .then(([items, muted]) => {
        if (!active) return;
        const hidden = new Set(muted);
        setReplies((items || []).filter((post) => !hidden.has((post.author || '').toLowerCase())));
      })
      .catch(() => {
        if (active) setReplies([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [username]);

  if (loading) return <p className="text-xs text-slate-400">Loading replies…</p>;
  if (replies.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-400">
        No replies to @{username} yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {replies.map((reply) => (
        <ReplyCard key={`${reply.author}/${reply.permlink}`} reply={reply} onOpenPost={onOpenPost} />
      ))}
    </div>
  );
}

export function ProfileMentions({
  username,
  onOpenPost,
}: {
  username: string;
  onOpenPost: (post: HivePost) => void;
}) {
  const [notes, setNotes] = useState<HiveNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getAccountNotifications(username, 40), getMutedAccounts(username)])
      .then(([items, muted]) => {
        if (!active) return;
        const hidden = new Set(muted);
        setNotes(
          (items || []).filter((item) => {
            if (item.type !== 'mention') return false;
            const actor = (item.msg || '').match(/@([a-z0-9.-]+)/i)?.[1]?.toLowerCase();
            return !actor || !hidden.has(actor);
          })
        );
      })
      .catch(() => {
        if (active) setNotes([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [username]);

  if (loading) return <p className="text-xs text-slate-400">Loading mentions…</p>;
  if (notes.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-400">
        <CornerDownRight className="w-4 h-4 mx-auto mb-2" />
        No mentions for @{username} yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notes.map((note) => (
        <MentionCard key={note.id || note.url} note={note} onOpenPost={onOpenPost} />
      ))}
    </div>
  );
}
