class WakeLockManager {
  private sentinel: any = null;
  private isRequested: boolean = false;
  private onChangeCallback: ((active: boolean) => void) | null = null;

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.isRequested) {
          this.requestLock();
        }
      });
    }
  }

  public setOnChange(cb: (active: boolean) => void) {
    this.onChangeCallback = cb;
  }

  public async requestLock(): Promise<boolean> {
    this.isRequested = true;
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        this.sentinel = await (navigator as any).wakeLock.request('screen');
        this.sentinel.addEventListener('release', () => {
          if (this.onChangeCallback) this.onChangeCallback(false);
        });
        if (this.onChangeCallback) this.onChangeCallback(true);
        return true;
      } catch (err) {
        console.warn('Wake Lock request failed:', err);
        if (this.onChangeCallback) this.onChangeCallback(false);
        return false;
      }
    }
    return false;
  }

  public async releaseLock(): Promise<void> {
    this.isRequested = false;
    if (this.sentinel) {
      try {
        await this.sentinel.release();
      } catch (err) {
        console.warn('Error releasing wake lock:', err);
      }
      this.sentinel = null;
    }
    if (this.onChangeCallback) this.onChangeCallback(false);
  }

  public isActive(): boolean {
    return this.sentinel !== null && !this.sentinel.released;
  }
}

export const wakeLockManager = new WakeLockManager();
