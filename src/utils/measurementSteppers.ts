import type { BrewStage, SessionMeasurements } from '../types/session';
import type { BrewfatherRecipe } from '../types/brewfather';

export const STEPPER_COLORS = {
  amber: { button: 'text-amber-400', value: 'text-amber-300 border-amber-800/60' },
  cyan: { button: 'text-cyan-400', value: 'text-cyan-300 border-cyan-800/60' },
  emerald: { button: 'text-emerald-400', value: 'text-emerald-300 border-emerald-800/60' },
  purple: { button: 'text-purple-400', value: 'text-purple-300 border-purple-800/60' }
};

// A reminder that records a measured value (temperature, pH, gravity) with a -/+ stepper
export interface MeasurementStepperConfig {
  key: keyof SessionMeasurements;
  label: string;
  step: number;
  stepLabel: string;
  decimals: number;
  suffix: string;
  color: keyof typeof STEPPER_COLORS;
  defaultValue: number;
}

// Reminders that record a measured value with a -/+ stepper. Recording a value ticks the reminder
// (see setMeasurement) and it appears in the session log, report and exports.
export const getMeasurementStepper = (
  checklistId: string,
  stage: BrewStage | undefined,
  recipe: BrewfatherRecipe | null
): MeasurementStepperConfig | null => {
  const stageTargetTemp = stage?.parameters?.targetTemp;
  switch (checklistId) {
    case 'strike-temp':
      return { key: 'strikeTempActual', label: 'Recorded temp:', step: 0.5, stepLabel: '0.5°', decimals: 1, suffix: '°C', color: 'amber',
        defaultValue: stageTargetTemp ?? 75 };
    case 'mash-temp-init':
      return { key: 'mashInTempActual', label: 'Recorded temp:', step: 0.5, stepLabel: '0.5°', decimals: 1, suffix: '°C', color: 'amber',
        defaultValue: stageTargetTemp ?? recipe?.mash?.steps?.[0]?.stepTemp ?? 65 };
    case 'ph-sample':
      return { key: 'mashPhActual', label: 'Recorded pH:', step: 0.05, stepLabel: '0.05', decimals: 2, suffix: '', color: 'cyan',
        defaultValue: 5.25 };
    case 'preboil-sg':
      return { key: 'preBoilGravityActual', label: 'Recorded SG:', step: 0.001, stepLabel: '1pt', decimals: 3, suffix: '', color: 'emerald',
        defaultValue: recipe?.preBoilGravity || 1.039 };
    case 'postboil-sg':
      return { key: 'postBoilGravityActual', label: 'Recorded SG:', step: 0.001, stepLabel: '1pt', decimals: 3, suffix: '', color: 'purple',
        defaultValue: recipe?.og || 1.045 };
    default:
      return null;
  }
};

// Short names for the By stage "Record ..." button when a reading comes due mid-stage
const READING_SHORT_NAMES: Record<string, string> = {
  'ph-sample': 'pH',
  'preboil-sg': 'pre-boil SG',
  'postboil-sg': 'OG'
};

export const getReadingShortName = (checklistId: string, fallback: string): string =>
  READING_SHORT_NAMES[checklistId] ?? fallback;

// One stepper press: start from the recorded value (or the default) and round away float noise
export const stepMeasurementValue = (currentVal: number | undefined, delta: number, defaultVal: number): number => {
  const val = currentVal !== undefined ? currentVal : defaultVal;
  return Math.round((val + delta) * 1000) / 1000;
};
