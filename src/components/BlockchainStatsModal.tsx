import React, { useState, useEffect } from 'react';
import { 
  X, 
  Activity, 
  Terminal, 
  Server, 
  Cpu, 
  DollarSign, 
  Play, 
  RefreshCw, 
  Check, 
  Layers,
  Zap,
  Trash2,
  Database,
  Plus,
  RotateCcw,
  Globe,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { 
  HiveGlobalProps, 
  getDynamicGlobalProperties, 
  getAllHiveNodes, 
  getCustomHiveNodes,
  DEFAULT_HIVE_NODES,
  getActiveNode, 
  setActiveNode, 
  addCustomHiveNode,
  removeCustomHiveNode,
  resetHiveNodesToDefault,
  pingNode, 
  hiveRpcCall,
  apiCache
} from '../services/hiveApi';

interface BlockchainStatsModalProps {
  onClose: () => void;
}

export const BlockchainStatsModal: React.FC<BlockchainStatsModalProps> = ({ onClose }) => {
  const [props, setProps] = useState<HiveGlobalProps | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeNodeUrl, setActiveNodeUrl] = useState(getActiveNode());
  const [nodePings, setNodePings] = useState<Record<string, number>>({});
  const [allNodes, setAllNodes] = useState<string[]>(() => getAllHiveNodes());
  const [customNodes, setCustomNodes] = useState<string[]>(() => getCustomHiveNodes());

  // Add custom RPC node form state
  const [newRpcUrl, setNewRpcUrl] = useState('');
  const [addingNode, setAddingNode] = useState(false);
  const [nodeAddError, setNodeAddError] = useState<string | null>(null);
  const [nodeAddSuccess, setNodeAddSuccess] = useState<string | null>(null);

  // Interactive Live RPC playground
  const [rpcMethod, setRpcMethod] = useState('condenser_api.get_dynamic_global_properties');
  const [rpcParams, setRpcParams] = useState('[]');
  const [rpcResult, setRpcResult] = useState<string>('');
  const [rpcLoading, setRpcLoading] = useState(false);
  const [rpcError, setRpcError] = useState<string | null>(null);

  // Client-Side Cache Stats
  const [cacheStats, setCacheStats] = useState(apiCache.getStats());
  const [cacheClearedMsg, setCacheClearedMsg] = useState(false);

  useEffect(() => {
    return apiCache.subscribe((stats) => {
      setCacheStats(stats);
    });
  }, []);

  const handleClearCache = () => {
    apiCache.clear();
    setCacheStats(apiCache.getStats());
    setCacheClearedMsg(true);
    setTimeout(() => setCacheClearedMsg(false), 2500);
  };

  const pingAllNodes = (nodesList: string[]) => {
    nodesList.forEach((node) => {
      pingNode(node).then((ms) => {
        setNodePings((prev) => ({ ...prev, [node]: ms }));
      });
    });
  };

  const fetchStats = () => {
    setLoading(true);
    getDynamicGlobalProperties()
      .then((data) => {
        setProps(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Ping all nodes (defaults + custom)
    const currentNodes = getAllHiveNodes();
    setAllNodes(currentNodes);
    setCustomNodes(getCustomHiveNodes());
    pingAllNodes(currentNodes);
  };

  const handleSelectNode = (node: string) => {
    setActiveNode(node);
    setActiveNodeUrl(node);
  };

  const handleAddCustomNode = async (e: React.FormEvent) => {
    e.preventDefault();
    setNodeAddError(null);
    setNodeAddSuccess(null);
    const trimmed = newRpcUrl.trim().replace(/\/+$/, '');
    if (!trimmed) {
      setNodeAddError('Please enter an RPC node URL.');
      return;
    }

    setAddingNode(true);
    try {
      // Test connectivity first
      const pingMs = await pingNode(trimmed);
      if (pingMs < 0) {
        setNodeAddError('Could not reach RPC node or response timed out. Verify the URL is a valid Hive JSON-RPC endpoint.');
        setAddingNode(false);
        return;
      }

      const res = addCustomHiveNode(trimmed);
      if (res.success) {
        setNewRpcUrl('');
        const updatedCustom = getCustomHiveNodes();
        const updatedAll = getAllHiveNodes();
        setCustomNodes(updatedCustom);
        setAllNodes(updatedAll);
        setActiveNodeUrl(trimmed);
        setNodePings((prev) => ({ ...prev, [trimmed]: pingMs }));
        setNodeAddSuccess(`Connected! Active node set to ${trimmed} (${pingMs}ms). Saved to cache.`);
        setTimeout(() => setNodeAddSuccess(null), 3500);
      } else {
        setNodeAddError(res.error || 'Failed to add custom RPC node.');
      }
    } catch (err: any) {
      setNodeAddError(err.message || 'Error validating RPC node.');
    } finally {
      setAddingNode(false);
    }
  };

  const handleRemoveCustomNode = (node: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeCustomHiveNode(node);
    const updatedCustom = getCustomHiveNodes();
    const updatedAll = getAllHiveNodes();
    setCustomNodes(updatedCustom);
    setAllNodes(updatedAll);
    setActiveNodeUrl(getActiveNode());
  };

  const handleResetNodes = () => {
    if (confirm('Reset RPC nodes to default public nodes?')) {
      resetHiveNodesToDefault();
      setCustomNodes([]);
      setAllNodes(DEFAULT_HIVE_NODES);
      setActiveNodeUrl(DEFAULT_HIVE_NODES[0]);
      pingAllNodes(DEFAULT_HIVE_NODES);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleExecuteRpc = async () => {
    setRpcLoading(true);
    setRpcError(null);
    setRpcResult('');
    try {
      let parsedParams = [];
      if (rpcParams.trim()) {
        parsedParams = JSON.parse(rpcParams);
      }
      const res = await hiveRpcCall(rpcMethod.trim(), parsedParams);
      setRpcResult(JSON.stringify(res, null, 2));
    } catch (err: any) {
      setRpcError(err.message || 'RPC Call Failed');
    } finally {
      setRpcLoading(false);
    }
  };

  return (
    <div 
      id="blockchain-stats-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
    >
      <div 
        className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/95">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Hive Blockchain Network Stats</h2>
              <p className="text-xs text-slate-400">Live consensus & RPC Explorer (Zero Backend)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchStats}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition"
              title="Refresh Stats"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-rose-500/20 border border-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          
          {/* Key Metric Cards */}
          {props && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-400">
                  <Server className="w-3.5 h-3.5 text-rose-400" />
                  <span>Head Block</span>
                </div>
                <p className="text-lg font-mono font-bold text-white mt-1">
                  #{props.head_block_number?.toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-500 mt-1 truncate">
                  Producer: <span className="text-rose-300 font-mono">@{props.current_witness}</span>
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-400">
                  <Coins className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Virtual Supply</span>
                </div>
                <p className="text-lg font-mono font-bold text-white mt-1 truncate">
                  {props.current_supply?.split(' ')[0]}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">HIVE In Circulation</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-400">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>HBD Supply</span>
                </div>
                <p className="text-lg font-mono font-bold text-emerald-400 mt-1 truncate">
                  {props.current_hbd_supply?.split(' ')[0]}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Savings APR: <span className="text-white font-bold">{props.hbd_interest_rate / 100}%</span>
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-400">
                  <Cpu className="w-3.5 h-3.5 text-sky-400" />
                  <span>Block Time</span>
                </div>
                <p className="text-lg font-mono font-bold text-white mt-1 truncate">
                  {props.time ? new Date(props.time + 'Z').toLocaleTimeString() : '3 sec'}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">3s Block Interval (DPoS)</p>
              </div>
            </div>
          )}

          {/* Public & Custom Hive RPC Nodes Manager */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Server className="w-4 h-4 text-rose-400" />
                <span>Hive RPC Nodes ({allNodes.length})</span>
                {customNodes.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {customNodes.length} custom
                  </span>
                )}
              </h3>

              <div className="flex items-center gap-2">
                {customNodes.length > 0 && (
                  <button
                    onClick={handleResetNodes}
                    className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition px-2 py-1 rounded bg-slate-950/60 border border-slate-800 hover:border-rose-900/60 cursor-pointer"
                    title="Remove all custom nodes and restore defaults"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Defaults</span>
                  </button>
                )}
              </div>
            </div>

            {/* Add Custom RPC Form */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-blue-400" />
                  <span>Add Custom Hive RPC Node</span>
                </span>
                <span className="text-[11px] text-slate-500">Saved in browser cache</span>
              </div>

              <form onSubmit={handleAddCustomNode} className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1 min-w-0">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <Globe className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="url"
                    value={newRpcUrl}
                    onChange={(e) => {
                      setNewRpcUrl(e.target.value);
                      if (nodeAddError) setNodeAddError(null);
                    }}
                    placeholder="https://your-custom-rpc.example.com"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={addingNode || !newRpcUrl.trim()}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition flex-shrink-0 cursor-pointer disabled:cursor-not-allowed shadow-xs"
                >
                  {addingNode ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Testing Node...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Test & Add RPC</span>
                    </>
                  )}
                </button>
              </form>

              {nodeAddError && (
                <div className="text-[11px] text-rose-400 flex items-center gap-1.5 pt-1 animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{nodeAddError}</span>
                </div>
              )}

              {nodeAddSuccess && (
                <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 pt-1 animate-in fade-in">
                  <Check className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{nodeAddSuccess}</span>
                </div>
              )}
            </div>

            {/* Nodes List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {allNodes.map((node) => {
                const isActive = node === activeNodeUrl;
                const isCustom = customNodes.includes(node);
                const ping = nodePings[node];

                return (
                  <div 
                    key={node}
                    onClick={() => handleSelectNode(node)}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between group ${
                      isActive 
                        ? 'bg-rose-950/30 border-rose-500 text-white shadow-xs' 
                        : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-950/60'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-mono font-semibold truncate">
                          {node.replace(/^https?:\/\//, '')}
                        </p>
                        {isCustom && (
                          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex-shrink-0">
                            Custom
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {isActive ? 'Active Node (Saved)' : 'Click to activate'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {ping !== undefined && (
                        <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                          ping > 0 && ping < 250 ? 'text-emerald-400 bg-emerald-950/50 border border-emerald-900/40' :
                          ping >= 250 ? 'text-amber-400 bg-amber-950/50 border border-amber-900/40' :
                          'text-rose-400 bg-rose-950/50 border border-rose-900/40'
                        }`}>
                          {ping > 0 ? `${ping}ms` : 'offline'}
                        </span>
                      )}

                      {isActive && <Check className="w-4 h-4 text-rose-400 flex-shrink-0" />}

                      {isCustom && (
                        <button
                          type="button"
                          onClick={(e) => handleRemoveCustomNode(node, e)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition ml-0.5"
                          title="Remove custom RPC node"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Client-Side RPC Caching Engine */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-200">Client-Side Cache Engine</h3>
              </div>
              <div className="flex items-center gap-2">
                {cacheClearedMsg && (
                  <span className="text-[10px] text-emerald-400 font-semibold animate-pulse">Cache Cleared!</span>
                )}
                <button
                  onClick={handleClearCache}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-700/60 rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
                  title="Clear all stored feed & discussion caches"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Purge Cache</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Protects public Hive nodes from rate limits and enables instant tab switching. Feeds, communities, and profiles are cached locally, while the <strong className="text-emerald-400">"New" feed always bypasses cache to stream newly created posts live</strong>.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Cache Hits</p>
                <p className="text-base font-bold text-emerald-400 font-mono mt-0.5">{cacheStats.hits}</p>
                <p className="text-[9px] text-slate-500">Saved RPC roundtrips</p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Cache Misses</p>
                <p className="text-base font-bold text-blue-400 font-mono mt-0.5">{cacheStats.misses}</p>
                <p className="text-[9px] text-slate-500">Live network calls</p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Hit Ratio</p>
                <p className="text-base font-bold text-amber-400 font-mono mt-0.5">{cacheStats.hitRatio}%</p>
                <p className="text-[9px] text-slate-500">Efficiency</p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Cached Items</p>
                <p className="text-base font-bold text-slate-200 font-mono mt-0.5">{cacheStats.entries}</p>
                <p className="text-[9px] text-slate-500">Active entries</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Feeds (Hot/Trending): 3m
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-emerald-900/40 text-emerald-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                "New" Feed: Live (0s / Bypassed)
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                Discussions: 2m
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                Accounts: 5m
              </span>
            </div>
          </div>

          {/* Interactive Live Hive RPC Test Playground */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>Live Hive RPC Query Runner</span>
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">100% Client-Side JSON-RPC 2.0</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Test any Hive API call directly against the decentralized blockchain without any backend servers or credentials:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Method</label>
                <input
                  type="text"
                  value={rpcMethod}
                  onChange={(e) => setRpcMethod(e.target.value)}
                  placeholder="e.g. condenser_api.get_version"
                  className="w-full px-3 py-1.5 text-xs font-mono bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Params (JSON Array)</label>
                <input
                  type="text"
                  value={rpcParams}
                  onChange={(e) => setRpcParams(e.target.value)}
                  placeholder={'e.g. [] or [["hiveio"]]'}
                  className="w-full px-3 py-1.5 text-xs font-mono bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setRpcMethod('condenser_api.get_version');
                    setRpcParams('[]');
                  }}
                  className="text-[10px] text-slate-400 hover:text-white bg-slate-900 px-2 py-1 rounded border border-slate-800"
                >
                  Preset: get_version
                </button>
                <button
                  onClick={() => {
                    setRpcMethod('condenser_api.get_accounts');
                    setRpcParams('[["ecency"]]');
                  }}
                  className="text-[10px] text-slate-400 hover:text-white bg-slate-900 px-2 py-1 rounded border border-slate-800"
                >
                  Preset: get_accounts
                </button>
              </div>

              <button
                id="execute-rpc-btn"
                onClick={handleExecuteRpc}
                disabled={rpcLoading}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 disabled:opacity-50 transition"
              >
                <Play className={`w-3.5 h-3.5 ${rpcLoading ? 'animate-pulse' : ''}`} />
                <span>{rpcLoading ? 'Executing...' : 'Run RPC'}</span>
              </button>
            </div>

            {rpcError && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
                {rpcError}
              </div>
            )}

            {rpcResult && (
              <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300 max-h-56 overflow-y-auto">
                {rpcResult}
              </pre>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

function Coins(props: any) {
  return (
    <svg 
      {...props}
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="m16.71 13.88.7.71-2.82 2.82" />
    </svg>
  );
}
