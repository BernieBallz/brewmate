import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import testRecipe from '../fixtures/testRecipe.json';
import type { BrewfatherRecipe } from '../../types/brewfather';
import { useBrewStore, ALERT_SNOOZE_MIN, getUnconfirmedAdditions } from '../../store/brewStore';

const BOIL_INDEX = 4;

// Put the boil countdown into a running state directly, avoiding startTimer's device side effects
const startBoilAt = (now: number) => {
  const boil = useBrewStore.getState().stages[BOIL_INDEX];
  useBrewStore.setState({
    timerStatus: 'running',
    timerStartedAtWallClock: now,
    timerAccumulatedElapsedSec: 0,
    timerTotalSec: boil.plannedDurationSec,
    timerRemainingSec: boil.plannedDurationSec
  });
};

const activeAlertIds = () => useBrewStore.getState().activeAlertAdditions.map(a => a.id);

describe('Alert snooze, undo and advance guard regression tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T10:00:00Z'));
    useBrewStore.getState().loadRecipe(testRecipe as unknown as BrewfatherRecipe);
    useBrewStore.getState().goToStage(BOIL_INDEX);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('re-raises a snoozed addition alert once the snooze period has passed', () => {
    startBoilAt(Date.now());
    useBrewStore.getState().tick();

    const startAddition = useBrewStore.getState().stages[BOIL_INDEX].additions.find(a => a.triggerTimeMin === 90)!;
    expect(activeAlertIds()).toContain(startAddition.id);

    useBrewStore.getState().dismissAlertModal();
    expect(activeAlertIds()).toEqual([]);

    // Still snoozed just before the snooze period ends
    vi.advanceTimersByTime(ALERT_SNOOZE_MIN * 60_000 - 1000);
    useBrewStore.getState().tick();
    expect(activeAlertIds()).not.toContain(startAddition.id);

    // Alerts again once it has passed
    vi.advanceTimersByTime(2000);
    useBrewStore.getState().tick();
    expect(activeAlertIds()).toContain(startAddition.id);
  });

  it('clears snoozes when moving to another stage', () => {
    startBoilAt(Date.now());
    useBrewStore.getState().tick();
    useBrewStore.getState().dismissAlertModal();
    expect(Object.keys(useBrewStore.getState().alertSnoozedUntil).length).toBeGreaterThan(0);

    useBrewStore.getState().goToStage(BOIL_INDEX + 1);
    expect(useBrewStore.getState().alertSnoozedUntil).toEqual({});
  });

  it('undoes a confirmed addition, un-ticks the additions reminder and logs it', () => {
    useBrewStore.getState().goToStage(1); // MASH_IN
    const mashIn = useBrewStore.getState().stages[1];
    for (const addition of mashIn.additions) {
      useBrewStore.getState().confirmAddition(addition.id);
    }
    expect(useBrewStore.getState().stages[1].checklist.find(c => c.id === 'mash-additions-check')?.checked).toBe(true);

    const undoId = mashIn.additions[0].id;
    useBrewStore.getState().unconfirmAddition(undoId);

    const after = useBrewStore.getState().stages[1];
    expect(after.additions.find(a => a.id === undoId)?.confirmed).toBe(false);
    expect(after.additions.find(a => a.id === undoId)?.confirmedAt).toBeUndefined();
    expect(after.checklist.find(c => c.id === 'mash-additions-check')?.checked).toBe(false);
    expect(useBrewStore.getState().auditLogs.at(-1)?.message).toContain('Undid addition');
  });

  it('reports unconfirmed additions for the advance guard', () => {
    const boil = useBrewStore.getState().stages[BOIL_INDEX];
    expect(getUnconfirmedAdditions(boil).length).toBe(boil.additions.length);

    useBrewStore.getState().confirmAdditions(boil.additions.map(a => a.id));
    expect(getUnconfirmedAdditions(useBrewStore.getState().stages[BOIL_INDEX])).toEqual([]);
  });
});
