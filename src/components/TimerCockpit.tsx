import React, { useMemo } from 'react';
import { useBrewStore, getUnconfirmedAdditions } from '../store/brewStore';
import { 
  Play, 
  Pause, 
  Square, 
  ArrowRight,
  Thermometer,
  Droplets,
  Timer,
  CheckCircle2,
  AlertTriangle,
  FileText
} from 'lucide-react';

interface TimerCockpitProps {
  onConfirmAdvance: () => void;
  onOpenReportModal?: () => void;
}

export const TimerCockpit: React.FC<TimerCockpitProps> = ({ 
  onConfirmAdvance,
  onOpenReportModal 
}) => {
  const {
    stages,
    currentStageIndex,
    timerStatus,
    timerRemainingSec,
    timerTotalSec,
    strikeOffset,
    recipe,
    finishedAt,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopStopwatch,
    confirmFlowStage,
    nextStage,
    extendTimer,
    setStrikeOffset,
    toggleChecklistItem
  } = useBrewStore();

  const currentStage = stages[currentStageIndex];

  // Defensive flow fallback ensures action buttons NEVER disappear if stage.flow is missing
  const flow = currentStage?.flow || {
    kind: currentStage?.timerType === 'stopwatch' ? 'stopwatch' : currentStage?.isTimed ? 'countdown' : 'confirm',
    startLabel: currentStage?.timerType === 'stopwatch' ? 'START' : currentStage?.isTimed ? 'START' : 'CONFIRM',
    pauseLabel: 'PAUSE',
    resumeLabel: 'RESUME',
    stopLabel: 'STOP',
    nextLabel: 'NEXT',
    startLog: `${currentStage?.title || 'Stage'} started`,
    endLog: `${currentStage?.title || 'Stage'} complete`,
    endAlert: `${currentStage?.title || 'Stage'} complete!`
  };

  // Moving on with additions still unconfirmed goes through the Complete Stage dialog, which lists them
  const hasUnconfirmedAdditions = getUnconfirmedAdditions(currentStage).length > 0;
  const guardAdvance = (advance: () => void) => () => (hasUnconfirmedAdditions ? onConfirmAdvance() : advance());

  const flowPhase = currentStage?.flowPhase ||(timerStatus === 'running' ? 'running' : timerStatus === 'paused' ? 'paused' : 'ready');
  const isSessionDone = finishedAt !== null || (currentStage?.id === 'CLEANUP' && currentStage?.status === 'completed');

  // Format MM:SS or HH:MM:SS
  const formatTime = (totalSeconds: number) => {
    const isNegative = totalSeconds < 0;
    const abs = Math.abs(totalSeconds);
    const hours = Math.floor(abs / 3600);
    const minutes = Math.floor((abs % 3600) / 60);
    const seconds = abs % 60;

    const base = hours > 0
      ? `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    return isNegative ? `+${base} over` : base;
  };

  const formatWaitCountdown = (waitSeconds: number) => {
    const sec = Math.max(0, waitSeconds);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const remM = m % 60;
      return `${h}h ${remM}m`;
    }
    if (m > 0) {
      return `${m}m ${s.toString().padStart(2, '0')}s`;
    }
    return `${s}s`;
  };

  const mashStep = recipe?.mash?.steps?.[0];
  const mashTemp = mashStep?.stepTemp || 65;
  const targetStrikeTemp = Number((mashTemp + strikeOffset).toFixed(1));
  const isCountdownDone = flow.kind === 'countdown' && (flowPhase === 'finished' || timerRemainingSec <= 0);

  const activeRemainingSec = timerStatus === 'idle' && flowPhase !== 'finished' ? timerTotalSec : timerRemainingSec;
  const displayTimeStr = formatTime(activeRemainingSec);
  const isLongTimeFormat = displayTimeStr.length > 5;

  // Compute progress percentage & milestone markers for Countdown stages
  const totalSec = Math.max(1, timerTotalSec || currentStage?.plannedDurationSec || 1);
  const elapsedSec = Math.max(0, Math.min(totalSec, totalSec - activeRemainingSec));
  const countdownProgressPct = flow.kind === 'countdown' ? Math.min(100, Math.max(0, (elapsedSec / totalSec) * 100)) : 0;

  const additionReminderIds = ['mash-additions-check', 'boil-additions-monitor', 'whirlpool-additions', 'pitch-additions'];

  // Check if additions in this stage are still pending
  const firstIncompleteChecklistItem = currentStage?.checklist?.find(c => {
    if (additionReminderIds.includes(c.id) && (currentStage?.additions?.length || 0) > 0) {
      return !(currentStage?.additions || []).every(a => a.confirmed);
    }
    return !c.checked;
  });

  // Only activate immediateUncheckedReminder if the first incomplete item is an operational task (not blocked by pending additions)
  const immediateUncheckedReminder = (firstIncompleteChecklistItem && !additionReminderIds.includes(firstIncompleteChecklistItem.id))
    ? (firstIncompleteChecklistItem.triggerRemainingSec === undefined || ((timerStatus !== 'idle' || flowPhase === 'finished') && activeRemainingSec <= firstIncompleteChecklistItem.triggerRemainingSec))
      ? firstIncompleteChecklistItem
      : undefined
    : undefined;

  // Next future timed event (either Addition or Timed Reminder)
  const upcomingTimedEvents: Array<{
    id: string;
    kind: 'addition' | 'reminder';
    label: string;
    triggerRemainingSec: number;
    waitSec: number;
  }> = [];

  // Before the timer starts, start-of-stage items (trigger == full duration) are not due yet but are next up
  const isAwaitingStart = timerStatus === 'idle' && flowPhase !== 'finished';
  const isUpcoming = (triggerRemainingSec: number) =>
    triggerRemainingSec < activeRemainingSec || (isAwaitingStart && triggerRemainingSec <= activeRemainingSec);

  if (flow.kind === 'countdown' && currentStage) {
    for (const add of currentStage.additions || []) {
      if (!add.confirmed && isUpcoming(add.triggerRemainingSec)) {
        upcomingTimedEvents.push({
          id: add.id,
          kind: 'addition',
          label: `${add.amount}${add.unit || 'g'} ${add.name}`,
          triggerRemainingSec: add.triggerRemainingSec,
          waitSec: activeRemainingSec - add.triggerRemainingSec
        });
      }
    }
    for (const item of currentStage.checklist || []) {
      if (!item.checked && item.triggerRemainingSec !== undefined && isUpcoming(item.triggerRemainingSec)) {
        upcomingTimedEvents.push({
          id: item.id,
          kind: 'reminder',
          label: item.label,
          triggerRemainingSec: item.triggerRemainingSec,
          waitSec: activeRemainingSec - item.triggerRemainingSec
        });
      }
    }
    upcomingTimedEvents.sort((a, b) => a.waitSec - b.waitSec);
  }

  const nextTimedEvent = upcomingTimedEvents[0];

  // Group all timed milestones (additions & timed checklist items) by triggerRemainingSec
  // to avoid overlapping DOM elements and compounded box-shadow artifacts,
  // and highlight the next upcoming milestone marker so it matches the banner below.
  const milestoneGroups = useMemo(() => {
    if (!currentStage || totalSec <= 0) return [];

    const map = new Map<number, {
      triggerRemainingSec: number;
      triggerPos: number;
      additions: NonNullable<typeof currentStage.additions>;
      checklist: NonNullable<typeof currentStage.checklist>;
    }>();

    for (const item of currentStage.checklist || []) {
      if (item.triggerRemainingSec !== undefined) {
        const sec = item.triggerRemainingSec;
        if (!map.has(sec)) {
          const triggerPos = Math.min(98, Math.max(2, ((totalSec - sec) / totalSec) * 100));
          map.set(sec, { triggerRemainingSec: sec, triggerPos, additions: [], checklist: [] });
        }
        map.get(sec)!.checklist.push(item);
      }
    }

    for (const add of currentStage.additions || []) {
      const sec = add.triggerRemainingSec;
      if (!map.has(sec)) {
        const triggerPos = Math.min(98, Math.max(2, ((totalSec - sec) / totalSec) * 100));
        map.set(sec, { triggerRemainingSec: sec, triggerPos, additions: [], checklist: [] });
      }
      map.get(sec)!.additions.push(add);
    }

    return Array.from(map.values()).sort((a, b) => b.triggerRemainingSec - a.triggerRemainingSec);
  }, [currentStage, totalSec]);

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
              <div className="w-full h-2 bg-slate-950 rounded-full border border-slate-800/90 relative overflow-visible">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isCountdownDone
                      ? 'bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]'
                      : timerStatus === 'paused'
                      ? 'bg-amber-500/60'
                      : 'bg-gradient-to-r from-amber-600 via-amber-400 to-cyan-400'
                  }`}
                  style={{ width: `${countdownProgressPct}%` }}
                />
                {/* Plot Milestone Markers for Timed Reminders & Additions (Grouped by time to avoid shadow compounding) */}
                {milestoneGroups.map(group => {
                  const allAdditionsConfirmed = group.additions.length === 0 || group.additions.every(a => a.confirmed);
                  const allChecklistChecked = group.checklist.length === 0 || group.checklist.every(c => c.checked);
                  const allCompleted = allAdditionsConfirmed && allChecklistChecked;

                  const isDueNow = !allCompleted && activeRemainingSec <= group.triggerRemainingSec && timerStatus !== 'idle';
                  const isNextUpcoming = !allCompleted && !isDueNow && nextTimedEvent !== undefined && nextTimedEvent.triggerRemainingSec === group.triggerRemainingSec;

                  const hasAdditions = group.additions.length > 0;
                  const itemLabels = [
                    ...group.additions.map(a => `${a.name} (${a.amount}${a.unit || 'g'})`),
                    ...group.checklist.map(c => c.label)
                  ];
                  const titleStr = `${itemLabels.join(' + ')} @ T-${Math.round(group.triggerRemainingSec / 60)}m${
                    allCompleted ? ' (Completed)' : isDueNow ? ' (DUE NOW)' : isNextUpcoming ? ' (NEXT UP)' : ''
                  }`;

                  return (
                    <div
                      key={`milestone-${group.triggerRemainingSec}`}
                      style={{ left: `${group.triggerPos}%` }}
                      title={titleStr}
                      className="absolute -top-[2px] -ml-1.5 z-10 flex items-center justify-center pointer-events-auto"
                    >
                      {/* Intentional radar pulse ring on Next Upcoming milestone to visually tie into the NEXT ADDITION banner */}
                      {isNextUpcoming && (
                        <>
                          <span className="absolute -inset-1 rounded-full border border-amber-300/80 animate-ping pointer-events-none" />
                          <span className="absolute -inset-0.5 rounded-full ring-2 ring-amber-400/50 animate-pulse pointer-events-none" />
                        </>
                      )}

                      {/* Flashing alert ring when milestone is due now */}
                      {isDueNow && (
                        <span className="absolute -inset-1 rounded-full bg-amber-400/80 animate-ping pointer-events-none" />
                      )}

                      <div
                        className={`w-2.5 h-2.5 rounded-full border transition-all ${
                          allCompleted
                            ? 'bg-emerald-400 border-slate-950'
                            : isDueNow
                            ? 'bg-amber-300 border-white'
                            : isNextUpcoming
                            ? 'bg-amber-400 border-white shadow-[0_0_8px_rgba(245,158,11,0.9)]'
                            : hasAdditions
                            ? 'bg-amber-400 border-slate-950 shadow-[0_0_5px_rgba(245,158,11,0.6)]'
                            : 'bg-cyan-400 border-slate-950 shadow-[0_0_5px_rgba(6,182,212,0.6)]'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
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
          /* Case B: Stopwatch Stages (Sparge, Cooling Recirc, Knockout) - Full Card-Width Digits */
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
            <div className="text-[11px] font-mono text-amber-400 font-bold uppercase tracking-wider mb-1 flex items-center space-x-1">
              <Thermometer className="w-3.5 h-3.5 mr-1" />
              <span>Mash {mashTemp}°C + Offset {strikeOffset >= 0 ? `+${strikeOffset}` : strikeOffset}°C</span>
            </div>

            {/* Stepper buttons flanking the strike temperature with large touch targets */}
            <div className="flex items-center justify-center space-x-2.5 my-0.5">
              <button
                type="button"
                onClick={() => setStrikeOffset(strikeOffset - 0.5)}
                className="w-14 h-10 sm:h-11 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 text-sm font-black font-mono text-amber-400 touch-press shadow flex items-center justify-center"
                title="Decrease strike offset"
              >
                -0.5°
              </button>

              <div className="font-mono font-black text-4xl sm:text-5xl text-amber-300 hud-glow tracking-tight px-1 leading-none">
                {targetStrikeTemp.toFixed(1)}°C
              </div>

              <button
                type="button"
                onClick={() => setStrikeOffset(strikeOffset + 0.5)}
                className="w-14 h-10 sm:h-11 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 text-sm font-black font-mono text-amber-400 touch-press shadow flex items-center justify-center"
                title="Increase strike offset"
              >
                +0.5°
              </button>
            </div>
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
        {/* Case 0: Session Finished -> Prominent Telemetry & Audit Report button */}
        {isSessionDone ? (
          <button
            onClick={() => onOpenReportModal?.()}
            className="w-full min-h-[50px] sm:min-h-[54px] py-2.5 rounded-xl font-mono font-black text-sm sm:text-base tracking-wider uppercase transition-all touch-press flex items-center justify-center space-x-2 border bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.4)]"
          >
            <FileText className="w-5 h-5 stroke-[2.5]" />
            <span>VIEW AUDIT & TELEMETRY</span>
          </button>
        ) : flow.kind === 'confirm' ? (
          /* Case 1: Confirm Stages (Single dominant button) */
          <button
            onClick={guardAdvance(confirmFlowStage)}
            className="w-full min-h-[50px] sm:min-h-[54px] py-2.5 rounded-xl font-mono font-black text-sm sm:text-base tracking-widest uppercase transition-all touch-press flex items-center justify-center space-x-2 border bg-emerald-950/80 hover:bg-emerald-900 active:bg-emerald-800 text-emerald-200 border-emerald-500/70 shadow-[0_0_20px_rgba(16,185,129,0.35)]"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400 stroke-[2.5]" />
            <span>{flow.startLabel}</span>
          </button>
        ) : flow.kind === 'countdown' ? (
          /* Case 2: Countdown Stages */
          <>
            {isCountdownDone ? (
              // Finished Countdown State -> NEXT Button
              <button
                onClick={guardAdvance(nextStage)}
                className="w-full min-h-[50px] sm:min-h-[54px] py-2.5 rounded-xl font-mono font-black text-sm sm:text-base tracking-widest uppercase transition-all touch-press flex items-center justify-center space-x-2 border bg-emerald-950/80 hover:bg-emerald-900 active:bg-emerald-800 text-emerald-200 border-emerald-500/70 shadow-[0_0_20px_rgba(16,185,129,0.35)]"
              >
                <span>{flow.nextLabel || 'NEXT STAGE'}</span>
                <ArrowRight className="w-5 h-5 text-emerald-400 stroke-[2.5]" />
              </button>
            ) : timerStatus === 'running' ? (
              // Running Countdown State -> PAUSE button + Extension Buttons side-by-side
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => pauseTimer()}
                  className="flex-1 min-h-[48px] py-2 rounded-xl font-mono font-black text-xs sm:text-sm tracking-wider uppercase transition-all touch-press flex items-center justify-center space-x-1.5 border bg-amber-950/70 hover:bg-amber-900/80 active:bg-amber-800/90 text-amber-300 border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                >
                  <Pause className="w-4 h-4 fill-current" />
                  <span>{flow.pauseLabel || 'PAUSE'}</span>
                </button>
                <button
                  onClick={() => extendTimer(60)}
                  className="px-3.5 min-h-[48px] py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-slate-200 hover:text-amber-300 border border-slate-800 text-xs font-mono font-bold touch-press"
                  title="Add 1 minute"
                >
                  +1m
                </button>
                <button
                  onClick={() => extendTimer(300)}
                  className="px-3.5 min-h-[48px] py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-slate-200 hover:text-amber-300 border border-slate-800 text-xs font-mono font-bold touch-press"
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
                  className="flex-1 min-h-[48px] py-2 rounded-xl font-mono font-black text-xs sm:text-sm tracking-widest uppercase transition-all touch-press flex items-center justify-center space-x-1.5 border bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-200 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{flow.resumeLabel || 'RESUME'}</span>
                </button>
                <button
                  onClick={() => extendTimer(60)}
                  className="px-3.5 min-h-[48px] py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-amber-300 border border-slate-800 text-xs font-mono font-bold touch-press"
                >
                  +1m
                </button>
                <button
                  onClick={() => extendTimer(300)}
                  className="px-3.5 min-h-[48px] py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-amber-300 border border-slate-800 text-xs font-mono font-bold touch-press"
                >
                  +5m
                </button>
              </div>
            ) : (
              // Ready Countdown State -> START button
              <button
                onClick={() => startTimer()}
                className="w-full min-h-[50px] sm:min-h-[54px] py-2.5 rounded-xl font-mono font-black text-sm sm:text-base tracking-widest uppercase transition-all touch-press flex items-center justify-center space-x-2 border bg-emerald-950/80 hover:bg-emerald-900 active:bg-emerald-800 text-emerald-200 border-emerald-500/70 shadow-[0_0_20px_rgba(16,185,129,0.35)]"
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
                onClick={guardAdvance(nextStage)}
                className="w-full min-h-[50px] sm:min-h-[54px] py-2.5 rounded-xl font-mono font-black text-sm sm:text-base tracking-widest uppercase transition-all touch-press flex items-center justify-center space-x-2 border bg-emerald-950/80 hover:bg-emerald-900 active:bg-emerald-800 text-emerald-200 border-emerald-500/70 shadow-[0_0_20px_rgba(16,185,129,0.35)]"
              >
                <span>{flow.nextLabel || 'NEXT STAGE'}</span>
                <ArrowRight className="w-5 h-5 text-emerald-400 stroke-[2.5]" />
              </button>
            ) : timerStatus === 'running' ? (
              // Running Stopwatch State -> STOP Button
              <button
                onClick={() => stopStopwatch()}
                className="w-full min-h-[50px] sm:min-h-[54px] py-2.5 rounded-xl font-mono font-black text-sm sm:text-base tracking-widest uppercase transition-all touch-press flex items-center justify-center space-x-2 border bg-amber-950/80 hover:bg-amber-900 active:bg-amber-800 text-amber-200 border-amber-500/70 shadow-[0_0_20px_rgba(245,158,11,0.35)]"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>{flow.stopLabel || 'STOP'}</span>
              </button>
            ) : (
              // Ready Stopwatch State -> START Button
              <button
                onClick={() => startTimer()}
                className="w-full min-h-[50px] sm:min-h-[54px] py-2.5 rounded-xl font-mono font-black text-sm sm:text-base tracking-widest uppercase transition-all touch-press flex items-center justify-center space-x-2 border bg-cyan-950/80 hover:bg-cyan-900 active:bg-cyan-800 text-cyan-200 border-cyan-500/70 shadow-[0_0_20px_rgba(6,182,212,0.35)]"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>{flow.startLabel}</span>
              </button>
            )}
          </>
        )}

        {/* 4. Subtle Early Exit Link (Only shown when running or paused, never when idle or finished) */}
        {(timerStatus === 'running' || timerStatus === 'paused') && !isSessionDone ? (
          <div className="flex justify-center pt-0.5">
            <button
              type="button"
              onClick={onConfirmAdvance}
              className="text-[10px] font-mono text-gray-500 hover:text-gray-300 underline flex items-center space-x-1"
            >
              <AlertTriangle className="w-3 h-3 text-amber-500/60" />
              <span>Leave stage early...</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
