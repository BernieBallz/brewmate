import type { BrewfatherRecipe } from '../types/brewfather';
import type { BrewStage, StageAddition, FlowStep } from '../types/session';

export function isEnzymeAddition(name: string, type?: string): boolean {
  const n = (name || '').toLowerCase();
  const t = (type || '').toLowerCase();
  return (
    t === 'enzyme' ||
    n.includes('enzyme') ||
    n.includes('ceremix') ||
    n.includes('aldc') ||
    n.includes('maturex') ||
    n.includes('amg') ||
    n.includes('benzyme') ||
    n.includes('clarex') ||
    n.includes('clarity ferm') ||
    n.includes('termamyl') ||
    n.includes('neutrase') ||
    n.includes('fungamyl') ||
    n.includes('viscoferm') ||
    n.includes('ultraflo') ||
    n.includes('amylase') ||
    n.includes('glucanase')
  );
}

export function buildWaterPrepStage(
  recipe: BrewfatherRecipe,
  mashTemp: number,
  strikeOffset: number
): BrewStage {
  const strikeWater = recipe.data?.strikeWaterAmount || recipe.water?.mashAdjustments?.volume || 0;
  const spargeWater = recipe.data?.spargeWaterAmount || recipe.water?.spargeAdjustments?.volume || 0;
  const targetStrikeTemp = Number((mashTemp + strikeOffset).toFixed(1));

  const flow: FlowStep = {
    id: 'strike-water-flow',
    kind: 'confirm',
    startLabel: 'STRIKE READY',
    endAlert: 'Strike temp reached',
    startLog: 'Strike temp reached',
    endLog: `Strike offset +${strikeOffset}°C (mash ${mashTemp}°C → strike ${targetStrikeTemp}°C)`,
    nextLabel: 'NEXT: MASH IN'
  };

  return {
    id: 'WATER_PREP',
    index: 0,
    title: 'Strike Water',
    shortCode: 'STRIKE',
    description: 'Fill kettle/HLT with brewing liquor and heat strike water to target temperature.',
    isTimed: false,
    timerType: 'manual',
    plannedDurationSec: 0,
    actualDurationSec: 0,
    status: 'pending',
    flow,
    additions: [],
    checklist: [
      { id: 'strike-sparge-vol', label: `Liquor ${strikeWater ? `${strikeWater}L` : 'Per recipe'} / ${spargeWater ? `${spargeWater}L` : 'Per recipe'}`, explanation: 'Verify liquor volumes', checked: false },
      { id: 'water-treat', label: 'Water salts', explanation: 'Add gypsum, calcium chloride, and acid into strike liquor', checked: false },
      { id: 'fv-cooler-on', label: 'FV cooling on', explanation: 'Switch on glycol chiller for fermenter to pre-cool', checked: false }
    ],
    parameters: {
      targetTemp: targetStrikeTemp,
      targetVolume: strikeWater,
      volumeLabel: 'STRIKE',
      infoNotes: `Batch: ${recipe.name} (${recipe.batchSize}L)`
    }
  };
}

export function buildMashInStage(
  recipe: BrewfatherRecipe,
  mashTemp: number,
  mashAdditions: StageAddition[]
): BrewStage {
  const flow: FlowStep = {
    id: 'mash-in-flow',
    kind: 'confirm',
    startLabel: 'DONE',
    endAlert: 'Add grain',
    startLog: 'Mash in complete',
    endLog: 'Mash in complete',
    nextLabel: 'NEXT: START MASH REST'
  };

  return {
    id: 'MASH_IN',
    index: 1,
    title: 'Mash In',
    shortCode: 'MASH-IN',
    description: 'Transfer grain bill and strike water while mixing thoroughly. Takes the time it takes.',
    isTimed: false,
    timerType: 'manual',
    plannedDurationSec: 0,
    actualDurationSec: 0,
    status: 'pending',
    flow,
    additions: mashAdditions,
    checklist: [
      { id: 'mash-temp-init', label: `Dough in & set temp ${mashTemp}°C`, explanation: 'Don’t add enzymes until target temp reached', checked: false },
      { id: 'mash-additions-check', label: 'Mash additions', explanation: 'Add enzymes, or lactic acid', checked: false },
      { id: 'dough-ball-check', label: 'No dough balls', explanation: 'Thoroughly stir the mash, checking corners for dry clumps', checked: false }
    ],
    parameters: {
      targetTemp: mashTemp,
      targetVolume: recipe.data?.mashVolume || 0,
      volumeLabel: 'MASH VOL',
      infoNotes: `Total mash volume (strike liquor + grain displacement): ${recipe.data?.mashVolume || 0}L`
    }
  };
}

