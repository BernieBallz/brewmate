import { assetUrl } from './assetUrl';

export type CustomNotificationOptions = NotificationOptions & {
  vibrate?: number[];
};

export interface NotificationDiagnostics {
  isSupported: boolean;
  isSecureContext: boolean;
  permission: NotificationPermission;
  errorReason?: string;
  advice?: string;
}

class NotificationManager {
  private liveTimerDismissed: boolean = false;
  private onActionCallback: ((action: string) => void) | null = null;
  private permissionListeners = new Set<() => void>();

  constructor() {
    if (typeof window !== 'undefined') {
      // Permission can change outside the app (browser prompt, site settings, Android settings),
      // so re-check whenever the app regains focus as well as on the Permissions API change event
      window.addEventListener('focus', this.notifyPermissionChange);
      document.addEventListener('visibilitychange', this.notifyPermissionChange);
      navigator.permissions?.query({ name: 'notifications' as PermissionName })
        .then((status) => status.addEventListener('change', this.notifyPermissionChange))
        .catch(() => {});
    }

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'LIVE_TIMER_NOTIFICATION_DISMISSED') {
          this.liveTimerDismissed = true;
        } else if (event.data?.type === 'LIVE_TIMER_NOTIFICATION_ACTION' && event.data?.action) {
          if (this.onActionCallback) {
            this.onActionCallback(event.data.action);
          }
        }
      });
    }
  }

  // Subscribe to permission changes (shape matches React's useSyncExternalStore)
  public subscribePermission = (listener: () => void): (() => void) => {
    this.permissionListeners.add(listener);
    return () => this.permissionListeners.delete(listener);
  };

  private notifyPermissionChange = (): void => {
    this.permissionListeners.forEach((listener) => listener());
  };

  // True when running as the installed app rather than a browser tab
  public isStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  }

  public isIos(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  public setActionHandler(handler: (action: string) => void): void {
    this.onActionCallback = handler;
  }

  public resetLiveTimerDismissal(): void {
    this.liveTimerDismissed = false;
  }

  public isLiveTimerDismissed(): boolean {
    return this.liveTimerDismissed;
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public isSecureContext(): boolean {
    return typeof window !== 'undefined' && Boolean(window.isSecureContext);
  }

  public getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    try {
      return Notification.permission;
    } catch {
      return 'denied';
    }
  }

  public getDiagnostics(): NotificationDiagnostics {
    const isSupported = this.isSupported();
    const isSecure = this.isSecureContext();
    const permission = this.getPermission();

    if (!isSecure) {
      return {
        isSupported,
        isSecureContext: false,
        permission,
        errorReason: 'Insecure Origin (HTTP)',
        advice: 'Mobile browsers (Chrome on Android) strictly require HTTPS or localhost to prompt for notifications and keep screen awake. Please open the app via https:// or use Chrome Port Forwarding.'
      };
    }

    if (!isSupported) {
      if (this.isIos() && !this.isStandalone()) {
        return {
          isSupported: false,
          isSecureContext: true,
          permission: 'denied',
          errorReason: 'Install Required on iPhone/iPad',
          advice: 'On iPhone and iPad, alerts only work from the installed app. Tap Share, then Add to Home Screen, and open BrewMate from your home screen.'
        };
      }
      return {
        isSupported: false,
        isSecureContext: true,
        permission: 'denied',
        errorReason: 'Notifications Not Supported in this browser',
        advice: 'This browser does not support the Web Notifications API. Consider using Chrome or another modern mobile browser.'
      };
    }

    if (permission === 'denied') {
      return {
        isSupported: true,
        isSecureContext: true,
        permission: 'denied',
        errorReason: 'Notifications Blocked',
        advice: this.isStandalone()
          ? 'Notifications are blocked for the BrewMate app. Open Android Settings -> Apps -> BrewMate -> Notifications and turn them on, then come back here.'
          : 'Notifications are blocked for this site. Tap the icon at the left of the address bar -> Permissions -> Notifications -> Allow, then come back here.'
      };
    }

    if (permission === 'granted') {
      return {
        isSupported: true,
        isSecureContext: true,
        permission: 'granted',
        advice: 'Lock-screen notifications and vibration alerts are enabled and ready.'
      };
    }

    return {
      isSupported: true,
      isSecureContext: true,
      permission: 'default',
      advice: 'Alerts are off. Tap Enable Alerts and choose Allow when your browser asks.'
    };
  }

  public async requestPermission(): Promise<{ granted: boolean; permission: NotificationPermission; message?: string }> {
    const diag = this.getDiagnostics();

    if (!diag.isSecureContext) {
      console.warn('Notification permission blocked: Insecure context.', diag.advice);
      return {
        granted: false,
        permission: diag.permission,
        message: diag.advice
      };
    }

    if (!diag.isSupported) {
      return {
        granted: false,
        permission: 'denied',
        message: diag.advice
      };
    }

    if (diag.permission === 'granted') {
      return { granted: true, permission: 'granted' };
    }

    if (diag.permission === 'denied') {
      return {
        granted: false,
        permission: 'denied',
        message: diag.advice
      };
    }

    try {
      let result: NotificationPermission;
      const permPromise = Notification.requestPermission();
      if (permPromise && typeof permPromise.then === 'function') {
        result = await permPromise;
      } else {
        result = await new Promise<NotificationPermission>((resolve) => {
          Notification.requestPermission(resolve);
        });
      }

      this.notifyPermissionChange();
      return {
        granted: result === 'granted',
        permission: result,
        message: result === 'granted'
          ? 'Notification permission granted.'
          : 'Permission not granted by user or browser.'
      };
    } catch (e: any) {
      console.warn('Error requesting notification permission:', e);
      return {
        granted: false,
        permission: this.getPermission(),
        message: `Notification request error: ${e?.message || String(e)}`
      };
    }
  }

  public async sendNotification(title: string, options?: CustomNotificationOptions): Promise<{ sent: boolean; reason?: string; message?: string }> {
    if (!this.isSupported()) {
      return { sent: false, reason: 'NOT_SUPPORTED', message: 'Notifications not supported in this browser.' };
    }
    if (this.getPermission() !== 'granted') {
      return { sent: false, reason: 'NOT_GRANTED', message: 'Notification permission is not granted.' };
    }

    const defaultOptions: any = {
      badge: assetUrl('badge-72.png'),
      icon: assetUrl('icon-192.png'),
      tag: 'brewmate-alert',
      requireInteraction: true,
      renotify: true,
      ...options
    };

    if (defaultOptions.icon === undefined) {
      delete defaultOptions.icon;
    }

    if (defaultOptions.silent) {
      delete defaultOptions.vibrate;
    } else if (!defaultOptions.vibrate) {
      defaultOptions.vibrate = [300, 150, 300, 150, 500];
    }

    let swError: any = null;

    try {
      // 1. Service Worker showNotification (Mandatory for Android Chrome)
      if ('serviceWorker' in navigator) {
        let reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          try {
            reg = await navigator.serviceWorker.register(assetUrl('sw.js'));
          } catch (regErr: any) {
            swError = regErr;
            console.warn('SW register failed:', regErr);
          }
        }

        if (reg) {
          // Await ready state if active worker is booting
          const activeReg = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<ServiceWorkerRegistration | undefined>((resolve) => setTimeout(() => resolve(reg), 600))
          ]);
          const targetReg = activeReg || reg;
          await targetReg.showNotification(title, defaultOptions);
          return { sent: true };
        }
      }

      // 2. Direct Notification fallback for Desktop Chrome / Safari / Firefox
      try {
        const fallbackOptions = { ...defaultOptions };
        delete fallbackOptions.actions;
        new Notification(title, fallbackOptions);
        return { sent: true };
      } catch (directErr) {
        console.warn('Direct Notification constructor failed (expected on Android):', directErr);
      }

      if (swError?.message?.includes('SSL') || swError?.message?.includes('certificate')) {
        return {
          sent: false,
          reason: 'SSL_CERT_ERROR',
          message: 'Android Chrome blocks Service Workers on untrusted self-signed SSL certificates.'
        };
      }

      return {
        sent: false,
        reason: 'DELIVERY_FAILED',
        message: swError?.message || 'Could not dispatch notification via Service Worker.'
      };
    } catch (e: any) {
      console.warn('Failed to send browser notification:', e);
      return {
        sent: false,
        reason: 'DELIVERY_ERROR',
        message: e?.message || String(e)
      };
    }
  }

  public async updateLiveTimerNotification(
    stageTitle: string,
    timeDisplay: string,
    nextInfo?: string,
    timerType: 'countdown' | 'stopwatch' | 'manual' = 'countdown',
    status: 'running' | 'paused' | 'finished' = 'running'
  ): Promise<boolean> {
    if (this.liveTimerDismissed) return false;
    if (!this.isSupported() || this.getPermission() !== 'granted') return false;

    // Compact, lock-screen-first title without right-side icon so Android never truncates "71:55 • Mash Rest"
    let title = `${timeDisplay} • ${stageTitle}`;
    if (status === 'paused') {
      title = `⏸ ${timeDisplay} • ${stageTitle}`;
    } else if (status === 'finished') {
      title = `✓ 00:00 • ${stageTitle} Complete`;
    } else if (timerType === 'stopwatch') {
      title = `⏱ ${timeDisplay} • ${stageTitle}`;
    }

    // Native Android Notification Action Buttons (Pause / Resume / +1m / +5m / Stop / Next)
    const actions: Array<{ action: string; title: string }> = [];
    if (status === 'finished') {
      actions.push({ action: 'next-stage', title: 'Next Stage ➔' });
    } else if (timerType === 'stopwatch') {
      if (status === 'running') {
        actions.push({ action: 'stop', title: '⏹ Stop Stopwatch' });
      }
    } else if (timerType === 'countdown') {
      if (status === 'running') {
        actions.push({ action: 'pause', title: '⏸ Pause' });
        actions.push({ action: 'extend-1m', title: '+1m' });
      } else if (status === 'paused') {
        actions.push({ action: 'resume', title: '▶ Resume' });
        actions.push({ action: 'extend-5m', title: '+5m' });
      }
    }

    const options: any = {
      badge: assetUrl('badge-72.png'),
      icon: undefined, // Omit right-side thumbnail image so compact lock-screen pill gets 100% horizontal text width
      tag: 'brewmate-live-timer',
      silent: true, // Silent update prevents notification buzz on every tick
      renotify: false, // Ensures zero continuous vibrations/beeps on timer ticks
      requireInteraction: true,
      timestamp: Date.now(),
      actions,
      body: nextInfo || (timerType === 'stopwatch' ? 'Stopwatch running' : 'Countdown active')
    };

    const res = await this.sendNotification(title, options);
    return res.sent;
  }

  public async clearLiveTimerNotification(): Promise<void> {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          const notifs = await reg.getNotifications({ tag: 'brewmate-live-timer' });
          notifs.forEach(n => n.close());
        }
      } catch {}
    }
  }
}

export const notificationManager = new NotificationManager();
