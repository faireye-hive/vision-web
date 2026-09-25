import React, { useState, useEffect, useRef } from 'react';
import { enqueueImageVerification, isPlausibleImageUrl } from '../utils/imageLoaderQueue';
import { Image as ImageIcon, AlertCircle, RefreshCw } from 'lucide-react';

export interface SafeSnapImageProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  onClick?: () => void;
  showOverlayIcon?: boolean;
}

export const SafeSnapImage: React.FC<SafeSnapImageProps> = ({
  src,
  alt,
  className = '',
  imgClassName = '',
  onClick,
  showOverlayIcon = false
}) => {
  const [inViewport, setInViewport] = useState<boolean>(false);
  const [status, setStatus] = useState<'idle' | 'queued' | 'loaded' | 'error'>('idle');
  const [verifiedSrc, setVerifiedSrc] = useState<string>('');
  const [errorReason, setErrorReason] = useState<string>('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 1. Observe intersection so we DO NOT load all images at once
  useEffect(() => {
    if (!containerRef.current) return;

    // If browser lacks IntersectionObserver, fallback to loading immediately
    if (typeof IntersectionObserver === 'undefined') {
      setInViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInViewport(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '200px 0px', // Preload slightly before entering viewport for smooth UX
        threshold: 0.01
      }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  // 2. Once in viewport, enqueue for controlled, rate-limited verification
  const loadVerifiedImage = () => {
    if (!src || !isPlausibleImageUrl(src)) {
      setStatus('error');
      setErrorReason('Invalid or unsafe image link');
      return;
    }

    setStatus('queued');
    enqueueImageVerification(src)
      .then((result) => {
        if (result.valid && result.resolvedUrl) {
          setVerifiedSrc(result.resolvedUrl);
          setStatus('loaded');
        } else {
          setStatus('error');
          setErrorReason(result.error || 'Failed to verify genuine image');
        }
      })
      .catch(() => {
        setStatus('error');
        setErrorReason('Image server connection failed');
      });
  };

  useEffect(() => {
    if (inViewport && status === 'idle') {
      loadVerifiedImage();
    }
  }, [inViewport, src]);

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    loadVerifiedImage();
  };

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      className={`relative overflow-hidden bg-gray-100 dark:bg-slate-800/80 transition ${className}`}
    >
      {/* State 1: Idle or In-queue skeleton shimmer */}
      {(status === 'idle' || status === 'queued') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 animate-pulse bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500">
          <ImageIcon className="w-6 h-6 opacity-40 mb-1" />
          <span className="text-[10px] font-medium opacity-60">
            {status === 'queued' ? 'Loading image...' : ''}
          </span>
        </div>
      )}

      {/* State 2: Verified Genuine Image loaded */}
      {status === 'loaded' && verifiedSrc && (
        <img
          src={verifiedSrc}
          alt={alt}
          loading="lazy"
          className={`w-full h-full object-cover transition-opacity duration-300 ${imgClassName}`}
          onError={() => {
            setStatus('error');
            setErrorReason('Display rendering error');
          }}
        />
      )}

      {/* State 3: Corrupt, deceptive or failed image fallback */}
      {status === 'error' && (
        <div className="w-full h-full min-h-[140px] flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-slate-800/60 border border-dashed border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 text-center select-none">
          <AlertCircle className="w-5 h-5 text-gray-400 dark:text-slate-500 mb-1" />
          <p className="text-[11px] font-medium text-gray-600 dark:text-slate-300">
            Image unavailable
          </p>
          <span className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 line-clamp-1 max-w-[200px]">
            {errorReason || 'Could not verify media asset'}
          </span>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}
    </div>
  );
};
