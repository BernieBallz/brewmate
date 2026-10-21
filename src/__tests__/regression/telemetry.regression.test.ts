import { describe, it, expect, beforeEach } from 'vitest';
import { useBrewStore } from '../../store/brewStore';
import testRecipe from '../fixtures/testRecipe.json';
import type { BrewfatherRecipe } from '../../types/brewfather';
import {
  generateTelemetryData,
  generateCsvReport,
  generateMarkdownReport,
  formatHourMinSec
} from '../../utils/telemetryExport';

describe('Telemetry & Audit Logging Regression Suite', () => {
  beforeEach(() => {
    useBrewStore.getState().loadRecipe(testRecipe as unknown as BrewfatherRecipe);
  });

  it('captures brewSessionDate, stage timestamps (startedAt/completedAt), and lengthOfBrewDay', () => {
    const store = useBrewStore.getState();
    const startTime = new Date('2026-10-17T08:00:00Z').getTime();
    const endTime = new Date('2026-10-17T13:30:00Z').getTime();

    // Set mock timings on stages
    const mockStages = store.stages.map((s, idx) => ({
      ...s,
      startedAt: startTime + idx * 1800 * 1000,
      endedAt: startTime + (idx + 1) * 1800 * 1000,
      actualDurationSec: 1800, // 30m each
      status: 'completed' as const
    }));

    const telemetry = generateTelemetryData({
      recipe: store.recipe,
      stages: mockStages,
      measurements: store.measurements,
      auditLogs: store.auditLogs,
      sessionStartTime: startTime,
      sessionEndTime: endTime,
      finishedAt: endTime,
      strikeOffset: store.strikeOffset
    });

    // 1. Session Date
    expect(telemetry.session.brewSessionDate).toBe('2026-10-17');
    expect(telemetry.session.brewSessionDateFormatted).toBeDefined();

    // 2. Length of Brew Day (Sum of stage durations)
    const expectedTotalSec = mockStages.length * 1800;
    expect(telemetry.session.lengthOfBrewDaySec).toBe(expectedTotalSec);
    expect(telemetry.session.lengthOfBrewDayFormatted).toBe(formatHourMinSec(expectedTotalSec));
    expect(telemetry.session.lengthOfBrewDay).toEqual({
      totalDurationSec: expectedTotalSec,
      totalDurationFormatted: formatHourMinSec(expectedTotalSec),
      wallClockDurationSec: Math.round((endTime - startTime) / 1000),
      wallClockDurationFormatted: formatHourMinSec(Math.round((endTime - startTime) / 1000)),
      hours: Number((expectedTotalSec / 3600).toFixed(2))
    });

    // 3. Stage Timestamps
    mockStages.forEach((s, idx) => {
      const stageTelemetry = telemetry.stages[idx];
      expect(stageTelemetry.startedAt).toBe(s.startedAt);
      expect(stageTelemetry.startedAtIso).toBe(new Date(s.startedAt!).toISOString());
      expect(stageTelemetry.startedAtTime).toBeDefined();
      expect(stageTelemetry.completedAt).toBe(s.endedAt);
      expect(stageTelemetry.completedAtIso).toBe(new Date(s.endedAt!).toISOString());
      expect(stageTelemetry.completedAtTime).toBeDefined();
      expect(stageTelemetry.actualDurationFormatted).toBe('30m 00s');
    });
  });

  it('generates CSV report with Session Date, Length of Brew Day, and stage Started/Completed columns', () => {
    const store = useBrewStore.getState();
    const startTime = new Date('2026-10-17T08:00:00Z').getTime();
    const endTime = new Date('2026-10-17T12:00:00Z').getTime();

    const mockStages = store.stages.map((s, idx) => ({
      ...s,
      startedAt: startTime + idx * 600 * 1000,
      endedAt: startTime + (idx + 1) * 600 * 1000,
      actualDurationSec: 600,
      status: 'completed' as const
    }));

    const csv = generateCsvReport({
      recipe: store.recipe,
      stages: mockStages,
      measurements: store.measurements,
      auditLogs: store.auditLogs,
      sessionStartTime: startTime,
      sessionEndTime: endTime,
      finishedAt: endTime,
      strikeOffset: store.strikeOffset
    });

    expect(csv).toContain('"Session Date"');
    expect(csv).toContain('"Length of Brew Day"');
    expect(csv).toContain('"Started At"');
    expect(csv).toContain('"Completed At"');
  });

  it('generates Markdown report with Brew Session Date, Length of Brew Day, and stage columns', () => {
    const store = useBrewStore.getState();
    const startTime = new Date('2026-10-17T08:00:00Z').getTime();
    const endTime = new Date('2026-10-17T12:00:00Z').getTime();

    const mockStages = store.stages.map((s, idx) => ({
      ...s,
      startedAt: startTime + idx * 600 * 1000,
      endedAt: startTime + (idx + 1) * 600 * 1000,
      actualDurationSec: 600,
      status: 'completed' as const
    }));

    const md = generateMarkdownReport({
      recipe: store.recipe,
      stages: mockStages,
      measurements: store.measurements,
      auditLogs: store.auditLogs,
      sessionStartTime: startTime,
      sessionEndTime: endTime,
      finishedAt: endTime,
      strikeOffset: store.strikeOffset
    });

    expect(md).toContain('**Brew Session Date**:');
    expect(md).toContain('**Length of Brew Day**:');
    expect(md).toContain('| Stage | Started | Completed | Planned | Actual | Delta Variance | Status |');
  });
});