export function buildMashScheduleStage(
  _recipe: BrewfatherRecipe,
  mashSteps: Array<{ name: string; stepTemp: number; stepTime: number }>,
  totalMashTime: number
): BrewStage {
  const mashTemp = mashSteps[0]?.stepTemp || 65;
  const phSampleRemainingSec = totalMashTime > 15 ? (totalMashTime - 15) * 60 : Math.max(60, Math.floor((totalMashTime * 60) * 0.75));
  const vorlaufRemainingSec = totalMashTime > 60 ? (totalMashTime - 60) * 60 : Math.min(15 * 60, Math.floor((totalMashTime * 60) / 4));

  const flow: FlowStep = {
    id: 'mash-schedule-flow',
    kind: 'countdown',
    startLabel: 'START MASH REST',
    pauseLabel: 'PAUSE',
    resumeLabel: 'RESUME',
    endAlert: 'Mash complete',
    startLog: 'Mash started',
    endLog: 'Mash complete',
    nextLabel: 'NEXT: START SPARGE'
  };

  return {
    id: 'MASH_SCHEDULE',
    index: 2,
    title: 'Mash Rest',
    shortCode: 'MASH REST',
    description: 'Enzymatic saccharification rest countdown and vorlauf recirculation.',
    isTimed: true,
    timerType: 'countdown',
    plannedDurationSec: totalMashTime * 60,
    actualDurationSec: 0,
    status: 'pending',
    flow,
    additions: [],
    mashSubSteps: mashSteps.map(step => ({
      name: step.name,
      temp: step.stepTemp,
      durationMinutes: step.stepTime,
      durationSeconds: step.stepTime * 60,
      completed: false
    })),
    checklist: [
      { id: 'mash-temp-stable', label: `Check mash temp ${mashTemp}°C`, explanation: 'Verify temp rest mash step', checked: false },
      {
        id: 'ph-sample',
        label: 'pH check (~5.2)',
        explanation: 'Cool wort sample to 20°C and verify mash pH is 5.2–5.4',
        checked: false,
        triggerRemainingSec: phSampleRemainingSec,
        alertTitle: 'MASH REST',
        alertHeadline: 'Mash pH check (~5.2)',
        alertMessage: 'Cool wort sample to 20°C and record mash pH (target 5.2–5.4)',
        alertActionLabel: 'LOG & CHECK PH'
      },
      {
        id: 'vorlauf-check',
        label: 'Vorlauf',
        explanation: 'Begin slow vorlauf recirculation until wort runs clear in sight glass',
        checked: false,
        triggerRemainingSec: vorlaufRemainingSec,
        alertTitle: 'MASH REST',
        alertHeadline: 'Start vorlauf',
        alertMessage: 'Start vorlauf recirculation',
        alertActionLabel: 'START VORLAUF'
      }
    ],
    parameters: {
      targetTemp: mashTemp,
      targetPh: 5.24
    }
  };
}

