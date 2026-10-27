import React from 'react';
import { useBrewStore, hasIncompleteStageItems, hasStageCardItems, getPendingEndReadings } from '../store/brewStore';
import { useStageTimerView } from '../hooks/useStageTimerView';
import {
  Play,
  Pause,
  Square,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  FileText
} from 'lucide-react';

interface StageActionsProps {
  onConfirmAdvance: () => void;
  onOpenReportModal?: () => void;
  // 'large' gives taller buttons and bigger type for the full-screen By stage view
  size?: 'normal' | 'large';
  // By stage: Start/Done opens the stage card, Next opens the Done card when readings are due
  onOpenStageCard?: () => void;
  onOpenDoneCard?: () => void;
}

// Primary flow controls for the current stage: Start / Pause / Resume / +1m / +5m / Stop / Done / Next
export const StageActions: React.FC<StageActionsProps> = ({
  onConfirmAdvance,
  onOpenReportModal,
  size = 'normal',
  onOpenStageCard,
  onOpenDoneCard
}) => {
  const startTimer = useBrewStore(state => state.startTimer);
  const pauseTimer = useBrewStore(state => state.pauseTimer);
  const resumeTimer = useBrewStore(state => state.resumeTimer);
  const stopStopwatch = useBrewStore(state => state.stopStopwatch);
  const confirmFlowStage = useBrewStore(state => state.confirmFlowStage);
  const nextStage = useBrewStore(state => state.nextStage);
  const extendTimer = useBrewStore(state => state.extendTimer);
  const isByStage = useBrewStore(state => state.flowMode === 'byStage');

  const { currentStage, flow, flowPhase, timerStatus, isSessionDone, isCountdownDone } = useStageTimerView();

  // Moving on with additions unconfirmed or reminders unticked goes through the Complete Stage dialog, which lists them
  const hasIncompleteItems = hasIncompleteStageItems(currentStage);
  const guardAdvance = (advance: () => void) => () => (hasIncompleteItems ? onConfirmAdvance() : advance());

  // By stage: starting a stage goes through its stage card while anything is left to confirm,
  // and moving on goes through the Done card while a later reading is unrecorded
  const guardStart = (start: () => void) => () =>
    (isByStage && onOpenStageCard && hasStageCardItems(currentStage) ? onOpenStageCard() : start());
  const guardNext = isByStage
    ? () => (onOpenDoneCard && getPendingEndReadings(currentStage).length > 0 ? onOpenDoneCard() : nextStage())
    : guardAdvance(nextStage);

  // By stage: a checklist stage whose card was dismissed reopens it rather than finishing ("DONE" would be misleading)
  const confirmLabel = isByStage && onOpenStageCard && hasStageCardItems(currentStage) ? 'REVIEW & CONFIRM' : flow.startLabel;

  const isLarge = size === 'large';
  const primarySize = isLarge
    ? 'min-h-[64px] sm:min-h-[72px] py-3 text-base sm:text-lg'
    : 'min-h-[50px] sm:min-h-[54px] py-2.5 text-sm sm:text-base';
  const secondarySize = isLarge
    ? 'min-h-[60px] py-2.5 text-sm sm:text-base'
    : 'min-h-[48px] py-2 text-xs sm:text-sm';
  const extendSize = isLarge
    ? 'px-4 min-h-[60px] py-2.5 text-sm'
    : 'px-3.5 min-h-[48px] py-2 text-xs';

  return (
    <>
      {/* Case 0: Session Finished -> Prominent Telemetry & Audit Report button */}
      {isSessionDone ? (
        <button
          onClick={() => onOpenReportModal?.()}
          className={`w-full ${primarySize} rounded-xl font-mono font-black tracking-wider uppercase transition-all touch-press flex items-center justify-center space-x-2 border bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.4)]`}
        >
          <FileText className="w-5 h-5 stroke-[2.5]" />
          <span>VIEW AUDIT & TELEMETRY</span>
        </button>
      ) : flow.kind === 'confirm' ? (
        /* Case 1: Confirm Stages (Single dominant button) */
        <button
          onClick={isByStage ? guardStart(confirmFlowStage) : guardAdvance(confirmFlowStage)}
          className={`w-full ${primarySize} rounded-xl font-mono font-black tracking-widest uppercase transition-all touch-press flex items-center justify-center space-x-2 border bg-emerald-950/80 hover:bg-emerald-900 active:bg-emerald-800 text-emerald-200 border-emerald-500/70 shadow-[0_0_20px_rgba(16,185,129,0.35)]`}
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-400 stroke-[2.5]" />
          <span>{confirmLabel}</span>
        </button>
      ) : flow.kind === 'countdown' ? (
        /* Case 2: Countdown Stages */
        <>
          {isCountdownDone ? (
            // Finished Countdown State -> NEXT Button
            <button
              onClick={guardNext}
              className={`w-full ${primarySize} rounded-xl font-mono font-black tracking-widest uppercase transition-all touch-press flex items-center justify-center space-x-2 border bg-emerald-950/80 hover:bg-emerald-900 active:bg-emerald-800 text-emerald-200 border-emerald-500/70 shadow-[0_0_20px_rgba(16,185,129,0.35)]`}
            >
              <span>{flow.nextLabel || 'NEXT STAGE'}</span>
              <ArrowRight className="w-5 h-5 text-emerald-400 stroke-[2.5]" />
            </button>
          ) : timerStatus === 'running' ? (
            // Running Countdown State -> PAUSE button + Extension Buttons side-by-side
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => pauseTimer()}
                className={`flex-1 ${secondarySize} rounded-xl font-mono font-black tracking-wider uppercase transition-all touch-press flex items-center justify-center space-x-1.5 border bg-amber-950/70 hover:bg-amber-900/80 active:bg-amber-800/90 text-amber-300 border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.25)]`}
              >
                <Pause className="w-4 h-4 fill-current" />
                <span>{flow.pauseLabel || 'PAUSE'}</span>
              </button>
              <button
                onClick={() => extendTimer(60)}
                className={`${extendSize} rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-slate-200 hover:text-amber-300 border border-slate-800 font-mono font-bold touch-press`}
                title="Add 1 minute"
              >
                +1m
              </button>
              <button
                onClick={() => extendTimer(300)}
                className={`${extendSize} rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-slate-200 hover:text-amber-300 border border-slate-800 font-mono font-bold touch-press`}
                title="Add 5 minutes"
              >
                +5m
              </button>
            </div>
          ) : timerStatus === 'paused' ? (
            // Paused Countdown State -> RESUME button + Extensions side-by-side
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => resumeTimer()}
                className={`flex-1 ${secondarySize} rounded-xl font-mono font-black tracking-widest uppercase transition-all touch-press flex items-center justify-center space-x-1.5 border bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-200 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.25)]`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{flow.resumeLabel || 'RESUME'}</span>
              </button>
              <button
                onClick={() => extendTimer(60)}
                className={`${extendSize} rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-amber-300 border border-slate-800 font-mono font-bold touch-press`}
              >
                +1m
              </button>
              <button
                onClick={() => extendTimer(300)}
                className={`${extendSize} rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-amber-300 border border-slate-800 font-mono font-bold touch-press`}
              >
                +5m
              </button>
            </div>
          ) : (
            // Ready Countdown State -> START button
            <button
              onClick={guardStart(startTimer)}
              className={`w-full ${primarySize} rounded-xl font-mono font-black tracking-widest uppercase transition-all touch-press flex items-center justify-center space-x-2 border bg-emerald-950/80 hover:bg-emerald-900 active:bg-emerald-800 text-emerald-200 border-emerald-500/70 shadow-[0_0_20px_rgba(16,185,129,0.35)]`}
            >
              <Play className="w-5 h-5 fill-current" />
              <span>{flow.startLabel}</span>
            </button>
          )}
        </>
      ) : (
        /* Case 3: Stopwatch Stages */
        <>
          {flowPhase === 'finished' ? (
            // Finished Stopwatch State -> NEXT Button
            <button
              onClick={guardNext}
              className={`w-full ${primarySize} rounded-xl font-mono font-black tracking-widest uppercase transition-all touch-press flex items-center justify-center space-x-2 border bg-emerald-950/80 hover:bg-emerald-900 active:bg-emerald-800 text-emerald-200 border-emerald-500/70 shadow-[0_0_20px_rgba(16,185,129,0.35)]`}
            >
              <span>{flow.nextLabel || 'NEXT STAGE'}</span>
              <ArrowRight className="w-5 h-5 text-emerald-400 stroke-[2.5]" />
            </button>
          ) : timerStatus === 'running' ? (
            // Running Stopwatch State -> STOP Button
            <button
              onClick={() => stopStopwatch()}
              className={`w-full ${primarySize} rounded-xl font-mono font-black tracking-widest uppercase transition-all touch-press flex items-center justify-center space-x-2 border bg-amber-950/80 hover:bg-amber-900 active:bg-amber-800 text-amber-200 border-amber-500/70 shadow-[0_0_20px_rgba(245,158,11,0.35)]`}
            >
              <Square className="w-4 h-4 fill-current" />
              <span>{flow.stopLabel || 'STOP'}</span>
            </button>
          ) : (
            // Ready Stopwatch State -> START Button
            <button
              onClick={guardStart(startTimer)}
              className={`w-full ${primarySize} rounded-xl font-mono font-black tracking-widest uppercase transition-all touch-press flex items-center justify-center space-x-2 border bg-cyan-950/80 hover:bg-cyan-900 active:bg-cyan-800 text-cyan-200 border-cyan-500/70 shadow-[0_0_20px_rgba(6,182,212,0.35)]`}
            >
              <Play className="w-5 h-5 fill-current" />
              <span>{flow.startLabel}</span>
            </button>
          )}
        </>
      )}

      {/* Subtle Early Exit Link (Only shown when running or paused, never when idle or finished) */}
      {(timerStatus === 'running' || timerStatus === 'paused') && !isSessionDone ? (
        <div className="flex justify-center pt-0.5">
          <button
            type="button"
            onClick={onConfirmAdvance}
            className={`${isLarge ? 'text-xs py-1' : 'text-[10px]'} font-mono text-gray-500 hover:text-gray-300 underline flex items-center space-x-1`}
          >
            <AlertTriangle className="w-3 h-3 text-amber-500/60" />
            <span>Skip stage…</span>
          </button>
        </div>
      ) : null}
    </>
  );
};
