import React, { useState } from 'react';
import {
  useBrewStore,
  getUnconfirmedAdditions,
  getStageCardReminders,
  getPendingEndReadings,
  ADDITION_SUMMARY_CHECKLIST_IDS,
  DONE_CARD_READING_IDS,
  isStrikeControlReading
} from '../store/brewStore';
import type { SessionMeasurements, StageAddition } from '../types/session';
import { getMeasurementStepper } from '../utils/measurementSteppers';
import { getAdditionBadge, getAdditionTypeInfo } from '../utils/additionDisplay';
import { getStageFlow, formatTime } from '../hooks/useStageTimerView';
import { MeasurementStepper } from './MeasurementStepper';
import { StrikeOffsetControl } from './StrikeOffsetControl';
import { AlertTriangle, Check, CheckCircle2, ChevronDown, Clock, Play, Timer } from 'lucide-react';

interface StagePrepareProps {
  onConfirmAdvance: () => void;
}

const sectionLabel = 'text-[11px] font-mono font-bold text-gray-400 uppercase tracking-wider mb-1.5';
const listClass = 'rounded-xl bg-slate-900/70 border border-slate-800 divide-y divide-slate-800/80';

// By stage, before the stage starts: its additions, reminders and optional readings on the stage screen itself,
// confirmed in one go. The same screen then becomes the running timer or stopwatch.
export const StagePrepare: React.FC<StagePrepareProps> = ({ onConfirmAdvance }) => {
  const stages = useBrewStore(state => state.stages);
  const currentStageIndex = useBrewStore(state => state.currentStageIndex);
  const recipe = useBrewStore(state => state.recipe);
  const timerStatus = useBrewStore(state => state.timerStatus);
  const timerRemainingSec = useBrewStore(state => state.timerRemainingSec);
  const confirmStageCard = useBrewStore(state => state.confirmStageCard);
  const startTimer = useBrewStore(state => state.startTimer);
  const confirmFlowStage = useBrewStore(state => state.confirmFlowStage);

  const [readings, setReadings] = useState<Partial<SessionMeasurements>>({});
  // Readings are optional, so they stay tucked away behind one link until asked for
  const [showReadings, setShowReadings] = useState(false);
  const [openReminderId, setOpenReminderId] = useState<string | null>(null);

  const stage = stages[currentStageIndex];
  if (!stage) return null;

  const flow = getStageFlow(stage);
  const boilTime = recipe?.boilTime || 60;
  // Confirm stages (Strike Water, Mash In, Yeast Pitch, Clean Up) always open on this screen, also when going
  // back to one, so they list items already done as well, ticked
  const listDone = flow.kind === 'confirm';
  const additions = [...(listDone ? stage.additions : getUnconfirmedAdditions(stage))]
    .sort((a, b) => b.triggerRemainingSec - a.triggerRemainingSec);
  const cardReminders = getStageCardReminders(stage);
  const readingItems = cardReminders.filter(c => getMeasurementStepper(c.id, stage, recipe) !== null);
  const reminders = (listDone
    ? stage.checklist.filter(c =>
        !DONE_CARD_READING_IDS.includes(c.id) &&
        !(stage.additions.length > 0 && ADDITION_SUMMARY_CHECKLIST_IDS.includes(c.id)) &&
        !isStrikeControlReading(stage, c.id) &&
        (c.checked || cardReminders.includes(c)))
    : cardReminders
  ).filter(c => getMeasurementStepper(c.id, stage, recipe) === null);
  const laterReadings = getPendingEndReadings(stage);

  // Switched to By stage mid-stage: confirm only, the timer is already going
  const isBeforeStart = timerStatus === 'idle' && stage.flowPhase !== 'finished';
  const durationMin = Math.round(stage.plannedDurationSec / 60);
  const timingChip = !isBeforeStart && flow.kind !== 'confirm'
    ? `Running · ${formatTime(timerRemainingSec)}`
    : flow.kind === 'countdown'
    ? `${durationMin} min timer`
    : flow.kind === 'stopwatch'
    ? `Stopwatch · est ${durationMin}m`
    : 'Checklist';
  const countChip = [
    additions.length > 0 ? `${additions.length} addition${additions.length === 1 ? '' : 's'}` : '',
    reminders.length > 0 ? `${reminders.length} reminder${reminders.length === 1 ? '' : 's'}` : ''
  ].filter(Boolean).join(' · ');

  const primaryLabel = !isBeforeStart
    ? 'Confirm'
    : flow.kind === 'confirm'
    ? (stage.id === 'CLEANUP' ? 'Confirm & finish' : 'Confirm & done')
    : 'Confirm & start';
  const PrimaryIcon = isBeforeStart && flow.kind !== 'confirm' ? Play : CheckCircle2;

  const additionWhen = (addition: StageAddition): string => {
    if (flow.kind !== 'countdown') return getAdditionBadge(addition, stage.id, boilTime).label;
    if (addition.triggerRemainingSec >= stage.plannedDurationSec) return 'Start';
    if (addition.triggerRemainingSec === 0) return stage.id === 'BOIL' ? 'Flameout' : 'End';
    return `${addition.triggerTimeMin}m left`;
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
  };

  return (
    <>
      {/* Summary chips: what kind of stage this is and how much is in it */}
      <div className="shrink-0 flex flex-wrap gap-1.5 motion-safe:animate-stage-in">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono font-bold bg-cyan-950/70 text-cyan-300 border border-cyan-800/60">
          {flow.kind === 'confirm' ? <CheckCircle2 className="w-3.5 h-3.5" /> : flow.kind === 'stopwatch' ? <Timer className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
          {timingChip}
        </span>
        {countChip && (
          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-mono text-gray-300 bg-slate-900 border border-slate-800">
            {countChip}
          </span>
        )}
      </div>

      {/* The checklist fills the free space and scrolls on its own; the button below stays put */}
      <div className="flex-1 min-h-[9rem] overflow-y-auto overscroll-contain flex flex-col gap-3 motion-safe:animate-stage-in">
        {stage.id === 'WATER_PREP' && (
          <div className="flex flex-col items-center py-1">
            <StrikeOffsetControl />
          </div>
        )}

        {/* A stage with nothing to list (e.g. Yeast Pitch) says what it is for instead */}
        {additions.length === 0 && reminders.length === 0 && readingItems.length === 0 && stage.description && (
          <p className="text-sm text-gray-300 leading-snug px-1">{stage.description}</p>
        )}

        {additions.length > 0 && (
          <section>
            <h2 className={sectionLabel}>Additions</h2>
            <ul className={listClass}>
              {additions.map(addition => {
                const typeInfo = getAdditionTypeInfo(addition);
                return (
                  <li key={addition.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="shrink-0 w-[4.5rem] text-[11px] font-mono font-bold uppercase text-cyan-300">
                      {additionWhen(addition)}
                    </span>
                    <span className={`min-w-0 flex-1 truncate font-semibold ${addition.confirmed ? 'text-gray-500 line-through' : 'text-gray-100'}`}>
                      {addition.name}
                    </span>
                    {addition.confirmed && <Check className="w-4 h-4 shrink-0 text-emerald-500" />}
                    <span className={`shrink-0 font-mono font-black ${addition.confirmed ? 'text-gray-500' : typeInfo.amountColor}`}>
                      {addition.amount} {addition.unit || 'g'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {reminders.length > 0 && (
          <section>
            <h2 className={sectionLabel}>Reminders</h2>
            <ul className={listClass}>
              {reminders.map(item => {
                const isOpen = openReminderId === item.id;
                return (
                  <li key={item.id}>
                    {/* Name only; tap for the explanation */}
                    <button
                      type="button"
                      onClick={() => setOpenReminderId(isOpen ? null : item.id)}
                      aria-expanded={item.explanation ? isOpen : undefined}
                      disabled={!item.explanation}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-100 touch-press"
                    >
                      {item.checked
                        ? <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                        : <span className="w-4 h-4 shrink-0 rounded-full border border-slate-600" />}
                      <span className={`min-w-0 flex-1 font-semibold ${item.checked ? 'text-gray-500 line-through' : ''}`}>{item.label}</span>
                      {item.triggerRemainingSec !== undefined && (
                        <span className="shrink-0 text-[11px] font-mono font-bold text-cyan-300">
                          Alert @ {Math.round(item.triggerRemainingSec / 60)}m left
                        </span>
                      )}
                      {item.explanation && (
                        <ChevronDown className={`w-4 h-4 shrink-0 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      )}
                    </button>
                    {isOpen && item.explanation && (
                      <p className="px-3 pb-2 pl-9 text-xs text-gray-400 leading-snug">{item.explanation}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {readingItems.length > 0 && !showReadings && (
          <button
            type="button"
            onClick={() => {
              // Asking for a reading opens its stepper at the target value, ready to nudge
              setReadings(Object.fromEntries(readingItems.map(item => {
                const stepper = getMeasurementStepper(item.id, stage, recipe)!;
                return [stepper.key, stepper.defaultValue];
              })));
              setShowReadings(true);
            }}
            className="w-full text-left px-3 py-2 rounded-xl border border-dashed border-slate-700 text-sm font-semibold text-amber-300 hover:bg-slate-900/60 touch-press"
          >
            + Add reading <span className="text-gray-400 font-normal">· {readingItems.map(c => c.label).join(', ')}</span>
          </button>
        )}

        {readingItems.length > 0 && showReadings && (
          <section>
            <h2 className={sectionLabel}>Readings (optional)</h2>
            <ul className={listClass}>
              {readingItems.map(item => {
                const stepper = getMeasurementStepper(item.id, stage, recipe)!;
                return (
                  <li key={item.id} className="px-3 py-2 space-y-1.5">
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
          <p className="text-[11px] font-mono text-gray-400 px-1">
            Later in this stage you'll be asked for: {laterReadings.map(c => c.label).join(', ')}.
          </p>
        )}

        {/* The timer about to start, dimmed: it lights up in place once the stage starts */}
        {isBeforeStart && flow.kind !== 'confirm' && (
          <div className="mt-auto pt-4 text-center font-mono font-black tabular-nums leading-tight tracking-tight text-slate-700 text-6xl" aria-hidden="true">
            {formatTime(flow.kind === 'countdown' ? stage.plannedDurationSec : 0)}
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-1.5">
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full min-h-[64px] sm:min-h-[72px] py-3 rounded-xl font-mono font-black text-base sm:text-lg tracking-widest uppercase touch-press flex items-center justify-center gap-2 border bg-emerald-950/80 hover:bg-emerald-900 active:bg-emerald-800 text-emerald-200 border-emerald-500/70 shadow-[0_0_20px_rgba(16,185,129,0.35)]"
        >
          <PrimaryIcon className="w-5 h-5 text-emerald-400" />
          <span>{primaryLabel}</span>
        </button>
        <div className="flex justify-center pt-0.5">
          <button
            type="button"
            onClick={onConfirmAdvance}
            className="text-xs py-1 font-mono text-gray-500 hover:text-gray-300 underline flex items-center space-x-1"
          >
            <AlertTriangle className="w-3 h-3 text-amber-500/60" />
            <span>Skip stage…</span>
          </button>
        </div>
      </div>
    </>
  );
};