export function buildLauterSpargeStage(
  recipe: BrewfatherRecipe,
  spargeWater: number
): BrewStage {
  const spargeTemp = recipe.equipment?.spargeTemperature || 80;
  const boilVol = recipe.boilSize || 267;
  const preBoilSg = recipe.preBoilGravity ? recipe.preBoilGravity.toFixed(3) : '1.039';

  const flow: FlowStep = {
    id: 'lauter-sparge-flow',
    kind: 'stopwatch',
    startLabel: 'START SPARGE',
    stopLabel: 'STOP SPARGE',
    endAlert: 'Sparge complete',
    startLog: 'Sparge started',
    endLog: 'Sparge time stored',
    nextLabel: 'NEXT: START BOIL'
  };

  return {
    id: 'LAUTER_SPARGE',
    index: 3,
    title: 'Sparge',
    shortCode: 'SPARGE',
    description: 'Runoff into kettle, sparge grain bed, verify pre-boil gravity and ramp kettle to boil.',
    isTimed: true,
    timerType: 'stopwatch',
    plannedDurationSec: 2700, // est. 45m (stopwatch; actual time is recorded)
    actualDurationSec: 0,
    status: 'pending',
    flow,
    additions: [],
    checklist: [
      { id: 'sparge-prep', label: `Sparge ${spargeTemp}°C`, explanation: 'Verify sparge liquor in HLT is heated to 78–80°C', checked: false },
      { id: 'equal-flow', label: 'Even flow', explanation: 'Balance runoff rate with sparge inflow to prevent bed compaction', checked: false },
      { id: 'kettle-early-heat', label: 'Kettle heat on', explanation: 'Turn on small kettle element as soon as it is submerged', checked: false },
      { id: 'runoff-gravity-cutoff', label: 'Stop before 1.010', explanation: 'Test runnings gravity; halt sparge if below 1.010 to prevent tannin extraction', checked: false },
      { id: 'preboil-vol', label: `Pre-boil volume ${boilVol}L`, explanation: 'Measure total volume collected in boil kettle before boil', checked: false },
      { id: 'preboil-sg', label: `Pre-boil SG ${preBoilSg}`, explanation: 'Take sample and record pre-boil gravity', checked: false },
      { id: 'hot-break-ramp', label: 'Ramp to boil', explanation: 'Bring kettle to rolling boil; prepare defoamer to control hot-break foam', checked: false }
    ],
    parameters: {
      targetTemp: spargeTemp,
      targetVolume: boilVol,
      volumeLabel: 'PRE-BOIL',
      targetGravity: recipe.preBoilGravity || 1.039,
      infoNotes: `Sparge liquor: ${spargeWater ? `${spargeWater}L` : 'Per recipe'} at ${spargeTemp}°C`
    }
  };
}

export function buildBoilStage(
  _recipe: BrewfatherRecipe,
  boilTime: number,
  boilAdditions: StageAddition[],
  hasNextWhirlpool: boolean
): BrewStage {
  const flow: FlowStep = {
    id: 'boil-flow',
    kind: 'countdown',
    startLabel: 'START BOIL',
    pauseLabel: 'PAUSE',
    resumeLabel: 'RESUME',
    endAlert: 'Flameout',
    startLog: 'Boil started',
    endLog: 'Flameout',
    nextLabel: hasNextWhirlpool ? 'NEXT: START WHIRLPOOL' : 'NEXT: START CHILL'
  };

  return {
    id: 'BOIL',
    index: 4,
    title: 'Boil',
    shortCode: 'BOIL',
    description: 'Rolling boil with scheduled hop additions, kettle sugars, finings, and nutrients.',
    isTimed: true,
    timerType: 'countdown',
    plannedDurationSec: boilTime * 60,
    actualDurationSec: 0,
    status: 'pending',
    flow,
    additions: boilAdditions,
    checklist: [
      { id: 'rolling-boil', label: 'Rolling boil', explanation: 'Confirm vigorous rolling boil established before starting timer', checked: false },
      { id: 'boil-additions-monitor', label: 'Additions', explanation: 'Check Additions tab for timed kettle hops, sugars, and finings', checked: false },
      { id: 'steam-heat-off', label: 'Heat off at flameout', explanation: 'Cut kettle heating immediately at flameout', checked: false }
    ],
    parameters: {
      targetTemp: 100,
      infoNotes: `${boilTime} min total boil. ${boilAdditions.length} additions scheduled.`
    }
  };
}

