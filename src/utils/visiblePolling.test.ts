import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { pollWhileVisible } from './visiblePolling';

let state: string;
let events: EventTarget;
beforeEach(() => {
  vi.useFakeTimers(); state = 'visible'; events = new EventTarget();
  vi.stubGlobal('document', {
    get visibilityState() { return state; },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events)
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('pauses a hidden tab, resumes on return and stops completely on cleanup', async () => {
  const read = vi.fn().mockResolvedValue(undefined);
  const stop = pollWhileVisible(read, 1000);
  await vi.advanceTimersByTimeAsync(1000);
  expect(read).toHaveBeenCalledTimes(2);
  state = 'hidden'; events.dispatchEvent(new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(10_000);
  expect(read).toHaveBeenCalledTimes(2);
  state = 'visible'; events.dispatchEvent(new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(0);
  expect(read).toHaveBeenCalledTimes(3);
  stop(); await vi.advanceTimersByTimeAsync(10_000);
  expect(read).toHaveBeenCalledTimes(3);
  expect(vi.getTimerCount()).toBe(0);
});

it('never overlaps a slow request when the tab is hidden and shown again', async () => {
  let resolve!: () => void;
  const read = vi.fn(() => new Promise<void>(done => { resolve = done; }));
  const stop = pollWhileVisible(read, 1000);
  state = 'hidden'; events.dispatchEvent(new Event('visibilitychange'));
  state = 'visible'; events.dispatchEvent(new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(5000);
  expect(read).toHaveBeenCalledTimes(1);
  stop(); resolve(); await vi.advanceTimersByTimeAsync(5000);
  expect(read).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
