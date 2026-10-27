import React, { useState } from 'react';
import {
  useBrewStore,
  getUnconfirmedAdditions,
  getStageCardReminders,
  getPendingEndReadings
} from '../store/brewStore';
import type { SessionMeasurements, StageAddition } from '../types/session';
import { getMeasurementStepper } from '../utils/measurementSteppers';
import { getAdditionBadge, getAdditionTypeInfo } from '../utils/additionDisplay';
import { getStageFlow } from '../hooks/useStageTimerView';
import { MeasurementStepper } from './MeasurementStepper';
import { ClipboardCheck, Play, CheckCircle2, Timer } from 'lucide-react';

interface StageCardProps {
  onClose: () => void;
}

// By stage start card: confirm the stage's reminders and additions in one go, record start readings, then start
export const StageCard: React.FC<StageCardProps> = ({ onClose }) => {
  const stages = useBrewStore(state => state.stages);
  const currentStageIndex = useBrewStore(state => state.currentStageIndex);
  const recipe = useBrewStore(state => state.recipe);
  const timerStatus = useBrewStore(state => state.timerStatus);
  const confirmStageCard = useBrewStore(state => state.confirmStageCard);
  const startTimer = useBrewStore(state => state.startTimer);
  const confirmFlowStage = useBrewStore(state => state.confirmFlowStage);

  const [readings, setReadings] = useState<Partial<SessionMeasurements>>({});

  const stage = stages[currentStageIndex];
  if (!stage) return null;

  const flow = getStageFlow(stage);
  const boilTime = recipe?.boilTime || 60;
  const additions = [...getUnconfirmedAdditions(stage)].sort((a, b) => b.triggerRemainingSec - a.triggerRemainingSec);
  const cardReminders = getStageCardReminders(stage);
  const readingItems = cardReminders.filter(c => getMeasurementStepper(c.id, stage, recipe) !== null);
  const reminders = cardReminders.filter(c => getMeasurementStepper(c.id, stage, recipe) === null);
  const laterReadings = getPendingEndReadings(stage);

  // Opened before the stage starts it confirms and starts; opened mid-stage (after switching mode) it only confirms
  const isBeforeStart = timerStatus === 'idle' && stage.flowPhase !== 'finished';
  const primaryLabel = !isBeforeStart ? 'Confirm' : flow.kind === 'confirm' ? 'Confirm & done' : 'Confirm & start';
  const PrimaryIcon = isBeforeStart && flow.kind !== 'confirm' ? Play : CheckCircle2;

  const timingLabel = flow.kind === 'countdown'
    ? `${Math.round(stage.plannedDurationSec / 60)} min timer`
    : flow.kind === 'stopwatch'
    ? `Stopwatch · est ${Math.round(stage.plannedDurationSec / 60)}m`
    : 'Checklist';

  const additionTiming = (addition: StageAddition): string | null => {
    if (flow.kind !== 'countdown' || stage.id === 'BOIL') return null;
    return addition.triggerRemainingSec >= stage.plannedDurationSec ? 'at start' : `@ ${addition.triggerTimeMin}m left`;
  };

  const handleConfirm = () => {
    confirmStageCard(readings);
    if (isBeforeStart) {
      if (flow.kind === 'confirm') {
        confirmFlowStage();
      } else {
        startTimer();
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stage-card-title"
        className="w-full max-w-lg max-h-[94dvh] flex flex-col bg-slate-950/95 backdrop-blur-xl border border-emerald-500/40 shadow-[0_0_35px_rgba(16,185,129,0.18)] rounded-t-2xl sm:rounded-2xl pb-[env(safe-area-inset-bottom,0px)]"
      >
        {/* Header */}
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-slate-800">
          <span className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider">
            Stage {currentStageIndex + 1}/{stages.length} · {timingLabel}
          </span>
          <h3 id="stage-card-title" className="flex items-center space-x-2 text-lg font-black text-white leading-tight mt-0.5">
            <ClipboardCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="truncate">{stage.title}</span>
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            {additions.length > 0 || reminders.length > 0
              ? 'Check everything below is in hand, then confirm it all in one go.'
              : 'Nothing to prepare for this stage.'}
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-4">
          {additions.length > 0 && (
            <section>
              <h4 className="text-[11px] font-mono font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                Additions ({additions.length})
              </h4>
              <ul className="space-y-1.5">
                {additions.map(addition => {
                  const badge = getAdditionBadge(addition, stage.id, boilTime);
                  const typeInfo = getAdditionTypeInfo(addition);
                  const timing = additionTiming(addition);
                  return (
                    <li
                      key={addition.id}
                      className={`px-2.5 py-2 rounded-lg bg-slate-900/80 border border-slate-800 ${typeInfo.borderAccent}`}
                    >
                      <div className="flex items-center flex-wrap gap-1">
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-black uppercase border ${badge.bg}`}>
                          {badge.label}
                        </span>
                        {timing && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold border bg-slate-900 text-cyan-300 border-slate-700">
                            {timing}
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline justify-between gap-2 mt-0.5">
                        <span className="font-bold text-sm text-white truncate">{addition.name}</span>
                        <span className={`font-mono font-black text-sm shrink-0 ${typeInfo.amountColor}`}>
                          {addition.amount} {addition.unit || 'g'}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {reminders.length > 0 && (
            <section>
              <h4 className="text-[11px] font-mono font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                Reminders ({reminders.length})
              </h4>
              <ul className="space-y-1">
                {reminders.map(item => (
                  <li key={item.id} className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500/70 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-gray-100 leading-snug">{item.label}</span>
                      {item.triggerRemainingSec !== undefined && (
                        <span className="ml-1.5 inline-flex items-center text-[10px] font-mono font-bold text-cyan-300">
                          <Timer className="w-3 h-3 mr-0.5" />
                          alert @ {Math.round(item.triggerRemainingSec / 60)}m left
                        </span>
                      )}
                      {item.explanation && (
                        <p className="text-[11px] text-gray-400 leading-snug line-clamp-2">{item.explanation}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {readingItems.length > 0 && (
            <section>
              <h4 className="text-[11px] font-mono font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                Readings (optional)
              </h4>
              <ul className="space-y-1.5">
                {readingItems.map(item => {
                  const stepper = getMeasurementStepper(item.id, stage, recipe)!;
                  return (
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
                  );
                })}
              </ul>
            </section>
          )}

          {laterReadings.length > 0 && (
            <p className="text-[11px] font-mono text-gray-400">
              Later in this stage you'll be asked for: {laterReadings.map(c => c.label).join(', ')}.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex gap-2 px-4 pt-3 pb-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 min-h-[52px] rounded-xl bg-slate-900 hover:bg-slate-800 text-gray-300 border border-slate-700 font-mono font-bold text-xs uppercase tracking-wider touch-press"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 min-h-[52px] rounded-xl font-mono font-black text-sm tracking-widest uppercase touch-press flex items-center justify-center space-x-2 border bg-emerald-950/80 hover:bg-emerald-900 active:bg-emerald-800 text-emerald-200 border-emerald-500/70 shadow-[0_0_20px_rgba(16,185,129,0.35)]"
          >
            <PrimaryIcon className="w-5 h-5 text-emerald-400" />
            <span>{primaryLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