export function buildWhirlpoolStage(
  _recipe: BrewfatherRecipe,
  whirlpoolTime: number,
  hopstandTemp: number,
  whirlpoolAdditions: StageAddition[]
): BrewStage {
  const flow: FlowStep = {
    id: 'whirlpool-flow',
    kind: 'countdown',
    startLabel: 'START WHIRLPOOL',
    pauseLabel: 'PAUSE',
    resumeLabel: 'RESUME',
    endAlert: 'Whirlpool complete',
    startLog: 'Whirlpool started',
    endLog: 'Whirlpool complete',
    nextLabel: 'NEXT: START CHILL'
  };

  return {
    id: 'HOPSTAND_WHIRLPOOL',
    index: 5,
    title: 'Whirlpool',
    shortCode: 'WHIRLPOOL',
    description: 'Kill heat, establish whirlpool vortex, steep aroma hops and allow trub cone to form.',
    isTimed: true,
    timerType: 'countdown',
    plannedDurationSec: whirlpoolTime * 60,
    actualDurationSec: 0,
    status: 'pending',
    flow,
    additions: whirlpoolAdditions,
    checklist: [
      { id: 'cut-heat', label: 'Heat off', explanation: 'Verify heating elements are fully turned off', checked: false },
      { id: 'whirlpool-additions', label: 'Whirlpool additions', explanation: 'Add aroma hopstand pellets/extract at designated whirlpool temp', checked: false },
      { id: 'vortex-spin', label: 'Spin', explanation: 'Run pump at full speed to create strong vortex, then shut pump off', checked: false },
      { id: 'settle-cone', label: 'Settle cone', explanation: 'Let kettle sit completely undisturbed to allow trub and hop cone to settle', checked: false }
    ],
    parameters: {
      targetTemp: hopstandTemp,
      infoNotes: `Whirlpool timer: ${whirlpoolTime} min from recipe.`
    }
  };
}

export function buildCoolingRecircStage(
  _recipe: BrewfatherRecipe
): BrewStage {
  const flow: FlowStep = {
    id: 'cooling-recirc-flow',
    kind: 'stopwatch',
    startLabel: 'START CHILL',
    stopLabel: 'STOP CHILL',
    endAlert: 'Chill complete',
    startLog: 'Chill started',
    endLog: 'Chill time stored',
    nextLabel: 'NEXT: START KNOCKOUT'
  };

  return {
    id: 'COOLING_RECIRC',
    index: 6,
    title: 'Cooling Recirc',
    shortCode: 'CHILL',
    description: 'Recirculate hot wort to cool to 60°C before knockout transfer. Stopwatch tracks chill time.',
    isTimed: true,
    timerType: 'stopwatch',
    plannedDurationSec: 1200, // est. 20m (stopwatch; actual time is recorded)
    actualDurationSec: 0,
    status: 'pending',
    flow,
    additions: [],
    checklist: [
      { id: 'hx-hot-sanitize', label: 'Sanitise loop', explanation: 'Recirculate hot wort through heat exchanger loop without cooling water', checked: false },
      { id: 'cooling-medium-on', label: 'Cooling on', explanation: 'Open mains cooling supply valve to heat exchanger', checked: false },
      { id: 'temp-goal-60', label: 'Chill to 60°C', explanation: 'Monitor recirc temp until core kettle reaches target 60°C', checked: false },
      { id: 'transfer-line-prep', label: 'Transfer hose', explanation: 'Transfer hose from chiller outlet toward fermenter inlet', checked: false }
    ],
    parameters: {
      targetTemp: 60,
      infoNotes: 'Target: Cool wort to 60°C before knockout'
    }
  };
}

