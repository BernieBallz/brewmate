// Tracks the PWA install prompt and new-version availability, outside React so events
// that fire before the app renders (beforeinstallprompt, controllerchange) aren't missed.

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export type UpdateCheckResult = 'downloading' | 'latest' | 'unavailable';

const UPDATE_CHECK_INTERVAL_MS = 30 * 60_000;

class AppLifecycle {
  private installPrompt: InstallPromptEvent | null = null;
  private updateReady = false;
  private listeners = new Set<() => void>();
  private started = false;

  public init(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installPrompt = e as InstallPromptEvent;
      this.notify();
    });
    window.addEventListener('appinstalled', () => {
      this.installPrompt = null;
      this.notify();
    });

    if (!('serviceWorker' in navigator)) return;

    // The service worker activates new versions immediately (skipWaiting + clients.claim),
    // so a controller change on a page that already had one means a new version is in place
    // and a reload will load it. On first install there is no previous controller.
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return;
      this.updateReady = true;
      this.notify();
    });

    // Long brew sessions keep the app open for hours, so check periodically and on return
    setInterval(() => void this.checkForUpdate(), UPDATE_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.checkForUpdate();
    });
  }

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  public canInstall = (): boolean => this.installPrompt !== null;

  public isUpdateReady = (): boolean => this.updateReady;

  public async promptInstall(): Promise<boolean> {
    const promptEvent = this.installPrompt;
    if (!promptEvent) return false;
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        this.installPrompt = null;
        this.notify();
        return true;
      }
    } catch (err) {
      console.warn('PWA install prompt error:', err);
    }
    return false;
  }

  public async checkForUpdate(): Promise<UpdateCheckResult> {
    if (this.updateReady) return 'downloading';
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 'unavailable';
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return 'unavailable';
      await reg.update();
      return reg.installing || reg.waiting ? 'downloading' : 'latest';
    } catch {
      return 'unavailable';
    }
  }

  public applyUpdate(): void {
    window.location.reload();
  }
}

export const appLifecycle = new AppLifecycle();
