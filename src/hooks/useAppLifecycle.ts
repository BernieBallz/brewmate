import { useSyncExternalStore } from 'react';
import { appLifecycle } from '../utils/appLifecycle';

export const useCanInstallApp = (): boolean =>
  useSyncExternalStore(appLifecycle.subscribe, appLifecycle.canInstall, appLifecycle.canInstall);

export const useAppUpdateReady = (): boolean =>
  useSyncExternalStore(appLifecycle.subscribe, appLifecycle.isUpdateReady, appLifecycle.isUpdateReady);
