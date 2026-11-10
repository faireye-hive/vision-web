/** The deadline covers both receiving headers and reading the JSON body. */
export async function fetchJsonWithTimeout<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 10000
): Promise<T> {
  const controller = new AbortController();
  const signal = init.signal;
  const cancel = () => controller.abort(signal?.reason);
  const timeoutError = new DOMException('The request timed out. Please try again.', 'TimeoutError');
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(timeoutError);
  }, timeoutMs);

  signal?.addEventListener('abort', cancel, { once: true });
  try {
    if (signal?.aborted) cancel();
    controller.signal.throwIfAborted();
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`Request failed: HTTP ${response.status}`);
    return await response.json() as T;
  } catch (error) {
    if (timedOut) throw timeoutError;
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
