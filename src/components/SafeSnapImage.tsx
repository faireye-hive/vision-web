import React, { useState, useEffect, useRef, useMemo } from 'react';
import { resolveProtectedImageUrl } from '../utils/imageLoaderQueue';
import { Image as ImageIcon, AlertCircle, RefreshCw } from 'lucide-react';

export interface SafeSnapImageProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  onClick?: () => void;
  onStatus?: (status: 'loaded' | 'error') => void;
  showOverlayIcon?: boolean;
  /** Fixed aspect ratio for skeleton placeholder (e.g. "16/9", "4/3", "1/1"). Prevents layout shift. */
  aspectRatio?: string;
}

export const SafeSnapImage: React.FC<SafeSnapImageProps> = React.memo(({
  src,
  alt,
  className = '',
  imgClassName = '',
  onClick,
  onStatus,
  showOverlayIcon = false,
  aspectRatio
}) => {
  const [inViewport, setInViewport] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [status, setStatus] = useState<'idle' | 'loaded' | 'error'>('idle');
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Whitelist + wsrv proxy. Never falls back to the original host.
  const protectedSrc = useMemo(() => resolveProtectedImageUrl(src), [src]);

  useEffect(() => {
    if (!protectedSrc) {
      setStatus('error');
      onStatus?.('error');
      return;
    }
    setStatus('idle');
    // onStatus is read once per src. Listing it would reset a loaded image on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protectedSrc, retryCount]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px 0px', threshold: 0.01 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    // 1x1 beacons that survived the proxy are not shown.
    if ((img.naturalWidth || 0) <= 1 || (img.naturalHeight || 0) <= 1) {
      setStatus('error');
      onStatus?.('error');
      return;
    }
    setStatus('loaded');
    onStatus?.('loaded');
  };

  const handleRetry = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!protectedSrc) return;
    setRetryCount((count) => count + 1);
  };

  const skeletonStyle: React.CSSProperties | undefined =
    status !== 'loaded' && aspectRatio ? { aspectRatio, width: '100%' } : undefined;

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      className={`relative overflow-hidden bg-gray-100 dark:bg-slate-800/80 transition ${className}`}
      style={skeletonStyle}
    >
      {status !== 'loaded' && status !== 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-slate-700/30 to-transparent animate-shimmer" />
          <ImageIcon className="w-6 h-6 opacity-40 mb-1 relative z-10" />
          {showOverlayIcon && (
            <span className="text-[10px] font-medium opacity-60 relative z-10">Loading image...</span>
          )}
        </div>
      )}

      {inViewport && protectedSrc && status !== 'error' && (
        <img
          key={`${protectedSrc}:${retryCount}`}
          src={protectedSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={`w-full h-full object-cover transition-opacity duration-300 ${imgClassName}`}
          onLoad={handleLoad}
          onError={() => {
            setStatus('error');
            onStatus?.('error');
          }}
        />
      )}

      {status === 'error' && (
        <div className="w-full h-full min-h-[140px] flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-slate-800/60 border border-dashed border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 text-center select-none">
          <AlertCircle className="w-5 h-5 text-gray-400 dark:text-slate-500 mb-1" />
          <p className="text-[11px] font-medium text-gray-600 dark:text-slate-300">
            Image unavailable
          </p>
          {protectedSrc && (
            <button
              type="button"
              onClick={handleRetry}
              className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
});

SafeSnapImage.displayName = 'SafeSnapImage';
