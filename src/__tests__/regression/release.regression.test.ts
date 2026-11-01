import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useBrewStore } from '../../store/brewStore';
import { parseBrewfatherRecipe } from '../../utils/brewfatherParser';
import { validateRecipe } from '../../utils/recipeValidation';
import { generateMarkdownReport, escapeMarkdown } from '../../utils/telemetryExport';
import testRecipe from '../fixtures/testRecipe.json';
import type { BrewfatherRecipe } from '../../types/brewfather';
import type { BrewSessionState } from '../../types/session';

const T0 = new Date('2026-01-01T12:00:00Z').getTime();
const MASH_IDX = 2;
const SPARGE_IDX = 3;

const state = () => useBrewStore.getState();
const clone = () => JSON.parse(JSON.stringify(testRecipe));
const advanceAndTick = (ms: number) => {
  vi.advanceTimersByTime(ms);
  state().tick();
};

describe('First release regression tests', () => {
  describe('stage navigation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(T0);
      state().loadRecipe(testRecipe as unknown as BrewfatherRecipe);
      useBrewStore.setState({ audioEnabled: false, vibrationEnabled: false });
      state().goToStage(MASH_IDX);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('moving to the current stage does not reset its running timer', () => {
      const planned = state().stages[MASH_IDX].plannedDurationSec;
      state().startTimer();
      advanceAndTick(60_000);

      state().goToStage(MASH_IDX);

      expect(state().timerStatus).toBe('running');
      expect(state().stages[MASH_IDX].flowPhase).toBe('running');
      advanceAndTick(1000);
      expect(state().timerRemainingSec).toBe(planned - 61);
    });

    it('a second start while running does not restart the clock', () => {
      const planned = state().stages[MASH_IDX].plannedDurationSec;
      state().startTimer();
      advanceAndTick(60_000);
      state().startTimer();
      advanceAndTick(1000);
      expect(state().timerRemainingSec).toBe(planned - 61);
    });

    it('going back leaves the later stage to be done again, not reported as completed', () => {
      state().startTimer();
      advanceAndTick(60_000);

      state().goToStage(MASH_IDX - 1);

      const left = state().stages[MASH_IDX];
      expect(left.status).toBe('pending');
      expect(left.flowPhase).toBe('ready');
      expect(left.endedAt).toBeUndefined();
      expect(state().auditLogs.at(-1)?.message).toMatch(/Went back from Mash Rest/);
    });

    it('skipping a running countdown records the time it did run', () => {
      state().startTimer();
      advanceAndTick(600_000);

      state().nextStage();

      expect(state().stages[MASH_IDX].actualDurationSec).toBe(600);
      expect(state().stages[MASH_IDX].status).toBe('completed');
    });

    it('extending does nothing unless a countdown is under way (stale lock-screen button)', () => {
      const planned = state().stages[MASH_IDX].plannedDurationSec;
      state().extendTimer(60);
      expect(state().timerTotalSec).toBe(planned);

      state().goToStage(SPARGE_IDX);
      state().startTimer();
      const before = state().stages[SPARGE_IDX].plannedDurationSec;
      state().extendTimer(60);
      expect(state().stages[SPARGE_IDX].plannedDurationSec).toBe(before);
    });
  });

  describe('a countdown that runs out while the app is closed', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(T0);
      state().loadRecipe(testRecipe as unknown as BrewfatherRecipe);
      useBrewStore.setState({ audioEnabled: false, vibrationEnabled: false });
      state().goToStage(MASH_IDX);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('still completes on reopening, with the planned time and the moment it really ended', () => {
      const planned = state().stages[MASH_IDX].plannedDurationSec;
      state().startTimer();
      advanceAndTick(5000);

      // Reopened an hour past the end: rehydration clamps the saved time to 0 before the first tick
      vi.setSystemTime(T0 + (planned + 3600) * 1000);
      useBrewStore.setState({ timerRemainingSec: 0 });
      state().tick();

      const stage = state().stages[MASH_IDX];
      expect(stage.flowPhase).toBe('finished');
      expect(stage.actualDurationSec).toBe(planned);
      expect(stage.endedAt).toBe(T0 + planned * 1000);
    });
  });

  describe('saved sessions', () => {
    it('tidies decimal litres in labels saved before whole-litre rounding', () => {
      const stages = parseBrewfatherRecipe(testRecipe as unknown as BrewfatherRecipe);
      const strike = stages.find(s => s.id === 'WATER_PREP')!;
      strike.checklist = strike.checklist.map(c => c.id === 'strike-sparge-vol' ? { ...c, label: 'Liquor 212.48L / 123.68L' } : c);
      const saved = { recipe: testRecipe, stages, auditLogs: [], measurements: {}, timerStatus: 'idle' } as unknown as BrewSessionState;

      useBrewStore.persist.getOptions().onRehydrateStorage?.(state())?.(saved as never);

      expect(strike.checklist.find(c => c.id === 'strike-sparge-vol')?.label).toBe('Liquor 213L / 124L');
    });
  });

  describe('recipe parsing', () => {
    it('leaves out targets the recipe does not give instead of inventing them', () => {
      const recipe = clone();
      delete recipe.boilSize;
      delete recipe.preBoilGravity;
      delete recipe.og;
      const stages = parseBrewfatherRecipe(recipe);
      const sparge = stages.find(s => s.id === 'LAUTER_SPARGE')!;
      const labels = sparge.checklist.map(c => c.label);
      expect(labels).toContain('Pre-boil volume');
      expect(labels).toContain('Pre-boil SG');
      expect(sparge.parameters.targetVolume).toBe(0);
      expect(sparge.parameters.targetGravity).toBeUndefined();
      expect(stages.find(s => s.id === 'KNOCKOUT_TRANSFER')!.parameters.targetGravity).toBeUndefined();
    });

    it('lists a Flameout hop at flameout rather than dropping it', () => {
      const recipe = clone();
      recipe.hops.push({ name: 'Test Flameout Hop', amount: 30, use: 'Flameout', time: 20 });
      const addition = parseBrewfatherRecipe(recipe).find(s => s.id === 'BOIL')!.additions.find(a => a.name.startsWith('Test Flameout Hop'));
      expect(addition?.triggerRemainingSec).toBe(0);
      expect(addition?.amount).toBe(30);
    });

    it('does not mistake a water field called "constructor" for a salt', () => {
      const recipe = clone();
      recipe.water.spargeAdjustments.constructor = 5;
      const sparge = parseBrewfatherRecipe(recipe).find(s => s.id === 'LAUTER_SPARGE')!;
      expect(sparge.additions.every(a => typeof a.name === 'string')).toBe(true);
      expect(sparge.additions.map(a => a.id)).not.toContain('sparge-salt-constructor');
    });

    it('falls back to a default mash for a saved recipe with an empty mash list', () => {
      const recipe = clone();
      recipe.mash.steps = [];
      expect(parseBrewfatherRecipe(recipe).find(s => s.id === 'MASH_SCHEDULE')!.plannedDurationSec).toBe(3600);
    });
  });

  describe('recipe validation', () => {
    it('still accepts the test recipe', () => {
      expect(validateRecipe(testRecipe)).toEqual([]);
    });

    it('rejects any other JSON file that happens to have a name', () => {
      const problems = validateRecipe({ name: 'brewmate', version: '1.0.0' });
      expect(problems).toContain('Recipe: "batchSize" must be a number');
      expect(problems).toContain('Recipe: "boilTime" must be a number');
      expect(problems).toContain('Recipe: has no fermentables');
      expect(problems).toContain('Recipe: has no mash steps');
    });

    it('rejects durations and amounts that would break the timers', () => {
      const huge = clone();
      huge.boilTime = 1e308;
      expect(validateRecipe(huge).some(p => /"boilTime" is out of range/.test(p))).toBe(true);

      const negative = clone();
      negative.mash.steps[0].stepTime = -5;
      expect(validateRecipe(negative).some(p => /"stepTime" is out of range/.test(p))).toBe(true);

      const noMash = clone();
      noMash.mash.steps = noMash.mash.steps.map((s: object) => ({ ...s, stepTime: 0 }));
      expect(validateRecipe(noMash).some(p => /total mash time/.test(p))).toBe(true);

      const badHop = clone();
      badHop.hops[0].use = 'Boil';
      badHop.hops[0].time = -10;
      expect(validateRecipe(badHop).some(p => /Hop #1.*"time" is out of range/.test(p))).toBe(true);

      const longName = clone();
      longName.name = 'x'.repeat(201);
      expect(validateRecipe(longName)).toContain('Recipe: "name" is too long');
    });

    it('does not apply timer limits to uses that do not drive a timer (dry hops)', () => {
      const dryHop = clone();
      dryHop.hops.push({ name: 'Test Dry Hop', amount: 50, use: 'Dry Hop', time: -2 });
      expect(validateRecipe(dryHop)).toEqual([]);
    });
  });

  describe('Markdown report', () => {
    const report = (recipe: BrewfatherRecipe) => generateMarkdownReport({
      recipe,
      stages: parseBrewfatherRecipe(recipe),
      measurements: {},
      auditLogs: [],
      sessionStartTime: null,
      sessionEndTime: null,
      finishedAt: null,
      strikeOffset: 10
    });

    it('names each addition\'s stage, and only calls boil additions Flameout', () => {
      const lines = report(testRecipe as unknown as BrewfatherRecipe).split('\n');
      const gypsum = lines.find(l => l.startsWith('| Gypsum (CaSO4) | Strike Water'));
      expect(gypsum).toBeDefined();
      expect(gypsum).not.toContain('Flameout');
    });

    it('keeps recipe text from becoming links, images, HTML or table cells', () => {
      expect(escapeMarkdown('![x](http://evil.example/x.png)')).toBe('!\\[x\\](http://evil.example/x.png)');
      expect(escapeMarkdown('<img src=x>')).toBe('\\<img src=x\\>');
      expect(escapeMarkdown('a|b')).toBe('a\\|b');
      expect(escapeMarkdown('one\n\ntwo')).toBe('one two');
      expect(escapeMarkdown('Citra (Pellet)')).toBe('Citra (Pellet)');

      const hostile = clone();
      hostile.name = '![x](http://evil.example/x.png)';
      expect(report(hostile)).not.toContain('![x]');
    });
  });
});

