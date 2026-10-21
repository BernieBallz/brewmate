/** Structurally compatible with zustand's `StateStorage`. */
export interface CoalescedStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  /** Write any pending value immediately. */
  flush: () => void;
}

/**
 * Wraps a Storage so that rapid `setItem` calls for the same key are collapsed into a
 * single write at most every `delayMs` (trailing edge). Reads see pending values, so
 * behaviour is otherwise identical to the underlying storage.
 *
 * The pending value is flushed when the page is hidden or being unloaded
 * (`visibilitychange` → hidden, `pagehide`), which are the last reliable hooks on mobile.
 * Timer correctness never depends on this: elapsed time is recomputed from the persisted
 * wall-clock start on rehydrate.
 */
export function createCoalescedStorage(
  getStorage: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined,
  delayMs: number
): CoalescedStorage {
  const pending = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending.size === 0) return;
    const storage = getStorage();
    const entries = Array.from(pending.entries());
    pending.clear();
    if (!storage) return;
    for (const [key, value] of entries) {
      try {
        storage.setItem(key, value);
      } catch (err) {
        // Quota exceeded / private mode: persistence is best-effort
        console.warn('Persist write failed:', err);
      }
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }

  return {
    getItem: (key) => {
      const queued = pending.get(key);
      if (queued !== undefined) return queued;
      return getStorage()?.getItem(key) ?? null;
    },
    setItem: (key, value) => {
      pending.set(key, value);
      if (timer === null) timer = setTimeout(flush, delayMs);
    },
    removeItem: (key) => {
      pending.delete(key);
      getStorage()?.removeItem(key);
    },
    flush
  };
}
