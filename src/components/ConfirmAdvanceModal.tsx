import React from 'react';
import { useBrewStore, getUnconfirmedAdditions } from '../store/brewStore';
import { AlertTriangle, Check, CheckCircle2 } from 'lucide-react';

interface ConfirmAdvanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Set when jumping to a specific stage from the menu; otherwise the dialog advances to the next stage
  targetStageIndex?: number | null;
}

export const ConfirmAdvanceModal: React.FC<ConfirmAdvanceModalProps> = ({ isOpen, onClose, targetStageIndex = null }) => {
  const { stages, currentStageIndex, nextStage, confirmFlowStage, goToStage, timerRemainingSec } = useBrewStore();

  if (!isOpen) return null;

  const currentStage = stages[currentStageIndex];
  const isJump = targetStageIndex !== null;
  const nextStageObj = stages[isJump ? targetStageIndex : currentStageIndex + 1];
  const unconfirmedAdditions = getUnconfirmedAdditions(currentStage);

  const handleAdvance = () => {
    if (isJump) {
      goToStage(targetStageIndex);
    } else if (currentStage.flow?.kind === 'confirm') {
      // Confirm-type stages (e.g. Mash In, Pitch) complete via their own flow action
      confirmFlowStage();
    } else {
      nextStage();
    }
    onClose();
  };

  const remainingMin = Math.ceil(timerRemainingSec / 60);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-xl max-h-[96dvh] overflow-y-auto bg-slate-950/95 backdrop-blur-xl border border-sky-500/40 shadow-[0_0_35px_rgba(56,189,248,0.2)] rounded-2xl p-3.5 sm:p-5 flex flex-col sm:flex-row items-center sm:items-stretch gap-3.5 sm:gap-4.5 text-center sm:text-left">
        {/* Left Side: Stage Information & Notice */}
        <div className="flex-1 flex flex-col justify-center min-w-0 py-0.5">
          <div className="flex items-center justify-center sm:justify-start space-x-2 text-sky-400 mb-1">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <h3 className="text-base sm:text-lg font-black text-white leading-tight truncate">
              Complete "{currentStage.title}"?
            </h3>
          </div>

          {unconfirmedAdditions.length > 0 && (
            <div className="mt-2 p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/50 text-left">
              <span className="flex items-center space-x-1.5 text-xs font-mono font-black text-amber-300 uppercase tracking-wider">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {unconfirmedAdditions.length} addition{unconfirmedAdditions.length === 1 ? '' : 's'} not confirmed
                </span>
              </span>
              <ul className="mt-1.5 space-y-0.5">
                {unconfirmedAdditions.map(a => (
                  <li key={a.id} className="text-xs text-gray-200 truncate">
                    <span className="font-mono font-bold text-amber-300">{a.amount} {a.unit || 'g'}</span> {a.name}
                  </li>
                ))}
              </ul>
              <span className="text-[11px] text-gray-400 block mt-1.5">
                Continuing leaves them unconfirmed in the brew log.
              </span>
            </div>
          )}

          {currentStage.timerType === 'countdown' && timerRemainingSec > 0 && (
            <p className="text-xs text-amber-400/90 font-mono mt-0.5">
              Note: Current countdown still has {remainingMin} min remaining.
            </p>
          )}

          {currentStage.timerType === 'stopwatch' && (
            <div className="mt-1 flex items-center justify-center sm:justify-start space-x-1.5 text-xs font-mono text-cyan-300">
              <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 font-bold">
                ⏱️ Storing Run Time: {Math.floor(timerRemainingSec / 60)}m {timerRemainingSec % 60}s
              </span>
            </div>
          )}

          {nextStageObj ? (
            <div className="mt-2 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-left">
              <span className="text-[10px] text-gray-500 font-mono uppercase block">{isJump ? 'Jumping To:' : 'Next Stage:'}</span>
              <span className="text-xs sm:text-sm font-bold text-amber-400 block mt-0.5">{nextStageObj.title}</span>
              <span className="text-[11px] text-gray-400 block mt-0.5 leading-snug line-clamp-2">{nextStageObj.description}</span>
            </div>
          ) : (
            <div className="mt-2 p-2 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 text-xs font-mono">
              All stages complete! Session will move to final audit review.
            </div>
          )}
        </div>

        {/* Right Side: Action Buttons (Right-thumb ergonomic reach in landscape) */}
        <div className="w-full sm:w-52 flex flex-col justify-center space-y-2 shrink-0">
          <button
            onClick={handleAdvance}
            className="w-full py-3 sm:py-3.5 px-4 rounded-xl bg-sky-950/60 hover:bg-sky-900/70 active:bg-sky-800/80 text-sky-200 hover:text-white border border-sky-500/60 hover:border-sky-400 font-mono font-black text-xs sm:text-sm tracking-widest uppercase shadow-[0_0_20px_rgba(56,189,248,0.25)] flex items-center justify-center space-x-2 transition-all touch-press active:scale-95"
          >
            <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[3] text-sky-400" />
            <span>{unconfirmedAdditions.length > 0 ? 'CONTINUE ANYWAY' : 'COMPLETE STAGE'}</span>
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
