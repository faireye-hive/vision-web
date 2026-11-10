import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useBlacklistFlair } from '../context/BlacklistFlairContext';

export function BlacklistFlair({ username }: { username: string }) {
  const { getSources } = useBlacklistFlair();
  const sources = getSources(username);
  if (!sources) return null;
  const description = [sources.own ? 'In your blacklist' : '', sources.lists.length ? `Listed by ${sources.lists.map(name => `@${name}`).join(', ')}` : ''].filter(Boolean).join(' · ');
  return <span title={description} aria-label={description} className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300/70 bg-amber-50 px-1.5 py-0.5 align-middle text-[9px] font-semibold leading-none text-amber-800 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300"><ShieldAlert aria-hidden="true" className="h-3 w-3" />Blacklist</span>;
}
