import { describe, it, expect } from 'vitest';
import { parseBrewfatherRecipe } from '../../utils/brewfatherParser';
import testRecipe from '../fixtures/testRecipe.json';
import type { BrewfatherRecipe } from '../../types/brewfather';

describe('Brewfather Parser Regression Test', () => {
  it('parses testRecipe.json correctly into 9 stages (no whirlpool)', () => {
    const stages = parseBrewfatherRecipe(testRecipe as unknown as BrewfatherRecipe);
    
    // Sample recipe has no whirlpool hops/time, so 9 stages are generated
    expect(stages).toHaveLength(9);
    
    const stageIds = stages.map(s => s.id);
    expect(stageIds).toEqual([
      'WATER_PREP',
      'MASH_IN',
      'MASH_SCHEDULE',
      'LAUTER_SPARGE',
      'BOIL',
      'COOLING_RECIRC',
      'KNOCKOUT_TRANSFER',
      'YEAST_PITCH',
      'CLEANUP',
    ]);

    // Check boil duration
    const boilStage = stages.find(s => s.id === 'BOIL');
    expect(boilStage?.plannedDurationSec).toBe(90 * 60);

    // Check additions in boil stage
    expect(boilStage?.additions.length).toBeGreaterThan(0);

    // Check vorlauf alert in mash schedule
    const mashStage = stages.find(s => s.id === 'MASH_SCHEDULE');
    const vorlaufTask = mashStage?.checklist.find(c => c.id === 'vorlauf-check');
    expect(vorlaufTask).toBeDefined();
    expect(vorlaufTask?.triggerRemainingSec).toBeDefined();

    // Verify all stages define a valid FlowStep
    for (const stage of stages) {
      expect(stage.flow).toBeDefined();
      expect(stage.flow.kind).toBeDefined();
      expect(['confirm', 'countdown', 'stopwatch']).toContain(stage.flow.kind);
      expect(stage.flow.startLabel).toBeDefined();
      expect(stage.flow.startLog).toBeDefined();
      expect(stage.flow.endLog).toBeDefined();
    }

    // Verify Grainfather wording
    expect(stages.find(s => s.id === 'WATER_PREP')?.flow.startLabel).toBe('STRIKE READY');
    expect(stages.find(s => s.id === 'MASH_IN')?.flow.startLabel).toBe('DONE');
    expect(stages.find(s => s.id === 'MASH_SCHEDULE')?.flow.startLabel).toBe('START MASH REST');
    expect(stages.find(s => s.id === 'LAUTER_SPARGE')?.flow.startLabel).toBe('START SPARGE');
    expect(stages.find(s => s.id === 'BOIL')?.flow.startLabel).toBe('START BOIL');
    expect(stages.find(s => s.id === 'COOLING_RECIRC')?.flow.startLabel).toBe('START CHILL');
    expect(stages.find(s => s.id === 'KNOCKOUT_TRANSFER')?.flow.startLabel).toBe('START KNOCKOUT');
    expect(stages.find(s => s.id === 'YEAST_PITCH')?.flow.startLabel).toBe('YEAST IN');
    expect(stages.find(s => s.id === 'CLEANUP')?.flow.startLabel).toBe('FINISH BREW');
  });

  it('generates whirlpool stage when whirlpool additions are present', () => {
    const recipeWithWhirlpool = {
      ...testRecipe,
      hops: [
        ...(testRecipe.hops || []),
        {
          name: 'Citra',
          amount: 50,
          use: 'Whirlpool',
          temp: 85,
        },
      ],
    } as unknown as BrewfatherRecipe;

    const stages = parseBrewfatherRecipe(recipeWithWhirlpool);
    expect(stages).toHaveLength(10);
    const wp = stages.find(s => s.id === 'HOPSTAND_WHIRLPOOL');
    expect(wp).toBeDefined();
    expect(wp?.flow.startLabel).toBe('START WHIRLPOOL');
    expect(wp?.flow.kind).toBe('countdown');
  });

  it('verifies checklist items are short reminder memory-joggers with explanations', () => {
    const stages = parseBrewfatherRecipe(testRecipe as unknown as BrewfatherRecipe);
    const cleanup = stages.find(s => s.id === 'CLEANUP')!;
    const labels = cleanup.checklist.map(c => c.label);
    expect(labels).toEqual(['Spent grain out', 'Backflush chiller']);
    expect(cleanup.checklist[0].explanation).toBeDefined();

    // Verify renames and removals across stages
    const strike = stages.find(s => s.id === 'WATER_PREP')!;
    expect(strike.checklist.map(c => c.label)).toContain('Water salts');

    const mashIn = stages.find(s => s.id === 'MASH_IN')!;
    expect(mashIn.checklist[0].id).toBe('mash-temp-init');
    expect(mashIn.checklist[0].label).toContain('Dough in & set temp');
    expect(mashIn.checklist.map(c => c.id)).not.toContain('dough-in-flow');

    const mashSchedule = stages.find(s => s.id === 'MASH_SCHEDULE')!;
    expect(mashSchedule.checklist.map(c => c.label)).toContain('Check mash temp 65°C');
    expect(mashSchedule.checklist.map(c => c.id)).not.toContain('iodine-test');

    const boil = stages.find(s => s.id === 'BOIL')!;
    expect(boil.checklist.map(c => c.id)).not.toContain('whirlpool-prep');

    const chill = stages.find(s => s.id === 'COOLING_RECIRC')!;
    expect(chill.checklist.map(c => c.label)).toContain('Transfer hose');

    const pitch = stages.find(s => s.id === 'YEAST_PITCH')!;
    expect(pitch.checklist.map(c => c.id)).not.toContain('seal-fv');
  });

  it('uses flow-matching short names and realistic stopwatch estimates', () => {
    const stages = parseBrewfatherRecipe(testRecipe as unknown as BrewfatherRecipe);
    const byId = (id: string) => stages.find(s => s.id === id)!;

    expect(byId('MASH_SCHEDULE').shortCode).toBe('MASH REST');
    expect(byId('LAUTER_SPARGE').shortCode).toBe('SPARGE');
    expect(byId('LAUTER_SPARGE').title).toBe('Sparge');

    // Stopwatch stages record actual time; plannedDurationSec is only an estimate
    expect(byId('LAUTER_SPARGE').timerType).toBe('stopwatch');
    expect(byId('LAUTER_SPARGE').plannedDurationSec).toBe(45 * 60);
    expect(byId('COOLING_RECIRC').plannedDurationSec).toBe(20 * 60);
    expect(byId('KNOCKOUT_TRANSFER').plannedDurationSec).toBe(60 * 60);
  });

  it('has one "heat off" (Boil), Sanitise loop last in Boil, and a recipe-driven whirlpool cool-to reminder', () => {
    const recipeWithWhirlpool = {
      ...testRecipe,
      hops: [...testRecipe.hops, { name: 'Test Whirlpool Hop', amount: 50, use: 'Whirlpool', temp: 85 }],
    } as unknown as BrewfatherRecipe;
    const stages = parseBrewfatherRecipe(recipeWithWhirlpool);
    const byId = (id: string) => stages.find(s => s.id === id)!;

    const boil = byId('BOIL');
    expect(boil.checklist.at(-1)?.id).toBe('hx-hot-sanitize');
    expect(boil.checklist.at(-1)?.label).toBe('Sanitise loop');
    expect(byId('COOLING_RECIRC').checklist.map(c => c.id)).not.toContain('hx-hot-sanitize');

    const whirlpool = byId('HOPSTAND_WHIRLPOOL');
    expect(whirlpool.checklist[0].label).toBe(`Cool to ${whirlpool.parameters.targetTemp}°C`);
    const heatOffReminders = stages.flatMap(s => s.checklist).filter(c => /heat off/i.test(c.label));
    expect(heatOffReminders.map(c => c.id)).toEqual(['steam-heat-off']);
  });
});
