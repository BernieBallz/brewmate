import { describe, it, expect, beforeEach } from 'vitest';
import { useBrewStore } from '../../store/brewStore';
import testRecipe from '../fixtures/testRecipe.json';
import type { BrewfatherRecipe } from '../../types/brewfather';

describe('Strike Offset Regression Suite', () => {
  beforeEach(() => {
    useBrewStore.getState().loadRecipe(testRecipe as unknown as BrewfatherRecipe);
  });

  it('calculates target strike temperature as mashTemp + strikeOffset', () => {
    const store = useBrewStore.getState();
    const mashTemp = store.recipe?.mash?.steps?.[0]?.stepTemp || 65; // testRecipe mash temp is 67
    
    // Initial default strike offset is 10
    expect(store.strikeOffset).toBe(10);
    const waterPrep = store.stages.find(s => s.id === 'WATER_PREP')!;
    expect(waterPrep.parameters.targetTemp).toBe(Number((mashTemp + 10).toFixed(1)));
  });

  it('updates target strike temp dynamically when strikeOffset changes', () => {
    useBrewStore.getState().setStrikeOffset(15);
    const store = useBrewStore.getState();
    expect(store.strikeOffset).toBe(15);

    const mashTemp = store.recipe?.mash?.steps?.[0]?.stepTemp || 65;
    const waterPrep = store.stages.find(s => s.id === 'WATER_PREP')!;
    expect(waterPrep.parameters.targetTemp).toBe(Number((mashTemp + 15).toFixed(1)));
    expect(waterPrep.flow.endLog).toContain('+15°C');
  });

  it('clamps strike offset to sensible range [0, 25]', () => {
    useBrewStore.getState().setStrikeOffset(-5);
    expect(useBrewStore.getState().strikeOffset).toBe(0);

    useBrewStore.getState().setStrikeOffset(35);
    expect(useBrewStore.getState().strikeOffset).toBe(25);
  });
});