describe('Wake lock', () => {
  const makeSentinel = () => {
    const sentinel = { released: false, release: vi.fn(async () => { sentinel.released = true; }) };
    return sentinel;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('shares one lock between simultaneous requests, so turning it off really releases it', async () => {
    const sentinels: ReturnType<typeof makeSentinel>[] = [];
    const request = vi.fn(async () => {
      const sentinel = makeSentinel();
      sentinels.push(sentinel);
      return sentinel;
    });
    vi.stubGlobal('navigator', { wakeLock: { request } });
    const { wakeLockManager } = await import('../../utils/wakeLock');

    await Promise.all([wakeLockManager.requestLock(), wakeLockManager.requestLock(), wakeLockManager.requestLock()]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(wakeLockManager.isActive()).toBe(true);

    await wakeLockManager.releaseLock();
    expect(sentinels[0].release).toHaveBeenCalledTimes(1);
    expect(wakeLockManager.isActive()).toBe(false);
  });

  it('releases a lock that arrives after it was turned off', async () => {
    const sentinel = makeSentinel();
    let grant: (value: typeof sentinel) => void = () => {};
    const request = vi.fn(() => new Promise<typeof sentinel>(resolve => { grant = resolve; }));
    vi.stubGlobal('navigator', { wakeLock: { request } });
    const { wakeLockManager } = await import('../../utils/wakeLock');

    const pending = wakeLockManager.requestLock();
    await wakeLockManager.releaseLock();
    grant(sentinel);

    expect(await pending).toBe(false);
    expect(sentinel.release).toHaveBeenCalledTimes(1);
    expect(wakeLockManager.isActive()).toBe(false);
  });
});
