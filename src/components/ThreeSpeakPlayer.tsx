import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Hls from 'hls.js';
import { Loader2, AlertCircle, RefreshCw, Play, Volume2, VolumeX, Maximize, Server, ExternalLink } from 'lucide-react';

interface ThreeSpeakPlayerProps {
  sources: string[]; // [videoUrl, fallback1, fallback2, fallback3]
  poster?: string;
  title?: string;
  originalUrl?: string;
  autoPlay?: boolean;
}

/**
 * Expand 3Speak video manifest URLs with direct IPFS gateway fallbacks
 */
function buildExpandedSources(rawSources: string[]): string[] {
  const list: string[] = [];
  const add = (url?: string) => {
    if (!url || typeof url !== 'string') return;
    const clean = url.trim();
    if (clean && !list.includes(clean)) list.push(clean);
  };

  for (const src of rawSources) {
    add(src);

    // Decode URL if it has query parameter u=
    try {
      if (src.includes('u=')) {
        const match = src.match(/[?&]u=([^&]+)/);
        if (match && match[1]) {
          const decoded = decodeURIComponent(match[1]);
          add(decoded);
        }
      }
    } catch {}

    // Extract IPFS hash (CID)
    const cidMatch = src.match(/(?:ipfs\/|%2Fipfs%2F)([a-zA-Z0-9]{40,})/i);
    if (cidMatch && cidMatch[1]) {
      const cid = cidMatch[1];
      // BunnyCDN high-speed cache
      add(`https://ipfs-3speak.b-cdn.net/ipfs/${cid}/manifest.m3u8`);
      add(`https://ipfs-3speak.b-cdn.net/ipfs/${cid}/480p/index.m3u8`);
      // Public gateways
      add(`https://ipfs.io/ipfs/${cid}/manifest.m3u8`);
      add(`https://cloudflare-ipfs.com/ipfs/${cid}/manifest.m3u8`);
    }
  }

  return list.filter(Boolean);
}

