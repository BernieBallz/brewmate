import React, { useEffect } from 'react';
import { useBrewStore } from '../store/brewStore';
import { BellRing } from 'lucide-react';

const AUTO_DISMISS_MS = 8000;

// By stage: short, non-blocking banner when a timed addition or reminder comes due. Nothing to confirm.
interface DueBannerProps {
  // Opens the reading card when the due items include a reading (mash pH)
  onRecord: () => void;
}

export const DueBanner: React.FC<DueBannerProps> = ({ onRecord }) => {
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
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto w-full max-w-lg rounded-2xl bg-amber-500 text-slate-950 shadow-[0_8px_30px_rgba(245,158,11,0.45)]"
      >
        <button
          type="button"
          onClick={dismissDueNotice}
          className="w-full flex items-start gap-3 px-4 py-3 text-left touch-press"
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
        {notice.readingIds && notice.readingIds.length > 0 && (
          <div className="px-4 pb-3 -mt-1">
            <button
              type="button"
              onClick={() => {
                dismissDueNotice();
                onRecord();
              }}
              className="w-full min-h-[44px] rounded-xl bg-slate-950 text-amber-300 font-mono font-black text-sm uppercase tracking-wider touch-press"
            >
              Record now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
