import React from 'react';
import { useBrewStore } from '../store/brewStore';
import { useStageTimerView, formatTime, formatWaitCountdown } from '../hooks/useStageTimerView';
import { CountdownProgressBar } from './CountdownProgressBar';
import { StageActions } from './StageActions';
import { StrikeOffsetControl } from './StrikeOffsetControl';
import {
  Thermometer,
  Droplets,
  Timer,
  CheckCircle2
} from 'lucide-react';

interface TimerCockpitProps {
  onConfirmAdvance: () => void;
  onOpenReportModal?: () => void;
}

export const TimerCockpit: React.FC<TimerCockpitProps> = ({
  onConfirmAdvance,
  onOpenReportModal
}) => {
  const toggleChecklistItem = useBrewStore(state => state.toggleChecklistItem);

  const {
    stages,
    currentStageIndex,
    currentStage,
    flow,
    flowPhase,
    timerStatus,
    timerRemainingSec,
    isSessionDone,
    isCountdownDone,
    displayTimeStr,
    isLongTimeFormat,
    immediateUncheckedReminder,
    nextTimedEvent
  } = useStageTimerView();

  return (
    <div className="flex flex-col justify-between h-full min-h-0 bg-slate-900/95 rounded-xl border border-brew-border p-2.5 sm:p-3 shadow-lg select-none overflow-y-auto overflow-x-hidden">
      {/* 1. Stage Title & Parameter Badge (Compact Header) */}
      <div className="flex items-center justify-between shrink-0 pb-1.5 border-b border-brew-border/60">
        <div className="min-w-0 pr-2">
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider">
              {currentStageIndex + 1}/{stages.length}
            </span>
            <span className="text-xs sm:text-sm font-black text-white truncate leading-tight">
              {currentStage?.title}
            </span>
          </div>
        </div>

        {/* Target Parameter Pill */}
        <div className="shrink-0 flex items-center space-x-1">
          {currentStage?.parameters?.targetTemp !== undefined && (
            <div className="flex items-center space-x-1 text-[10px] sm:text-[11px] font-mono font-bold text-amber-400 bg-amber-950/70 px-2 py-0.5 rounded border border-amber-800/60">
              <Thermometer className="w-3 h-3" />
              <span>{currentStage.parameters.targetTemp}°C</span>
            </div>
          )}
          {currentStage?.parameters?.targetVolume !== undefined && currentStage.parameters.targetVolume > 0 && (
            <div 
              className="flex items-center space-x-1 text-[10px] sm:text-[11px] font-mono font-bold text-cyan-400 bg-cyan-950/70 px-2 py-0.5 rounded border border-cyan-800/60"
              title={currentStage.parameters.infoNotes || `${currentStage.parameters.volumeLabel || 'Target'} Volume: ${currentStage.parameters.targetVolume}L`}
            >
              <Droplets className="w-3 h-3" />
              <span>
                {currentStage.parameters.volumeLabel ? `${currentStage.parameters.volumeLabel} ` : ''}
                {currentStage.parameters.targetVolume}L
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Hero Full-Width Display & Linked Prompt Bar */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center py-1.5 w-full">
        {/* Case 0: Session Finished State */}
        {isSessionDone ? (
          <div className="flex flex-col items-center justify-center py-1 animate-in fade-in duration-300">
            <div className="w-12 h-12 rounded-full bg-emerald-950/90 border-2 border-emerald-500/80 flex items-center justify-center text-emerald-400 mb-1.5 shadow-[0_0_25px_rgba(16,185,129,0.4)]">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-white font-mono tracking-wider uppercase">
              Brew Session Complete!
            </h3>
            <p className="text-[11px] text-emerald-400 font-mono mt-0.5">
              All {stages.length} stages finished • Full telemetry logged
            </p>
          </div>
        ) : flow.kind === 'countdown' ? (
          /* Case A: Countdown Stages (Mash Rest, Boil, Whirlpool) - Full Card-Width Digits + Milestone Timeline */
          <div className="flex flex-col items-center w-full">
            <div
              className={`w-full text-center font-mono font-black tabular-nums leading-none transition-colors py-0.5 ${
                displayTimeStr.includes('over')
                  ? 'text-[clamp(2.25rem,11vw,4rem)] sm:text-5xl tracking-tight'
                  : isLongTimeFormat
                  ? 'text-[clamp(3.25rem,16.8vw,5.5rem)] sm:text-6xl lg:text-7xl tracking-tighter'
                  : 'text-[clamp(4.25rem,22.5vw,6.5rem)] sm:text-7xl lg:text-8xl tracking-tight'
              } ${
                isCountdownDone
                  ? 'text-emerald-400 animate-pulse hud-glow-green'
                  : timerStatus === 'running'
                  ? 'text-amber-400 hud-glow'
                  : timerStatus === 'paused'
                  ? 'text-amber-300/80'
                  : 'text-gray-200'
              }`}
            >
              {displayTimeStr}
            </div>

            {/* Full-Width Stage Progress Bar with Timed Reminder / Addition Milestone Markers */}
            <div className="w-full px-1 mt-1.5 mb-1">
              <CountdownProgressBar />
            </div>

            {/* Interactive Timer <-> Prompt Link Banner */}
            <div className="w-full mt-1">
              {isCountdownDone ? (
                <div className="w-full px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/50 text-xs font-mono font-bold text-emerald-300 flex items-center justify-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{flow.endAlert || 'Stage Complete'} • Tap NEXT below</span>
                </div>
              ) : nextTimedEvent ? (
                <div className="w-full px-2.5 py-1 rounded-lg bg-slate-950/90 border border-slate-800 text-[11px] font-mono flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/80 text-[9px] font-black uppercase tracking-wider shrink-0">
                      {nextTimedEvent.kind === 'addition' ? 'NEXT ADDITION' : 'NEXT PROMPT'}
                    </span>
                    <span className="text-gray-200 font-semibold truncate">
                      {nextTimedEvent.label}
                    </span>
                  </div>
                  <span className="text-cyan-400 font-bold shrink-0">
                    {timerStatus === 'running'
                      ? `in ${formatWaitCountdown(nextTimedEvent.waitSec)}`
                      : nextTimedEvent.waitSec <= 0
                        ? 'at start'
                        : `@ ${Math.round(nextTimedEvent.triggerRemainingSec / 60)}m left`}
                  </span>
                </div>
              ) : immediateUncheckedReminder ? (
                <div className="w-full px-2.5 py-1 rounded-lg bg-slate-950/90 border border-amber-500/30 text-[11px] font-mono flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700/60 text-[9px] font-black uppercase tracking-wider shrink-0">
                      NEXT TASK
                    </span>
                    <span className="text-gray-200 font-semibold truncate">
                      {immediateUncheckedReminder.label}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleChecklistItem(immediateUncheckedReminder.id)}
                    className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-[10px] shrink-0 touch-press"
                  >
                    CHECK
                  </button>
                </div>
              ) : (
                <span className="text-[11px] font-mono text-emerald-400/90 mt-0.5 inline-flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>All stage tasks complete • {timerStatus === 'paused' ? 'Timer paused' : 'Countdown active'}</span>
                </span>
              )}
            </div>
          </div>
        ) : flow.kind === 'stopwatch' ? (
          /* Case B: Stopwatch Stages (Sparge, Chill, Knockout) - Full Card-Width Digits */
          <div className="flex flex-col items-center w-full">
            <div
              className={`w-full text-center font-mono font-black tabular-nums leading-none transition-colors py-0.5 ${
                formatTime(timerRemainingSec).length > 5
                  ? 'text-[clamp(3.25rem,16.8vw,5.5rem)] sm:text-6xl lg:text-7xl tracking-tighter'
                  : 'text-[clamp(4.25rem,22.5vw,6.5rem)] sm:text-7xl lg:text-8xl tracking-tight'
              } ${
                flowPhase === 'finished'
                  ? 'text-emerald-400'
                  : timerStatus === 'running'
                  ? 'text-cyan-400 hud-glow-cyan'
                  : 'text-gray-300'
              }`}
            >
              {formatTime(timerRemainingSec)}
            </div>
            {flowPhase === 'finished' ? (
              <div className="flex flex-col items-center mt-1.5 w-full">
                <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[11px] font-mono font-bold flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>TIME STORED: {formatTime(timerRemainingSec)}</span>
                </span>
              </div>
            ) : immediateUncheckedReminder ? (
              <div className="w-full px-2.5 py-1 mt-1.5 rounded-lg bg-slate-950/90 border border-cyan-500/30 text-[11px] font-mono flex items-center justify-between gap-2">
                <div className="flex items-center space-x-1.5 min-w-0">
                  <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[9px] font-black uppercase tracking-wider shrink-0">
                    NEXT TASK
                  </span>
                  <span className="text-gray-200 font-semibold truncate">
                    {immediateUncheckedReminder.label}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleChecklistItem(immediateUncheckedReminder.id)}
                  className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold text-[10px] shrink-0 touch-press"
                >
                  CHECK
                </button>
              </div>
            ) : timerStatus === 'running' ? (
              <span className="text-xs font-mono text-cyan-300/90 mt-1 flex items-center space-x-1">
                <Timer className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                <span>Elapsed stopwatch active</span>
              </span>
            ) : (
              <span className="text-[11px] font-mono text-gray-400 mt-1">
                Ready to track elapsed time
              </span>
            )}
          </div>
        ) : currentStage?.id === 'WATER_PREP' ? (
          /* Case C: Strike Water (Confirm stage with horizontal compact stepper) */
          <div className="flex flex-col items-center justify-center py-0.5">
            {/* Same tick + title header as the other confirm stages (Case D) */}
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-1" />
            <h3 className="text-sm sm:text-base font-bold text-gray-100 mb-2">{currentStage?.title}</h3>

            <StrikeOffsetControl />
          </div>
        ) : (
          /* Case D: Other Confirm Stages (Mash In, Yeast Pitch, Clean Up) */
          <div className="flex flex-col items-center justify-center py-1 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-1" />
            <h3 className="text-sm sm:text-base font-bold text-gray-100">{currentStage?.title}</h3>
            <p className="text-[11px] text-gray-400 max-w-xs mt-0.5 leading-snug">
              {currentStage?.description}
            </p>
          </div>
        )}
      </div>

      {/* 3. Primary Flow-First Action Controls (Sticky at Bottom, NEVER Pushed Off-Screen) */}
      <div className="shrink-0 sticky bottom-0 bg-slate-900/95 pt-1.5 pb-0.5 z-10 space-y-1.5">
        <StageActions onConfirmAdvance={onConfirmAdvance} onOpenReportModal={onOpenReportModal} />
      </div>
    </div>
  );
};
