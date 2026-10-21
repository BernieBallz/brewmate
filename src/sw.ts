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

// Handle clicking on notification card or timer action buttons from lock screen / shade
self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  const tag = event.notification?.tag || '';

  // If user tapped a native timer control button (Pause, Resume, +1m, +5m, Stop, Next)
  if (action && tag === 'brewmate-live-timer') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          client.postMessage({
            type: 'LIVE_TIMER_NOTIFICATION_ACTION',
            action
          });
        }
      })
    );
    return;
  }

  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(self.registration.scope);
      }
    })
  );
});

// Handle user swipe-away / dismissal so live timer notifications don't resurrect
self.addEventListener('notificationclose', (event) => {
  const tag = event.notification ? event.notification.tag : '';
  if (tag === 'brewmate-live-timer') {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        client.postMessage({ type: 'LIVE_TIMER_NOTIFICATION_DISMISSED' });
      }
    });
  }
});
