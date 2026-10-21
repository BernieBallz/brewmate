import { describe, it, expect, beforeEach } from 'vitest';
import { useBrewStore } from '../../store/brewStore';
import testRecipe from '../fixtures/testRecipe.json';
import type { BrewfatherRecipe } from '../../types/brewfather';

describe('Flow State Machine & Grainfather Track Regression Suite', () => {
  beforeEach(() => {
    useBrewStore.getState().loadRecipe(testRecipe as unknown as BrewfatherRecipe);
  });

  it('progresses through confirm stages via confirmFlowStage without modals', () => {
    const store = useBrewStore.getState();
    expect(store.currentStageIndex).toBe(0);
    expect(store.stages[0].id).toBe('WATER_PREP');
    expect(store.stages[0].flow.startLabel).toBe('STRIKE READY');

    // 1. STRIKE READY -> moves to MASH_IN
    useBrewStore.getState().confirmFlowStage();
    expect(useBrewStore.getState().currentStageIndex).toBe(1);
    expect(useBrewStore.getState().stages[1].id).toBe('MASH_IN');
    expect(useBrewStore.getState().stages[1].flow.startLabel).toBe('DONE');

    // 2. DONE -> moves to MASH_SCHEDULE
    useBrewStore.getState().confirmFlowStage();
    expect(useBrewStore.getState().currentStageIndex).toBe(2);
    expect(useBrewStore.getState().stages[2].id).toBe('MASH_SCHEDULE');
    expect(useBrewStore.getState().stages[2].flow.startLabel).toBe('START MASH REST');
  });

  it('runs stopwatch stages and stores elapsed duration on stopStopwatch', () => {
    // Jump to LAUTER_SPARGE (stage 3)
    useBrewStore.getState().goToStage(3);
    const store = useBrewStore.getState();
    expect(store.stages[3].id).toBe('LAUTER_SPARGE');
    expect(store.stages[3].flow.kind).toBe('stopwatch');
    expect(store.stages[3].flow.startLabel).toBe('START SPARGE');
    expect(store.stages[3].flow.stopLabel).toBe('STOP SPARGE');

    // Start stopwatch
    useBrewStore.getState().startTimer();
    expect(useBrewStore.getState().timerStatus).toBe('running');
    expect(useBrewStore.getState().stages[3].flowPhase).toBe('running');

    // Stop stopwatch
    useBrewStore.getState().stopStopwatch();
    const updatedStore = useBrewStore.getState();
    expect(updatedStore.timerStatus).toBe('idle');
    expect(updatedStore.stages[3].flowPhase).toBe('finished');

    // Verify audit log has MEASUREMENT_RECORDED
    const lastAudit = updatedStore.auditLogs[updatedStore.auditLogs.length - 1];
    expect(lastAudit.type).toBe('MEASUREMENT_RECORDED');
    expect(lastAudit.message).toContain('Sparge time stored');
  });

  it('stamps finishedAt and sessionEndTime when FINISH BREW is executed in CLEANUP', () => {
    // Go to CLEANUP (stage 8)
    const store = useBrewStore.getState();
    const cleanupIdx = store.stages.findIndex(s => s.id === 'CLEANUP');
    useBrewStore.getState().goToStage(cleanupIdx);

    expect(useBrewStore.getState().stages[cleanupIdx].flow.startLabel).toBe('FINISH BREW');
    expect(useBrewStore.getState().finishedAt).toBeNull();

    // Confirm finish brew
    useBrewStore.getState().confirmFlowStage();

    const finishedStore = useBrewStore.getState();
    expect(finishedStore.finishedAt).not.toBeNull();
    expect(finishedStore.sessionEndTime).not.toBeNull();
    expect(finishedStore.stages[cleanupIdx].flowPhase).toBe('finished');
  });

  it('never publishes MediaSession metadata, so Android shows no music/media player card', () => {
    // 1. Countdown stage (BOIL)
    const boilIdx = useBrewStore.getState().stages.findIndex(s => s.id === 'BOIL');
    useBrewStore.getState().goToStage(boilIdx);
    useBrewStore.getState().startTimer();
    useBrewStore.getState().tick();

    // Verify no media session metadata is set while timers run
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      expect(navigator.mediaSession.metadata).toBeNull();
    }

    // 2. Stopwatch stage (LAUTER_SPARGE)
    const spargeIdx = useBrewStore.getState().stages.findIndex(s => s.id === 'LAUTER_SPARGE');
    useBrewStore.getState().goToStage(spargeIdx);
    useBrewStore.getState().startTimer();
    useBrewStore.getState().tick();

    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      expect(navigator.mediaSession.metadata).toBeNull();
    }
  });
});
