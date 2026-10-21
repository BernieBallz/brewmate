import React from 'react';
import { useBrewStore } from '../store/brewStore';
import { RotateCcw, Trash2 } from 'lucide-react';

export type SessionClearMode = 'reset' | 'remove';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  // 'reset' restarts the current recipe; 'remove' clears the recipe and session from this device
  mode?: SessionClearMode;
}

const COPY: Record<SessionClearMode, { title: string; body: string; action: string }> = {
  reset: {
    title: 'Reset Brew Session?',
    body: 'This will reset all timers, uncheck reminders, and restart from Stage 1 (Strike Water). Logged measurements will be cleared.',
    action: 'Reset Session'
  },
  remove: {
    title: 'Remove Recipe?',
    body: 'This removes the recipe and its brew session from this device, including the session log and measurements, and returns to the start screen. Export the session report first if you want to keep it.',
    action: 'Remove Recipe'
  }
};

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({ isOpen, onClose, mode = 'reset' }) => {
  const { resetSession, removeRecipe } = useBrewStore();

  if (!isOpen) return null;

  const copy = COPY[mode];
  const Icon = mode === 'remove' ? Trash2 : RotateCcw;

  const handleConfirm = () => {
    if (mode === 'remove') {
      removeRecipe();
    } else {
      resetSession();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-lg max-h-[96dvh] overflow-y-auto bg-slate-950/95 backdrop-blur-xl border border-rose-500/40 shadow-[0_0_35px_rgba(244,63,94,0.2)] rounded-2xl p-3.5 sm:p-5 flex flex-col sm:flex-row items-center sm:items-stretch gap-3.5 sm:gap-4.5 text-center sm:text-left">
        {/* Left Side: Warning Description */}
        <div className="flex-1 flex flex-col justify-center min-w-0 py-0.5">
          <div className="flex items-center justify-center sm:justify-start space-x-2 text-rose-400 mb-1">
            <Icon className="w-5 h-5 shrink-0" />
            <h3 className="text-base sm:text-lg font-black text-white leading-tight font-mono tracking-wide">
              {copy.title}
            </h3>
          </div>
          <p className="text-xs text-gray-300 mt-1 leading-relaxed">
            {copy.body}
          </p>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="w-full sm:w-48 flex flex-col justify-center space-y-2 shrink-0">
          <button
            onClick={handleConfirm}
            className="w-full py-3 px-4 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 active:bg-rose-800/80 text-rose-300 hover:text-white border border-rose-500/60 hover:border-rose-400 font-mono font-black text-xs tracking-widest uppercase shadow-[0_0_20px_rgba(244,63,94,0.25)] transition-all touch-press active:scale-95 flex items-center justify-center space-x-2"
          >
            <Icon className="w-4 h-4 stroke-[2.5]" />
            <span>{copy.action}</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 px-3 rounded-lg bg-slate-900/80 hover:bg-slate-800 active:bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 font-mono font-bold text-xs tracking-wider uppercase transition-all touch-press"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
