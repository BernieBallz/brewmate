import type { BrewfatherRecipe } from '../types/brewfather';
import type { BrewStage, SessionAuditLogItem, SessionMeasurements } from '../types/session';

export interface TelemetryExportOptions {
  recipe: BrewfatherRecipe | null;
  stages: BrewStage[];
  measurements: SessionMeasurements;
  auditLogs: SessionAuditLogItem[];
  sessionStartTime: number | null;
  sessionEndTime: number | null;
  finishedAt: number | null;
  strikeOffset: number;
}

export const formatDurationOnly = (totalSec: number): string => {
  const safeSec = Math.max(0, Math.round(totalSec));
  const mins = Math.floor(safeSec / 60);
  const secs = safeSec % 60;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
};

export const formatHourMinSec = (totalSec: number): string => {
  const safeSec = Math.max(0, Math.round(totalSec));
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = safeSec % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs.toString().padStart(2, '0')}s`;
  }
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
};

export const formatSecVariance = (totalSec: number): string => {
  const mins = Math.floor(Math.abs(totalSec) / 60);
  const secs = Math.abs(totalSec) % 60;
  const sign = totalSec < 0 ? '-' : '+';
  return `${sign}${mins}m ${secs.toString().padStart(2, '0')}s`;
};

export const generateTelemetryData = (options: TelemetryExportOptions) => {
  const {
    recipe,
    stages,
    measurements,
    auditLogs,
    sessionStartTime,
    sessionEndTime,
    finishedAt,
    strikeOffset
  } = options;

  const isComplete = finishedAt !== null || (stages.length > 0 && stages[stages.length - 1].status === 'completed');

  // Length of brew day: sum of stage actual durations
  const sumStageDurationSec = stages.reduce((acc, s) => acc + (s.actualDurationSec || 0), 0);

  // Wall-clock session duration: from sessionStartTime to sessionEndTime or current time
  const wallClockDurationSec = sessionStartTime
    ? Math.max(0, Math.round(((sessionEndTime || finishedAt || Date.now()) - sessionStartTime) / 1000))
    : sumStageDurationSec;

  const lengthOfBrewDayFormatted = formatHourMinSec(sumStageDurationSec);
  const wallClockDurationFormatted = formatHourMinSec(wallClockDurationSec);

  const brewSessionDateObj = sessionStartTime ? new Date(sessionStartTime) : new Date();
  const brewSessionDate = brewSessionDateObj.toISOString().split('T')[0];
  const brewSessionDateFormatted = brewSessionDateObj.toLocaleDateString();

  const lauterStage = stages.find((s) => s.id === 'LAUTER_SPARGE');
  const coolingStage = stages.find((s) => s.id === 'COOLING_RECIRC');
  const knockoutStage = stages.find((s) => s.id === 'KNOCKOUT_TRANSFER');

  const allAdditions = stages.flatMap((s) =>
    (s.additions || []).map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      stageId: s.id,
      stageTitle: s.title,
      amount: a.amount,
      unit: a.unit || 'g',
      triggerTimeMin: a.triggerTimeMin,
      confirmed: Boolean(a.confirmed),
      confirmedAt: a.confirmedAt || null
    }))
  );

  return {
    exportVersion: 'brewmate_telemetry_v1',
    app: 'BrewMate PWA HUD',
    exportedAt: new Date().toISOString(),
    session: {
      recipeName: recipe?.name || 'Untitled Brew Session',
      brewer: recipe?.author || 'Lead Brewer',
      style: recipe?.type || 'All Grain',
      batchSizeL: recipe?.batchSize || 0,
      boilTimeMin: recipe?.boilTime || 60,
      targetOg: recipe?.og ?? null,
      targetFg: recipe?.fg ?? null,
      targetIbu: recipe?.ibu ?? null,
      targetAbv: recipe?.abv ?? null,
      preBoilGravityTarget: recipe?.preBoilGravity ?? null,
      strikeOffsetC: strikeOffset,
      brewSessionDate,
      brewSessionDateFormatted,
      sessionStartTime: sessionStartTime ? new Date(sessionStartTime).toISOString() : null,
      sessionEndTime: sessionEndTime ? new Date(sessionEndTime).toISOString() : null,
      sessionDurationSec: wallClockDurationSec,
      lengthOfBrewDaySec: sumStageDurationSec,
      lengthOfBrewDayFormatted,
      lengthOfBrewDay: {
        totalDurationSec: sumStageDurationSec,
        totalDurationFormatted: lengthOfBrewDayFormatted,
        wallClockDurationSec,
        wallClockDurationFormatted,
        hours: Number((sumStageDurationSec / 3600).toFixed(2))
      },
      isComplete
    },
    measurements: {
      strikeTempActualC: measurements.strikeTempActual ?? null,
      mashInTempActualC: measurements.mashInTempActual ?? null,
      mashRestTempActualC: measurements.mashRestTempActual ?? null,
      mashPhActual: measurements.mashPhActual ?? null,
      preBoilGravityActual: measurements.preBoilGravityActual ?? null,
      postBoilGravityActual: measurements.postBoilGravityActual ?? null,
      knockoutTempActualC: measurements.knockoutTempActual ?? null,
      lauterDurationSec: lauterStage?.actualDurationSec || 0,
      coolingDurationSec: coolingStage?.actualDurationSec || 0,
      knockoutDurationSec: knockoutStage?.actualDurationSec || 0
    },
    stages: stages.map((s, idx) => ({
      index: idx + 1,
      id: s.id,
      title: s.title,
      shortCode: s.shortCode,
      flowKind: s.flow?.kind || (s.timerType === 'stopwatch' ? 'stopwatch' : s.isTimed ? 'countdown' : 'confirm'),
      flowPhase: s.flowPhase || (s.status === 'completed' ? 'finished' : 'ready'),
      status: s.status,
      startedAt: s.startedAt ?? null,
      startedAtIso: s.startedAt ? new Date(s.startedAt).toISOString() : null,
      startedAtTime: s.startedAt ? new Date(s.startedAt).toLocaleTimeString() : null,
      completedAt: (s.endedAt || (s.status === 'completed' ? s.startedAt : null)) ?? null,
      completedAtIso: s.endedAt ? new Date(s.endedAt).toISOString() : null,
      completedAtTime: s.endedAt ? new Date(s.endedAt).toLocaleTimeString() : null,
      endedAt: s.endedAt ?? null,
      endedAtIso: s.endedAt ? new Date(s.endedAt).toISOString() : null,
      endedAtTime: s.endedAt ? new Date(s.endedAt).toLocaleTimeString() : null,
      plannedDurationSec: s.plannedDurationSec,
      actualDurationSec: s.actualDurationSec,
      actualDurationFormatted: formatDurationOnly(s.actualDurationSec),
      varianceSec: s.actualDurationSec - s.plannedDurationSec,
      parameters: s.parameters || {},
      reminders: (s.checklist || []).map((item) => ({
        id: item.id,
        label: item.label,
        completed: Boolean(item.checked),
        triggerRemainingSec: item.triggerRemainingSec ?? null
      })),
      additions: (s.additions || []).map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        amount: a.amount,
        unit: a.unit || 'g',
        triggerTimeMin: a.triggerTimeMin,
        confirmed: Boolean(a.confirmed),
        confirmedAt: a.confirmedAt || null
      }))
    })),
    additionsLog: allAdditions,
    auditTrail: auditLogs.map((log) => ({
      timestamp: log.timestamp,
      isoTime: new Date(log.timestamp).toISOString(),
      type: log.type,
      stageId: log.stageId,
      message: log.message,
      deltaSec: log.deltaSec ?? null,
      metadata: log.metadata ?? null
    }))
  };
};

export const generateTelemetryJson = (options: TelemetryExportOptions): string => {
  return JSON.stringify(generateTelemetryData(options), null, 2);
};

// Spreadsheets run cells starting with = + - @ (or tab / CR) as formulas, so text from an imported recipe like
// =HYPERLINK(...) would become live. Prefix such text with ' so it stays text; real numbers (e.g. -120) are untouched.
export const neutraliseCsvFormula = (value: unknown): string => {
  const text = String(value ?? '');
  if (typeof value === 'number') return text;
  if (/^[=+\-@\t\r]/.test(text) && !/^[+-]?\d+(\.\d+)?$/.test(text.trim())) return `'${text}`;
  return text;
};

