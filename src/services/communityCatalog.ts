import type { HiveCommunity } from './hiveApi';
import { CACHE_TTL, fetchWithCache } from './apiCache';

/** Share the local catalog across mounts and sort changes, including StrictMode. */
export function loadCommunityCatalog(): Promise<HiveCommunity[]> {
  return fetchWithCache('community_catalog_snapshot', async () => {
    const response = await fetch(`${import.meta.env.BASE_URL}data/communities-rank.json`);
    if (!response.ok) throw new Error('Cached community catalog is unavailable.');
    const rows: unknown = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('Cached community catalog is empty.');
    return rows as HiveCommunity[];
  }, { ttl: CACHE_TTL.COMMUNITY });
}
