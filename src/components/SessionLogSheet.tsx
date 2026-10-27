import React from 'react';
import { SessionLogPanel } from './SessionLogPanel';
import { ScrollText, X } from 'lucide-react';

interface SessionLogSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

// Session Log from the menu: the By stage screen has no tabs, so the log opens as a full-height sheet
export const SessionLogSheet: React.FC<SessionLogSheetProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/85 backdrop-blur-md select-none">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-log-title"
        className="w-full max-w-xl h-[94dvh] sm:h-auto sm:max-h-[90dvh] flex flex-col bg-slate-950/95 border border-slate-800 rounded-t-2xl sm:rounded-2xl pb-[env(safe-area-inset-bottom,0px)]"
      >
        <div className="shrink-0 flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-slate-800">
          <h3 id="session-log-title" className="flex items-center space-x-2 font-mono font-bold text-sm text-gray-100 uppercase tracking-wider">
            <ScrollText className="w-4 h-4 text-amber-400" />
            <span>Session Log</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close session log"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3">
          <SessionLogPanel />
        </div>
      </div>
    </div>
  );
};
