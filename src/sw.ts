/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// matchAll also returns other same-origin pages (other projects on this GitHub Pages domain), so keep to this app's own
const getAppClients = async (): Promise<readonly WindowClient[]> => {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return clients.filter((client) => client.url.startsWith(self.registration.scope));
};

const openApp = async (): Promise<void> => {
  await self.clients.openWindow?.(self.registration.scope);
};

// Handle clicking on notification card or timer action buttons from lock screen / shade
self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  const tag = event.notification?.tag || '';

  // If user tapped a native timer control button (Pause, Resume, +1m, +5m, Stop, Next)
  if (action && tag === 'brewmate-live-timer') {
    event.waitUntil((async () => {
      const clientList = await getAppClients();
      // The app was closed by the phone: nothing can act on the button, so reopen it (the timer recovers from its saved start time)
      if (clientList.length === 0) {
        await openApp();
        return;
      }
      for (const client of clientList) {
        client.postMessage({
          type: 'LIVE_TIMER_NOTIFICATION_ACTION',
          action
        });
      }
      // Next Stage may need the Complete Stage dialog, so bring the app to the front
      if (action === 'next-stage') {
        await clientList[0].focus();
      }
    })());
    return;
  }

  event.notification.close();

  event.waitUntil((async () => {
    const clientList = await getAppClients();
    if (clientList.length > 0) {
      await clientList[0].focus();
    } else {
      await openApp();
    }
  })());
});

// Handle user swipe-away / dismissal so live timer notifications don't resurrect
self.addEventListener('notificationclose', (event) => {
  const tag = event.notification ? event.notification.tag : '';
  if (tag === 'brewmate-live-timer') {
    event.waitUntil((async () => {
      for (const client of await getAppClients()) {
        client.postMessage({ type: 'LIVE_TIMER_NOTIFICATION_DISMISSED' });
      }
    })());
  }
});
