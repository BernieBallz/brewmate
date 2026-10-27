import React, { useState } from 'react';
import { useBrewStore, getPendingEndReadings, getDueReadings } from '../store/brewStore';
import type { SessionMeasurements } from '../types/session';
import { getMeasurementStepper } from '../utils/measurementSteppers';
import { getStageFlow } from '../hooks/useStageTimerView';
import { MeasurementStepper } from './MeasurementStepper';
import { ArrowRight, Gauge, Check } from 'lucide-react';

export type ReadingCardMode = 'finish' | 'record';

interface DoneCardProps {
  // 'finish': all outstanding readings, then move on to the next stage.
  // 'record': only readings that have just come due (mash pH mid-rest); saves and stays on the stage.
  mode?: ReadingCardMode;
  onClose: () => void;
}

// By stage reading card: readings taken during or at the end of the stage (mash pH, pre-boil SG, OG)
export const DoneCard: React.FC<DoneCardProps> = ({ mode = 'finish', onClose }) => {
  const stages = useBrewStore(state => state.stages);
  const currentStageIndex = useBrewStore(state => state.currentStageIndex);
  const recipe = useBrewStore(state => state.recipe);
  const setMeasurement = useBrewStore(state => state.setMeasurement);
  const nextStage = useBrewStore(state => state.nextStage);
  const confirmFlowStage = useBrewStore(state => state.confirmFlowStage);
  const announcedDueIds = useBrewStore(state => state.announcedDueIds);

  const [readings, setReadings] = useState<Partial<SessionMeasurements>>({});

  const stage = stages[currentStageIndex];
  if (!stage) return null;

  const flow = getStageFlow(stage);
  const isRecord = mode === 'record';
  const pending = (isRecord ? getDueReadings(stage, announcedDueIds) : getPendingEndReadings(stage))
    .map(item => ({ item, stepper: getMeasurementStepper(item.id, stage, recipe) }))
    .filter((entry): entry is { item: typeof entry.item; stepper: NonNullable<typeof entry.stepper> } => entry.stepper !== null);

  const advance = () => {
    if (flow.kind === 'confirm') {
      confirmFlowStage();
    } else {
      nextStage();
    }
    onClose();
  };

  const handleSave = () => {
    for (const [key, value] of Object.entries(readings)) {
      if (typeof value === 'number') {
        setMeasurement(key as keyof SessionMeasurements, value);
      }
    }
    if (isRecord) {
      onClose();
    } else {
      advance();
    }
  };

  const hasReadings = Object.keys(readings).length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="done-card-title"
        className="w-full max-w-lg max-h-[94dvh] flex flex-col bg-slate-950/95 backdrop-blur-xl border border-purple-500/40 shadow-[0_0_35px_rgba(168,85,247,0.18)] rounded-t-2xl sm:rounded-2xl pb-[env(safe-area-inset-bottom,0px)]"
      >
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-slate-800">
          <span className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider">
            {isRecord ? `${stage.title} · due now` : `Finishing ${stage.title}`}
          </span>
          <h3 id="done-card-title" className="flex items-center space-x-2 text-lg font-black text-white leading-tight mt-0.5">
            <Gauge className="w-5 h-5 text-purple-400 shrink-0" />
            <span>{isRecord ? 'Record reading' : 'Record readings'}</span>
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            {isRecord ? 'The timer keeps running.' : 'Leave a reading empty to skip it.'}
          </p>
        </div>

        <ul className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-1.5">
          {pending.map(({ item, stepper }) => (
            <li key={item.id} className="px-2.5 py-2 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1.5">
              <span className="block text-sm font-semibold text-gray-100">{item.label}</span>
              <MeasurementStepper
                stepper={stepper}
                value={readings[stepper.key]}
                optional
                onChange={(value) => setReadings(prev => ({ ...prev, [stepper.key]: value }))}
                onClear={() => setReadings(prev => {
                  const next = { ...prev };
                  delete next[stepper.key];
                  return next;
                })}
              />
            </li>
          ))}
        </ul>

        <div className="shrink-0 flex gap-2 px-4 pt-3 pb-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 min-h-[52px] rounded-xl bg-slate-900 hover:bg-slate-800 text-gray-300 border border-slate-700 font-mono font-bold text-xs uppercase tracking-wider touch-press"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 min-h-[52px] rounded-xl font-mono font-black text-sm tracking-widest uppercase touch-press flex items-center justify-center space-x-2 border bg-emerald-950/80 hover:bg-emerald-900 active:bg-emerald-800 text-emerald-200 border-emerald-500/70 shadow-[0_0_20px_rgba(16,185,129,0.35)]"
          >
            {isRecord ? (
              <>
                <Check className="w-5 h-5 text-emerald-400" />
                <span>Save</span>
              </>
            ) : (
              <>
                <span>{hasReadings ? 'Save & next' : 'Skip & next'}</span>
                <ArrowRight className="w-5 h-5 text-emerald-400" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
