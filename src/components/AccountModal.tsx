import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  MapPin, 
  Link as LinkIcon, 
  Calendar, 
  Coins, 
  Zap, 
  ShieldCheck, 
  FileText, 
  History, 
  ExternalLink,
  Search,
  Check
} from 'lucide-react';
import { 
  HiveAccount, 
  HivePost, 
  getAccount, 
  getProfile, 
  getAccountPosts, 
  getAccountHistory, 
  getDynamicGlobalProperties, 
  calculateReputation, 
  calculateVotingPower, 
  vestsToHivePower, 
  getHiveAvatarUrl 
} from '../services/hiveApi';

interface AccountModalProps {
  username: string;
  onClose: () => void;
  onSelectPost: (post: HivePost) => void;
  onSelectAuthor: (author: string) => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  username,
  onClose,
  onSelectPost,
  onSelectAuthor
}) => {
  const [currentUser, setCurrentUser] = useState(username);
  const [inputSearch, setInputSearch] = useState('');
  const [account, setAccount] = useState<HiveAccount | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<HivePost[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [globalProps, setGlobalProps] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'posts' | 'history'>('posts');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      getAccount(currentUser),
      getProfile(currentUser),
      getAccountPosts('posts', currentUser, 20),
      getAccountHistory(currentUser, 25),
      getDynamicGlobalProperties()
    ])
      .then(([acc, prof, userPosts, userHistory, dynProps]) => {
        if (!isMounted) return;
        if (!acc) {
          setError(`Account @${currentUser} not found on the Hive blockchain.`);
        } else {
          setAccount(acc);
          setProfile(prof);
          setPosts(userPosts);
          setHistory(userHistory.reverse());
          setGlobalProps(dynProps);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to fetch Hive account details.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputSearch.replace(/^@/, '').trim().toLowerCase();
    if (clean) {
      setCurrentUser(clean);
      setInputSearch('');
    }
  };

  const rep = account ? calculateReputation(account.reputation) : 25;
  const avatarUrl = getHiveAvatarUrl(currentUser, 'large');

  // Calculate HP
  const hp = account && globalProps
    ? vestsToHivePower(
        account.vesting_shares,
        globalProps.total_vesting_shares,
        globalProps.total_vesting_fund_hive
      )
    : 0;

  // Calculate real voting power
  const vp = account ? calculateVotingPower(account.voting_power, account.last_vote_time) : 100;

  // Parse metadata for profile info
  let metaProfile: any = profile?.metadata?.profile || {};
  if (!metaProfile.name && account?.posting_json_metadata) {
    try {
      metaProfile = JSON.parse(account.posting_json_metadata)?.profile || {};
    } catch {
      // ignore
    }
  }

  return (
    <div 
      id="account-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/60 backdrop-blur-sm flex justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
    >
      <div 
        className="relative bg-white border border-gray-200 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar with quick user search & close */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-150 bg-white sticky top-0 z-20">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-xs w-full">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={inputSearch}
                onChange={(e) => setInputSearch(e.target.value)}
                placeholder="Search other @account..."
                className="w-full pl-8 pr-3 py-1 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              className="px-2.5 py-1 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg border border-gray-200 transition"
            >
              Lookup
            </button>
          </form>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 transition"
            title="Close profile"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-gray-500">Fetching @{currentUser} from public Hive RPC...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-sm text-rose-500">{error}</p>
              <button
                onClick={() => setCurrentUser('ecency')}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
              >
                Go to @ecency
              </button>
            </div>
          ) : account && (
            <div>
              {/* Cover Banner */}
              <div className="h-32 sm:h-44 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-100 relative overflow-hidden border-b border-gray-150">
                {metaProfile.cover_image && (
                  <img 
                    src={metaProfile.cover_image} 
                    alt="Cover" 
                    className="w-full h-full object-cover opacity-60"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                )}
              </div>

              {/* Profile Details Header */}
              <div className="px-5 sm:px-8 pb-6 relative">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-14 sm:-mt-16 gap-4 mb-4">
                  <div className="flex items-end gap-4">
                    <img 
                      src={avatarUrl} 
                      alt={currentUser} 
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white border-4 border-white object-cover shadow-md"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.ecency.com/u/hive/avatar/large';
                      }}
                    />
                    <div className="mb-2">
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                          {metaProfile.name || currentUser}
                        </h2>
                        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          ({rep})
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">@{currentUser}</p>
                    </div>
                  </div>

                  {/* External Ecency Profile Link */}
                  <a
                    href={`https://ecency.com/@${currentUser}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold self-start sm:self-auto shadow-sm transition"
                  >
                    <span>View on Ecency</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Bio & Meta details */}
                {metaProfile.about && (
                  <p className="text-xs sm:text-sm text-gray-600 max-w-2xl mb-4 leading-relaxed">
                    {metaProfile.about}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mb-6">
                  {metaProfile.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      {metaProfile.location}
                    </span>
                  )}
                  {metaProfile.website && (
                    <a 
                      href={metaProfile.website.startsWith('http') ? metaProfile.website : `https://${metaProfile.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      {metaProfile.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    Joined {new Date(account.created + 'Z').toLocaleDateString()}
                  </span>
                  {profile?.stats && (
                    <>
                      <span>• <strong className="text-gray-800">{profile.stats.followers || 0}</strong> followers</span>
                      <span>• <strong className="text-gray-800">{profile.stats.following || 0}</strong> following</span>
                    </>
                  )}
                </div>

                {/* Balances & Power Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {/* HIVE */}
                  <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                    <p className="text-[10px] uppercase font-bold text-gray-400">Liquid HIVE</p>
                    <p className="text-sm sm:text-base font-mono font-bold text-gray-900 mt-0.5 truncate">
                      {account.balance}
                    </p>
                  </div>

                  {/* HBD */}
                  <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                    <p className="text-[10px] uppercase font-bold text-gray-400">Hive Dollars (HBD)</p>
                    <p className="text-sm sm:text-base font-mono font-bold text-emerald-600 mt-0.5 truncate">
                      {account.hbd_balance}
                    </p>
                  </div>

                  {/* Hive Power */}
                  <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                    <p className="text-[10px] uppercase font-bold text-gray-400">Hive Power (HP)</p>
                    <p className="text-sm sm:text-base font-mono font-bold text-blue-600 mt-0.5 truncate">
                      {hp.toFixed(2)} HP
                    </p>
                  </div>

                  {/* Voting Power Gauge */}
                  <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase font-bold text-gray-400">Voting Power</p>
                      <span className="text-xs font-mono font-bold text-blue-600">{vp}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, Math.max(0, vp))}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Tabs: Posts vs History */}
                <div className="flex items-center gap-4 border-b border-gray-150 text-xs mb-4">
                  <button
                    onClick={() => setActiveTab('posts')}
                    className={`pb-2 font-bold transition border-b-2 flex items-center gap-1.5 ${
                      activeTab === 'posts'
                        ? 'text-blue-600 border-blue-600'
                        : 'text-gray-500 border-transparent hover:text-gray-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>User Posts ({posts.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('history')}
                    className={`pb-2 font-bold transition border-b-2 flex items-center gap-1.5 ${
                      activeTab === 'history'
                        ? 'text-blue-600 border-blue-600'
                        : 'text-gray-500 border-transparent hover:text-gray-900'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Recent Chain Operations ({history.length})</span>
                  </button>
                </div>

                {/* Tab 1: Posts */}
                {activeTab === 'posts' && (
                  <div className="space-y-3">
                    {posts.length > 0 ? (
                      posts.map((post) => (
                        <div
                          key={post.post_id || post.permlink}
                          onClick={() => {
                            onSelectPost(post);
                            onClose();
                          }}
                          className="p-3.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 cursor-pointer transition flex items-center justify-between gap-4 shadow-sm"
                        >
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-gray-900 hover:text-blue-600 truncate">
                              {post.title}
                            </h4>
                            <p className="text-[11px] text-gray-400 mt-1">
                              {new Date(post.created + 'Z').toLocaleDateString()} • {post.children} comments
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 italic p-6 text-center">No posts found for this user.</p>
                    )}
                  </div>
                )}

                {/* Tab 2: History */}
                {activeTab === 'history' && (
                  <div className="space-y-2">
                    {history.length > 0 ? (
                      history.map(([seq, item], idx) => {
                        const opType = item?.op?.[0] || 'operation';
                        const opData = item?.op?.[1] || {};
                        const time = item?.timestamp;

                        return (
                          <div 
                            key={idx} 
                            className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 text-xs flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-white text-gray-600 border border-gray-200">
                                {opType}
                              </span>
                              <span className="text-gray-700 truncate font-mono text-[11px]">
                                {opType === 'vote' ? `voted @${opData.author} (${opData.weight / 100}%)` : 
                                 opType === 'transfer' ? `transferred ${opData.amount} to @${opData.to}` :
                                 opType === 'comment' ? `commented on ${opData.permlink}` :
                                 opType === 'claim_reward_balance' ? `claimed rewards` :
                                 JSON.stringify(opData).slice(0, 50)}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-400 flex-shrink-0">
                              {time ? new Date(time + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-gray-400 italic p-6 text-center">No recent history retrieved.</p>
                    )}
                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
