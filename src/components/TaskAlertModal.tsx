import React from 'react';
import { useBrewStore, ALERT_SNOOZE_MIN } from '../store/brewStore';
import { Check, Waves } from 'lucide-react';

export const TaskAlertModal: React.FC = () => {
  const {
    activeTaskAlert,
    confirmTaskAlert,
    dismissTaskAlert,
    measurements,
    setMeasurement
  } = useBrewStore();

  if (!activeTaskAlert) return null;

  const isPhPrompt = activeTaskAlert.checklistId === 'ph-sample';
  const currentPh = measurements.mashPhActual !== undefined ? measurements.mashPhActual : 5.25;

  const adjustPh = (delta: number) => {
    const nextVal = Math.round((currentPh + delta) * 100) / 100;
    setMeasurement('mashPhActual', nextVal);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-xl max-h-[96dvh] bg-slate-950/95 backdrop-blur-xl border border-cyan-500/50 shadow-[0_0_35px_rgba(6,182,212,0.2)] rounded-2xl p-3.5 sm:p-5 overflow-y-auto flex flex-col sm:flex-row items-center sm:items-stretch gap-3.5 sm:gap-4.5 text-center sm:text-left">
        {/* Left Side: Task Alert Information */}
        <div className="flex-1 flex flex-col justify-center min-w-0 py-0.5 w-full">
          <div className="flex items-center justify-center sm:justify-start space-x-1.5 mb-1.5 text-cyan-400">
            <Waves className="w-4 h-4 text-cyan-400 shrink-0 animate-pulse" />
            <span className="font-mono font-black text-xs uppercase tracking-widest">
              {activeTaskAlert.title}
            </span>
          </div>

          <h3 className="text-lg sm:text-xl font-black text-white leading-tight font-mono tracking-wide">
            {activeTaskAlert.headline}
          </h3>

          <p className="text-xs sm:text-sm text-gray-300 mt-1.5 leading-relaxed">
            {activeTaskAlert.message}
          </p>

          {/* Inline pH Stepper when the 15m Mash pH Alert triggers */}
          {isPhPrompt && (
            <div className="mt-3 p-2.5 rounded-xl bg-slate-900/90 border border-cyan-500/40 flex items-center justify-between gap-2 w-full">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                Recorded pH:
              </span>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => adjustPh(-0.05)}
                  className="h-9 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-950 text-xs font-bold font-mono text-cyan-400 border border-slate-700 touch-press"
                >
                  -0.05
                </button>
                <span className="text-sm font-black font-mono px-3 py-1.5 rounded-lg bg-slate-950 border border-cyan-700/70 text-cyan-200 min-w-[58px] text-center">
                  {currentPh.toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={() => adjustPh(0.05)}
                  className="h-9 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-950 text-xs font-bold font-mono text-cyan-400 border border-slate-700 touch-press"
                >
                  +0.05
                </button>
              </div>
            </div>
          )}

          {activeTaskAlert.remainingMin !== undefined && (
            <div className="mt-2.5 inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-[11px] font-mono self-center sm:self-start">
              <span>⏱️ Current Remaining: ~{activeTaskAlert.remainingMin}m</span>
            </div>
          )}
        </div>

        {/* Right Side: Touch Actions (HUD Glass Buttons) */}
        <div className="w-full sm:w-52 flex flex-col justify-center space-y-2 shrink-0">
          <button
            onClick={() => {
              if (isPhPrompt && measurements.mashPhActual === undefined) {
                setMeasurement('mashPhActual', currentPh);
              }
              confirmTaskAlert(activeTaskAlert.checklistId);
            }}
            className="w-full py-3 sm:py-3.5 px-4 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/70 active:bg-cyan-800/80 text-cyan-300 hover:text-white border border-cyan-500/70 hover:border-cyan-400 font-mono font-black text-xs sm:text-sm tracking-widest uppercase shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-center space-x-2 touch-press active:scale-95 transition-all"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{activeTaskAlert.actionLabel || 'CONFIRM & CHECK'}</span>
          </button>

          <button
            onClick={dismissTaskAlert}
            className="w-full py-2 px-3 rounded-lg bg-slate-900/80 hover:bg-slate-800 active:bg-slate-950 text-slate-400 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 font-mono font-bold text-xs tracking-wider uppercase transition-all touch-press"
          >
            Snooze {ALERT_SNOOZE_MIN} min
          </button>
        </div>
      </div>
    </div>
  );
};
