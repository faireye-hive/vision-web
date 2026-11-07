import React, { useState, useEffect, useRef } from 'react';
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
  Zap,
  Trash2,
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

  // Ref para controlar se o ping já está em andamento e evitar duplicidade
  const isPingingRef = useRef(false);

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

  // Testa os nós com controle para não encadear requisições
  const pingAllNodes = (nodesList: string[], force: boolean = false) => {
    if (isPingingRef.current && !force) return;
    isPingingRef.current = true;

    Promise.all(
      nodesList.map(async (node) => {
        const ms = await pingNode(node);
        return { node, ms };
      })
    ).then((results) => {
      const pingMap: Record<string, number> = {};
      results.forEach(({ node, ms }) => {
        pingMap[node] = ms;
      });
      setNodePings((prev) => ({ ...prev, ...pingMap }));
      isPingingRef.current = false;
    }).catch(() => {
      isPingingRef.current = false;
    });
  };

  // Atualiza apenas os dados da blockchain no timer (sem pingar os nós novamente)
  const fetchStatsOnly = () => {
    setLoading(true);
    getDynamicGlobalProperties()
      .then((data) => {
        setProps(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const handleManualRefresh = () => {
    fetchStatsOnly();
    const currentNodes = getAllHiveNodes();
    setAllNodes(currentNodes);
    setCustomNodes(getCustomHiveNodes());
    pingAllNodes(currentNodes, true);
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
      const pingMs = await pingNode(trimmed);
      if (pingMs < 0) {
        setNodeAddError('Could not reach RPC node or response timed out.');
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
      pingAllNodes(DEFAULT_HIVE_NODES, true);
    }
  };

  useEffect(() => {
    // 1. Busca inicial das métricas
    fetchStatsOnly();

    // 2. Executa o ping apenas UMA VEZ na abertura do modal
    const currentNodes = getAllHiveNodes();
    setAllNodes(currentNodes);
    setCustomNodes(getCustomHiveNodes());
    pingAllNodes(currentNodes);

    // 3. Atualiza apenas as métricas gerais a cada 60s (SEM re-pingar os nós)
    const interval = setInterval(fetchStatsOnly, 60000);
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
      className="fixed inset-0 z-[110] flex items-start justify-center overflow-hidden bg-slate-900/40 backdrop-blur-sm p-0 animate-in fade-in duration-200 sm:items-center sm:overflow-y-auto sm:overscroll-contain sm:p-4 md:p-6"
    >
      <div 
        className="relative my-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-4xl flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 sm:my-auto sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="hidden shrink-0 rounded-xl border border-slate-200 bg-slate-100 p-2 text-slate-600 sm:block">
              <Activity className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">Hive Blockchain Network</h2>
              <p className="truncate text-[11px] text-slate-500 sm:text-xs">Live network data and RPC tools</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={handleManualRefresh}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              title="Refresh Stats & Pings"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/70 p-3 space-y-5 sm:p-6 sm:space-y-6">
          
          {/* Key Metric Cards */}
          {props && (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
              <div className="group min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md sm:rounded-2xl sm:p-4">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Server className="w-3.5 h-3.5" /></span>
                  <span>Head Block</span>
                </div>
                <p className="mt-2 truncate text-base font-semibold tabular-nums tracking-tight text-slate-900 sm:mt-3 sm:text-lg">
                  #{props.head_block_number?.toLocaleString()}
                </p>
                <p className="mt-1 truncate text-xs text-slate-500">
                  Producer <span className="font-medium text-slate-700">@{props.current_witness}</span>
                </p>
              </div>

              <div className="group min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md sm:rounded-2xl sm:p-4">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Coins className="w-3.5 h-3.5" /></span>
                  <span>Virtual Supply</span>
                </div>
                <p className="mt-2 truncate text-base font-semibold tabular-nums tracking-tight text-slate-900 sm:mt-3 sm:text-lg">
                  {props.current_supply?.split(' ')[0]}
                </p>
                <p className="mt-1 text-xs text-slate-500">HIVE in circulation</p>
              </div>

              <div className="group min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md sm:rounded-2xl sm:p-4">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><DollarSign className="w-3.5 h-3.5" /></span>
                  <span>HBD Supply</span>
                </div>
                <p className="mt-2 truncate text-base font-semibold tabular-nums tracking-tight text-slate-900 sm:mt-3 sm:text-lg">
                  {props.current_hbd_supply?.split(' ')[0]}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Savings APR <span className="font-semibold text-slate-700">{props.hbd_interest_rate / 100}%</span>
                </p>
              </div>

              <div className="group min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md sm:rounded-2xl sm:p-4">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Cpu className="w-3.5 h-3.5" /></span>
                  <span>Block Time</span>
                </div>
                <p className="mt-2 truncate text-base font-semibold tabular-nums tracking-tight text-slate-900 sm:mt-3 sm:text-lg">
                  {props.time ? new Date(props.time + 'Z').toLocaleTimeString() : '3 sec'}
                </p>
                <p className="mt-1 text-xs text-slate-500">3s block interval · DPoS</p>
              </div>
            </div>
          )}

          {/* Public & Custom Hive RPC Nodes Manager */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Server className="w-4 h-4 text-slate-500" />
                <span>Hive RPC Nodes ({allNodes.length})</span>
                {customNodes.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    {customNodes.length} custom
                  </span>
                )}
              </h3>

              <div className="flex items-center gap-2">
                {customNodes.length > 0 && (
                  <button
                    onClick={handleResetNodes}
                    className="text-[11px] text-slate-600 hover:text-rose-700 flex items-center gap-1 transition px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-rose-200 hover:bg-rose-50 cursor-pointer"
                    title="Remove all custom nodes and restore defaults"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Defaults</span>
                  </button>
                )}
              </div>
            </div>

            {/* Add Custom RPC Form */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-slate-500" />
                  <span>Add Custom Hive RPC Node</span>
                </span>
                <span className="text-[11px] text-slate-500">Saved in this browser</span>
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
                    className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 transition font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={addingNode || !newRpcUrl.trim()}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition flex-shrink-0 cursor-pointer disabled:cursor-not-allowed shadow-sm"
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
                <div className="text-[11px] text-rose-700 flex items-center gap-1.5 pt-1 animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{nodeAddError}</span>
                </div>
              )}

              {nodeAddSuccess && (
                <div className="text-[11px] text-emerald-700 flex items-center gap-1.5 pt-1 animate-in fade-in">
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
                        ? 'bg-slate-100 border-slate-300 text-slate-900 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-mono font-semibold truncate">
                          {node.replace(/^https?:\/\//, '')}
                        </p>
                        {isCustom && (
                          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold bg-slate-100 text-slate-600 border border-slate-200 flex-shrink-0">
                            Custom
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {isActive ? 'Active Node (Saved)' : 'Click to activate'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {ping !== undefined ? (
                        <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                          ping > 0 && ping < 250 ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' :
                          ping >= 250 ? 'text-amber-700 bg-amber-50 border border-amber-200' :
                          'text-rose-700 bg-rose-50 border border-rose-200'
                        }`}>
                          {ping > 0 ? `${ping}ms` : 'offline'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-mono animate-pulse">pinging...</span>
                      )}

                      {isActive && <Check className="w-4 h-4 text-slate-700 flex-shrink-0" />}

                      {isCustom && (
                        <button
                          type="button"
                          onClick={(e) => handleRemoveCustomNode(node, e)}
                          className="p-1 rounded text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition ml-0.5"
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
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-bold text-slate-900">Client-Side Cache Engine</h3>
              </div>
              <div className="flex items-center gap-2">
                {cacheClearedMsg && (
                  <span className="text-[10px] text-emerald-700 font-semibold animate-pulse">Cache cleared</span>
                )}
                <button
                  onClick={handleClearCache}
                  className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
                  title="Clear all stored feed & discussion caches"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Purge Cache</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Protects public Hive nodes from rate limits and enables instant tab switching. Feeds, communities, and profiles are cached locally, while the <strong className="text-slate-800">"New" feed always bypasses cache to stream newly created posts live</strong>.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Cache Hits</p>
                <p className="text-base font-semibold text-slate-900 font-mono mt-0.5">{cacheStats.hits}</p>
                <p className="text-[9px] text-slate-500">Saved RPC roundtrips</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Cache Misses</p>
                <p className="text-base font-semibold text-slate-900 font-mono mt-0.5">{cacheStats.misses}</p>
                <p className="text-[9px] text-slate-500">Live network calls</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Hit Ratio</p>
                <p className="text-base font-semibold text-slate-900 font-mono mt-0.5">{cacheStats.hitRatio}%</p>
                <p className="text-[9px] text-slate-500">Efficiency</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Cached Items</p>
                <p className="text-base font-semibold text-slate-900 font-mono mt-0.5">{cacheStats.entries}</p>
                <p className="text-[9px] text-slate-500">Active entries</p>
              </div>
            </div>
          </div>

          {/* Interactive Live Hive RPC Test Playground */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-slate-500" />
                <span>Live Hive RPC Query Runner</span>
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">100% Client-Side JSON-RPC 2.0</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Test any Hive API call directly against the decentralized blockchain without any backend servers or credentials:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-mono text-slate-500 mb-1">Method</label>
                <input
                  type="text"
                  value={rpcMethod}
                  onChange={(e) => setRpcMethod(e.target.value)}
                  placeholder="e.g. condenser_api.get_version"
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-500 mb-1">Params (JSON Array)</label>
                <input
                  type="text"
                  value={rpcParams}
                  onChange={(e) => setRpcParams(e.target.value)}
                  placeholder={'e.g. [] or [["hiveio"]]'}
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
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
                  className="text-[10px] text-slate-600 hover:text-slate-900 bg-white px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                >
                  Preset: get_version
                </button>
                <button
                  onClick={() => {
                    setRpcMethod('condenser_api.get_accounts');
                    setRpcParams('[["ecency"]]');
                  }}
                  className="text-[10px] text-slate-600 hover:text-slate-900 bg-white px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                >
                  Preset: get_accounts
                </button>
              </div>

              <button
                id="execute-rpc-btn"
                onClick={handleExecuteRpc}
                disabled={rpcLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50 transition cursor-pointer"
              >
                <Play className={`w-3.5 h-3.5 ${rpcLoading ? 'animate-pulse' : ''}`} />
                <span>{rpcLoading ? 'Executing...' : 'Run RPC'}</span>
              </button>
            </div>

            {rpcError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
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