export const ThreeSpeakPlayer: React.FC<ThreeSpeakPlayerProps> = ({
  sources: rawSources,
  poster,
  title,
  originalUrl,
  autoPlay = true
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryCountRef = useRef<number>(0);

  const enhancedSources = useMemo(() => {
    return buildExpandedSources(rawSources);
  }, [rawSources]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);

  const currentSource = enhancedSources[currentIdx] || '';

  const loadNextFallback = useCallback(() => {
    retryCountRef.current = 0;
    if (currentIdx + 1 < enhancedSources.length) {
      console.warn(`[3Speak] Source #${currentIdx} failed, switching to gateway #${currentIdx + 1}`);
      setCurrentIdx((prev) => prev + 1);
      setIsBuffering(true);
    } else {
      console.error('[3Speak] All IPFS gateways and fallback sources failed');
      setFailed(true);
      setIsBuffering(false);
    }
  }, [currentIdx, enhancedSources.length]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentSource) {
      if (enhancedSources.length === 0) setFailed(true);
      return;
    }

    setIsBuffering(true);
    retryCountRef.current = 0;

    // Destroy any existing Hls instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // 1. Prefer Hls.js first on all browsers that support MediaSource (Chrome, Firefox, Edge, Android, Safari Desktop)
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        fragLoadingTimeOut: 15000,
        manifestLoadingTimeOut: 15000,
        fragLoadingMaxRetry: 3,
        manifestLoadingMaxRetry: 3
      });
      hlsRef.current = hls;

      hls.loadSource(currentSource);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsBuffering(false);
        if (autoPlay) {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                setHasStartedPlaying(true);
                setIsPaused(false);
              })
              .catch(() => {
                // Autoplay blocked by browser policy; user can tap center play
                setIsPaused(true);
                setIsBuffering(false);
              });
          }
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (retryCountRef.current < 2) {
                retryCountRef.current++;
                console.warn(`[3Speak HLS] Network retry #${retryCountRef.current} on gateway #${currentIdx}...`);
                hls.startLoad();
              } else {
                hls.destroy();
                hlsRef.current = null;
                loadNextFallback();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('[3Speak HLS] Media error, attempting recovery...');
              hls.recoverMediaError();
              break;
            default:
              console.warn('[3Speak HLS] Fatal error, moving to next gateway...');
              hls.destroy();
              hlsRef.current = null;
              loadNextFallback();
              break;
          }
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    // 2. Fallback to native HLS for iOS Safari
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = currentSource;
      const handleError = () => loadNextFallback();
      video.addEventListener('error', handleError, { once: true });

      if (autoPlay) {
        const p = video.play();
        if (p !== undefined) {
          p.then(() => {
            setHasStartedPlaying(true);
            setIsPaused(false);
            setIsBuffering(false);
          }).catch(() => {
            setIsPaused(true);
            setIsBuffering(false);
          });
        }
      }

      return () => {
        video.removeEventListener('error', handleError);
      };
    }

    // Neither Hls nor native HLS supported
    setFailed(true);
  }, [currentSource, currentIdx, enhancedSources.length, autoPlay, loadNextFallback]);

  const handleRetryAll = () => {
    setFailed(false);
    setCurrentIdx(0);
    setIsBuffering(true);
    setHasStartedPlaying(false);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => {
        setIsPaused(false);
        setHasStartedPlaying(true);
      }).catch(() => {});
    } else {
      video.pause();
      setIsPaused(true);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (video.requestFullscreen) {
      video.requestFullscreen().catch(() => {});
    }
  };

  if (failed) {
    return (
      <div className="w-full h-full min-h-[280px] bg-slate-950 flex flex-col items-center justify-center p-6 text-center gap-3 rounded-2xl border border-slate-800">
        <AlertCircle className="w-10 h-10 text-rose-500 animate-pulse" />
        <h4 className="text-sm font-semibold text-white">
          Unable to stream 3Speak IPFS video
        </h4>
        <p className="text-xs text-slate-400 max-w-md">
          The decentralized IPFS nodes were unreachable or buffering timed out. You can retry with alternative gateways or view on 3Speak.
        </p>
        <div className="flex items-center gap-2 mt-2 flex-wrap justify-center">
          <button
            type="button"
            onClick={handleRetryAll}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-md cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry from start</span>
          </button>
          {originalUrl && (
            <a
              href={originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open on 3Speak</span>
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative group w-full h-full bg-black rounded-2xl overflow-hidden select-none">
      <video
        ref={videoRef}
        controls
        playsInline
        poster={poster}
        title={title}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPaused(false);
          setHasStartedPlaying(true);
        }}
        onPause={() => setIsPaused(true)}
        onCanPlay={() => setIsBuffering(false)}
        className="w-full h-full bg-black object-contain cursor-pointer"
        onClick={togglePlay}
      />

      {/* Buffering overlay */}
      {isBuffering && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/40 backdrop-blur-xs transition-opacity z-20">
          <div className="p-3.5 rounded-2xl bg-black/75 shadow-2xl flex items-center gap-2.5 text-white text-xs font-semibold border border-purple-500/30">
            <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
            <span>Buffering IPFS stream ({currentIdx + 1}/{enhancedSources.length})...</span>
          </div>
        </div>
      )}

      {/* Center play icon when paused and not buffering */}
      {isPaused && !isBuffering && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer z-10 transition-opacity"
        >
          <div className="w-16 h-16 rounded-full bg-purple-600/90 hover:bg-purple-600 text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition cursor-pointer border border-white/20">
            <Play className="w-7 h-7 ml-1 fill-current" />
          </div>
        </div>
      )}

      {/* Top bar with gateway info */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-[11px] font-semibold text-white/90 shadow-md">
          <Server className="w-3 h-3 text-purple-400" />
          <span>IPFS Node #{currentIdx + 1}</span>
          {enhancedSources.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                loadNextFallback();
              }}
              className="ml-1.5 px-2 py-0.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold pointer-events-auto transition cursor-pointer"
              title="Switch to next IPFS gateway"
            >
              Switch Node
            </button>
          )}
        </div>

        {title && (
          <span className="text-xs font-medium text-white/90 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full truncate max-w-[200px] sm:max-w-xs shadow-md">
            {title}
          </span>
        )}
      </div>
    </div>
  );
};