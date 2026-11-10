/** Detect URL userinfo using the browser's URL rules, including encoded names,
 * protocol-relative URLs and backslashes. An @ in a path/query is harmless. */
export function hasUrlCredentials(value: string): boolean {
  try {
    const url = new URL(value, 'https://nebulosa.invalid/');
    return Boolean(url.username || url.password);
  } catch {
    return false; // Malformed URLs are rejected by the caller's URL policy.
  }
}
