/** Preserve shared links from before Nebulosa Snaps had its own page. */
export function legacySnapsRedirect(pathname: string, search: string): string | null {
  if (pathname !== '/shorts') return null;
  const params = new URLSearchParams(search);
  const mode = params.get('mode');
  if (mode !== 'json' && mode !== 'rewards') return null;
  params.delete('mode');
  const query = params.toString();
  return `${mode === 'json' ? '/snaps' : '/shorts'}${query ? `?${query}` : ''}`;
}
