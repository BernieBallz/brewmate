import { useSyncExternalStore } from 'react';
import { notificationManager } from '../utils/notificationManager';

const getSnapshot = () => notificationManager.getPermission();

// Live notification permission; updates after the browser prompt and when returning from settings
export const useNotificationPermission = (): NotificationPermission =>
  useSyncExternalStore(notificationManager.subscribePermission, getSnapshot, getSnapshot);
