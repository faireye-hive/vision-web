/** Poll only a visible tab, sharing the current run when visibility changes. */
export function pollWhileVisible(callback: () => Promise<unknown>, intervalMs: number): () => void {
  let stopped = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const isVisible = () => document.visibilityState !== 'hidden';

  const run = async () => {
    if (stopped || running || !isVisible()) return;
    running = true;
    try {
      await callback();
    } catch {
      // A failed poll can be retried on the next interval.
    } finally {
      running = false;
      if (!stopped && isVisible()) timer = setTimeout(run, intervalMs);
    }
  };
  const onVisibility = () => {
    clearTimeout(timer);
    void run();
  };
  document.addEventListener('visibilitychange', onVisibility);
  void run();
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