export function buildKnockoutTransferStage(
  recipe: BrewfatherRecipe
): BrewStage {
  const exitTemp = recipe.primaryTemp || 19;
  const batchVol = recipe.batchSize || 0;

  const flow: FlowStep = {
    id: 'knockout-transfer-flow',
    kind: 'stopwatch',
    startLabel: 'START KNOCKOUT',
    stopLabel: 'STOP KNOCKOUT',
    endAlert: 'Knockout complete',
    startLog: 'Knockout started',
    endLog: 'Knockout time stored',
    nextLabel: 'NEXT: YEAST IN'
  };

  return {
    id: 'KNOCKOUT_TRANSFER',
    index: 7,
    title: 'Knockout',
    shortCode: 'KNOCKOUT',
    description: 'Transfer chilled wort through chiller into fermenter. Stopwatch tracks transfer duration.',
    isTimed: true,
    timerType: 'stopwatch',
    plannedDurationSec: 3600, // est. 60m (stopwatch; actual time is recorded)
    actualDurationSec: 0,
    status: 'pending',
    flow,
    additions: [],
    checklist: [
      { id: 'start-aeration', label: 'Aeration on', explanation: 'Turn on sterile inline oxygen / aeration stone at designated LPM', checked: false },
      { id: 'chiller-exit-temp', label: `Exit temp ${exitTemp}°C`, explanation: 'Check dial thermometer at chiller outlet to ensure wort enters FV at pitch temp', checked: false },
      { id: 'postboil-sg', label: 'Record OG', explanation: 'Pull cooled sample from FV port and log original gravity', checked: false },
      { id: 'trub-cutoff', label: 'Stop at trub', explanation: 'Watch sight glass; stop transfer pump as soon as trub cone breaks', checked: false },
      { id: 'fv-volume-check', label: `FV volume ${batchVol}L`, explanation: 'Verify final volume into fermenter', checked: false }
    ],
    parameters: {
      targetTemp: exitTemp,
      targetVolume: batchVol,
      volumeLabel: 'BATCH',
      targetGravity: recipe.og || 1.0378,
      infoNotes: `Fermenter target volume: ${batchVol}L`
    }
  };
}

export function buildYeastPitchStage(
  recipe: BrewfatherRecipe,
  pitchAdditions: StageAddition[]
): BrewStage {
  const pitchTemp = recipe.primaryTemp || 19;

  const flow: FlowStep = {
    id: 'yeast-pitch-flow',
    kind: 'confirm',
    startLabel: 'YEAST IN',
    endAlert: 'Pitch yeast',
    startLog: 'Yeast pitched',
    endLog: 'Yeast pitched',
    nextLabel: 'NEXT: FINISH BREW'
  };

  return {
    id: 'YEAST_PITCH',
    index: 8,
    title: 'Yeast Pitch',
    shortCode: 'PITCH',
    description: 'Inoculate aerated wort with yeast and fermenter enzymes/nutrients.',
    isTimed: false,
    timerType: 'manual',
    plannedDurationSec: 0,
    actualDurationSec: 0,
    status: 'pending',
    flow,
    additions: pitchAdditions,
    checklist: [
      { id: 'temp-confirm', label: `Pitch temp ${pitchTemp}°C`, explanation: 'Verify fermenter probe reads <= pitch temp before pitching yeast', checked: false },
      { id: 'pitch-additions', label: 'Yeast + aids', explanation: 'Dose yeast slurry/brink, ALDC enzyme, and oxygenation aids into FV', checked: false },
      { id: 'temp-controller-set', label: `Set controller ${pitchTemp}°C`, explanation: 'Set fermenter temperature controller to target primary setpoint - check the temp probe!', checked: false }
    ],
    parameters: {
      targetTemp: pitchTemp
    }
  };
}

export function buildCleanupStage(
  _recipe: BrewfatherRecipe
): BrewStage {
  const flow: FlowStep = {
    id: 'cleanup-flow',
    kind: 'confirm',
    startLabel: 'FINISH BREW',
    endAlert: 'Brew complete',
    startLog: 'Session finished',
    endLog: 'Session finished',
    nextLabel: 'VIEW AUDIT REPORT'
  };

  return {
    id: 'CLEANUP',
    index: 9,
    title: 'Clean Up',
    shortCode: 'CLEANUP',
    description: 'Brewhouse cleanup, equipment backflush, and session audit telemetry review.',
    isTimed: false,
    timerType: 'manual',
    plannedDurationSec: 0,
    actualDurationSec: 0,
    status: 'pending',
    flow,
    additions: [],
    checklist: [
      { id: 'spent-grain-dump', label: 'Spent grain out', explanation: 'Dig out mash tun spent grains into bins bags', checked: false },
      { id: 'chiller-backflush', label: 'Backflush chiller', explanation: 'Reverse flush heat exchanger with hot water to dislodge hop matter', checked: false }
    ],
    parameters: {}
  };
}

