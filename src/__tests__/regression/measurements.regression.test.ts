import { describe, it, expect, beforeEach } from 'vitest';
import { useBrewStore } from '../../store/brewStore';
import testRecipe from '../fixtures/testRecipe.json';
import type { BrewfatherRecipe } from '../../types/brewfather';
import { generateTelemetryData, generateCsvReport, generateMarkdownReport } from '../../utils/telemetryExport';

const state = () => useBrewStore.getState();
const checklistItem = (stageId: string, itemId: string) =>
  state().stages.find(s => s.id === stageId)!.checklist.find(c => c.id === itemId);

const exportOptions = () => ({
  recipe: state().recipe,
  stages: state().stages,
  measurements: state().measurements,
  auditLogs: state().auditLogs,
  sessionStartTime: Date.now() - 3600_000,
  sessionEndTime: Date.now(),
  finishedAt: Date.now(),
  strikeOffset: state().strikeOffset
});

describe('Temperature measurements (strike and mash-in)', () => {
  beforeEach(() => {
    state().loadRecipe(testRecipe as unknown as BrewfatherRecipe);
  });

  it('adds a Strike temp reminder that follows the strike offset', () => {
    const strike = state().stages.find(s => s.id === 'WATER_PREP')!;
    const ids = strike.checklist.map(c => c.id);
    expect(ids.indexOf('strike-temp')).toBe(ids.indexOf('water-treat') + 1);
    expect(checklistItem('WATER_PREP', 'strike-temp')?.label).toBe(`Strike temp ${strike.parameters.targetTemp}°C`);

    state().setStrikeOffset(12);
    const target = state().stages.find(s => s.id === 'WATER_PREP')!.parameters.targetTemp;
    expect(checklistItem('WATER_PREP', 'strike-temp')?.label).toBe(`Strike temp ${target}°C`);
  });

  it('recording a temperature ticks its reminder and is logged', () => {
    state().goToStage(0);
    state().setMeasurement('strikeTempActual', 76.5);
    expect(state().measurements.strikeTempActual).toBe(76.5);
    expect(checklistItem('WATER_PREP', 'strike-temp')?.checked).toBe(true);
    expect(state().auditLogs.at(-1)?.type).toBe('MEASUREMENT_RECORDED');

    state().goToStage(1);
    state().setMeasurement('mashInTempActual', 66.5);
    expect(state().measurements.mashInTempActual).toBe(66.5);
    expect(checklistItem('MASH_IN', 'mash-temp-init')?.checked).toBe(true);
  });

  it('includes both temperatures in the JSON, CSV and Markdown exports', () => {
    state().setMeasurement('strikeTempActual', 76.5);
    state().setMeasurement('mashInTempActual', 66.5);

    const telemetry = generateTelemetryData(exportOptions());
    expect(telemetry.measurements.strikeTempActualC).toBe(76.5);
    expect(telemetry.measurements.mashInTempActualC).toBe(66.5);

    const csv = generateCsvReport(exportOptions());
    expect(csv).toContain('"Mash In Temp Actual (C)"');
    expect(csv).toContain('"66.5"');

    const markdown = generateMarkdownReport(exportOptions());
    expect(markdown).toContain('**Mash In Temp**: 66.5 °C');
  });
});
