import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import testRecipe from '../fixtures/testRecipe.json';
import type { BrewfatherRecipe } from '../../types/brewfather';
import {
  useBrewStore,
  getPendingEndReadings,
  getDueReadings,
  hasStageCardItems,
  DONE_CARD_READING_IDS
} from '../../store/brewStore';
import { notificationManager } from '../../utils/notificationManager';
import { generateTelemetryData, generateMarkdownReport } from '../../utils/telemetryExport';

const MASH_REST_INDEX = 2;
const BOIL_INDEX = 4;
const state = () => useBrewStore.getState();
const boil = () => state().stages[BOIL_INDEX];
// By stage shows the Prepare state (checklist instead of timer) while the current stage has items to confirm
const isPreparing = () => state().flowMode === 'byStage' && hasStageCardItems(state().stages[state().currentStageIndex]);

// Put the boil countdown into a running state directly, avoiding startTimer's device side effects
const startBoilAt = (now: number) => {
  useBrewStore.setState({
    timerStatus: 'running',
    timerStartedAtWallClock: now,
    timerAccumulatedElapsedSec: 0,
    timerTotalSec: boil().plannedDurationSec,
    timerRemainingSec: boil().plannedDurationSec
  });
};

describe('Brew flow mode (Full step / By stage) regression tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-27T10:00:00Z'));
    useBrewStore.setState({ flowMode: 'full' });
    state().loadRecipe(testRecipe as unknown as BrewfatherRecipe);
    state().goToStage(BOIL_INDEX);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('preference', () => {
    it('defaults to Full step and is persisted', () => {
      expect(state().flowMode).toBe('full');
      state().setFlowMode('byStage');
      const persisted = useBrewStore.persist.getOptions().partialize!(state()) as Record<string, unknown>;
      expect(persisted.flowMode).toBe('byStage');
    });

    it('survives loading, resetting and removing the recipe', () => {
      state().setFlowMode('byStage');
      state().resetSession();
      expect(state().flowMode).toBe('byStage');
      state().loadRecipe(testRecipe as unknown as BrewfatherRecipe);
      expect(state().flowMode).toBe('byStage');
      state().removeRecipe();
      expect(state().flowMode).toBe('byStage');
    });

    it('a session saved before flow modes existed rehydrates as Full step', () => {
      const current = { ...state(), flowMode: 'full' as const };
      const { flowMode: _omit, announcedDueIds: _omit2, ...savedBeforeFlowModes } =
        useBrewStore.persist.getOptions().partialize!(current) as Record<string, unknown>;
      const merge = useBrewStore.persist.getOptions().merge ?? ((persisted, cur) => ({ ...cur, ...(persisted as object) }));
      const merged = merge(savedBeforeFlowModes, current) as typeof current;
      expect(merged.flowMode).toBe('full');
      expect(merged.announcedDueIds).toEqual([]);
    });

    it('logs the change and clears any open Full step alerts', () => {
      startBoilAt(Date.now());
      state().tick();
      expect(state().activeAlertAdditions.length).toBeGreaterThan(0);

      state().setFlowMode('byStage');
      expect(state().activeAlertAdditions).toEqual([]);
      expect(state().auditLogs.at(-1)?.message).toBe('Brew flow changed to By stage');
    });
  });

  describe('stage card', () => {
    it('confirms every addition and reminder in the stage', () => {
      state().setFlowMode('byStage');
      state().confirmStageCard();

      const stage = boil();
      expect(stage.additions.every(a => a.confirmed && a.confirmedVia === 'stage-card')).toBe(true);
      expect(stage.checklist.every(c => c.checked)).toBe(true);
      expect(getPendingEndReadings(stage)).toEqual([]);
      expect(hasStageCardItems(stage)).toBe(false);
    });

    it('leaves readings taken later in the stage for the Done card', () => {
      state().goToStage(MASH_REST_INDEX);
      state().setFlowMode('byStage');
      state().confirmStageCard();

      const stage = state().stages[MASH_REST_INDEX];
      for (const item of stage.checklist) {
        expect(item.checked).toBe(!DONE_CARD_READING_IDS.includes(item.id));
      }
      expect(getPendingEndReadings(stage).map(c => c.id)).toEqual(['ph-sample']);
      expect(hasStageCardItems(stage)).toBe(false);
    });

    it('records only the readings that were entered', () => {
      state().goToStage(MASH_REST_INDEX);
      state().setFlowMode('byStage');
      state().confirmStageCard({ mashPhActual: 5.3 });

      expect(state().measurements).toEqual({ mashPhActual: 5.3 });
      expect(state().stages[MASH_REST_INDEX].checklist.find(c => c.id === 'ph-sample')?.checked).toBe(true);
    });

    it('logs the confirmations as made on the stage card', () => {
      state().setFlowMode('byStage');
      state().confirmStageCard();

      const viaCard = state().auditLogs.filter(l => l.metadata?.via === 'stage-card');
      expect(viaCard.map(l => l.type)).toEqual(['ADDITION_CONFIRMED', 'CHECKLIST_TOGGLE']);
      expect(viaCard[0].metadata?.additionIds).toHaveLength(boil().additions.length);
    });
  });

  describe('due banner', () => {
    it('announces a timed hop once with a banner and notification, never the confirm modal', () => {
      const notify = vi.spyOn(notificationManager, 'sendNotification').mockResolvedValue({ sent: true });
      state().setFlowMode('byStage');
      state().confirmStageCard();
      const start = Date.now();
      startBoilAt(start);

      // Items due at the start were just confirmed on the card: marked, but no banner
      state().tick();
      expect(state().activeDueNotice).toBeNull();
      expect(state().announcedDueIds.length).toBeGreaterThan(0);
      expect(notify).not.toHaveBeenCalled();

      // The 15 minute hop comes due
      const hop15 = boil().additions.find(a => a.triggerTimeMin === 15 && a.type === 'hop')!;
      vi.setSystemTime(start + (boil().plannedDurationSec - hop15.triggerRemainingSec) * 1000);
      state().tick();

      const notice = state().activeDueNotice;
      expect(notice?.lines.some(line => line.includes(hop15.name))).toBe(true);
      expect(state().announcedDueIds).toContain(hop15.id);
      expect(state().activeAlertAdditions).toEqual([]);
      expect(state().activeTaskAlert).toBeNull();
      expect(notify).toHaveBeenCalledTimes(1);
      expect(state().auditLogs.at(-1)?.message).toMatch(/^Due: /);

      // Later ticks don't announce it again
      state().dismissDueNotice();
      vi.advanceTimersByTime(5000);
      state().tick();
      expect(state().activeDueNotice).toBeNull();
      expect(notify).toHaveBeenCalledTimes(1);
    });

    it('announces a timed reminder (mash pH) even though its reading waits for the Done card', () => {
      vi.spyOn(notificationManager, 'sendNotification').mockResolvedValue({ sent: true });
      state().goToStage(MASH_REST_INDEX);
      state().setFlowMode('byStage');
      state().confirmStageCard();
      const mash = state().stages[MASH_REST_INDEX];
      const ph = mash.checklist.find(c => c.id === 'ph-sample')!;
      const start = Date.now();
      useBrewStore.setState({
        timerStatus: 'running',
        timerStartedAtWallClock: start,
        timerAccumulatedElapsedSec: 0,
        timerTotalSec: mash.plannedDurationSec,
        timerRemainingSec: mash.plannedDurationSec
      });

      vi.setSystemTime(start + (mash.plannedDurationSec - ph.triggerRemainingSec!) * 1000);
      state().tick();
      expect(state().announcedDueIds).toContain('ph-sample');
      expect(state().activeDueNotice?.lines).toHaveLength(1);
      expect(state().activeTaskAlert).toBeNull();
    });

    it('does not re-announce items already past due when switching mid-stage', () => {
      const start = Date.now();
      startBoilAt(start);
      vi.setSystemTime(start + 80 * 60_000); // 10 minutes left
      state().tick();

      state().setFlowMode('byStage');
      state().confirmStageCard();
      vi.advanceTimersByTime(1000);
      state().tick();
      expect(state().activeDueNotice).toBeNull();
    });

    it('forgets announcements when moving to another stage', () => {
      state().setFlowMode('byStage');
      state().confirmStageCard();
      startBoilAt(Date.now());
      state().tick();
      expect(state().announcedDueIds.length).toBeGreaterThan(0);

      state().goToStage(BOIL_INDEX + 1);
      expect(state().announcedDueIds).toEqual([]);
      expect(state().activeDueNotice).toBeNull();
    });
  });

  describe('exports', () => {
    it('record the brew flow and mark additions confirmed on the stage card', () => {
      state().setFlowMode('byStage');
      state().confirmStageCard();
      const options = {
        recipe: state().recipe,
        stages: state().stages,
        measurements: state().measurements,
        auditLogs: state().auditLogs,
        sessionStartTime: Date.now(),
        sessionEndTime: null,
        finishedAt: null,
        strikeOffset: state().strikeOffset,
        flowMode: state().flowMode
      };

      const data = generateTelemetryData(options);
      expect(data.session.flowMode).toBe('byStage');
      const boilAdditions = data.additionsLog.filter(a => a.stageId === 'BOIL');
      expect(boilAdditions.every(a => a.confirmedVia === 'stage-card')).toBe(true);

      const markdown = generateMarkdownReport(options);
      expect(markdown).toContain('**Brew Flow**: By stage');
      expect(markdown).toContain('(at stage start)');
    });
  });

  describe('arriving at a stage', () => {
    it('shows the next stage in Prepare on arrival in By stage', () => {
      state().setFlowMode('byStage');
      state().confirmStageCard();
      expect(isPreparing()).toBe(false);

      state().nextStage(); // Boil -> Chill, which has reminders to confirm
      expect(isPreparing()).toBe(true);
    });

    it('never shows Prepare in Full step', () => {
      state().nextStage();
      expect(isPreparing()).toBe(false);
    });

    it('skips Prepare for a stage with nothing left to confirm', () => {
      state().setFlowMode('byStage');
      state().goToStage(BOIL_INDEX + 1);
      state().confirmStageCard();
      state().goToStage(BOIL_INDEX); // back to Boil...
      state().confirmStageCard();
      state().goToStage(BOIL_INDEX + 1); // ...and into the already-confirmed Chill
      expect(isPreparing()).toBe(false);
    });

    it('opens the first stage in Prepare when a recipe loads in By stage', () => {
      state().loadRecipe(testRecipe as unknown as BrewfatherRecipe);
      expect(isPreparing()).toBe(false);

      state().setFlowMode('byStage');
      state().loadRecipe(testRecipe as unknown as BrewfatherRecipe);
      expect(isPreparing()).toBe(true);
    });
  });

  describe('readings due mid-stage', () => {
    it('offers to record the mash pH when its prompt fires, until it is recorded', () => {
      vi.spyOn(notificationManager, 'sendNotification').mockResolvedValue({ sent: true });
      state().goToStage(MASH_REST_INDEX);
      state().setFlowMode('byStage');
      state().confirmStageCard();
      const mash = state().stages[MASH_REST_INDEX];
      const ph = mash.checklist.find(c => c.id === 'ph-sample')!;
      const start = Date.now();
      useBrewStore.setState({
        timerStatus: 'running',
        timerStartedAtWallClock: start,
        timerAccumulatedElapsedSec: 0,
        timerTotalSec: mash.plannedDurationSec,
        timerRemainingSec: mash.plannedDurationSec
      });

      expect(getDueReadings(state().stages[MASH_REST_INDEX], state().announcedDueIds)).toEqual([]);

      vi.setSystemTime(start + (mash.plannedDurationSec - ph.triggerRemainingSec!) * 1000);
      state().tick();
      expect(state().activeDueNotice?.readingIds).toEqual(['ph-sample']);
      expect(getDueReadings(state().stages[MASH_REST_INDEX], state().announcedDueIds).map(c => c.id)).toEqual(['ph-sample']);

      state().setMeasurement('mashPhActual', 5.3);
      const after = state().stages[MASH_REST_INDEX];
      expect(getDueReadings(after, state().announcedDueIds)).toEqual([]);
      expect(getPendingEndReadings(after)).toEqual([]);
    });
  });

  describe('mid-stage switch', () => {
    it('shows Prepare when switching mid-stage with items to confirm', () => {
      state().setFlowMode('byStage');
      expect(isPreparing()).toBe(true);
      state().confirmStageCard();
      expect(isPreparing()).toBe(false);
    });

    it('stays on the timer when everything is already confirmed', () => {
      state().setFlowMode('byStage');
      state().confirmStageCard();
      state().setFlowMode('full');
      state().setFlowMode('byStage');
      expect(isPreparing()).toBe(false);
    });
  });
});
