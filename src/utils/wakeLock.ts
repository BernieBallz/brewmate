class WakeLockManager {
  private sentinel: WakeLockSentinel | null = null;
  private isRequested: boolean = false;
  // Waking the phone triggers several requests at once; they share one lock, or the extras could never be released
  private pending: Promise<boolean> | null = null;

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.isRequested) {
          void this.requestLock();
        }
      });
    }
  }

  public requestLock(): Promise<boolean> {
    this.isRequested = true;
    if (this.isActive()) return Promise.resolve(true);
    if (this.pending) return this.pending;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return Promise.resolve(false);

    this.pending = navigator.wakeLock.request('screen')
      .then(async (sentinel) => {
        // Turned off while the request was in flight
        if (!this.isRequested) {
          await sentinel.release();
          return false;
        }
        this.sentinel = sentinel;
        return true;
      })
      .catch((err) => {
        console.warn('Wake Lock request failed:', err);
        return false;
      })
      .finally(() => {
        this.pending = null;
      });
    return this.pending;
  }

  public async releaseLock(): Promise<void> {
    this.isRequested = false;
    const sentinel = this.sentinel;
    this.sentinel = null;
    if (sentinel) {
      try {
        await sentinel.release();
      } catch (err) {
        console.warn('Error releasing wake lock:', err);
      }
    }
  }

  public isActive(): boolean {
    return this.sentinel !== null && !this.sentinel.released;
  }
}

export const wakeLockManager = new WakeLockManager();