export const generateCsvReport = (options: TelemetryExportOptions): string => {
  const { recipe, stages, measurements, auditLogs, sessionStartTime, sessionEndTime, finishedAt } = options;
  const rows: string[] = [];
  const escapeCsv = (value: any) => `"${neutraliseCsvFormula(value).replace(/"/g, '""')}"`;

  const isComplete = finishedAt !== null || (stages.length > 0 && stages[stages.length - 1].status === 'completed');
  const sumStageDurationSec = stages.reduce((acc, s) => acc + (s.actualDurationSec || 0), 0);
  const lengthOfBrewDayFormatted = formatHourMinSec(sumStageDurationSec);

  const sessionDateObj = sessionStartTime ? new Date(sessionStartTime) : new Date();
  const dateStr = sessionDateObj.toLocaleDateString();
  const timeStr = sessionStartTime ? new Date(sessionStartTime).toLocaleTimeString() : 'In Progress';
  const endTimeStr = sessionEndTime
    ? new Date(sessionEndTime).toLocaleTimeString()
    : isComplete
    ? 'Completed'
    : 'In Progress';

  // Section 1: Session Summary
  rows.push(['# BREWMATE SESSION AUDIT CSV'].map(escapeCsv).join(','));
  rows.push(
    [
      'Recipe',
      'Session Date',
      'Length of Brew Day',
      'Start Time',
      'End Time',
      'Brewer',
      'Batch Size (L)',
      'Target OG',
      'Actual OG',
      'Pre-Boil SG',
      'Mash pH',
      'Strike Temp Actual (C)',
      'Mash In Temp Actual (C)',
      'Mash Rest Temp Actual (C)'
    ]
      .map(escapeCsv)
      .join(',')
  );
  rows.push(
    [
      recipe?.name || 'Batch',
      dateStr,
      lengthOfBrewDayFormatted,
      timeStr,
      endTimeStr,
      recipe?.author || 'Lead Brewer',
      recipe?.batchSize || 0,
      recipe?.og ?? 'N/A',
      measurements.postBoilGravityActual ?? 'N/A',
      measurements.preBoilGravityActual ?? 'N/A',
      measurements.mashPhActual ?? 'N/A',
      measurements.strikeTempActual ?? 'N/A',
      measurements.mashInTempActual ?? 'N/A',
      measurements.mashRestTempActual ?? 'N/A'
    ]
      .map(escapeCsv)
      .join(',')
  );

  rows.push('');
  // Section 2: Stage Timing Audit
  rows.push(['# STAGE TIMING & DELTAS'].map(escapeCsv).join(','));
  rows.push(
    [
      'Order',
      'Stage ID',
      'Stage Name',
      'Flow Kind',
      'Started At',
      'Completed At',
      'Planned (s)',
      'Actual (s)',
      'Actual Duration',
      'Delta (s)',
      'Status'
    ]
      .map(escapeCsv)
      .join(',')
  );
  stages.forEach((s, idx) => {
    const deltaSec = s.actualDurationSec - s.plannedDurationSec;
    rows.push(
      [
        idx + 1,
        s.id,
        s.title,
        s.flow?.kind || s.timerType,
        s.startedAt ? new Date(s.startedAt).toLocaleTimeString() : 'N/A',
        s.endedAt ? new Date(s.endedAt).toLocaleTimeString() : s.status === 'completed' ? 'Done' : 'Pending',
        s.plannedDurationSec,
        s.actualDurationSec,
        formatDurationOnly(s.actualDurationSec),
        deltaSec,
        s.status
      ]
        .map(escapeCsv)
        .join(',')
    );
  });

  rows.push('');
  // Section 3: Additions Log
  rows.push(['# INGREDIENT ADDITIONS'].map(escapeCsv).join(','));
  rows.push(
    ['Name', 'Type', 'Stage', 'Target Time (min)', 'Amount', 'Unit', 'Confirmed', 'Confirmed At']
      .map(escapeCsv)
      .join(',')
  );
  stages
    .flatMap((s) => (s.additions || []).map((a) => ({ ...a, stageTitle: s.title })))
    .forEach((a) => {
      rows.push(
        [
          a.name,
          a.type,
          a.stageTitle,
          a.triggerTimeMin,
          a.amount,
          a.unit || 'g',
          a.confirmed ? 'YES' : 'NO',
          a.confirmedAt ? new Date(a.confirmedAt).toISOString() : 'N/A'
        ]
          .map(escapeCsv)
          .join(',')
      );
    });

  rows.push('');
  // Section 4: Audit Event Log
  rows.push(['# AUDIT EVENT LOG'].map(escapeCsv).join(','));
  rows.push(['Timestamp', 'ISO Time', 'Event Type', 'Message'].map(escapeCsv).join(','));
  auditLogs.forEach((log) => {
    rows.push([log.timestamp, new Date(log.timestamp).toISOString(), log.type, log.message].map(escapeCsv).join(','));
  });

  return rows.join('\r\n');
};