export function parseBrewfatherRecipe(
  recipe: BrewfatherRecipe,
  strikeOffset = 10
): BrewStage[] {
  const boilTime = recipe.boilTime || 60;
  const mashSteps = recipe.mash?.steps || [{ name: 'Single Infusion', stepTemp: 65, stepTime: 60 }];
  const totalMashTime = mashSteps.reduce((acc, step) => acc + (step.stepTime || 0), 0);
  const mashTemp = mashSteps[0]?.stepTemp || 65;
  const spargeWater = recipe.data?.spargeWaterAmount || recipe.water?.spargeAdjustments?.volume || 0;

  // Hopstand / Whirlpool time & temperature from JSON
  const rawHopStandMinutes = (recipe as any).hopStandMinutes ?? (recipe as any).hopstandMinutes ?? 0;
  const whirlpoolTime =
    recipe.equipment?.whirlpoolTime ||
    rawHopStandMinutes ||
    (recipe.equipment as any)?.hopstandMinutes ||
    15;

  const hopstandTemp =
    recipe.equipment?.hopstandTemperature ||
    (recipe as any).avgWeightedHopstandTemp ||
    (recipe.hops?.find(h => h.use === 'Aroma' || h.use === 'Whirlpool' || h.use === 'Hopstand')?.temp) ||
    80;

  // Process Boil additions
  const boilAdditions: StageAddition[] = [];

  // Hops in boil
  (recipe.hops || [])
    .filter(h => h.use === 'Boil' || h.use === 'First Wort')
    .forEach((h, idx) => {
      const time = h.use === 'First Wort' ? boilTime : (h.time ?? boilTime);
      boilAdditions.push({
        id: `hop-boil-${idx}`,
        name: `${h.name} (${h.type || 'Hop'})`,
        amount: h.amount,
        unit: 'g',
        triggerTimeMin: time,
        triggerRemainingSec: time * 60,
        confirmed: false,
        type: 'hop',
        notes: h.use === 'First Wort' ? 'First Wort Hop' : `${h.ibu ? `${h.ibu.toFixed(1)} IBU` : ''}`
      });
    });

  // Sugars in boil
  (recipe.fermentables || [])
    .filter(f => f.use === 'Boil')
    .forEach((f, idx) => {
      const time = f.time ?? 15;
      boilAdditions.push({
        id: `sugar-boil-${idx}`,
        name: `${f.name} (Sugar/Extract)`,
        amount: f.amount,
        unit: 'kg',
        triggerTimeMin: time,
        triggerRemainingSec: time * 60,
        confirmed: false,
        type: 'sugar'
      });
    });

  // Miscs in boil & flameout
  (recipe.miscs || [])
    .filter(m => m.use === 'Boil' || m.use === 'Flameout')
    .forEach((m, idx) => {
      const time = m.use === 'Flameout' ? 0 : (m.time ?? 10);
      boilAdditions.push({
        id: `misc-boil-${idx}`,
        name: `${m.name}`,
        amount: m.amount,
        unit: m.unit || 'g',
        triggerTimeMin: time,
        triggerRemainingSec: time * 60,
        confirmed: false,
        type: m.name.toLowerCase().includes('ph') ? 'other' : 'misc',
        notes: m.use === 'Flameout' ? 'Add at Flameout' : undefined
      });
    });

  boilAdditions.sort((a, b) => b.triggerRemainingSec - a.triggerRemainingSec);

  // Hopstand / Whirlpool additions
  const whirlpoolAdditions: StageAddition[] = [];
  (recipe.hops || [])
    .filter(h => h.use === 'Whirlpool' || h.use === 'Hopstand' || h.use === 'Aroma')
    .forEach((h, idx) => {
      const time = h.time ?? whirlpoolTime;
      const notesParts = [
        h.temp ? `${h.temp}°C Hopstand` : '',
        h.ibu ? `${h.ibu.toFixed(1)} IBU` : ''
      ].filter(Boolean);
      whirlpoolAdditions.push({
        id: `hop-wp-${idx}`,
        name: `${h.name} (${h.type || 'Hop'})`,
        amount: h.amount,
        unit: 'g',
        triggerTimeMin: time,
        triggerRemainingSec: time * 60,
        confirmed: false,
        type: 'hop',
        notes: notesParts.length > 0 ? notesParts.join(' • ') : undefined
      });
    });

  (recipe.miscs || [])
    .filter(m => m.use === 'Whirlpool' || m.use === 'Hopstand' || m.use === 'Aroma')
    .forEach((m, idx) => {
      const time = m.time ?? whirlpoolTime;
      whirlpoolAdditions.push({
        id: `misc-wp-${idx}`,
        name: m.name,
        amount: m.amount,
        unit: m.unit || 'g',
        triggerTimeMin: time,
        triggerRemainingSec: time * 60,
        confirmed: false,
        type: 'misc'
      });
    });

  // Mash additions (water salts, enzymes, acid)
  const mashAdditions: StageAddition[] = [];
  (recipe.miscs || [])
    .filter(m => m.use === 'Mash')
    .forEach((m, idx) => {
      mashAdditions.push({
        id: `misc-mash-${idx}`,
        name: m.name,
        amount: m.amount,
        unit: m.unit || 'g',
        triggerTimeMin: 0,
        triggerRemainingSec: 0,
        confirmed: false,
        type: isEnzymeAddition(m.name, m.type) ? 'enzyme' : 'water'
      });
    });

  // Pitch additions (ALDC, nutrients, yeast)
  const pitchAdditions: StageAddition[] = [];
  (recipe.miscs || [])
    .filter(m => m.use === 'Primary')
    .forEach((m, idx) => {
      pitchAdditions.push({
        id: `misc-primary-${idx}`,
        name: m.name,
        amount: m.amount,
        unit: m.unit || 'ml',
        triggerTimeMin: 0,
        triggerRemainingSec: 0,
        confirmed: false,
        type: 'enzyme'
      });
    });

  (recipe.yeasts || []).forEach((y, idx) => {
    pitchAdditions.push({
      id: `yeast-pitch-${idx}`,
      name: `${y.name} (${y.laboratory || 'Yeast'})`,
      amount: y.amount || 1,
      unit: y.unit || 'pkg',
      triggerTimeMin: 0,
      triggerRemainingSec: 0,
      confirmed: false,
      type: 'other',
      notes: `Target pitch temp: ${y.minTemp || 19}°C - ${y.maxTemp || 22}°C`
    });
  });

  const hasWhirlpoolHopsOrMiscs = whirlpoolAdditions.length > 0;
  const hasWhirlpool = hasWhirlpoolHopsOrMiscs || rawHopStandMinutes > 0;

  // Build sequential stages
  const stages: BrewStage[] = [
    buildWaterPrepStage(recipe, mashTemp, strikeOffset),
    buildMashInStage(recipe, mashTemp, mashAdditions),
    buildMashScheduleStage(recipe, mashSteps, totalMashTime),
    buildLauterSpargeStage(recipe, spargeWater),
    buildBoilStage(recipe, boilTime, boilAdditions, hasWhirlpool)
  ];

  if (hasWhirlpool) {
    stages.push(buildWhirlpoolStage(recipe, whirlpoolTime, hopstandTemp, whirlpoolAdditions));
  }

  stages.push(
    buildCoolingRecircStage(recipe),
    buildKnockoutTransferStage(recipe),
    buildYeastPitchStage(recipe, pitchAdditions),
    buildCleanupStage(recipe)
  );

  stages.forEach((stage, idx) => {
    stage.index = idx;
  });

  return stages;
}
