import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_URL = process.env.HIVE_RPC_URL || 'https://api.hive.blog';
const TARGET_COUNT = Number(process.env.COMMUNITY_CATALOG_SIZE || 1000);
const PAGE_SIZE = 100;
const outputPath = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/communities-rank.json');

async function listCommunities(last, limit) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'bridge.list_communities',
      params: { sort: 'rank', limit, last, observer: '' },
      id: 1
    })
  });
  if (!response.ok) throw new Error(`Hive RPC returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message || 'Hive RPC request failed');
  return Array.isArray(payload.result) ? payload.result : [];
}

const communities = new Map();
let cursor = '';

while (communities.size < TARGET_COUNT) {
  const limit = Math.min(PAGE_SIZE, TARGET_COUNT - communities.size);
  const page = await listCommunities(cursor, limit);
  if (page.length === 0) break;

  for (const community of page) {
    if (community?.name) communities.set(community.name, community);
  }

  const nextCursor = page[page.length - 1]?.name;
  if (!nextCursor || nextCursor === cursor) break;
  cursor = nextCursor;
  console.log(`Fetched ${communities.size}/${TARGET_COUNT} communities`);
}

if (communities.size === 0) throw new Error('Hive returned no communities; catalog was not written.');

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify([...communities.values()], null, 2)}\n`);
console.log(`Saved ${communities.size} communities to ${outputPath}`);
