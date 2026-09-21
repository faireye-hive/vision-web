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
  Layers 
} from 'lucide-react';
import { 
  HiveGlobalProps, 
  getDynamicGlobalProperties, 
  PUBLIC_HIVE_NODES, 
  getActiveNode, 
  setActiveNode, 
  pingNode, 
  hiveRpcCall 
} from '../services/hiveApi';

interface BlockchainStatsModalProps {
  onClose: () => void;
}

export const BlockchainStatsModal: React.FC<BlockchainStatsModalProps> = ({ onClose }) => {
  const [props, setProps] = useState<HiveGlobalProps | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeNodeUrl, setActiveNodeUrl] = useState(getActiveNode());
  const [nodePings, setNodePings] = useState<Record<string, number>>({});

  // Interactive Live RPC playground
  const [rpcMethod, setRpcMethod] = useState('condenser_api.get_dynamic_global_properties');
  const [rpcParams, setRpcParams] = useState('[]');
  const [rpcResult, setRpcResult] = useState<string>('');
  const [rpcLoading, setRpcLoading] = useState(false);
  const [rpcError, setRpcError] = useState<string | null>(null);

  const fetchStats = () => {
    setLoading(true);
    getDynamicGlobalProperties()
      .then((data) => {
        setProps(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Ping all nodes
    PUBLIC_HIVE_NODES.forEach((node) => {
      pingNode(node).then((ms) => {
        setNodePings((prev) => ({ ...prev, [node]: ms }));
      });
    });
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

          {/* Public Hive Nodes Health & Ping */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Server className="w-4 h-4 text-rose-400" />
              <span>Public RPC Nodes Status</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {PUBLIC_HIVE_NODES.map((node) => {
                const isActive = node === activeNodeUrl;
                const ping = nodePings[node];

                return (
                  <div 
                    key={node}
                    onClick={() => {
                      setActiveNode(node);
                      setActiveNodeUrl(node);
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      isActive 
                        ? 'bg-rose-950/30 border-rose-500 text-white' 
                        : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <p className="text-xs font-mono font-semibold truncate">{node.replace('https://', '')}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{isActive ? 'Current Node' : 'Click to activate'}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {ping !== undefined && (
                        <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                          ping > 0 && ping < 200 ? 'text-emerald-400 bg-emerald-950/50' :
                          ping >= 200 ? 'text-amber-400 bg-amber-950/50' : 'text-rose-400 bg-rose-950/50'
                        }`}>
                          {ping > 0 ? `${ping}ms` : 'offline'}
                        </span>
                      )}
                      {isActive && <Check className="w-4 h-4 text-rose-400" />}
                    </div>
                  </div>
                );
              })}
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
