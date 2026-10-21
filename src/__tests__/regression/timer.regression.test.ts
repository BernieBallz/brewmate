import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useBrewStore } from '../../store/brewStore';
import testRecipe from '../fixtures/testRecipe.json';
import type { BrewfatherRecipe } from '../../types/brewfather';

/**
 * Timer-math regression suite.
 *
 * The timer is wall-clock based (timerStartedAtWallClock + timerAccumulatedElapsedSec),
 * so every test drives time with fake timers and asserts on derived values rather than
 * on how many times tick() ran.
 */

const T0 = new Date('2026-01-01T12:00:00Z').getTime();
const MASH_IDX = 2; // MASH_SCHEDULE (countdown, has timed ph-sample + vorlauf reminders)
const SPARGE_IDX = 3; // LAUTER_SPARGE (stopwatch)

const state = () => useBrewStore.getState();

/** Advance wall-clock time and run one tick, as the 250 ms interval in App.tsx would. */
function advanceAndTick(ms: number) {
  vi.advanceTimersByTime(ms);
  state().tick();
}

describe('Timer math regression suite', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    state().loadRecipe(testRecipe as unknown as BrewfatherRecipe);
    // Keep side-effects (Web Audio, vibration) out of the way
    useBrewStore.setState({ audioEnabled: false, vibrationEnabled: false });
    state().goToStage(MASH_IDX);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('countdown', () => {
    it('counts down from the planned duration using whole elapsed seconds', () => {
      const planned = state().stages[MASH_IDX].plannedDurationSec;
      expect(state().timerRemainingSec).toBe(planned);

      state().startTimer();
      expect(state().timerStatus).toBe('running');

      advanceAndTick(10_400);
      expect(state().timerRemainingSec).toBe(planned - 10);

      advanceAndTick(600); // 11.0 s elapsed
      expect(state().timerRemainingSec).toBe(planned - 11);
    });

    it('marks the stage finished exactly once when the countdown reaches zero', () => {
      const planned = state().stages[MASH_IDX].plannedDurationSec;
      state().startTimer();

      advanceAndTick((planned - 1) * 1000);
      expect(state().timerRemainingSec).toBe(1);
      expect(state().stages[MASH_IDX].flowPhase).toBe('running');

      advanceAndTick(1000);
      expect(state().timerRemainingSec).toBe(0);
      expect(state().stages[MASH_IDX].flowPhase).toBe('finished');
      expect(state().stages[MASH_IDX].actualDurationSec).toBe(planned);
      const endedAt = state().stages[MASH_IDX].endedAt;

      // Overtime keeps counting negative but must not re-complete the stage
      advanceAndTick(5000);
      expect(state().timerRemainingSec).toBe(-5);
      expect(state().stages[MASH_IDX].endedAt).toBe(endedAt);
    });
  });

  describe('pause / resume', () => {
    it('freezes elapsed time while paused and continues from it on resume', () => {
      const planned = state().stages[MASH_IDX].plannedDurationSec;
      state().startTimer();
      advanceAndTick(30_000);

      state().pauseTimer();
      expect(state().timerStatus).toBe('paused');
      expect(state().timerStartedAtWallClock).toBeNull();
      expect(state().timerAccumulatedElapsedSec).toBe(30);
      expect(state().timerRemainingSec).toBe(planned - 30);

      // 10 minutes pass while paused: nothing may move
      advanceAndTick(600_000);
      expect(state().timerRemainingSec).toBe(planned - 30);
      expect(state().timerAccumulatedElapsedSec).toBe(30);

      state().resumeTimer();
      expect(state().timerStatus).toBe('running');
      advanceAndTick(15_000);
      expect(state().timerRemainingSec).toBe(planned - 45);
    });

    it('ignores pause when not running and resume when not paused', () => {
      state().pauseTimer();
      expect(state().timerStatus).toBe('idle');

      state().startTimer();
      const startedAt = state().timerStartedAtWallClock;
      state().resumeTimer();
      expect(state().timerStartedAtWallClock).toBe(startedAt);
    });

    it('survives several pause/resume cycles without drift', () => {
      const planned = state().stages[MASH_IDX].plannedDurationSec;
      state().startTimer();
      for (let i = 0; i < 4; i++) {
        advanceAndTick(5_000);
        state().pauseTimer();
        vi.advanceTimersByTime(60_000);
        state().resumeTimer();
      }
      advanceAndTick(5_000);
      expect(state().timerRemainingSec).toBe(planned - 25);
    });
  });

  describe('extendTimer', () => {
    it('adds time to remaining, total and planned duration while running', () => {
      const planned = state().stages[MASH_IDX].plannedDurationSec;
      state().startTimer();
      advanceAndTick(20_000);

      state().extendTimer(60);
      expect(state().timerRemainingSec).toBe(planned - 20 + 60);
      expect(state().timerTotalSec).toBe(planned + 60);
      expect(state().stages[MASH_IDX].plannedDurationSec).toBe(planned + 60);

      advanceAndTick(10_000);
      expect(state().timerRemainingSec).toBe(planned - 30 + 60);
    });

    it('extends while paused and keeps the extension on resume', () => {
      const planned = state().stages[MASH_IDX].plannedDurationSec;
      state().startTimer();
      advanceAndTick(30_000);
      state().pauseTimer();

      state().extendTimer(300);
      expect(state().timerStatus).toBe('paused');
      expect(state().timerRemainingSec).toBe(planned - 30 + 300);

      state().resumeTimer();
      advanceAndTick(10_000);
      expect(state().timerRemainingSec).toBe(planned - 40 + 300);
    });

    it('can rescue a stage from overtime', () => {
      const planned = state().stages[MASH_IDX].plannedDurationSec;
      state().startTimer();
      advanceAndTick((planned + 10) * 1000);
      expect(state().timerRemainingSec).toBe(-10);

      state().extendTimer(60);
      expect(state().timerRemainingSec).toBe(50);
      expect(state().stages[MASH_IDX].flowPhase).toBe('running');
    });
  });

  describe('wall-clock reconcile (backgrounded tab / screen off / reload)', () => {
    it('catches up after a long gap with no ticks', () => {
      const planned = state().stages[MASH_IDX].plannedDurationSec;
      state().startTimer();

      // Browser throttled / froze the page: no tick for 100 s
      vi.advanceTimersByTime(100_000);
      expect(state().timerRemainingSec).toBe(planned); // stale until reconciled

      state().reconcileTimerWithWallClock();
      expect(state().timerRemainingSec).toBe(planned - 100);
    });

    it('does not move a paused or idle timer', () => {
      const planned = state().stages[MASH_IDX].plannedDurationSec;
      state().reconcileTimerWithWallClock();
      expect(state().timerRemainingSec).toBe(planned);

      state().startTimer();
      advanceAndTick(10_000);
      state().pauseTimer();
      vi.advanceTimersByTime(60_000);
      state().reconcileTimerWithWallClock();
      expect(state().timerRemainingSec).toBe(planned - 10);
    });

    it('rehydrating mid-countdown recomputes remaining time from the persisted wall clock', () => {
      const planned = state().stages[MASH_IDX].plannedDurationSec;
      state().startTimer();
      advanceAndTick(40_000);

      // What a reload sees: persisted fields only, with a stale timerRemainingSec
      const persisted = {
        timerStartedAtWallClock: state().timerStartedAtWallClock,
        timerAccumulatedElapsedSec: state().timerAccumulatedElapsedSec,
        timerTotalSec: state().timerTotalSec
      };
      vi.advanceTimersByTime(20_000); // page was closed for 20 s

      const elapsed =
        persisted.timerAccumulatedElapsedSec +
        Math.floor((Date.now() - persisted.timerStartedAtWallClock!) / 1000);
      expect(persisted.timerTotalSec - elapsed).toBe(planned - 60);
    });

    it('fires a due alert on reconcile after a gap that spans its trigger point', () => {
      const mash = state().stages[MASH_IDX];
      const ph = mash.checklist.find(c => c.id === 'ph-sample')!;
      state().startTimer();

      // Jump past the ph-sample trigger without any tick in between
      vi.advanceTimersByTime((mash.plannedDurationSec - ph.triggerRemainingSec! + 5) * 1000);
      expect(state().activeTaskAlert).toBeNull();

      state().reconcileTimerWithWallClock();
      expect(state().activeTaskAlert?.checklistId).toBe('ph-sample');
    });
  });

  describe('stage transitions', () => {
    it('resets timer state when moving to another stage', () => {
      state().startTimer();
      advanceAndTick(30_000);

      state().goToStage(SPARGE_IDX);
      expect(state().currentStageIndex).toBe(SPARGE_IDX);
      expect(state().timerStatus).toBe('idle');
      expect(state().timerStartedAtWallClock).toBeNull();
      expect(state().timerAccumulatedElapsedSec).toBe(0);
      expect(state().activeAlertAdditions).toEqual([]);
      expect(state().activeTaskAlert).toBeNull();
      expect(state().stages[MASH_IDX].status).toBe('completed');
    });

    it('sets the next countdown stage to its planned duration', () => {
      const boilIdx = state().stages.findIndex(s => s.id === 'BOIL');
      const boil = state().stages[boilIdx];
      state().goToStage(boilIdx);
      expect(state().timerRemainingSec).toBe(boil.plannedDurationSec);
      expect(state().timerTotalSec).toBe(boil.plannedDurationSec);
    });

    it('ignores out-of-range stage indices', () => {
      state().goToStage(-1);
      state().goToStage(state().stages.length);
      expect(state().currentStageIndex).toBe(MASH_IDX);
    });

    it('confirmFlowStage advances one stage and leaves the new stage idle', () => {
      state().goToStage(0);
      state().confirmFlowStage();
      expect(state().currentStageIndex).toBe(1);
      expect(state().timerStatus).toBe('idle');
      expect(state().stages[0].status).toBe('completed');
    });
  });

  describe('stopwatch', () => {
    it('counts up and stores the elapsed time on stop', () => {
      state().goToStage(SPARGE_IDX);
      state().startTimer();

      advanceAndTick(125_400);
      expect(state().timerRemainingSec).toBe(125);

      state().stopStopwatch();
      expect(state().timerStatus).toBe('idle');
      expect(state().stages[SPARGE_IDX].actualDurationSec).toBe(125);
      expect(state().timerAccumulatedElapsedSec).toBe(125);
    });
  });

  describe('alerts', () => {
    it('raises the timed checklist alert once the trigger point is reached', () => {
      const mash = state().stages[MASH_IDX];
      const ph = mash.checklist.find(c => c.id === 'ph-sample')!;
      state().startTimer();

      advanceAndTick((mash.plannedDurationSec - ph.triggerRemainingSec! - 1) * 1000);
      expect(state().activeTaskAlert).toBeNull();

      advanceAndTick(1000);
      expect(state().activeTaskAlert?.checklistId).toBe('ph-sample');
    });

    it('raises boil addition alerts at their trigger point', () => {
      const boilIdx = state().stages.findIndex(s => s.id === 'BOIL');
      state().goToStage(boilIdx);
      const boil = state().stages[boilIdx];
      const addition = boil.additions.find(
        a => a.triggerRemainingSec > 0 && a.triggerRemainingSec < boil.plannedDurationSec
      )!;
      state().startTimer();

      advanceAndTick((boil.plannedDurationSec - addition.triggerRemainingSec - 1) * 1000);
      expect(state().activeAlertAdditions.map(a => a.id)).not.toContain(addition.id);

      advanceAndTick(1000);
      expect(state().activeAlertAdditions.map(a => a.id)).toContain(addition.id);
    });
  });

  describe('render / persistence load', () => {
    it('does not write to the store for ticks inside the same displayed second', () => {
      state().startTimer();
      advanceAndTick(1000); // settle on a whole second

      let writes = 0;
      const unsubscribe = useBrewStore.subscribe(() => { writes++; });

      advanceAndTick(250);
      advanceAndTick(250);
      advanceAndTick(250);
      expect(writes).toBe(0);

      advanceAndTick(250); // crosses into the next second
      expect(writes).toBe(1);
      unsubscribe();
    });

    it('keeps alert references stable across no-op ticks', () => {
      const mash = state().stages[MASH_IDX];
      const ph = mash.checklist.find(c => c.id === 'ph-sample')!;
      state().startTimer();
      advanceAndTick((mash.plannedDurationSec - ph.triggerRemainingSec!) * 1000);

      const alert = state().activeTaskAlert;
      const additions = state().activeAlertAdditions;
      expect(alert).not.toBeNull();

      advanceAndTick(250);
      expect(state().activeTaskAlert).toBe(alert);
      expect(state().activeAlertAdditions).toBe(additions);
    });

    it('still writes when the alert countdown text changes (remainingMin)', () => {
      const mash = state().stages[MASH_IDX];
      const ph = mash.checklist.find(c => c.id === 'ph-sample')!;
      state().startTimer();
      advanceAndTick((mash.plannedDurationSec - ph.triggerRemainingSec!) * 1000);
      const first = state().activeTaskAlert!.remainingMin;

      advanceAndTick(60_000);
      expect(state().activeTaskAlert!.remainingMin).toBe(first! - 1);
    });

    it('does not write for stopwatch ticks inside the same second', () => {
      state().goToStage(SPARGE_IDX);
      state().startTimer();
      advanceAndTick(1000);

      let writes = 0;
      const unsubscribe = useBrewStore.subscribe(() => { writes++; });
      advanceAndTick(250);
      advanceAndTick(250);
      expect(writes).toBe(0);
      unsubscribe();
    });
  });

  describe('persisted state migration', () => {
    const migrate = (persisted: unknown, version: number) =>
      useBrewStore.persist.getOptions().migrate!(persisted, version);

    it('rebuilds stages and defaults missing fields when upgrading from < v15', async () => {
      const migrated = (await migrate({ strikeOffset: 7, recipe: testRecipe }, 14)) as any;
      expect(migrated.strikeOffset).toBe(7);
      expect(migrated.finishedAt).toBeNull();
      expect(migrated.dismissedAdditionIds).toEqual([]);
      expect(migrated.dismissedTaskAlertIds).toEqual([]);
      expect(migrated.stages.length).toBeGreaterThan(0);
      expect(migrated.stages[0].flow).toBeDefined();
    });

    it('defaults strikeOffset to 10 when absent', async () => {
      const migrated = (await migrate({}, 14)) as any;
      expect(migrated.strikeOffset).toBe(10);
    });

    it('passes v15 state through untouched', async () => {
      const current = { strikeOffset: 3, marker: 'keep' };
      expect(await migrate(current, 15)).toBe(current);
    });
  });
});
