export type StageId =
  | 'WATER_PREP'
  | 'MASH_IN'
  | 'MASH_SCHEDULE'
  | 'VORLAUF'
  | 'LAUTER_SPARGE'
  | 'PRE_BOIL_HEAT'
  | 'BOIL'
  | 'HOPSTAND_WHIRLPOOL'
  | 'COOLING_RECIRC'
  | 'KNOCKOUT_TRANSFER'
  | 'YEAST_PITCH'
  | 'CLEANUP';

export type StageStatus = 'pending' | 'active' | 'completed' | 'skipped';

export type TimerType = 'countdown' | 'stopwatch' | 'manual';

// 'full': tick each reminder and confirm each addition as you go.
// 'byStage': confirm a stage's reminders and additions in one go when it starts; due items show a banner.
export type FlowMode = 'full' | 'byStage';

export interface StageAddition {
  id: string;
  name: string;
  amount: number | string;
  unit?: string;
  triggerTimeMin: number; // e.g. 15 for 15m remaining in boil, or 0 for flameout
  triggerRemainingSec: number; // calculated seconds remaining at which alert fires
  confirmed: boolean;
  confirmedAt?: number; // timestamp
  confirmedVia?: 'stage-card'; // confirmed upfront on the By stage card rather than when added
  type: 'hop' | 'misc' | 'sugar' | 'water' | 'enzyme' | 'other';
  notes?: string;
}

export interface TaskAlertPrompt {
  checklistId: string;
  title: string;
  headline: string;
  message: string;
  actionLabel?: string;
  remainingMin?: number;
}

// In-app banner for timed items coming due in By stage mode (no confirmation needed)
export interface DueNotice {
  id: string;
  title: string;
  lines: string[];
  // Readings among the due items, offered a Record button
  readingIds?: string[];
}

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  checkedAt?: number;
  explanation?: string;
  triggerRemainingSec?: number;
  alertTitle?: string;
  alertHeadline?: string;
  alertMessage?: string;
  alertActionLabel?: string;
}

export type FlowKind = 'confirm' | 'countdown' | 'stopwatch';
export type FlowPhase = 'ready' | 'running' | 'paused' | 'finished';

export interface FlowStep {
  id: string;
  kind: FlowKind;
  startLabel: string;
  pauseLabel?: string;
  resumeLabel?: string;
  stopLabel?: string;
  endAlert?: string;
  startLog: string;
  endLog: string;
  nextLabel?: string;
}

export interface MashSubStep {
  name: string;
  temp: number;
  durationMinutes: number;
  durationSeconds: number;
  completed: boolean;
}

export interface BrewStage {
  id: StageId;
  index: number;
  title: string;
  shortCode: string;
  description: string;
  isTimed: boolean;
  timerType: TimerType;
  plannedDurationSec: number;
  actualDurationSec: number;
  status: StageStatus;
  startedAt?: number; // timestamp ms
  endedAt?: number; // timestamp ms
  flow: FlowStep;
  flowPhase?: FlowPhase;
  additions: StageAddition[];
  checklist: ChecklistItem[];
  parameters: {
    targetTemp?: number;
    targetVolume?: number;
    volumeLabel?: string;
    targetGravity?: number;
    targetPh?: number;
    infoNotes?: string;
  };
  mashSubSteps?: MashSubStep[];
}

export interface SessionMeasurements {
  strikeTempActual?: number;
  mashInTempActual?: number;
  mashPhActual?: number;
  preBoilGravityActual?: number;
  postBoilGravityActual?: number;
  knockoutTempActual?: number;
}

export interface SessionAuditLogItem {
  timestamp: number;
  stageId: StageId;
  type: 'STAGE_START' | 'STAGE_END' | 'STAGE_EXTEND' | 'ADDITION_CONFIRMED' | 'MEASUREMENT_RECORDED' | 'CHECKLIST_TOGGLE' | 'NOTE';
  message: string;
  deltaSec?: number;
  metadata?: Record<string, any>;
}

export interface BrewSessionState {
  recipe: import('./brewfather').BrewfatherRecipe | null;
  sessionId: string;
  sessionStartTime: number | null;
  sessionEndTime: number | null;
  finishedAt: number | null;
  strikeOffset: number; // Brewer-set offset from mash temp, default 10°C (range 5-15°C)
  currentStageIndex: number;
  stages: BrewStage[];
  measurements: SessionMeasurements;
  auditLogs: SessionAuditLogItem[];
  
  // Timer state
  timerStatus: 'idle' | 'running' | 'paused';
  timerRemainingSec: number; // For countdown, counts down to 0. For stopwatch, tracks count up elapsed seconds.
  timerTotalSec: number;
  timerStartedAtWallClock: number | null; // Date.now() when started/resumed
  timerAccumulatedElapsedSec: number; // accumulated elapsed time before last resume
  
  // Audio & Wake lock
  wakeLockActive: boolean;
  audioEnabled: boolean;
  vibrationEnabled: boolean;
  
  // Active modal/prompt (supports multiple simultaneous additions & timed task alerts)
  activeAlertAdditions: StageAddition[];
  dismissedAdditionIds: string[];
  activeTaskAlert: TaskAlertPrompt | null;
  dismissedTaskAlertIds: string[];
  // Snoozed addition / task alert ids -> wall-clock time (ms) when they may alert again
  alertSnoozedUntil: Record<string, number>;

  // Brew flow preference (kept across sessions) and By stage state
  flowMode: FlowMode;
  // Timed items in the current stage already announced by the By stage due banner
  announcedDueIds: string[];
  activeDueNotice: DueNotice | null;
  // Set when switching to By stage mid-stage with items still to confirm; the UI opens the stage card
  stageCardRequested: boolean;
}
