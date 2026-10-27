import React from 'react';
import { useBrewStore, ADDITION_SUMMARY_CHECKLIST_IDS, DONE_CARD_READING_IDS, getDueReadings } from '../store/brewStore';
import { useStageTimerView, formatTime, formatWaitCountdown } from '../hooks/useStageTimerView';
import { getAdditionBadge } from '../utils/additionDisplay';
import { getReadingShortName } from '../utils/measurementSteppers';
import { CountdownProgressBar } from './CountdownProgressBar';
import { StageActions } from './StageActions';
import { StrikeOffsetControl } from './StrikeOffsetControl';
import { useFullscreen } from '../hooks/useFullscreen';
import { useAppUpdateReady } from '../hooks/useAppLifecycle';
import { Menu, Thermometer, Droplets, CheckCircle2, Check, Gauge, Maximize, Minimize } from 'lucide-react';

interface StageScreenProps {
  onOpenMenu: () => void;
  onConfirmAdvance: () => void;
  onOpenReportModal: () => void;
  onOpenStageCard: () => void;
  onOpenDoneCard: () => void;
  onRecordReading: () => void;
}

interface PlanItem {
  id: string;
  when: string | null;
  text: string;
  done: boolean;
  // Its time has just arrived: highlighted for a minute, no confirmation needed
  flashing?: boolean;
  // First minute after Start with nothing due yet: the first item to come is flagged as a heads-up
  headsUp?: boolean;
}

// How long a timed item flashes in the stage plan once its time arrives
const FLASH_SEC = 60;

// Digits sized to fill the screen width without overflowing. Monospace glyphs run ~0.53em wide on desktop but
// ~0.6em with Android's fallback monospace font, so 0.64 leaves a margin on both.
// Capped by height so landscape phones still fit the controls.
const digitFontSize = (text: string) => `min(calc((100vw - 2.5rem) / ${(text.length * 0.64).toFixed(2)}), 22dvh)`;

