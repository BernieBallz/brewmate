import { useEffect, useState } from 'react';
import { notificationManager } from '../utils/notificationManager';

type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

const isDocumentFullscreen = () =>
  Boolean(document.fullscreenElement || (document as WebkitDocument).webkitFullscreenElement);

// Browser fullscreen (hides the address bar). Not offered in the installed app, which has no address bar.
export const useFullscreen = () => {
  const [isFullscreen, setIsFullscreen] = useState(() => typeof document !== 'undefined' && isDocumentFullscreen());

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(isDocumentFullscreen());
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      const doc = document as WebkitDocument;
      const root = document.documentElement as WebkitElement;
      if (!isDocumentFullscreen()) {
        if (root.requestFullscreen) {
          await root.requestFullscreen();
        } else if (root.webkitRequestFullscreen) {
          await root.webkitRequestFullscreen();
        }
      } else if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen error:', err);
    }
  };

  const canFullscreen =
    typeof document !== 'undefined' &&
    !notificationManager.isStandalone() &&
    Boolean(document.documentElement.requestFullscreen || (document.documentElement as WebkitElement).webkitRequestFullscreen);

  return { isFullscreen, toggleFullscreen, canFullscreen };
};
