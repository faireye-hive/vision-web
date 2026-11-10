export const COMMUNITY_NAME = /^hive-\d+$/;

export function communityPath(name: string): string {
  return `/c/${encodeURIComponent(name.trim().toLowerCase())}`;
}

/** Only a single Hive community account is accepted in a public community URL. */
export function communityNameFromPath(pathname: string): string {
  const match = /^\/c\/([^/]+)\/?$/.exec(pathname);
  if (!match) return '';
  try {
    const name = decodeURIComponent(match[1]).toLowerCase();
    return COMMUNITY_NAME.test(name) ? name : '';
  } catch { return ''; }
}
