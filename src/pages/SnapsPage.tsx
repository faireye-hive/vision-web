import React from 'react';
import { JsonShortsFeed } from '../components/JsonShortsFeed';
import { useContentFilter } from '../context/ContentFilterContext';

export function SnapsPage() {
  const { config } = useContentFilter();
  return <div className="mx-auto w-full max-w-[1280px] px-0 py-2 sm:px-3 sm:py-5">
    <JsonShortsFeed blockedWords={config.words} blockedAuthors={config.authors} filterEnabled={config.enabled} />
  </div>;
}
