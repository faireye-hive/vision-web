import React, { useState, useEffect } from 'react';
import { Play, Loader2, ExternalLink, AlertCircle, RefreshCw } from 'lucide-react';
import { parseVideoUrl, VideoInfo, VideoPlatform } from '../utils/videoEmbeds';
import { ThreeSpeakPlayer } from './ThreeSpeakPlayer';

interface LazyVideoPlayerProps {
  url?: string;
  info?: VideoInfo;
  className?: string;
}

export const LazyVideoPlayer: React.FC<LazyVideoPlayerProps> = ({
  url,
  info: initialInfo,
  className = ''
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading3SpeakData, setLoading3SpeakData] = useState(false);
  const [threeSpeakError, setThreeSpeakError] = useState<string | null>(null);
  const [threeSpeakMetadata, setThreeSpeakMetadata] = useState<{
    title?: string;
    thumbnail?: string;
    duration?: number;
    videoUrl?: string;
    videoUrlFallback1?: string;
    videoUrlFallback2?: string;
    videoUrlFallback3?: string;
  } | null>(null);

  const videoInfo: VideoInfo | null = initialInfo || (url ? parseVideoUrl(url) : null);

  // Optional background pre-fetch for thumbnail and title when idle
  useEffect(() => {
    if (!videoInfo || videoInfo.platform !== '3speak' || isPlaying) return;

    let active = true;
    const fetch3SpeakData = async () => {
      try {
        const res = await fetch(`https://play.3speak.tv/api/embed?v=${encodeURIComponent(videoInfo.id)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (active && data && data.success) {
          setThreeSpeakMetadata({
            title: data.title,
            thumbnail: data.thumbnail,
            duration: data.duration,
            videoUrl: data.videoUrl,
            videoUrlFallback1: data.videoUrlFallback1,
            videoUrlFallback2: data.videoUrlFallback2,
            videoUrlFallback3: data.videoUrlFallback3,
          });
        }
      } catch {
        // Handled on click
      }
    };

    fetch3SpeakData();
    return () => {
      active = false;
    };
  }, [videoInfo, isPlaying]);

  if (!videoInfo) return null;

  const platformNames: Record<VideoPlatform, string> = {
    youtube: 'YouTube',
    '3speak': '3Speak (IPFS)',
    bitchute: 'BitChute'
  };

  const platformBadgeColors: Record<VideoPlatform, string> = {
    youtube: 'bg-red-600 text-white',
    '3speak': 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white',
    bitchute: 'bg-gradient-to-r from-orange-600 to-red-600 text-white'
  };

  const handleStartPlay = async () => {
    setIsPlaying(true);
    setThreeSpeakError(null);

    // If 3Speak and stream URL not available yet, fetch immediately on click
    if (videoInfo.platform === '3speak' && !threeSpeakMetadata?.videoUrl) {
      setLoading3SpeakData(true);
      try {
        const res = await fetch(`https://play.3speak.tv/api/embed?v=${encodeURIComponent(videoInfo.id)}`);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();
        if (data && data.success && data.videoUrl) {
          setThreeSpeakMetadata({
            title: data.title,
            thumbnail: data.thumbnail,
            duration: data.duration,
            videoUrl: data.videoUrl,
            videoUrlFallback1: data.videoUrlFallback1,
            videoUrlFallback2: data.videoUrlFallback2,
            videoUrlFallback3: data.videoUrlFallback3,
          });
        } else {
          throw new Error('No valid video URL returned from 3Speak API');
        }
      } catch (err: any) {
        console.error('Failed to load 3Speak video data:', err);
        setThreeSpeakError('Could not retrieve 3Speak IPFS video stream.');
      } finally {
        setLoading3SpeakData(false);
      }
    }
  };

  const threeSpeakSources = threeSpeakMetadata?.videoUrl
    ? ([
        ...new Set([
          threeSpeakMetadata.videoUrl,
          threeSpeakMetadata.videoUrlFallback1,
          threeSpeakMetadata.videoUrlFallback2,
          threeSpeakMetadata.videoUrlFallback3,
        ].filter(Boolean))
      ] as string[])
    : [];

  const activeThumbnail =
    threeSpeakMetadata?.thumbnail || videoInfo.thumbnailUrl;

  return (
    <div className={`my-4 mx-auto max-w-3xl ${className}`}>
      <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-200/80 dark:border-slate-800 shadow-lg">
        {isPlaying ? (
          videoInfo.platform === '3speak' ? (
            loading3SpeakData ? (
              <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center gap-3 p-4 text-center">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                <span className="text-xs text-white/90 font-medium">Connecting to 3Speak IPFS stream...</span>
              </div>
            ) : threeSpeakError ? (
              <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <AlertCircle className="w-8 h-8 text-rose-500" />
                <p className="text-sm text-slate-300 font-medium">{threeSpeakError}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleStartPlay}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                  <a
                    href={videoInfo.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white/90 text-xs font-semibold transition cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open on 3Speak</span>
                  </a>
                </div>
              </div>
            ) : threeSpeakSources.length > 0 ? (
              <ThreeSpeakPlayer
                sources={threeSpeakSources}
                poster={activeThumbnail}
                title={threeSpeakMetadata?.title}
                originalUrl={videoInfo.originalUrl}
              />
            ) : (
              <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center gap-3 p-4 text-center">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                <span className="text-xs text-white/90 font-medium">Loading stream sources...</span>
              </div>
            )
          ) : (
            <iframe
              src={videoInfo.embedUrl}
              title={`${platformNames[videoInfo.platform]} video player`}
              className="w-full h-full border-0 rounded-2xl"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
            />
          )
        ) : (
          <div
            onClick={handleStartPlay}
            className="group relative w-full h-full cursor-pointer select-none"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleStartPlay();
              }
            }}
            aria-label={`Play ${platformNames[videoInfo.platform]} video`}
          >
            {activeThumbnail ? (
              <img
                src={activeThumbnail}
                alt={threeSpeakMetadata?.title || `${platformNames[videoInfo.platform]} Video`}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center">
                <span className="text-slate-600 text-xs font-bold tracking-widest uppercase">
                  {platformNames[videoInfo.platform]}
                </span>
              </div>
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/40 group-hover:bg-black/45 transition-colors" />

            {/* Platform Badge */}
            <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-md tracking-wide">
              <span className={`px-2.5 py-0.5 rounded-full ${platformBadgeColors[videoInfo.platform]}`}>
                {platformNames[videoInfo.platform]}
              </span>
              {threeSpeakMetadata?.title && (
                <span className="text-white/90 text-xs font-medium truncate max-w-[200px] sm:max-w-xs drop-shadow-sm hidden sm:inline">
                  {threeSpeakMetadata.title}
                </span>
              )}
            </div>

            {/* External link button */}
            <a
              href={videoInfo.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="absolute top-3.5 right-3.5 p-2 rounded-full bg-black/50 hover:bg-black/75 text-white/80 hover:text-white backdrop-blur-sm transition cursor-pointer"
              title="Open video in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* Centered Play Button */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-white flex items-center justify-center shadow-2xl group-hover:scale-110 group-active:scale-95 transition-all duration-200 border border-white/20">
                <Play className="w-7 h-7 sm:w-9 sm:h-9 ml-1 text-red-600 dark:text-red-500 fill-current" />
              </div>
              <span className="text-xs font-semibold text-white/95 drop-shadow-md tracking-wide px-3.5 py-1 rounded-full bg-black/50 backdrop-blur-sm">
                Click to play
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
