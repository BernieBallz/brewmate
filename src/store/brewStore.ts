import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { BrewfatherRecipe } from '../types/brewfather';
import type {
  BrewSessionState,
  StageAddition,
  SessionAuditLogItem,
  SessionMeasurements,
  TaskAlertPrompt,
  BrewStage,
  ChecklistItem
} from '../types/session';
import { parseBrewfatherRecipe } from '../utils/brewfatherParser';
import { audioAlarm } from '../utils/audioAlarm';
import { vibrate, VIBRATION_PATTERNS } from '../utils/vibration';
import { wakeLockManager } from '../utils/wakeLock';
import { notificationManager } from '../utils/notificationManager';
import { createCoalescedStorage } from './coalescedStorage';

interface BrewStoreActions {
  // Initialization & Recipe
  loadRecipe: (recipe: BrewfatherRecipe) => void;
  resetSession: () => void;
  removeRecipe: () => void;

  // Timer & Flow controls
  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopStopwatch: () => void;
  confirmFlowStage: () => void;
  finishBrew: () => void;
  extendTimer: (additionalSeconds: number) => void;
  tick: () => void;
  reconcileTimerWithWallClock: () => void;

  // Stage Navigation
  goToStage: (index: number) => void;
  nextStage: () => void;
  prevStage: () => void;

  // Checklist & Additions
  toggleChecklistItem: (checklistId: string) => void;
  confirmAddition: (additionId: string) => void;
  unconfirmAddition: (additionId: string) => void;
  confirmAdditions: (additionIds: string[]) => void;
  confirmAllDueAdditions: () => void;
  dismissAlertModal: () => void;
  confirmTaskAlert: (checklistId: string) => void;
  dismissTaskAlert: () => void;

  // Strike Offset & Parameters
  setStrikeOffset: (offset: number) => void;
  setTargetStrikeTemp: (temp: number) => void;

  // Measurements & Logging
  setMeasurement: (key: keyof SessionMeasurements, value: number) => void;
  addAuditLog: (type: SessionAuditLogItem['type'], message: string, metadata?: Record<string, any>) => void;

  // Hardware Toggles
  toggleWakeLock: () => Promise<void>;
  toggleAudio: () => void;
  toggleVibration: () => void;
}

// How long Snooze holds back an addition or task alert before it fires again
export const ALERT_SNOOZE_MIN = 2;

const isSnoozed = (snoozedUntil: Record<string, number> | undefined, id: string, now: number): boolean =>
  (snoozedUntil?.[id] ?? 0) > now;

// Checklist items that summarise a stage's additions; they tick themselves once every addition is confirmed
export const ADDITION_SUMMARY_CHECKLIST_IDS = ['water-treat', 'mash-additions-check', 'boil-additions-monitor', 'whirlpool-additions', 'pitch-additions'];

// Unconfirmed additions in a stage; used to warn before moving on
export const getUnconfirmedAdditions = (stage: BrewStage | undefined): StageAddition[] =>
  stage?.additions?.filter(a => !a.confirmed) ?? [];

// Unticked reminders in a stage. Addition-summary items are skipped when the stage has additions (the
// additions list already covers them); without additions they are ordinary manual reminders.
export const getUncheckedReminders = (stage: BrewStage | undefined): ChecklistItem[] => {
  const hasAdditions = (stage?.additions?.length ?? 0) > 0;
  return stage?.checklist?.filter(c => !c.checked && !(hasAdditions && ADDITION_SUMMARY_CHECKLIST_IDS.includes(c.id))) ?? [];
};

// True when leaving the stage now would leave additions unconfirmed or reminders unticked
export const hasIncompleteStageItems = (stage: BrewStage | undefined): boolean =>
  getUnconfirmedAdditions(stage).length > 0 || getUncheckedReminders(stage).length > 0;

const initialStrikeOffset = 10;

function formatTimerDisplay(seconds: number): string {
  const isNegative = seconds < 0;
  const absSec = Math.abs(seconds);
  const mins = Math.floor(absSec / 60);
  const secs = absSec % 60;
  const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  return isNegative ? `+${formatted} over` : formatted;
}

function getNextMilestoneSummary(stage: BrewStage | undefined, remainingSec: number): string {
  if (!stage) return 'Brew Session Active';

  if (stage.additions && stage.additions.length > 0) {
    const dueNow = stage.additions.find(a => !a.confirmed && remainingSec <= a.triggerRemainingSec);
    if (dueNow) {
      return `DUE NOW: ${dueNow.amount}${dueNow.unit || 'g'} ${dueNow.name}`;
    }
    const upcoming = stage.additions
      .filter(a => !a.confirmed && a.triggerRemainingSec < remainingSec)
      .sort((a, b) => b.triggerRemainingSec - a.triggerRemainingSec)[0];
    if (upcoming) {
      const waitMin = Math.ceil((remainingSec - upcoming.triggerRemainingSec) / 60);
      const shortName = upcoming.name.replace(/\s*\([^)]*\)\s*/g, '').trim();
      return `${upcoming.amount}${upcoming.unit || 'g'} ${shortName} in ${waitMin}m`;
    }
  }

  if (stage.checklist && stage.checklist.length > 0) {
    const dueTask = stage.checklist.find(
      c => !c.checked && c.triggerRemainingSec !== undefined && remainingSec <= c.triggerRemainingSec
    );
    if (dueTask) {
      return `DUE NOW: ${dueTask.label}`;
    }
    const upcomingTask = stage.checklist
      .filter(c => !c.checked && c.triggerRemainingSec !== undefined && c.triggerRemainingSec < remainingSec)
      .sort((a, b) => (b.triggerRemainingSec || 0) - (a.triggerRemainingSec || 0))[0];
    if (upcomingTask) {
      const waitMin = Math.ceil((remainingSec - (upcomingTask.triggerRemainingSec || 0)) / 60);
      return `${upcomingTask.label} in ${waitMin}m`;
    }
  }

  return 'Stage in progress';
}

function sameAdditionIds(a: StageAddition[], b: StageAddition[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id) return false;
  }
  return true;
}

function sameTaskAlert(a: TaskAlertPrompt | null, b: TaskAlertPrompt | null): boolean {
  if (a === null || b === null) return a === b;
  return a.checklistId === b.checklistId && a.remainingMin === b.remainingMin;
}

const coalescedLocalStorage = createCoalescedStorage(
  () => (typeof localStorage !== 'undefined' ? localStorage : undefined),
  1000
);