export const generateMarkdownReport = (options: TelemetryExportOptions): string => {
  const { recipe, stages, measurements, auditLogs, sessionStartTime, sessionEndTime, finishedAt } = options;
  const isComplete = finishedAt !== null || (stages.length > 0 && stages[stages.length - 1].status === 'completed');

  const sumStageDurationSec = stages.reduce((acc, s) => acc + (s.actualDurationSec || 0), 0);
  const wallClockDurationSec = sessionStartTime
    ? Math.max(0, Math.round(((sessionEndTime || finishedAt || Date.now()) - sessionStartTime) / 1000))
    : sumStageDurationSec;

  const lengthOfBrewDayFormatted = formatHourMinSec(sumStageDurationSec);
  const sessionDateObj = sessionStartTime ? new Date(sessionStartTime) : new Date();
  const dateStr = sessionDateObj.toLocaleDateString();
  const timeStr = sessionStartTime ? new Date(sessionStartTime).toLocaleTimeString() : 'In Progress';
  const endTimeStr = sessionEndTime
    ? new Date(sessionEndTime).toLocaleTimeString()
    : isComplete
    ? 'Completed'
    : 'In Progress';

  const lines: string[] = [];
  lines.push(`# BREW DAY AUDIT REPORT: ${recipe?.name || 'Batch'} (${recipe?.batchSize || 0}L)`);
  lines.push(`**Brew Session Date**: ${dateStr}`);
  lines.push(
    `**Length of Brew Day**: ${lengthOfBrewDayFormatted} (Sum of stage times: ${formatHourMinSec(
      sumStageDurationSec
    )} | Wall-clock: ${formatHourMinSec(wallClockDurationSec)})`
  );
  lines.push(`**Session Start**: ${timeStr} | **Session End**: ${endTimeStr}`);
  lines.push(`**Brewer**: ${recipe?.author || 'Lead Brewer'}`);
  lines.push(`**Style**: ${recipe?.type || 'All Grain'} | **Target OG**: ${recipe?.og || 'N/A'}`);
  lines.push(`**Status**: ${isComplete ? 'COMPLETED' : 'IN PROGRESS'}`);
  lines.push('');
  lines.push('---');
  lines.push('## 1. TIMING & STAGE VARIANCE AUDIT');
  lines.push('| Stage | Started | Completed | Planned | Actual | Delta Variance | Status |');
  lines.push('| :--- | :--- | :--- | :--- | :--- | :--- | :--- |');

  stages.forEach((s) => {
    const plannedStr =
      s.timerType === 'stopwatch' ? 'Stopwatch' : s.isTimed ? formatDurationOnly(s.plannedDurationSec) : 'Checklist';
    const actualStr = formatDurationOnly(s.actualDurationSec);
    const deltaSec = s.actualDurationSec - s.plannedDurationSec;
    const deltaStr =
      s.timerType === 'stopwatch'
        ? 'Recorded'
        : s.isTimed
        ? deltaSec === 0
          ? '0m (On Time)'
          : formatSecVariance(deltaSec)
        : '--';
    const startedStr = s.startedAt ? new Date(s.startedAt).toLocaleTimeString() : '--';
    const completedStr = s.endedAt ? new Date(s.endedAt).toLocaleTimeString() : s.status === 'completed' ? 'Done' : '--';

    lines.push(
      `| **${s.title}** | ${startedStr} | ${completedStr} | ${plannedStr} | ${actualStr} | ${deltaStr} | ${s.status.toUpperCase()} |`
    );
  });

  lines.push('');
  lines.push('---');
  lines.push('## 2. RECORDED MEASUREMENTS');
  lines.push(
    `- **Strike Temp**: ${
      measurements.strikeTempActual !== undefined ? `${measurements.strikeTempActual} °C` : 'Not recorded'
    } (Target: ~${stages[0]?.parameters?.targetTemp ?? recipe?.data?.strikeTemp ?? 71.5}°C)`
  );
  lines.push(
    `- **Mash In Temp**: ${
      measurements.mashInTempActual !== undefined ? `${measurements.mashInTempActual} °C` : 'Not recorded'
    } (Target: ${recipe?.mash?.steps?.[0]?.stepTemp ?? 65}°C)`
  );
  lines.push(
    `- **Mash Rest Temp**: ${
      measurements.mashRestTempActual !== undefined ? `${measurements.mashRestTempActual} °C` : 'Not recorded'
    } (Target: ${recipe?.mash?.steps?.[0]?.stepTemp ?? 65}°C)`
  );
  lines.push(
    `- **Mash pH (15m sample)**: ${
      measurements.mashPhActual !== undefined ? measurements.mashPhActual : 'Not recorded'
    } (Target: 5.2 - 5.3)`
  );
  lines.push(
    `- **Pre-Boil Gravity**: ${
      measurements.preBoilGravityActual !== undefined ? `${measurements.preBoilGravityActual} SG` : 'Not recorded'
    } (Target: ${recipe?.preBoilGravity || 'N/A'})`
  );
  lines.push(
    `- **Post-Boil Original Gravity (OG)**: ${
      measurements.postBoilGravityActual !== undefined ? `${measurements.postBoilGravityActual} SG` : 'Not recorded'
    } (Target: ${recipe?.og || 'N/A'})`
  );
  lines.push(
    `- **Chiller Knockout Temp**: ${
      measurements.knockoutTempActual !== undefined ? `${measurements.knockoutTempActual} °C` : 'Not recorded'
    } (Target: ${recipe?.primaryTemp || 19}°C)`
  );

  const lauterStage = stages.find((s) => s.id === 'LAUTER_SPARGE');
  if (lauterStage && lauterStage.actualDurationSec > 0) {
    lines.push(`- **Sparge Duration**: ${formatDurationOnly(lauterStage.actualDurationSec)} (Stopwatch)`);
  }
  const coolingStage = stages.find((s) => s.id === 'COOLING_RECIRC');
  if (coolingStage && coolingStage.actualDurationSec > 0) {
    lines.push(
      `- **Cooling & Recirc (Chill to 60°C) Duration**: ${formatDurationOnly(coolingStage.actualDurationSec)} (Stopwatch)`
    );
  }
  const knockoutStage = stages.find((s) => s.id === 'KNOCKOUT_TRANSFER');
  if (knockoutStage && knockoutStage.actualDurationSec > 0) {
    lines.push(`- **Knockout Transfer Duration**: ${formatDurationOnly(knockoutStage.actualDurationSec)} (Stopwatch)`);
  }

  lines.push('');
  lines.push('---');
  lines.push('## 3. INGREDIENT ADDITIONS CONFIRMATION LOG');
  const allAdditions = stages.flatMap((s) => s.additions);
  if (allAdditions.length > 0) {
    lines.push('| Addition | Stage | Target Time | Amount | Confirmed | Timestamp |');
    lines.push('| :--- | :--- | :--- | :--- | :--- | :--- |');
    allAdditions.forEach((a) => {
      const timeTarget = a.triggerTimeMin === 0 ? 'Flameout' : `T-${a.triggerTimeMin}m`;
      const timeLog = a.confirmedAt ? new Date(a.confirmedAt).toLocaleTimeString() : 'Pending';
      lines.push(
        `| ${a.name} | ${a.type} | ${timeTarget} | ${a.amount} ${a.unit || 'g'} | ${
          a.confirmed ? '✅ YES' : '❌ NO'
        } | ${timeLog} |`
      );
    });
  } else {
    lines.push('No additions scheduled.');
  }

  lines.push('');
  lines.push('---');
  lines.push('## 4. SESSION EVENT TRAIL');
  auditLogs.slice(-25).forEach((log) => {
    lines.push(`- [${new Date(log.timestamp).toLocaleTimeString()}] **${log.type}**: ${log.message}`);
  });

  lines.push('');
  lines.push('_Generated by BrewMate PWA HUD Assistant._');
  return lines.join('\n');
};
