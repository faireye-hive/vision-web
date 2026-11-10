import { getProfileRelations } from './profileRelations';

export interface BlacklistSources { own: boolean; lists: string[] }
export async function loadBlacklistSources(username: string): Promise<{ accounts: Record<string, BlacklistSources>; incomplete: boolean }> {
  const [own, followed] = await Promise.all([
    getProfileRelations(username, 'blacklisted'), getProfileRelations(username, 'follow_blacklist')
  ]);
  const accounts: Record<string, BlacklistSources> = Object.create(null);
  const add = (name: string, source?: string) => {
    const clean = name.trim().replace(/^@/, '').toLowerCase();
    if (!clean) return;
    const entry = accounts[clean] ||= { own: false, lists: [] };
    if (source) { if (!entry.lists.includes(source)) entry.lists.push(source); }
    else entry.own = true;
  };
  own.rows.forEach(row => add(row.name));
  let incomplete = false;
  // Bound concurrent public RPC calls for accounts following many lists.
  for (let offset = 0; offset < followed.rows.length; offset += 4) {
    const batch = followed.rows.slice(offset, offset + 4);
    const results = await Promise.allSettled(batch.map(row => getProfileRelations(row.name, 'blacklisted')));
    results.forEach((result, index) => {
      if (result.status === 'rejected') { incomplete = true; return; }
      result.value.rows.forEach(row => add(row.name, batch[index].name));
    });
  }
  return { accounts, incomplete };
}
