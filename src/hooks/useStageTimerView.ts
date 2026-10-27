import { useMemo } from 'react';
import { useBrewStore, ADDITION_SUMMARY_CHECKLIST_IDS } from '../store/brewStore';
import type { BrewStage, ChecklistItem, FlowStep, StageAddition } from '../types/session';

export interface UpcomingTimedEvent {
  id: string;
  kind: 'addition' | 'reminder';
  label: string;
  triggerRemainingSec: number;
  waitSec: number;
}

export interface MilestoneGroup {
  triggerRemainingSec: number;
  triggerPos: number;
  additions: StageAddition[];
  checklist: ChecklistItem[];
}

// Format MM:SS or HH:MM:SS
export const formatTime = (totalSeconds: number) => {
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

export const formatWaitCountdown = (waitSeconds: number) => {
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

// Defensive flow fallback ensures action buttons NEVER disappear if stage.flow is missing
export const getStageFlow = (stage: BrewStage | undefined): FlowStep => stage?.flow || {
  id: stage?.id || 'stage',
  kind: stage?.timerType === 'stopwatch' ? 'stopwatch' : stage?.isTimed ? 'countdown' : 'confirm',
  startLabel: stage?.timerType === 'stopwatch' ? 'START' : stage?.isTimed ? 'START' : 'CONFIRM',
  pauseLabel: 'PAUSE',
  resumeLabel: 'RESUME',
  stopLabel: 'STOP',
  nextLabel: 'NEXT',
  startLog: `${stage?.title || 'Stage'} started`,
  endLog: `${stage?.title || 'Stage'} complete`,
  endAlert: `${stage?.title || 'Stage'} complete!`
};

// Timer, progress and next-event state for the current stage, shared by the Full step cockpit and the By stage screen
export const useStageTimerView = () => {
  const stages = useBrewStore(state => state.stages);
  const currentStageIndex = useBrewStore(state => state.currentStageIndex);
  const timerStatus = useBrewStore(state => state.timerStatus);
  const timerRemainingSec = useBrewStore(state => state.timerRemainingSec);
  const timerTotalSec = useBrewStore(state => state.timerTotalSec);
  const finishedAt = useBrewStore(state => state.finishedAt);

  const currentStage = stages[currentStageIndex];
  const flow = getStageFlow(currentStage);

  const flowPhase = currentStage?.flowPhase || (timerStatus === 'running' ? 'running' : timerStatus === 'paused' ? 'paused' : 'ready');
  const isSessionDone = finishedAt !== null || (currentStage?.id === 'CLEANUP' && currentStage?.status === 'completed');
  const isCountdownDone = flow.kind === 'countdown' && (flowPhase === 'finished' || timerRemainingSec <= 0);

  const activeRemainingSec = timerStatus === 'idle' && flowPhase !== 'finished' ? timerTotalSec : timerRemainingSec;
  const displayTimeStr = formatTime(activeRemainingSec);
  const isLongTimeFormat = displayTimeStr.length > 5;

  // Compute progress percentage & milestone markers for Countdown stages
  const totalSec = Math.max(1, timerTotalSec || currentStage?.plannedDurationSec || 1);
  const elapsedSec = Math.max(0, Math.min(totalSec, totalSec - activeRemainingSec));
  const countdownProgressPct = flow.kind === 'countdown' ? Math.min(100, Math.max(0, (elapsedSec / totalSec) * 100)) : 0;

  const additionReminderIds = ADDITION_SUMMARY_CHECKLIST_IDS;

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
  const upcomingTimedEvents: UpcomingTimedEvent[] = [];

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

  const nextTimedEvent: UpcomingTimedEvent | undefined = upcomingTimedEvents[0];

  // Group all timed milestones (additions & timed checklist items) by triggerRemainingSec
  // to avoid overlapping DOM elements and compounded box-shadow artifacts,
  // and highlight the next upcoming milestone marker so it matches the banner below.
  const milestoneGroups = useMemo<MilestoneGroup[]>(() => {
    if (!currentStage || totalSec <= 0) return [];

    const map = new Map<number, MilestoneGroup>();

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

  return {
    stages,
    currentStageIndex,
    currentStage,
    flow,
    flowPhase,
    timerStatus,
    timerRemainingSec,
    isSessionDone,
    isCountdownDone,
    activeRemainingSec,
    displayTimeStr,
    isLongTimeFormat,
    countdownProgressPct,
    immediateUncheckedReminder,
    nextTimedEvent,
    milestoneGroups
  };
};
