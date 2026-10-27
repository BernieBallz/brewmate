import React from 'react';
import { STEPPER_COLORS, stepMeasurementValue, type MeasurementStepperConfig } from '../utils/measurementSteppers';

interface MeasurementStepperProps {
  stepper: MeasurementStepperConfig;
  value: number | undefined;
  onChange: (value: number) => void;
  // Optional readings start empty with a "Record" button, so leaving them alone records nothing
  optional?: boolean;
  onClear?: () => void;
}

// -/+ stepper row for a recorded measurement (temperature, pH, gravity)
export const MeasurementStepper: React.FC<MeasurementStepperProps> = ({ stepper, value, onChange, optional = false, onClear }) => {
  const colors = STEPPER_COLORS[stepper.color];
  const step = (delta: number) => onChange(stepMeasurementValue(value, delta, stepper.defaultValue));

  return (
    <div
      className="flex items-center justify-between gap-2 w-full px-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-[11px] font-mono uppercase tracking-wider text-gray-300 font-bold shrink-0">
        {stepper.label}
      </span>

      {optional && value === undefined ? (
        <button
          type="button"
          onClick={() => onChange(stepper.defaultValue)}
          className={`h-8 sm:h-9 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-xs font-bold font-mono border border-slate-700 touch-press ${colors.button}`}
        >
          Record
        </button>
      ) : (
        <div className="flex items-center space-x-1.5 shrink-0">
          {/* Stepper - */}
          <button
            type="button"
            onClick={() => step(-stepper.step)}
            className={`h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-xs font-bold font-mono border border-slate-700 touch-press flex items-center justify-center ${colors.button}`}
            title="Decrease"
          >
            -{stepper.stepLabel}
          </button>

          {/* Value Display (Centered between - and + for ergonomic thumb stepping) */}
          <span className={`text-xs sm:text-sm font-black font-mono px-2.5 py-1 rounded-lg bg-slate-950 border min-w-[56px] text-center ${colors.value}`}>
            {(value ?? stepper.defaultValue).toFixed(stepper.decimals)}{stepper.suffix}
          </span>

          {/* Stepper + */}
          <button
            type="button"
            onClick={() => step(stepper.step)}
            className={`h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-xs font-bold font-mono border border-slate-700 touch-press flex items-center justify-center ${colors.button}`}
            title="Increase"
          >
            +{stepper.stepLabel}
          </button>

          {optional && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="h-8 sm:h-9 px-2 rounded-lg text-gray-500 hover:text-gray-300 text-xs font-mono touch-press"
              title="Don't record"
              aria-label={`Don't record ${stepper.label.replace(/:$/, '')}`}
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
};