export const useBrewStore = create<BrewSessionState & BrewStoreActions>()(
  persist(
    (set, get) => ({
      // Starts with no recipe; the app shows its welcome screen until one is loaded
      recipe: null,
      sessionId: `brew-${Date.now()}`,
      sessionStartTime: null,
      sessionEndTime: null,
      finishedAt: null,
      strikeOffset: initialStrikeOffset,
      currentStageIndex: 0,
      stages: [],
      measurements: {},
      auditLogs: [],

      timerStatus: 'idle',
      timerRemainingSec: 0,
      timerTotalSec: 0,
      timerStartedAtWallClock: null,
      timerAccumulatedElapsedSec: 0,

      wakeLockActive: false,
      audioEnabled: true,
      vibrationEnabled: true,
      activeAlertAdditions: [],
      dismissedAdditionIds: [],
      activeTaskAlert: null,
      dismissedTaskAlertIds: [],
      alertSnoozedUntil: {},

      loadRecipe: (recipe: BrewfatherRecipe) => {
        notificationManager.clearLiveTimerNotification();

        const offset = get().strikeOffset || 10;
        const parsedStages = parseBrewfatherRecipe(recipe, offset);
        const firstStage = parsedStages[0];
        set({
          recipe,
          sessionId: `brew-${Date.now()}`,
          sessionStartTime: null,
          sessionEndTime: null,
          finishedAt: null,
          currentStageIndex: 0,
          stages: parsedStages,
          measurements: {},
          auditLogs: [
            {
              timestamp: Date.now(),
              stageId: firstStage.id,
              type: 'NOTE',
              message: `Loaded recipe "${recipe.name}" (${recipe.batchSize}L)`
            }
          ],
          timerStatus: 'idle',
          timerRemainingSec: firstStage.timerType === 'countdown' ? firstStage.plannedDurationSec : 0,
          timerTotalSec: firstStage.timerType === 'countdown' ? firstStage.plannedDurationSec : 0,
          timerStartedAtWallClock: null,
          timerAccumulatedElapsedSec: 0,
          activeAlertAdditions: [],
          dismissedAdditionIds: [],
          activeTaskAlert: null,
          dismissedTaskAlertIds: [],
          alertSnoozedUntil: {}
        });
      },

      resetSession: () => {
        const currentRecipe = get().recipe;
        if (currentRecipe) {
          get().loadRecipe(currentRecipe);
        }
      },

      // Clear the recipe and its whole session from this device; the app returns to the welcome screen.
      // Device preferences (strike offset, audio, vibration) are kept.
      removeRecipe: () => {
        notificationManager.clearLiveTimerNotification();
        if (get().wakeLockActive) {
          void wakeLockManager.releaseLock();
        }
        set({
          recipe: null,
          sessionId: `brew-${Date.now()}`,
          sessionStartTime: null,
          sessionEndTime: null,
          finishedAt: null,
          currentStageIndex: 0,
          stages: [],
          measurements: {},
          auditLogs: [],
          timerStatus: 'idle',
          timerRemainingSec: 0,
          timerTotalSec: 0,
          timerStartedAtWallClock: null,
          timerAccumulatedElapsedSec: 0,
          wakeLockActive: false,
          activeAlertAdditions: [],
          dismissedAdditionIds: [],
          activeTaskAlert: null,
          dismissedTaskAlertIds: [],
          alertSnoozedUntil: {}
        });
      },

      startTimer: () => {
        const state = get();
        const now = Date.now();
        const stage = state.stages[state.currentStageIndex];

        if (state.audioEnabled) {
          audioAlarm.unlock();
          audioAlarm.playClick();
        }

        notificationManager.resetLiveTimerDismissal();
        notificationManager.requestPermission();

        if (!state.wakeLockActive) {
          wakeLockManager.requestLock().then((active) => {
            set({ wakeLockActive: active });
          });
        }

        const updatedStages = [...state.stages];
        updatedStages[state.currentStageIndex] = {
          ...stage,
          status: 'active',
          flowPhase: 'running',
          startedAt: stage.startedAt || now
        };

        const initialTimerSec = stage.timerType === 'countdown' ? stage.plannedDurationSec : 0;
        const nextInfo = getNextMilestoneSummary(stage, initialTimerSec);
        const timeDisplay = formatTimerDisplay(initialTimerSec);
        notificationManager.updateLiveTimerNotification(stage.title, timeDisplay, nextInfo, stage.timerType, 'running');

        set({
          sessionStartTime: state.sessionStartTime || now,
          stages: updatedStages,
          timerStatus: 'running',
          timerStartedAtWallClock: now
        });

        get().addAuditLog(
          'STAGE_START',
          stage.flow?.startLog || `Started stage: ${stage.title}`,
          { stageId: stage.id, plannedDurationSec: stage.plannedDurationSec }
        );
      },

      pauseTimer: () => {
        const state = get();
        if (state.timerStatus !== 'running' || !state.timerStartedAtWallClock) return;

        const now = Date.now();
        const additionalElapsed = Math.floor((now - state.timerStartedAtWallClock) / 1000);
        const totalElapsed = state.timerAccumulatedElapsedSec + additionalElapsed;
        const currentStage = state.stages[state.currentStageIndex];
        const remaining = currentStage.timerType === 'countdown'
          ? Math.max(0, state.timerTotalSec - totalElapsed)
          : totalElapsed;

        if (state.audioEnabled) {
          audioAlarm.playClick();
        }

        const updatedStages = [...state.stages];
        updatedStages[state.currentStageIndex] = {
          ...currentStage,
          actualDurationSec: totalElapsed,
          flowPhase: 'paused'
        };

        const timeDisplay = formatTimerDisplay(remaining);
        notificationManager.updateLiveTimerNotification(currentStage.title, timeDisplay, 'Paused • Tap to resume', currentStage.timerType, 'paused');

        set({
          stages: updatedStages,
          timerStatus: 'paused',
          timerStartedAtWallClock: null,
          timerAccumulatedElapsedSec: totalElapsed,
          timerRemainingSec: remaining
        });

        get().addAuditLog('NOTE', `Paused timer in stage "${currentStage.title}"`);
      },

      resumeTimer: () => {
        const state = get();
        if (state.timerStatus !== 'paused') return;

        const now = Date.now();
        if (state.audioEnabled) {
          audioAlarm.unlock();
          audioAlarm.playClick();
        }

        notificationManager.resetLiveTimerDismissal();
        notificationManager.requestPermission();

        if (!state.wakeLockActive || !wakeLockManager.isActive()) {
          wakeLockManager.requestLock().then((active) => {
            set({ wakeLockActive: active });
          });
        }

        const currentStage = state.stages[state.currentStageIndex];
        let accumulated = state.timerAccumulatedElapsedSec;
        if (currentStage.timerType === 'countdown' && accumulated === 0 && state.timerRemainingSec < state.timerTotalSec) {
          accumulated = state.timerTotalSec - state.timerRemainingSec;
        }

        const updatedStages = [...state.stages];
        updatedStages[state.currentStageIndex] = {
          ...currentStage,
          flowPhase: 'running'
        };

        const nextInfo = getNextMilestoneSummary(currentStage, state.timerRemainingSec);
        const timeDisplay = formatTimerDisplay(state.timerRemainingSec);
        notificationManager.updateLiveTimerNotification(currentStage.title, timeDisplay, nextInfo, currentStage.timerType, 'running');

        set({
          stages: updatedStages,
          timerStatus: 'running',
          timerStartedAtWallClock: now,
          timerAccumulatedElapsedSec: accumulated
        });

        get().addAuditLog('NOTE', `Resumed timer in stage ${currentStage.title}`);
      },

      stopStopwatch: () => {
        const state = get();
        if (state.timerStatus !== 'running' || !state.timerStartedAtWallClock) return;

        const now = Date.now();
        const additionalElapsed = Math.floor((now - state.timerStartedAtWallClock) / 1000);
        const totalElapsed = state.timerAccumulatedElapsedSec + additionalElapsed;
        const currentStage = state.stages[state.currentStageIndex];

        if (state.audioEnabled) {
          audioAlarm.playClick();
        }

        const updatedStages = [...state.stages];
        updatedStages[state.currentStageIndex] = {
          ...currentStage,
          actualDurationSec: totalElapsed,
          flowPhase: 'finished',
          status: 'completed',
          endedAt: now
        };

        const mins = Math.floor(totalElapsed / 60);
        const secs = totalElapsed % 60;
        const timeDisplay = formatTimerDisplay(totalElapsed);
        notificationManager.updateLiveTimerNotification(currentStage.title, timeDisplay, `${currentStage.flow.endAlert || 'Complete'}`, 'stopwatch', 'finished');

        set({
          stages: updatedStages,
          timerStatus: 'idle',
          timerStartedAtWallClock: null,
          timerAccumulatedElapsedSec: totalElapsed,
          timerRemainingSec: totalElapsed
        });

        get().addAuditLog(
          'MEASUREMENT_RECORDED',
          `${currentStage.flow.endLog || 'Time stored'}: ${mins}m ${secs}s`,
          { stageId: currentStage.id, durationSec: totalElapsed }
        );
      },

      confirmFlowStage: () => {
        const state = get();
        const currentStage = state.stages[state.currentStageIndex];
        const now = Date.now();

        if (state.audioEnabled) {
          audioAlarm.unlock();
          audioAlarm.playClick();
        }

        if (currentStage.id === 'CLEANUP') {
          get().finishBrew();
          return;
        }

        const updatedStages = [...state.stages];
        const started = currentStage.startedAt || state.sessionStartTime || now;
        const actualSec = currentStage.actualDurationSec || Math.max(0, Math.floor((now - started) / 1000));
        updatedStages[state.currentStageIndex] = {
          ...currentStage,
          status: 'completed',
          flowPhase: 'finished',
          startedAt: started,
          endedAt: now,
          actualDurationSec: actualSec
        };

        set({ 
          stages: updatedStages,
          sessionStartTime: state.sessionStartTime || started
        });

        get().addAuditLog(
          'STAGE_END',
          currentStage.flow.endLog || `${currentStage.title} complete`,
          { stageId: currentStage.id, actualDurationSec: actualSec }
        );

        const nextIdx = state.currentStageIndex + 1;
        if (nextIdx < state.stages.length) {
          get().goToStage(nextIdx);
        }
      },

      finishBrew: () => {
        const state = get();
        const now = Date.now();
        const currentStage = state.stages[state.currentStageIndex];

        const updatedStages = [...state.stages];
        const started = currentStage.startedAt || now;
        const actualSec = currentStage.actualDurationSec || Math.max(0, Math.floor((now - started) / 1000));
        updatedStages[state.currentStageIndex] = {
          ...currentStage,
          status: 'completed',
          flowPhase: 'finished',
          startedAt: started,
          endedAt: now,
          actualDurationSec: actualSec
        };

        set({
          stages: updatedStages,
          sessionStartTime: state.sessionStartTime || started,
          sessionEndTime: now,
          finishedAt: now,
          timerStatus: 'idle'
        });

        if (state.audioEnabled) {
          audioAlarm.playStageComplete();
        }
        if (state.vibrationEnabled) {
          vibrate(VIBRATION_PATTERNS.STAGE_COMPLETE);
        }

        notificationManager.sendNotification('Brew Complete', {
          body: 'Brew session completed! Review session audit report.',
          tag: 'brew-complete'
        });

        get().addAuditLog(
          'STAGE_END',
          currentStage.flow.endLog || 'Session finished',
          { stageId: currentStage.id, finishedAt: now }
        );
      },

      extendTimer: (additionalSeconds: number) => {
        const state = get();
        const currentStage = state.stages[state.currentStageIndex];
        const newRemaining = state.timerRemainingSec + additionalSeconds;
        const newTotal = state.timerTotalSec + additionalSeconds;

        if (state.audioEnabled) {
          audioAlarm.playTone(587.33, 'sine', 0.15, 0.2);
        }
        if (state.vibrationEnabled) {
          vibrate(VIBRATION_PATTERNS.SHORT_CLICK);
        }

        const updatedStages = [...state.stages];
        updatedStages[state.currentStageIndex] = {
          ...currentStage,
          plannedDurationSec: currentStage.plannedDurationSec + additionalSeconds,
          flowPhase: newRemaining > 0 ? 'running' : currentStage.flowPhase
        };

        set({
          stages: updatedStages,
          timerRemainingSec: newRemaining,
          timerTotalSec: newTotal
        });

        const nextInfo = getNextMilestoneSummary(currentStage, Math.max(0, newRemaining));
        const timeDisplay = formatTimerDisplay(newRemaining);
        const notifStatus = state.timerStatus === 'paused' ? 'paused' : 'running';
        notificationManager.updateLiveTimerNotification(
          currentStage.title,
          timeDisplay,
          state.timerStatus === 'paused' ? 'Paused • Tap Resume' : nextInfo,
          currentStage.timerType,
          notifStatus
        );

        get().addAuditLog(
          'STAGE_EXTEND',
          `Extended stage "${currentStage.title}" by +${Math.floor(additionalSeconds / 60)} min`,
          { addedSec: additionalSeconds }
        );
      },

      tick: () => {
        const state = get();
        if (state.timerStatus !== 'running' || !state.timerStartedAtWallClock) return;

        const now = Date.now();
        const elapsedSinceResume = Math.floor((now - state.timerStartedAtWallClock) / 1000);
        const totalElapsed = state.timerAccumulatedElapsedSec + elapsedSinceResume;
        const currentStage = state.stages[state.currentStageIndex];

        // 1. STOPWATCH MODE
        if (currentStage.timerType === 'stopwatch') {
          const timeDisplay = formatTimerDisplay(totalElapsed);

          if (totalElapsed !== state.timerRemainingSec) {
            notificationManager.updateLiveTimerNotification(currentStage.title, timeDisplay, 'Stopwatch running', 'stopwatch', 'running');
          }

          // Tick fires every 250 ms but the displayed second changes once per second:
          // skip the write (and the re-render / persist it triggers) when nothing changed.
          if (totalElapsed === state.timerRemainingSec) return;
          set({
            timerRemainingSec: totalElapsed
          });
          return;
        }

        // 2. COUNTDOWN MODE
        const rawRemaining = state.timerTotalSec - totalElapsed;
        const remaining = rawRemaining;
        const timeDisplay = formatTimerDisplay(rawRemaining);
        const nextInfo = getNextMilestoneSummary(currentStage, Math.max(0, rawRemaining));

        if (rawRemaining !== state.timerRemainingSec) {
          notificationManager.updateLiveTimerNotification(currentStage.title, timeDisplay, nextInfo, 'countdown', 'running');
        }

        // Check for additions triggering in this stage
        const dueAdditions: StageAddition[] = [];
        if (currentStage.additions && currentStage.additions.length > 0) {
          for (const addition of currentStage.additions) {
            if (
              !addition.confirmed &&
              remaining <= addition.triggerRemainingSec &&
              !state.dismissedAdditionIds.includes(addition.id) &&
              !isSnoozed(state.alertSnoozedUntil, addition.id, now)
            ) {
              dueAdditions.push(addition);
            }
          }
        }

        const currentAlertIds = new Set(state.activeAlertAdditions.map(a => a.id));
        const hasNewAlert = dueAdditions.some(a => !currentAlertIds.has(a.id));

        if (hasNewAlert && dueAdditions.length > 0) {
          if (state.audioEnabled) {
            audioAlarm.unlock().then(() => {
              audioAlarm.playAdditionAlert();
            });
          }
          if (state.vibrationEnabled) {
            vibrate(VIBRATION_PATTERNS.ADDITION_ALERT);
          }
          // Grainfather punchy copy: "Add 20g Citra"
          const primaryAddition = dueAdditions[0];
          const additionSummary = dueAdditions.length === 1
            ? `Add ${primaryAddition.amount}${primaryAddition.unit || ''} ${primaryAddition.name}`
            : dueAdditions.map(a => `Add ${a.amount}${a.unit || ''} ${a.name}`).join(' • ');

          notificationManager.sendNotification(additionSummary, {
            body: `${currentStage.title}: ${dueAdditions.map(a => `${a.name} (${a.amount}${a.unit || ''})`).join(', ')}`,
            tag: 'addition-alert-' + dueAdditions.map(a => a.id).join('-')
          });
        }

        // Check for timed checklist task alerts (e.g. Vorlauf reminder in Mash Rest)
        let triggeredTaskAlert: TaskAlertPrompt | null = null;
        if (currentStage.checklist && currentStage.checklist.length > 0) {
          for (const item of currentStage.checklist) {
            if (
              !item.checked &&
              item.triggerRemainingSec !== undefined &&
              remaining <= item.triggerRemainingSec &&
              !state.dismissedTaskAlertIds.includes(item.id) &&
              !isSnoozed(state.alertSnoozedUntil, item.id, now)
            ) {
              triggeredTaskAlert = {
                checklistId: item.id,
                title: item.alertTitle || `${currentStage.title.toUpperCase()}`,
                headline: item.alertHeadline || item.label,
                message: item.alertMessage || item.label,
                actionLabel: item.alertActionLabel || 'START VORLAUF',
                remainingMin: Math.ceil(remaining / 60)
              };
              break;
            }
          }
        }

        const isNewTaskAlert = Boolean(triggeredTaskAlert && state.activeTaskAlert?.checklistId !== triggeredTaskAlert.checklistId);
        if (isNewTaskAlert && triggeredTaskAlert) {
          if (state.audioEnabled) {
            audioAlarm.unlock().then(() => {
              audioAlarm.playAdditionAlert();
            });
          }
          if (state.vibrationEnabled) {
            vibrate(VIBRATION_PATTERNS.ADDITION_ALERT);
          }
          notificationManager.sendNotification(triggeredTaskAlert.headline, {
            body: `${triggeredTaskAlert.title} (${triggeredTaskAlert.remainingMin}m remaining)`,
            tag: 'task-alert-' + triggeredTaskAlert.checklistId
          });
        }

        // Check if countdown hit 0
        const isCompletingNow = remaining <= 0 && state.timerRemainingSec > 0;
        let nextStages = state.stages;

        if (isCompletingNow) {
          const endAlertText = currentStage.flow?.endAlert || 'Stage Complete';
          
          // Collision rule: if Boil finishes and flameout additions exist, combined alert
          const flameoutAdditions = dueAdditions.filter(a => a.triggerRemainingSec === 0);
          const notificationTitle = currentStage.id === 'BOIL' && flameoutAdditions.length > 0
            ? 'Flameout'
            : endAlertText;
          const notificationBody = flameoutAdditions.length > 0
            ? `Flameout: ${flameoutAdditions.map(a => `${a.amount}${a.unit || ''} ${a.name}`).join(', ')}`
            : `${currentStage.title} complete. Tap to advance.`;

          notificationManager.updateLiveTimerNotification(currentStage.title, '00:00', endAlertText, 'countdown', 'finished');

          if (state.audioEnabled) {
            audioAlarm.unlock().then(() => {
              audioAlarm.playStageComplete();
            });
          }
          if (state.vibrationEnabled) {
            vibrate(VIBRATION_PATTERNS.STAGE_COMPLETE);
          }

          notificationManager.sendNotification(notificationTitle, {
            body: notificationBody,
            tag: 'stage-complete-' + currentStage.id
          });

          // Mark stage flowPhase as finished
          const updatedStages = [...state.stages];
          const startedAtTime = currentStage.startedAt || (state.timerStartedAtWallClock ? state.timerStartedAtWallClock - (state.timerAccumulatedElapsedSec * 1000) : now - (totalElapsed * 1000));
          updatedStages[state.currentStageIndex] = {
            ...currentStage,
            flowPhase: 'finished',
            startedAt: startedAtTime,
            endedAt: now,
            actualDurationSec: totalElapsed
          };
          nextStages = updatedStages;
        }

        // Skip no-op ticks: 3 of every 4 ticks (250 ms interval) land in the same displayed
        // second with no alert changes. Writing then would allocate a new activeAlertAdditions
        // array, re-render every subscriber and re-serialise the persisted state for nothing.
        if (
          !isCompletingNow &&
          remaining === state.timerRemainingSec &&
          sameAdditionIds(dueAdditions, state.activeAlertAdditions) &&
          sameTaskAlert(triggeredTaskAlert, state.activeTaskAlert)
        ) {
          return;
        }

        // Decoupled tick update
        set({
          stages: nextStages,
          timerRemainingSec: remaining,
          activeAlertAdditions: dueAdditions,
          activeTaskAlert: triggeredTaskAlert
        });
      },

      reconcileTimerWithWallClock: () => {
        const state = get();
        if (state.audioEnabled) {
          audioAlarm.unlock();
        }
        if (state.timerStatus === 'running') {
          if (!wakeLockManager.isActive()) {
            wakeLockManager.requestLock().then((active) => {
              set({ wakeLockActive: active });
            });
          }
          get().tick();
        }
      },

      goToStage: (newIndex: number) => {
        const state = get();
        if (newIndex < 0 || newIndex >= state.stages.length) return;

        notificationManager.clearLiveTimerNotification();

        const now = Date.now();
        const oldStage = state.stages[state.currentStageIndex];
        const nextStage = state.stages[newIndex];

        const updatedStages = [...state.stages];
        const startedOld = oldStage.startedAt || state.sessionStartTime || now;
        let actualSec = oldStage.actualDurationSec;
        if (oldStage.timerType === 'stopwatch') {
          if (state.timerStatus === 'running' && state.timerStartedAtWallClock) {
            const additional = Math.floor((now - state.timerStartedAtWallClock) / 1000);
            actualSec = state.timerAccumulatedElapsedSec + additional;
          } else {
            actualSec = state.timerAccumulatedElapsedSec || oldStage.actualDurationSec;
          }
        } else if (oldStage.timerType === 'countdown') {
          actualSec = oldStage.actualDurationSec;
        } else {
          actualSec = Math.max(0, Math.floor((now - startedOld) / 1000));
        }

        updatedStages[state.currentStageIndex] = {
          ...oldStage,
          status: 'completed',
          flowPhase: 'finished',
          startedAt: startedOld,
          endedAt: now,
          actualDurationSec: actualSec
        };

        updatedStages[newIndex] = {
          ...nextStage,
          status: 'active',
          flowPhase: 'ready',
          startedAt: nextStage.startedAt || now
        };

        const initialTimerSec = nextStage.timerType === 'countdown' ? nextStage.plannedDurationSec : 0;

        set({
          stages: updatedStages,
          sessionStartTime: state.sessionStartTime || startedOld,
          currentStageIndex: newIndex,
          timerStatus: 'idle',
          timerRemainingSec: initialTimerSec,
          timerTotalSec: nextStage.timerType === 'countdown' ? nextStage.plannedDurationSec : 0,
          timerStartedAtWallClock: null,
          timerAccumulatedElapsedSec: 0,
          activeAlertAdditions: [],
          dismissedAdditionIds: [],
          activeTaskAlert: null,
          dismissedTaskAlertIds: [],
          alertSnoozedUntil: {}
        });

        get().addAuditLog(
          'STAGE_END',
          `Stage completed: ${oldStage.title} (Actual: ${Math.floor(actualSec / 60)}m ${actualSec % 60}s, ${oldStage.timerType === 'stopwatch' ? 'Est' : 'Planned'}: ${Math.floor(oldStage.plannedDurationSec / 60)}m)`,
          {
            stageId: oldStage.id,
            actualDurationSec: actualSec,
            deltaSec: actualSec - oldStage.plannedDurationSec
          }
        );

        if (state.audioEnabled) {
          audioAlarm.playClick();
        }
      },

      nextStage: () => {
        const state = get();
        if (state.currentStageIndex < state.stages.length - 1) {
          get().goToStage(state.currentStageIndex + 1);
        }
      },

      prevStage: () => {
        const state = get();
        if (state.currentStageIndex > 0) {
          get().goToStage(state.currentStageIndex - 1);
        }
      },

      toggleChecklistItem: (checklistId: string) => {
        const state = get();
        const currentStage = state.stages[state.currentStageIndex];
        const updatedChecklist = currentStage.checklist.map((item) => {
          if (item.id === checklistId) {
            const checked = !item.checked;
            return {
              ...item,
              checked,
              checkedAt: checked ? Date.now() : undefined
            };
          }
          return item;
        });

        const updatedStages = [...state.stages];
        updatedStages[state.currentStageIndex] = {
          ...currentStage,
          checklist: updatedChecklist
        };

        const targetItem = currentStage.checklist.find(c => c.id === checklistId);
        const isNowChecked = !targetItem?.checked;

        if (state.audioEnabled) {
          audioAlarm.playClick();
        }
        if (state.vibrationEnabled) {
          vibrate(VIBRATION_PATTERNS.SHORT_CLICK);
        }

        set({ stages: updatedStages });

        get().addAuditLog(
          'CHECKLIST_TOGGLE',
          `${isNowChecked ? 'Checked' : 'Unchecked'}: ${targetItem?.label || checklistId}`,
          { checklistId, checked: isNowChecked }
        );
      },

      confirmAddition: (additionId: string) => {
        const state = get();
        const currentStage = state.stages[state.currentStageIndex];
        const now = Date.now();
        const updatedAdditions = currentStage.additions.map((addition) => {
          if (addition.id === additionId) {
            return {
              ...addition,
              confirmed: true,
              confirmedAt: now
            };
          }
          return addition;
        });

        const allConfirmed = updatedAdditions.length > 0 && updatedAdditions.every(a => a.confirmed);
        const additionChecklistIds = ADDITION_SUMMARY_CHECKLIST_IDS;
        const updatedChecklist = allConfirmed
          ? currentStage.checklist.map(item =>
              additionChecklistIds.includes(item.id) && !item.checked
                ? { ...item, checked: true, checkedAt: now }
                : item
            )
          : currentStage.checklist;

        const updatedStages = [...state.stages];
        updatedStages[state.currentStageIndex] = {
          ...currentStage,
          additions: updatedAdditions,
          checklist: updatedChecklist
        };

        const targetAddition = currentStage.additions.find(a => a.id === additionId);

        if (state.audioEnabled) {
          audioAlarm.playClick();
        }
        if (state.vibrationEnabled) {
          vibrate(VIBRATION_PATTERNS.SHORT_CLICK);
        }

        set({
          stages: updatedStages,
          activeAlertAdditions: state.activeAlertAdditions.filter(a => a.id !== additionId),
          dismissedAdditionIds: [...state.dismissedAdditionIds, additionId]
        });

        get().addAuditLog(
          'ADDITION_CONFIRMED',
          `Added: ${targetAddition?.amount}${targetAddition?.unit || ''} ${targetAddition?.name || additionId}`,
          { additionId }
        );
      },

      confirmAdditions: (additionIds: string[]) => {
        const state = get();
        if (!additionIds || additionIds.length === 0) return;

        const now = Date.now();
        const currentStage = state.stages[state.currentStageIndex];
        if (!currentStage) return;

        const updatedAdditions = (currentStage.additions || []).map((addition) => {
          if (additionIds.includes(addition.id)) {
            return {
              ...addition,
              confirmed: true,
              confirmedAt: now
            };
          }
          return addition;
        });

        const allConfirmed = updatedAdditions.length > 0 && updatedAdditions.every(a => a.confirmed);
        const additionChecklistIds = ADDITION_SUMMARY_CHECKLIST_IDS;
        const updatedChecklist = allConfirmed
          ? currentStage.checklist.map(item =>
              additionChecklistIds.includes(item.id) && !item.checked
                ? { ...item, checked: true, checkedAt: now }
                : item
            )
          : currentStage.checklist;

        const updatedStages = [...state.stages];
        updatedStages[state.currentStageIndex] = {
          ...currentStage,
          additions: updatedAdditions,
          checklist: updatedChecklist
        };

        if (state.audioEnabled) {
          audioAlarm.playClick();
        }
        if (state.vibrationEnabled) {
          vibrate(VIBRATION_PATTERNS.SHORT_CLICK);
        }

        const remainingAlerts = state.activeAlertAdditions.filter(a => !additionIds.includes(a.id));

        set({
          stages: updatedStages,
          activeAlertAdditions: remainingAlerts,
          dismissedAdditionIds: [...state.dismissedAdditionIds, ...additionIds]
        });

        get().addAuditLog(
          'ADDITION_CONFIRMED',
          `Confirmed ${additionIds.length} addition(s) simultaneously`,
          { additionIds }
        );
      },

      confirmAllDueAdditions: () => {
        const state = get();
        const dueIds = state.activeAlertAdditions.map(a => a.id);
        if (dueIds.length === 0) return;
        get().confirmAdditions(dueIds);
      },

      unconfirmAddition: (additionId: string) => {
        const state = get();
        const currentStage = state.stages[state.currentStageIndex];
        const targetAddition = currentStage?.additions?.find(a => a.id === additionId);
        if (!targetAddition?.confirmed) return;

        const additionChecklistIds = ADDITION_SUMMARY_CHECKLIST_IDS;
        const updatedStages = [...state.stages];
        updatedStages[state.currentStageIndex] = {
          ...currentStage,
          additions: currentStage.additions.map(a =>
            a.id === additionId ? { ...a, confirmed: false, confirmedAt: undefined } : a
          ),
          // The "all additions done" checklist item no longer holds
          checklist: currentStage.checklist.map(item =>
            additionChecklistIds.includes(item.id) && item.checked
              ? { ...item, checked: false, checkedAt: undefined }
              : item
          )
        };

        if (state.vibrationEnabled) {
          vibrate(VIBRATION_PATTERNS.SHORT_CLICK);
        }

        // Stays in dismissedAdditionIds so the alert doesn't pop straight back up; it shows as due in the feed
        set({ stages: updatedStages });

        get().addAuditLog(
          'NOTE',
          `Undid addition: ${targetAddition.amount}${targetAddition.unit || ''} ${targetAddition.name}`,
          { additionId }
        );
      },

      dismissAlertModal: () => {
        const state = get();
        const snoozeUntil = Date.now() + ALERT_SNOOZE_MIN * 60_000;
        const snoozed = Object.fromEntries(state.activeAlertAdditions.map(a => [a.id, snoozeUntil]));
        set({
          activeAlertAdditions: [],
          alertSnoozedUntil: { ...state.alertSnoozedUntil, ...snoozed }
        });
      },

      confirmTaskAlert: (checklistId: string) => {
        const state = get();
        const currentStage = state.stages[state.currentStageIndex];
        const target = currentStage?.checklist?.find(c => c.id === checklistId);
        if (target && !target.checked) {
          get().toggleChecklistItem(checklistId);
        }
        set({
          activeTaskAlert: null,
          dismissedTaskAlertIds: [...state.dismissedTaskAlertIds, checklistId]
        });
      },

      dismissTaskAlert: () => {
        const state = get();
        if (state.activeTaskAlert) {
          set({
            alertSnoozedUntil: {
              ...state.alertSnoozedUntil,
              [state.activeTaskAlert.checklistId]: Date.now() + ALERT_SNOOZE_MIN * 60_000
            },
            activeTaskAlert: null
          });
        }
      },

      setStrikeOffset: (offset: number) => {
        const clamped = Math.max(0, Math.min(25, Math.round(offset * 10) / 10));
        const state = get();
        const updatedStages = [...state.stages];
        const waterPrep = updatedStages.find(s => s.id === 'WATER_PREP');
        const mashStep = state.recipe?.mash?.steps?.[0];
        const mashTemp = mashStep?.stepTemp || 65;
        const newStrikeTemp = Number((mashTemp + clamped).toFixed(1));

        if (waterPrep) {
          waterPrep.parameters.targetTemp = newStrikeTemp;
          waterPrep.flow.endLog = `Strike offset +${clamped}°C (mash ${mashTemp}°C → strike ${newStrikeTemp}°C)`;
        }

        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          localStorage.setItem('brewmate_strike_offset', clamped.toString());
        }

        set({
          strikeOffset: clamped,
          stages: updatedStages
        });

        get().addAuditLog(
          'NOTE',
          `Updated strike offset to +${clamped}°C (Target strike: ${newStrikeTemp}°C)`
        );
      },

      setTargetStrikeTemp: (temp: number) => {
        const state = get();
        const mashStep = state.recipe?.mash?.steps?.[0];
        const mashTemp = mashStep?.stepTemp || 65;
        const offset = Number((temp - mashTemp).toFixed(1));
        get().setStrikeOffset(offset);
      },

      setMeasurement: (key: keyof SessionMeasurements, value: number) => {
        const state = get();
        const now = Date.now();
        const metricToChecklistId: Partial<Record<keyof SessionMeasurements, string>> = {
          mashPhActual: 'ph-sample',
          preBoilGravityActual: 'preboil-sg',
          postBoilGravityActual: 'postboil-sg'
        };
        const linkedChecklistId = metricToChecklistId[key];
        const currentStage = state.stages[state.currentStageIndex];

        let updatedStages = state.stages;
        if (linkedChecklistId && currentStage && state.activeTaskAlert?.checklistId !== linkedChecklistId) {
          const targetItem = currentStage.checklist.find(c => c.id === linkedChecklistId);
          if (targetItem && !targetItem.checked) {
            updatedStages = [...state.stages];
            updatedStages[state.currentStageIndex] = {
              ...currentStage,
              checklist: currentStage.checklist.map(c =>
                c.id === linkedChecklistId ? { ...c, checked: true, checkedAt: now } : c
              )
            };
          }
        }

        set({
          stages: updatedStages,
          measurements: {
            ...state.measurements,
            [key]: value
          }
        });

        get().addAuditLog(
          'MEASUREMENT_RECORDED',
          `Recorded measurement ${key}: ${value}`,
          { key, value }
        );
      },

      addAuditLog: (type: SessionAuditLogItem['type'], message: string, metadata?: Record<string, any>) => {
        const state = get();
        const currentStage = state.stages[state.currentStageIndex];
        const logItem: SessionAuditLogItem = {
          timestamp: Date.now(),
          stageId: currentStage?.id || 'WATER_PREP',
          type,
          message,
          metadata
        };

        set({
          auditLogs: [...state.auditLogs, logItem]
        });
      },

      toggleWakeLock: async () => {
        const state = get();
        if (state.wakeLockActive) {
          await wakeLockManager.releaseLock();
          set({ wakeLockActive: false });
        } else {
          const success = await wakeLockManager.requestLock();
          set({ wakeLockActive: success });
        }
      },

      toggleAudio: () => {
        const state = get();
        set({ audioEnabled: !state.audioEnabled });
      },

      toggleVibration: () => {
        const state = get();
        set({ vibrationEnabled: !state.vibrationEnabled });
      }
    }),
    {
      name: 'brewmate_active_session_v15',
      version: 15,
      // Coalesce bursts of writes (an action typically triggers set() + addAuditLog()) into one
      // serialisation per second. Flushed on pagehide / tab hide so nothing is lost on exit.
      storage: createJSONStorage(() => coalescedLocalStorage),
      migrate: (persistedState: any, version: number) => {
        if (version < 15) {
          // Migration from v14 to v15: ensure strikeOffset, flowStep, and finishedAt are populated
          const state = persistedState as Partial<BrewSessionState>;
          const strikeOffset = state.strikeOffset ?? 10;
          const freshStages = state.recipe ? parseBrewfatherRecipe(state.recipe, strikeOffset) : [];

          return {
            ...state,
            strikeOffset,
            finishedAt: state.finishedAt ?? null,
            stages: freshStages,
            dismissedAdditionIds: state.dismissedAdditionIds ?? [],
            dismissedTaskAlertIds: state.dismissedTaskAlertIds ?? []
          };
        }
        return persistedState;
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // Check if v14 legacy session exists in localStorage and migrate
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          const storedOffset = localStorage.getItem('brewmate_strike_offset');
          if (storedOffset) {
            const parsed = parseFloat(storedOffset);
            if (!isNaN(parsed)) state.strikeOffset = parsed;
          }
        }

        // Wall-clock recovery upon rehydration
        if (state.timerStatus === 'running' && state.timerStartedAtWallClock) {
          const currentStage = state.stages?.[state.currentStageIndex];
          const now = Date.now();
          const elapsedSinceResume = Math.floor((now - state.timerStartedAtWallClock) / 1000);
          const totalElapsed = state.timerAccumulatedElapsedSec + elapsedSinceResume;
          if (currentStage?.timerType === 'countdown') {
            state.timerRemainingSec = Math.max(0, state.timerTotalSec - totalElapsed);
          } else if (currentStage?.timerType === 'stopwatch') {
            state.timerRemainingSec = totalElapsed;
          }
        }

        // Ensure all stages have valid flow definitions
        if (state.recipe && state.stages && state.stages.length > 0 && !state.stages[0]?.flow) {
          const offset = state.strikeOffset || 10;
          state.stages = parseBrewfatherRecipe(state.recipe, offset);
        }

        // Migrate any legacy stage labels if present in persisted state
        if (state.stages && state.stages.length > 0) {
          const mashIn = state.stages.find(s => s.id === 'MASH_IN');
          if (mashIn) {
            if (mashIn.flow?.startLabel === 'GRAIN IN') {
              mashIn.flow.startLabel = 'DONE';
            }
            const mashTempItem = mashIn.checklist.find(c => c.id === 'mash-temp-init');
            if (mashTempItem && mashTempItem.label.startsWith('Check mash temp')) {
              mashTempItem.label = mashTempItem.label.replace('Check mash temp', 'Dough in & set temp');
            }
          }
          const mashRest = state.stages.find(s => s.id === 'MASH_SCHEDULE');
          if (mashRest && mashRest.flow?.startLabel === 'START MASH') {
            mashRest.flow.startLabel = 'START MASH REST';
          }
          if (mashIn && mashIn.flow?.nextLabel === 'NEXT: START MASH') {
            mashIn.flow.nextLabel = 'NEXT: START MASH REST';
          }
          const waterPrep = state.stages.find(s => s.id === 'WATER_PREP');
          if (waterPrep && waterPrep.flow?.nextLabel === 'NEXT: GRAIN IN') {
            waterPrep.flow.nextLabel = 'NEXT: MASH IN';
          }
          // Water salts and acids moved from Mash In to Strike Water (enzymes stay on Mash In); keeps confirmed state
          const mashInStage = state.stages.find(s => s.id === 'MASH_IN');
          if (waterPrep && mashInStage) {
            const liquorAdditions = mashInStage.additions.filter(a => a.type !== 'enzyme');
            if (liquorAdditions.length > 0 && waterPrep.additions.length === 0) {
              waterPrep.additions = liquorAdditions;
              mashInStage.additions = mashInStage.additions.filter(a => a.type === 'enzyme');
              const mashSummary = mashInStage.checklist.find(c => c.id === 'mash-additions-check');
              if (mashSummary && mashSummary.explanation === 'Add enzymes, or lactic acid') {
                mashSummary.explanation = 'Add enzymes once the mash is at temperature';
              }
              // Keep each summary reminder in step with its stage's additions
              const syncSummary = (stage: BrewStage, summaryId: string) => {
                const item = stage.checklist.find(c => c.id === summaryId);
                const allConfirmed = stage.additions.length > 0 && stage.additions.every(a => a.confirmed);
                if (item && item.checked !== allConfirmed && stage.additions.length > 0) {
                  item.checked = allConfirmed;
                  item.checkedAt = allConfirmed ? Date.now() : undefined;
                }
              };
              syncSummary(waterPrep, 'water-treat');
              syncSummary(mashInStage, 'mash-additions-check');
            }
          }

          // Strike Water's action button is now DONE (was STRIKE READY), like the other confirm stages
          if (waterPrep && waterPrep.flow?.startLabel === 'STRIKE READY') {
            waterPrep.flow.startLabel = 'DONE';
          }
          const waterSalts = waterPrep?.checklist.find(c => c.id === 'water-treat');
          if (waterSalts && waterSalts.explanation === 'Add gypsum, calcium chloride, and acid into strike liquor') {
            waterSalts.explanation = 'Prepare water salts and acids then add to strike liquor';
          }
          // It now heads the Strike additions list, like "Mash additions" on Mash In
          if (waterSalts && waterSalts.label === 'Water salts') {
            waterSalts.label = 'Strike additions';
          }
          // Pitch's action button is now DONE (was YEAST IN), and Knockout's NEXT label follows it
          const yeastPitch = state.stages.find(s => s.id === 'YEAST_PITCH');
          if (yeastPitch && yeastPitch.flow?.startLabel === 'YEAST IN') {
            yeastPitch.flow.startLabel = 'DONE';
          }
          const knockout = state.stages.find(s => s.id === 'KNOCKOUT_TRANSFER');
          if (knockout && knockout.flow?.nextLabel === 'NEXT: YEAST IN') {
            knockout.flow.nextLabel = 'NEXT: PITCH YEAST';
          }

          // Short names now follow the timer screen's flow labels; stopwatch estimates are more realistic
          const legacyStageUpdates: Record<string, { title?: [string, string]; shortCode?: [string, string]; estimateSec?: [number, number] }> = {
            MASH_SCHEDULE: { shortCode: ['MASH', 'MASH REST'] },
            LAUTER_SPARGE: { title: ['Lauter & Sparge', 'Sparge'], shortCode: ['LAUTER', 'SPARGE'] },
            COOLING_RECIRC: { estimateSec: [600, 1200] },
            KNOCKOUT_TRANSFER: { estimateSec: [1500, 3600] }
          };
          for (const stage of state.stages) {
            const update = legacyStageUpdates[stage.id];
            if (!update) continue;
            if (update.title && stage.title === update.title[0]) {
              stage.title = update.title[1];
            }
            if (update.shortCode && stage.shortCode === update.shortCode[0]) {
              stage.shortCode = update.shortCode[1];
            }
            if (update.estimateSec && stage.plannedDurationSec === update.estimateSec[0]) {
              stage.plannedDurationSec = update.estimateSec[1];
            }
          }

          // Sanitise loop moved from Cooling Recirc to the end of the Boil (keeps its ticked state)
          const boilStage = state.stages.find(s => s.id === 'BOIL');
          const chillStage = state.stages.find(s => s.id === 'COOLING_RECIRC');
          const sanitiseItem = chillStage?.checklist.find(c => c.id === 'hx-hot-sanitize');
          if (boilStage && chillStage && sanitiseItem) {
            chillStage.checklist = chillStage.checklist.filter(c => c.id !== 'hx-hot-sanitize');
            if (!boilStage.checklist.some(c => c.id === 'hx-hot-sanitize')) {
              boilStage.checklist = [...boilStage.checklist, sanitiseItem];
            }
          }

          // Whirlpool "Heat off" duplicated the Boil's flameout reminder; it is now "Cool to <whirlpool temp>"
          const whirlpoolStage = state.stages.find(s => s.id === 'HOPSTAND_WHIRLPOOL');
          if (whirlpoolStage?.checklist.some(c => c.id === 'cut-heat')) {
            whirlpoolStage.checklist = whirlpoolStage.checklist.map(c => c.id === 'cut-heat'
              ? {
                  ...c,
                  id: 'whirlpool-cool-temp',
                  label: `Cool to ${whirlpoolStage.parameters?.targetTemp ?? ''}°C`,
                  explanation: 'Let the wort cool to whirlpool temperature before adding whirlpool hops (heat is already off from flameout)'
                }
              : c);
          }
        }
      },
      partialize: (state) => ({
        recipe: state.recipe,
        sessionId: state.sessionId,
        sessionStartTime: state.sessionStartTime,
        sessionEndTime: state.sessionEndTime,
        finishedAt: state.finishedAt,
        strikeOffset: state.strikeOffset,
        currentStageIndex: state.currentStageIndex,
        stages: state.stages,
        measurements: state.measurements,
        auditLogs: state.auditLogs,
        timerStatus: state.timerStatus,
        timerStartedAtWallClock: state.timerStartedAtWallClock,
        timerRemainingSec: state.timerRemainingSec,
        timerTotalSec: state.timerTotalSec,
        timerAccumulatedElapsedSec: state.timerAccumulatedElapsedSec,
        wakeLockActive: state.wakeLockActive,
        audioEnabled: state.audioEnabled,
        vibrationEnabled: state.vibrationEnabled,
        dismissedAdditionIds: state.dismissedAdditionIds,
        dismissedTaskAlertIds: state.dismissedTaskAlertIds,
        alertSnoozedUntil: state.alertSnoozedUntil
      })
    }
  )
);

// Connect the live timer notification's action buttons (Pause / Resume / +1m / Next...)
if (typeof window !== 'undefined') {
  notificationManager.setActionHandler((action) => {
    const store = useBrewStore.getState();
    switch (action) {
      case 'pause':
        store.pauseTimer();
        break;
      case 'resume':
        store.resumeTimer();
        break;
      case 'stop':
        store.stopStopwatch();
        break;
      case 'extend-1m':
        store.extendTimer(60);
        break;
      case 'extend-5m':
        store.extendTimer(300);
        break;
      case 'next-stage':
        store.nextStage();
        break;
    }
  });
}
