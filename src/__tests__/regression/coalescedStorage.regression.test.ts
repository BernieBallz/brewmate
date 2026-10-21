import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createCoalescedStorage } from '../../store/coalescedStorage';

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    setItem: vi.fn((k: string, v: string) => { data.set(k, v); }),
    getItem: vi.fn((k: string) => data.get(k) ?? null),
    removeItem: vi.fn((k: string) => { data.delete(k); })
  };
}

describe('Coalesced persistence storage', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('collapses a burst of writes into one trailing write of the latest value', () => {
    const backing = fakeStorage();
    const storage = createCoalescedStorage(() => backing, 1000);

    storage.setItem('k', 'v1');
    storage.setItem('k', 'v2');
    storage.setItem('k', 'v3');
    expect(backing.setItem).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(backing.setItem).toHaveBeenCalledTimes(1);
    expect(backing.setItem).toHaveBeenCalledWith('k', 'v3');
  });

  it('writes at most once per delay window under continuous updates', () => {
    const backing = fakeStorage();
    const storage = createCoalescedStorage(() => backing, 1000);

    for (let t = 0; t < 5000; t += 250) {
      storage.setItem('k', `v${t}`);
      vi.advanceTimersByTime(250);
    }
    expect(backing.setItem.mock.calls.length).toBeLessThanOrEqual(5);
  });

  it('serves pending values to readers before they are flushed', () => {
    const backing = fakeStorage();
    backing.data.set('k', 'old');
    const storage = createCoalescedStorage(() => backing, 1000);

    expect(storage.getItem('k')).toBe('old');
    storage.setItem('k', 'new');
    expect(storage.getItem('k')).toBe('new');
  });

  it('flush() writes immediately and cancels the timer', () => {
    const backing = fakeStorage();
    const storage = createCoalescedStorage(() => backing, 1000);

    storage.setItem('k', 'v');
    storage.flush();
    expect(backing.setItem).toHaveBeenCalledWith('k', 'v');

    vi.advanceTimersByTime(5000);
    expect(backing.setItem).toHaveBeenCalledTimes(1);
  });

  it('removeItem drops a pending write', () => {
    const backing = fakeStorage();
    const storage = createCoalescedStorage(() => backing, 1000);

    storage.setItem('k', 'v');
    storage.removeItem('k');
    vi.advanceTimersByTime(2000);
    expect(backing.setItem).not.toHaveBeenCalled();
    expect(backing.removeItem).toHaveBeenCalledWith('k');
  });

  it('swallows write failures (quota / private mode)', () => {
    const backing = fakeStorage();
    backing.setItem.mockImplementation(() => { throw new Error('QuotaExceededError'); });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = createCoalescedStorage(() => backing, 1000);

    storage.setItem('k', 'v');
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('is a safe no-op when no storage is available', () => {
    const storage = createCoalescedStorage(() => undefined, 1000);
    storage.setItem('k', 'v');
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    expect(storage.getItem('missing')).toBeNull();
  });
});
