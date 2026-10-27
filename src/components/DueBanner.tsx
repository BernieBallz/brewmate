import React, { useEffect } from 'react';
import { useBrewStore } from '../store/brewStore';
import { BellRing } from 'lucide-react';

const AUTO_DISMISS_MS = 8000;

// By stage: short, non-blocking banner when a timed addition or reminder comes due. Nothing to confirm.
export const DueBanner: React.FC = () => {
  const notice = useBrewStore(state => state.activeDueNotice);
  const dismissDueNotice = useBrewStore(state => state.dismissDueNotice);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(dismissDueNotice, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notice, dismissDueNotice]);

  if (!notice) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] pointer-events-none">
      <button
        type="button"
        role="status"
        aria-live="polite"
        onClick={dismissDueNotice}
        className="pointer-events-auto w-full max-w-lg flex items-start gap-3 px-4 py-3 rounded-2xl bg-amber-500 text-slate-950 shadow-[0_8px_30px_rgba(245,158,11,0.45)] text-left touch-press"
      >
        <BellRing className="w-6 h-6 shrink-0 mt-0.5" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-mono font-black uppercase tracking-wider opacity-80">
            {notice.title} · due now
          </span>
          {notice.lines.map(line => (
            <span key={line} className="block text-base font-black leading-snug">
              {line}
            </span>
          ))}
        </span>
        <span className="text-[10px] font-mono font-bold uppercase opacity-70 shrink-0 mt-1">Tap to close</span>
      </button>
    </div>
  );
};