// By stage: one stage at a time, full screen. Big timer, what's next, the stage plan and the action buttons.
export const StageScreen: React.FC<StageScreenProps> = ({
  onOpenMenu,
  onConfirmAdvance,
  onOpenReportModal,
  onOpenStageCard,
  onOpenDoneCard,
  onRecordReading
}) => {
  const recipe = useBrewStore(state => state.recipe);
  const announcedDueIds = useBrewStore(state => state.announcedDueIds);
  const { isFullscreen, toggleFullscreen, canFullscreen } = useFullscreen();
  const updateReady = useAppUpdateReady();
  const {
    stages,
    currentStageIndex,
    currentStage,
    flow,
    flowPhase,
    timerStatus,
    timerRemainingSec,
    isSessionDone,
    isCountdownDone,
    displayTimeStr,
    activeRemainingSec,
    nextTimedEvent,
    isTimedItemDone
  } = useStageTimerView();

  if (!currentStage) return null;

  const boilTime = recipe?.boilTime || 60;
  const isCountdown = flow.kind === 'countdown';

  // Stage plan: timed additions and prompts for countdown stages; otherwise the stage's additions and reminders
  const timedWhen = (sec: number) => sec >= currentStage.plannedDurationSec
    ? 'Start'
    : sec === 0
    ? (currentStage.id === 'BOIL' ? 'Flameout' : 'End')
    : `${Math.round(sec / 60)}m left`;

  // Items due at the start (e.g. all Whirlpool hops) flash for the first minute after Start
  const isFlashing = (sec: number) =>
    timerStatus !== 'idle' &&
    activeRemainingSec <= sec &&
    activeRemainingSec > sec - FLASH_SEC;

  // Countdown stages list their timed items; once its time has passed (after its minute of flashing)
  // an item stays on the list, ticked and struck through.
  // Other stages list their additions and reminders as a plain reference: everything was confirmed on the card.
  const timedPlanItems: PlanItem[] = [
        ...currentStage.additions.map(a => ({
          id: a.id,
          sec: a.triggerRemainingSec,
          when: timedWhen(a.triggerRemainingSec),
          text: `${a.amount} ${a.unit || 'g'} ${a.name}`,
          done: isTimedItemDone(a.id, a.confirmed),
          flashing: isFlashing(a.triggerRemainingSec)
        })),
        ...currentStage.checklist
          .filter(c => c.triggerRemainingSec !== undefined)
          .map(c => ({
            id: c.id,
            sec: c.triggerRemainingSec!,
            when: timedWhen(c.triggerRemainingSec!),
            text: c.label,
            // A reading prompt (mash pH) stays open until the reading is recorded or skipped
            done: DONE_CARD_READING_IDS.includes(c.id) ? c.checked : isTimedItemDone(c.id, c.checked),
            flashing: isFlashing(c.triggerRemainingSec!)
          }))
      ].sort((a, b) => b.sec - a.sec);

  const isFirstMinute = timerStatus !== 'idle' && activeRemainingSec > currentStage.plannedDurationSec - FLASH_SEC;
  if (isFirstMinute && timedPlanItems.length > 0 && !timedPlanItems.some(item => item.flashing)) {
    timedPlanItems[0] = { ...timedPlanItems[0], headsUp: true };
  }

  const planItems: PlanItem[] = isCountdown
    ? timedPlanItems
    : [
        ...currentStage.additions.map(a => ({
          id: a.id,
          when: getAdditionBadge(a, currentStage.id, boilTime).label,
          text: `${a.amount} ${a.unit || 'g'} ${a.name}`,
          // Additions go in as the stage starts (e.g. sparge salts), so they're struck through once it has
          done: timerStatus !== 'idle' || flowPhase === 'finished'
        })),
        ...currentStage.checklist
          .filter(c => !(currentStage.additions.length > 0 && ADDITION_SUMMARY_CHECKLIST_IDS.includes(c.id)))
          .map(c => ({ id: c.id, when: null, text: c.label, done: false }))
      ];

  const stopwatchStr = formatTime(timerRemainingSec);

  // A reading whose prompt has fired (mash pH) can be recorded straight away rather than at the end of the stage
  const dueReadings = getDueReadings(currentStage, announcedDueIds);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 px-4 pt-2 pb-3 overflow-y-auto overscroll-contain select-none">
      {/* Header: stage number, targets and controls on top; the stage name gets its own full-width line */}
      <div className="shrink-0">
      <div className="flex items-center gap-2">
        {/* Recipe name (truncates) with the stage count */}
        <span className="min-w-0 flex-1 flex items-baseline gap-1.5 text-xs font-bold">
          <span className="min-w-0 truncate text-gray-300">{recipe?.name}</span>
          <span className="shrink-0 font-mono text-amber-400 uppercase tracking-wider">
            {recipe?.name ? '· ' : 'Stage '}{currentStageIndex + 1}/{stages.length}
          </span>
        </span>
        {currentStage.parameters?.targetTemp !== undefined && (
          <span className="shrink-0 flex items-center space-x-1 text-xs font-mono font-bold text-amber-400 bg-amber-950/70 px-2 py-1 rounded border border-amber-800/60">
            <Thermometer className="w-3.5 h-3.5" />
            <span>{currentStage.parameters.targetTemp}°C</span>
          </span>
        )}
        {currentStage.parameters?.targetVolume !== undefined && currentStage.parameters.targetVolume > 0 && (
          <span className="shrink-0 hidden min-[400px]:flex items-center space-x-1 text-xs font-mono font-bold text-cyan-400 bg-cyan-950/70 px-2 py-1 rounded border border-cyan-800/60">
            <Droplets className="w-3.5 h-3.5" />
            <span>{currentStage.parameters.targetVolume}L</span>
          </span>
        )}
        {/* Full screen hides the browser's address bar (not shown in the installed app, which has none) */}
        {canFullscreen && (
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
            className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center border touch-press ${
              isFullscreen
                ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-amber-300'
                : 'bg-amber-500 hover:bg-amber-400 border-amber-400 text-slate-950'
            }`}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5 stroke-[2.5]" />}
          </button>
        )}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label={updateReady ? 'Open menu (update ready)' : 'Open menu'}
          className="relative shrink-0 w-11 h-11 rounded-xl flex items-center justify-center bg-slate-900 hover:bg-slate-800 border border-slate-700 text-gray-200 touch-press"
        >
          <Menu className="w-5 h-5" />
          {/* Dot marks a downloaded update waiting in the menu */}
          {updateReady && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400 border-2 border-slate-950" />
          )}
        </button>
      </div>
      {/* Keyed by stage so the name eases in each time the stage changes */}
      <h1
        key={currentStageIndex}
        className="mt-1 text-3xl sm:text-4xl font-black text-white leading-tight break-words motion-safe:animate-stage-in"
      >
        {currentStage.title}
      </h1>
      </div>

      {/* Hero: the timer, stopwatch or stage confirmation fills the free space */}
      <div className="flex-1 min-h-[9rem] flex flex-col items-center justify-center text-center">
        {isSessionDone ? (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-950/90 border-2 border-emerald-500/80 flex items-center justify-center text-emerald-400 mb-2 shadow-[0_0_25px_rgba(16,185,129,0.4)]">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h2 className="text-xl font-black text-white font-mono tracking-wider uppercase">Brew Session Complete!</h2>
            <p className="text-xs text-emerald-400 font-mono mt-1">All {stages.length} stages finished</p>
          </div>
        ) : isCountdown ? (
          <>
            <div
              className={`w-full font-mono font-black tabular-nums leading-none tracking-tight ${
                isCountdownDone
                  ? 'text-emerald-400 animate-pulse hud-glow-green'
                  : timerStatus === 'running'
                  ? 'text-amber-400 hud-glow'
                  : timerStatus === 'paused'
                  ? 'text-amber-300/80'
                  : 'text-gray-200'
              }`}
              style={{ fontSize: digitFontSize(displayTimeStr) }}
            >
              {displayTimeStr}
            </div>
            <div className="w-full mt-3 px-1">
              <CountdownProgressBar size="large" />
            </div>
            <p className="mt-3 text-sm font-mono text-gray-300 min-h-[1.25rem]">
              {isCountdownDone ? (
                <span className="text-emerald-300 font-bold">{flow.endAlert || 'Stage complete'}</span>
              ) : nextTimedEvent ? (
                <>
                  <span className="text-cyan-300 font-bold">Next:</span> {nextTimedEvent.label}
                  <span className="text-cyan-400 font-bold">
                    {' · '}
                    {timerStatus === 'running'
                      ? `in ${formatWaitCountdown(nextTimedEvent.waitSec)}`
                      : nextTimedEvent.waitSec <= 0
                      ? 'at start'
                      : `@ ${Math.round(nextTimedEvent.triggerRemainingSec / 60)}m left`}
                  </span>
                </>
              ) : timerStatus === 'paused' ? (
                'Timer paused'
              ) : null}
            </p>
          </>
        ) : flow.kind === 'stopwatch' ? (
          <>
            <div
              className={`w-full font-mono font-black tabular-nums leading-none tracking-tight ${
                flowPhase === 'finished'
                  ? 'text-emerald-400'
                  : timerStatus === 'running'
                  ? 'text-cyan-400 hud-glow-cyan'
                  : 'text-gray-300'
              }`}
              style={{ fontSize: digitFontSize(stopwatchStr) }}
            >
              {stopwatchStr}
            </div>
            <p className="mt-3 text-sm font-mono text-gray-400">
              {flowPhase === 'finished'
                ? <span className="text-emerald-300 font-bold">Time stored</span>
                : timerStatus === 'running'
                ? `Stopwatch running · est ${Math.round(currentStage.plannedDurationSec / 60)}m`
                : `Stopwatch · est ${Math.round(currentStage.plannedDurationSec / 60)}m`}
            </p>
          </>
        ) : currentStage.id === 'WATER_PREP' ? (
          <StrikeOffsetControl size="large" />
        ) : (
          <div className="flex flex-col items-center max-w-sm">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2" />
            <p className="text-sm text-gray-300 leading-snug">{currentStage.description}</p>
          </div>
        )}
      </div>

      {/* Stage plan (read-only) */}
      {!isSessionDone && planItems.length > 0 && (
        <ul className="shrink-0 max-h-[24dvh] overflow-y-auto overscroll-contain rounded-xl bg-slate-900/70 border border-slate-800 divide-y divide-slate-800/80">
          {planItems.map(item => (
            <li
              key={item.id}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm ${
                item.flashing || item.headsUp ? 'text-white font-bold' : item.done ? 'text-gray-500' : 'text-gray-200'
              }`}
            >
              {/* The bullet itself flashes: green when the item is due now, amber as the first-minute heads-up */}
              {item.flashing || item.headsUp ? (
                <span className="relative w-4 h-4 shrink-0 flex items-center justify-center">
                  <span className={`absolute inset-0 rounded-full animate-ping ${item.flashing ? 'bg-emerald-400/70' : 'bg-amber-400/70'}`} />
                  <span className={`relative w-4 h-4 rounded-full ${
                    item.flashing ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]' : 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)]'
                  }`} />
                </span>
              ) : item.done ? (
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <span className="w-4 h-4 shrink-0 rounded-full border border-slate-600" />
              )}
              {item.when && (
                <span className={`shrink-0 w-[4.5rem] text-[11px] font-mono font-bold uppercase ${
                  item.flashing ? 'text-emerald-300' : item.headsUp ? 'text-amber-300' : item.done ? 'text-gray-600' : 'text-cyan-300'
                }`}>
                  {item.flashing ? 'Now' : item.when}
                </span>
              )}
              <span className={`min-w-0 truncate ${item.done && !item.flashing ? 'line-through' : ''}`}>{item.text}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Actions */}
      <div className="shrink-0 space-y-1.5">
        {!isSessionDone && dueReadings.length > 0 && (
          <button
            type="button"
            onClick={onRecordReading}
            className="w-full min-h-[48px] rounded-xl font-mono font-black text-sm tracking-wider uppercase touch-press flex items-center justify-center space-x-2 border bg-purple-950/70 hover:bg-purple-900/80 text-purple-200 border-purple-500/60"
          >
            <Gauge className="w-5 h-5 text-purple-300" />
            <span>Record {dueReadings.map(c => getReadingShortName(c.id, c.label)).join(' & ')}</span>
          </button>
        )}
        <StageActions
          size="large"
          onConfirmAdvance={onConfirmAdvance}
          onOpenReportModal={onOpenReportModal}
          onOpenStageCard={onOpenStageCard}
          onOpenDoneCard={onOpenDoneCard}
        />
      </div>
    </div>
  );
};
