import { describe, it, expect } from 'vitest';
import { parseBrewfatherRecipe } from '../../utils/brewfatherParser';
import testRecipe from '../fixtures/testRecipe.json';
import type { BrewfatherRecipe } from '../../types/brewfather';

describe('Triggers & Addition Timing Regression Tests', () => {
  it('correctly maps addition triggers in boil stage to remaining seconds', () => {
    const stages = parseBrewfatherRecipe(testRecipe as unknown as BrewfatherRecipe);
    const boilStage = stages.find(s => s.id === 'BOIL')!;
    expect(boilStage).toBeDefined();

    // In testRecipe, boil is 90 mins (5400s)
    // Additions with time X min before flameout should have triggerRemainingSec = X * 60
    for (const addition of boilStage.additions) {
      expect(addition.triggerRemainingSec).toBe(addition.triggerTimeMin * 60);
      expect(addition.triggerRemainingSec).toBeLessThanOrEqual(5400);
      expect(addition.triggerRemainingSec).toBeGreaterThanOrEqual(0);
    }
  });

  it('correctly configures ph-sample (15m into mash) and vorlauf checklist alerts in mash stage', () => {
    // 1. In testRecipe, mash is 90 min.
    // ph-sample triggers 15m into mash = 75 min remaining (4500s)
    // vorlauf triggers 60m into mash = 30 min remaining (1800s)
    const stages = parseBrewfatherRecipe(testRecipe as unknown as BrewfatherRecipe);
    const mashStage = stages.find(s => s.id === 'MASH_SCHEDULE')!;
    expect(mashStage).toBeDefined();

    const phSample = mashStage.checklist.find(c => c.id === 'ph-sample');
    expect(phSample).toBeDefined();
    expect(phSample?.triggerRemainingSec).toBe(75 * 60);
    expect(phSample?.alertTitle).toContain('MASH');

    const vorlauf = mashStage.checklist.find(c => c.id === 'vorlauf-check');
    expect(vorlauf).toBeDefined();
    expect(vorlauf?.triggerRemainingSec).toBe(30 * 60);
    expect(vorlauf?.alertTitle).toBeDefined();
    expect(vorlauf?.alertTitle).toContain('MASH');

    // 2. In a 60 min mash, ph-sample = 45m remaining (2700s), vorlauf = 15m remaining (900s)
    const recipe60Min = {
      ...testRecipe,
      mash: {
        steps: [{ name: 'Single infusion', stepTemp: 65, stepTime: 60 }],
      },
    } as unknown as BrewfatherRecipe;
    const stages60 = parseBrewfatherRecipe(recipe60Min);
    const mash60 = stages60.find(s => s.id === 'MASH_SCHEDULE')!;
    expect(mash60.checklist.find(c => c.id === 'ph-sample')?.triggerRemainingSec).toBe(45 * 60);
    const vorlauf60 = mash60.checklist.find(c => c.id === 'vorlauf-check');
    expect(vorlauf60?.triggerRemainingSec).toBe(15 * 60);
    expect(vorlauf60?.alertTitle).toBeDefined();
  });

  it('assigns trigger 0 to manual stage additions (Mash In & Yeast Pitch)', () => {
    const stages = parseBrewfatherRecipe(testRecipe as unknown as BrewfatherRecipe);
    const mashIn = stages.find(s => s.id === 'MASH_IN')!;
    const yeastPitch = stages.find(s => s.id === 'YEAST_PITCH')!;

    expect(mashIn.additions.length).toBeGreaterThan(0);
    for (const add of mashIn.additions) {
      expect(add.triggerRemainingSec).toBe(0);
    }

    expect(yeastPitch.additions.length).toBeGreaterThan(0);
    for (const add of yeastPitch.additions) {
      expect(add.triggerRemainingSec).toBe(0);
    }
  });

  it('auto-checks addition reminder when all stage additions are confirmed', async () => {
    const { useBrewStore } = await import('../../store/brewStore');
    useBrewStore.getState().loadRecipe(testRecipe as unknown as BrewfatherRecipe);

    // Move to MASH_IN (index 1), which has mash additions and 'mash-additions-check' reminder
    useBrewStore.getState().goToStage(1);
    const mashInBefore = useBrewStore.getState().stages[1];
    const reminderBefore = mashInBefore.checklist.find(c => c.id === 'mash-additions-check');
    expect(reminderBefore?.checked).toBe(false);

    // Confirm all additions in Mash In
    for (const addition of mashInBefore.additions) {
      useBrewStore.getState().confirmAddition(addition.id);
    }

    const mashInAfter = useBrewStore.getState().stages[1];
    const reminderAfter = mashInAfter.checklist.find(c => c.id === 'mash-additions-check');
    expect(reminderAfter?.checked).toBe(true);
  });

  it('auto-checks measurement reminder when pH or SG measurement is recorded', async () => {
    const { useBrewStore } = await import('../../store/brewStore');
    useBrewStore.getState().loadRecipe(testRecipe as unknown as BrewfatherRecipe);

    // Move to MASH_SCHEDULE (index 2), which has 'ph-sample' reminder
    useBrewStore.getState().goToStage(2);
    expect(useBrewStore.getState().stages[2].checklist.find(c => c.id === 'ph-sample')?.checked).toBe(false);

    // Record mash pH measurement
    useBrewStore.getState().setMeasurement('mashPhActual', 5.25);
    expect(useBrewStore.getState().stages[2].checklist.find(c => c.id === 'ph-sample')?.checked).toBe(true);
  });

  it('correctly provides volumeLabel across stages (STRIKE, MASH VOL, PRE-BOIL)', () => {
    const stages = parseBrewfatherRecipe(testRecipe as unknown as BrewfatherRecipe);
    const strikeStage = stages.find(s => s.id === 'WATER_PREP')!;
    const mashInStage = stages.find(s => s.id === 'MASH_IN')!;
    const spargeStage = stages.find(s => s.id === 'LAUTER_SPARGE')!;

    expect(strikeStage.parameters.volumeLabel).toBe('STRIKE');
    expect(mashInStage.parameters.volumeLabel).toBe('MASH VOL');
    expect(spargeStage.parameters.volumeLabel).toBe('PRE-BOIL');
  });

  it('supports confirming a subset of simultaneous additions via confirmAdditions', async () => {
    const { useBrewStore } = await import('../../store/brewStore');
    useBrewStore.getState().loadRecipe(testRecipe as unknown as BrewfatherRecipe);
    useBrewStore.getState().goToStage(1); // MASH_IN has 2 additions in testRecipe

    const mashStage = useBrewStore.getState().stages[1];
    expect(mashStage.additions.length).toBeGreaterThanOrEqual(2);

    // Simulate 2 additions triggering simultaneously
    useBrewStore.setState({ activeAlertAdditions: [mashStage.additions[0], mashStage.additions[1]] });
    expect(useBrewStore.getState().activeAlertAdditions.length).toBe(2);

    // Confirm only the first addition
    const firstId = mashStage.additions[0].id;
    const secondId = mashStage.additions[1].id;
    useBrewStore.getState().confirmAdditions([firstId]);

    // First addition is confirmed, second addition remains in activeAlertAdditions
    const updatedMash = useBrewStore.getState().stages[1];
    expect(updatedMash.additions.find(a => a.id === firstId)?.confirmed).toBe(true);
    expect(updatedMash.additions.find(a => a.id === secondId)?.confirmed).toBe(false);

    expect(useBrewStore.getState().activeAlertAdditions.map(a => a.id)).toEqual([secondId]);

    // Confirm remaining addition
    useBrewStore.getState().confirmAdditions([secondId]);
    expect(useBrewStore.getState().activeAlertAdditions.length).toBe(0);
    expect(useBrewStore.getState().stages[1].additions.find(a => a.id === secondId)?.confirmed).toBe(true);
  });
});
