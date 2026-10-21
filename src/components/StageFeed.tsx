import React, { useEffect, useRef, useState } from 'react';
import { useBrewStore } from '../store/brewStore';
import type { StageAddition, ChecklistItem } from '../types/session';
import { isEnzymeAddition } from '../utils/brewfatherParser';
import {
  Check,
  Leaf,
  FlaskConical,
  Pill,
  Sparkles,
  Info,
  Undo2,
  X
} from 'lucide-react';

// Compact, single-line tab pills so the tabs stay secondary to the stage controls above
const tabClass = (isActive: boolean): string =>
  `px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap border transition-all touch-press ${
    isActive
      ? 'bg-amber-500/10 text-amber-300 border-amber-500/40'
      : 'text-gray-400 hover:text-gray-200 border-transparent'
  }`;

export const StageFeed: React.FC = () => {
  const {
    stages,
    currentStageIndex,
    toggleChecklistItem,
    confirmAddition,
    unconfirmAddition,
    measurements,
    setMeasurement,
    timerStatus,
    timerRemainingSec,
    timerTotalSec,
    auditLogs,
    recipe
  } = useBrewStore();

  const [activeExplanationItem, setActiveExplanationItem] = useState<ChecklistItem | null>(null);

  const currentStage = stages[currentStageIndex];
  const hasAdditions = currentStage.additions && currentStage.additions.length > 0;
  const boilTime = recipe?.boilTime || 60;
  const lauterStage = stages.find(s => s.id === 'LAUTER_SPARGE');
  const coolingStage = stages.find(s => s.id === 'COOLING_RECIRC');
  const knockoutStage = stages.find(s => s.id === 'KNOCKOUT_TRANSFER');

  const activeRemainingSec =
    timerStatus === 'idle' && currentStage?.flowPhase !== 'finished'
      ? timerTotalSec || currentStage?.plannedDurationSec || 0
      : timerRemainingSec;

  const formatWaitTime = (waitSec: number) => {
    const sec = Math.max(0, waitSec);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const remM = m % 60;
      return `${h}h ${remM}m`;
    }
    if (m > 0) {
      return `${m}m ${s.toString().padStart(2, '0')}s`;
    }
    return `${s}s`;
  };

  // Always prioritize Reminders as first visible tab across all stages (resets automatically on stage change)
  const [selectedTabState, setSelectedTabState] = useState<{ stageIdx: number; tab: 'reminders' | 'additions' | 'log' }>({
    stageIdx: currentStageIndex,
    tab: 'reminders'
  });

  const activeTab = selectedTabState.stageIdx === currentStageIndex ? selectedTabState.tab : 'reminders';
  const setActiveTab = (tab: 'reminders' | 'additions' | 'log') => {
    setSelectedTabState({ stageIdx: currentStageIndex, tab });
  };

  // The tabs share one scroll area, so each new stage and each tab switch starts at the top of its list
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollBodyRef.current?.scrollTo({ top: 0 });
  }, [currentStageIndex, activeTab]);

  const updateMetric = (key: any, currentVal: number | undefined, delta: number, defaultVal: number) => {
    const val = currentVal !== undefined ? currentVal : defaultVal;
    const newVal = Math.round((val + delta) * 1000) / 1000;
    setMeasurement(key, newVal);
  };

  // Stage-aware addition badge label & styling
  const getAdditionBadge = (addition: StageAddition) => {
    const stageId = currentStage.id;
    if (stageId === 'BOIL') {
      if (addition.triggerTimeMin >= boilTime) {
        return { label: `START`, bg: 'bg-emerald-950 text-emerald-300 border-emerald-800' };
      }
      if (addition.triggerTimeMin === 0) {
        return { label: 'FLAMEOUT', bg: 'bg-red-950 text-red-300 border-red-800' };
      }
      return { label: `T-${addition.triggerTimeMin}m`, bg: 'bg-slate-800 text-amber-400 border-slate-700' };
    }
    if (stageId === 'MASH_IN' || stageId === 'MASH_SCHEDULE') {
      return { label: 'DOUGH-IN', bg: 'bg-amber-950 text-amber-300 border-amber-800' };
    }
    if (stageId === 'HOPSTAND_WHIRLPOOL') {
      return { label: 'WHIRLPOOL', bg: 'bg-cyan-950 text-cyan-300 border-cyan-800' };
    }
    if (stageId === 'YEAST_PITCH') {
      return { label: 'AT PITCH', bg: 'bg-purple-950 text-purple-300 border-purple-800' };
    }
    return {
      label: addition.triggerTimeMin > 0 ? `T-${addition.triggerTimeMin}m` : 'ADDITION',
      bg: 'bg-slate-800 text-amber-400 border-slate-700'
    };
  };

  // Addition categorization helper for distinct visual scanning (Hops vs Finings vs Nutrients vs Sugars)
  const getAdditionTypeInfo = (addition: StageAddition) => {
    const isHop = addition.type === 'hop' || addition.name.toLowerCase().includes('hop');
    if (isHop) {
      return {
        isHop: true,
        tag: 'HOP',
        icon: Leaf,
        tagColor: 'bg-emerald-950 text-emerald-300 border-emerald-700/80',
        amountColor: 'text-emerald-400',
        borderAccent: 'border-l-4 border-l-emerald-400'
      };
    }
    const nameLower = addition.name.toLowerCase();
    if (nameLower.includes('protafloc') || nameLower.includes('whirlfloc') || nameLower.includes('finings')) {
      return {
        isHop: false,
        tag: 'FINING',
        icon: FlaskConical,
        tagColor: 'bg-blue-950/80 text-blue-300 border-blue-800/80',
        amountColor: 'text-blue-300',
        borderAccent: 'border-l-4 border-l-blue-400'
      };
    }
    if (nameLower.includes('nutrient') || nameLower.includes('yeastlife') || nameLower.includes('zinc')) {
      return {
        isHop: false,
        tag: 'NUTRIENT',
        icon: Pill,
        tagColor: 'bg-purple-950/80 text-purple-300 border-purple-800/80',
        amountColor: 'text-purple-300',
        borderAccent: 'border-l-4 border-l-purple-400'
      };
    }
    if (addition.type === 'sugar' || nameLower.includes('sugar') || nameLower.includes('dextrose')) {
      return {
        isHop: false,
        tag: 'SUGAR',
        icon: Sparkles,
        tagColor: 'bg-amber-950/80 text-amber-300 border-amber-800/80',
        amountColor: 'text-amber-300',
        borderAccent: 'border-l-4 border-l-amber-400'
      };
    }
    if (addition.type === 'enzyme' || isEnzymeAddition(addition.name)) {
      return {
        isHop: false,
        tag: 'ENZYME',
        icon: FlaskConical,
        tagColor: 'bg-rose-950/80 text-rose-300 border-rose-800/80',
        amountColor: 'text-rose-300',
        borderAccent: 'border-l-4 border-l-rose-400'
      };
    }
    return {
      isHop: false,
      tag: 'MISC',
      icon: FlaskConical,
      tagColor: 'bg-slate-800 text-gray-300 border-slate-700',
      amountColor: 'text-amber-400',
      borderAccent: 'border-l-4 border-l-slate-600'
    };
  };

  const additionReminderIds = ['mash-additions-check', 'boil-additions-monitor', 'whirlpool-additions', 'pitch-additions'];

  return (
    <div className="flex flex-col h-full bg-slate-900/95 rounded-xl border border-brew-border p-2.5 overflow-hidden shadow-lg select-none">
      {/* Tab Selector Header - Tasks is Always First */}
      <div className="flex items-center justify-between border-b border-brew-border pb-1 mb-1.5 shrink-0">
        <div className="flex items-center space-x-1 min-w-0">
          {/* TAB 1: Reminders (Default Active Tab) */}
          <button
            onClick={() => setActiveTab('reminders')}
            className={tabClass(activeTab === 'reminders')}
          >
            Reminders
            <span className="ml-1 font-mono text-[10px] text-gray-500">
              {currentStage.checklist.filter(c => c.checked).length}/{currentStage.checklist.length}
            </span>
          </button>

          {/* TAB 2: Additions (Preserving alerts and animations) */}
          {hasAdditions && (
            <button
              onClick={() => setActiveTab('additions')}
              className={tabClass(activeTab === 'additions')}
            >
              Additions
              <span className="ml-1 font-mono text-[10px] text-gray-500">
                {currentStage.additions.filter(a => a.confirmed).length}/{currentStage.additions.length}
              </span>
            </button>
          )}

          {/* TAB 3: Session Activity Log */}
          <button
            onClick={() => setActiveTab('log')}
            className={tabClass(activeTab === 'log')}
          >
            Session Log
          </button>
        </div>
      </div>

      {/* Scrollable Content Body (overscroll-contain stops chaining to page rubber-band) */}
      <div ref={scrollBodyRef} className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pr-0.5 space-y-2 pb-16">
        {/* 1. REMINDERS TAB (FIRST & DEFAULT) */}
        {activeTab === 'reminders' && (
          <div className="space-y-2">
            {/* Mash Sub-steps if present */}
            {currentStage.mashSubSteps && currentStage.mashSubSteps.length > 0 && (
              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-amber-500/20 mb-2">
                <span className="text-[11px] font-mono text-amber-400 font-bold block mb-1">
                  MASH SCHEDULE
                </span>
                {currentStage.mashSubSteps.map((step, idx) => (
                  <div key={idx} className="flex justify-between text-xs py-0.5 text-gray-300">
                    <span>{step.name}</span>
                    <span className="font-mono text-amber-400 font-bold">{step.temp}°C ({step.durationMinutes}m)</span>
                  </div>
                ))}
              </div>
            )}

            {/* Checklist reminder items with timer-synced state & inline linked additions/measurements */}
            {(() => {
              // Determine checklist item completion, taking into account additions completion for addition sections
              const isAdditionItemDone = () => {
                return currentStage.additions.length > 0 && currentStage.additions.every(a => a.confirmed);
              };

              const isChecklistItemDone = (c: typeof currentStage.checklist[0]) => {
                if (additionReminderIds.includes(c.id) && hasAdditions) {
                  return isAdditionItemDone();
                }
                return c.checked;
              };

              // First actionable item that is not yet completed
              const firstActionableId = currentStage.checklist.find(
                c =>
                  !isChecklistItemDone(c) &&
                  (c.triggerRemainingSec === undefined ||
                    ((timerStatus !== 'idle' || currentStage.flowPhase === 'finished') &&
                      activeRemainingSec <= c.triggerRemainingSec))
              )?.id;

              return currentStage.checklist.map((item) => {
                const isMashPh = item.id === 'ph-sample';
                const isPreBoilSg = item.id === 'preboil-sg';
                const isPostBoilSg = item.id === 'postboil-sg';
                const hasStepper = isMashPh || isPreBoilSg || isPostBoilSg;
                const isAdditionLinkItem = additionReminderIds.includes(item.id) && hasAdditions;
                const isNextUp = !isChecklistItemDone(item) && item.id === firstActionableId;

                // Option 2: Render Additions as a clean section card with cards and counter badge, without a parent checkbox
                if (isAdditionLinkItem) {
                  const confirmedCount = currentStage.additions.filter(a => a.confirmed).length;
                  const totalCount = currentStage.additions.length;
                  const allDone = confirmedCount === totalCount && totalCount > 0;

                  return (
                    <div
                      key={item.id}
                      className={`w-full text-left p-2.5 sm:p-3 rounded-xl border transition-all flex flex-col justify-between shadow-sm space-y-2.5 ${
                        isNextUp && !allDone
                          ? 'bg-slate-900/95 border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/30'
                          : 'border-slate-800/90 bg-slate-950/70'
                      }`}
                    >
                      {/* Section Header: Clean title + counter badge + NEXT UP badge + info button */}
                      <div className="flex items-center justify-between w-full pb-1 border-b border-slate-800/60">
                        <div className="flex items-center flex-wrap gap-2 min-w-0">
                          <span className="text-sm sm:text-base font-semibold text-gray-200">
                            {item.label}
                          </span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            allDone
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80'
                              : 'bg-slate-900 text-amber-300 border-slate-700'
                          }`}>
                            {confirmedCount}/{totalCount}
                          </span>
                          {isNextUp && !allDone && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-black uppercase tracking-wider bg-amber-950 text-amber-300 border border-amber-500/60 shrink-0">
                              NEXT UP
                            </span>
                          )}
                          {allDone && (
                            <span className="text-[10px] font-mono text-emerald-400 font-bold hidden sm:inline">
                              ✓ All Confirmed
                            </span>
                          )}
                        </div>

                        {item.explanation && (
                          <button
                            type="button"
                            onClick={() => setActiveExplanationItem(item)}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-cyan-300 bg-slate-900/60 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 touch-press transition-colors shrink-0 ml-2"
                            title="View reminder explanation"
                            aria-label={`Explanation for ${item.label}`}
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Additions List */}
                      <div className="space-y-1.5 w-full">
                        {currentStage.additions.map((addition) => {
                          const isDue =
                            !addition.confirmed &&
                            (!currentStage.isTimed ||
                              ((timerStatus !== 'idle' || currentStage.flowPhase === 'finished') &&
                                activeRemainingSec <= addition.triggerRemainingSec));
                          const waitSec =
                            currentStage.isTimed && !addition.confirmed && activeRemainingSec > addition.triggerRemainingSec
                              ? activeRemainingSec - addition.triggerRemainingSec
                              : 0;
                          const badge = getAdditionBadge(addition);
                          const typeInfo = getAdditionTypeInfo(addition);
                          const IconComponent = typeInfo.icon;

                          return (
                            <div
                              key={addition.id}
                              className={`p-2 rounded-lg border transition-all flex items-center justify-between gap-2 ${typeInfo.borderAccent} ${
                                addition.confirmed
                                  ? 'bg-slate-950/40 border-slate-900 opacity-65'
                                  : isDue
                                  ? typeInfo.isHop
                                    ? 'bg-emerald-950/80 border-emerald-400 ring-1 ring-emerald-400'
                                    : 'bg-amber-950/60 border-amber-500 ring-1 ring-amber-500'
                                  : 'bg-slate-950/85 border-slate-800'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center flex-wrap gap-1">
                                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-black uppercase border shrink-0 ${badge.bg}`}>
                                    {badge.label}
                                  </span>
                                  {!addition.confirmed && currentStage.isTimed && (
                                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold border shrink-0 ${
                                      isDue
                                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-black'
                                        : 'bg-slate-900 text-cyan-300 border-slate-700'
                                    }`}>
                                      {isDue
                                        ? '🔥 DUE NOW'
                                        : timerStatus !== 'idle'
                                        ? `in ${formatWaitTime(waitSec)}`
                                        : `@ ${addition.triggerTimeMin}m`}
                                    </span>
                                  )}
                                  <span className={`text-[9px] font-mono px-1 py-0.5 rounded font-black uppercase border shrink-0 flex items-center space-x-0.5 ${typeInfo.tagColor}`}>
                                    <IconComponent className="w-2.5 h-2.5 stroke-[2.5]" />
                                    <span>{typeInfo.tag}</span>
                                  </span>
                                </div>
                                <div className="flex items-baseline space-x-1.5 mt-0.5">
                                  <span className="font-bold text-xs text-white truncate">
                                    {addition.name}
                                  </span>
                                  <span className={`font-mono font-black text-xs shrink-0 ${typeInfo.amountColor}`}>
                                    {addition.amount} {addition.unit || 'g'}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => (addition.confirmed ? unconfirmAddition(addition.id) : confirmAddition(addition.id))}
                                title={addition.confirmed ? 'Added. Tap to undo' : undefined}
                                className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-black font-mono transition-all touch-press ${
                                  addition.confirmed
                                    ? 'bg-slate-900 text-emerald-400 border border-slate-800 hover:border-slate-600'
                                    : isDue
                                    ? typeInfo.isHop
                                      ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 shadow'
                                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow'
                                    : 'bg-slate-800 hover:bg-slate-700 text-gray-200 border border-slate-700'
                                }`}
                              >
                                {addition.confirmed ? (
                                  <span className="flex items-center space-x-1">
                                    <span>✓ DONE</span>
                                    <Undo2 className="w-3 h-3 text-gray-500" />
                                  </span>
                                ) : 'CONFIRM'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                const isTimedItem = item.triggerRemainingSec !== undefined;
                const isTimedDueNow =
                  !item.checked &&
                  isTimedItem &&
                  (timerStatus !== 'idle' || currentStage.flowPhase === 'finished') &&
                  activeRemainingSec <= (item.triggerRemainingSec || 0);
                const isTimedFuture =
                  !item.checked &&
                  isTimedItem &&
                  !isTimedDueNow;
                const waitSecForTimed = isTimedFuture ? Math.max(0, activeRemainingSec - (item.triggerRemainingSec || 0)) : 0;

                return (
                  <div
                    key={item.id}
                    className={`w-full text-left p-2.5 sm:p-3 rounded-xl border transition-all flex flex-col justify-between min-h-[56px] ${
                      item.checked
                        ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'
                        : isTimedDueNow
                        ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_18px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/50 animate-pulse'
                        : isNextUp
                        ? 'bg-slate-900/95 border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/30'
                        : isTimedFuture
                        ? 'bg-slate-950/90 border-cyan-900/60 text-gray-100'
                        : 'bg-slate-950/80 border-slate-800 text-gray-100 hover:border-slate-700 shadow-sm'
                    }`}
                  >
                    {/* Primary Row: Checkbox Tile + Label + Status Badge + Info Button */}
                    <div className={`flex items-center justify-between w-full ${item.checked && !hasStepper ? 'opacity-65' : ''}`}>
                      <button
                        type="button"
                        onClick={() => toggleChecklistItem(item.id)}
                        className="flex items-center space-x-3 flex-1 min-w-0 text-left touch-press py-0.5"
                      >
                        {/* Large Tactile Checkbox Tile */}
                        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all ${
                          item.checked
                            ? 'bg-emerald-950 border-emerald-400 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                            : isTimedDueNow
                            ? 'bg-cyan-950 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                            : isNextUp
                            ? 'bg-slate-900 border-amber-400/80 text-amber-400'
                            : isTimedFuture
                            ? 'bg-slate-900 border-cyan-800/80 text-transparent'
                            : 'bg-slate-900 border-slate-700 text-transparent hover:border-slate-500'
                        }`}>
                          {item.checked && <Check className="w-5 h-5 stroke-[3]" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-1.5">
                            <span className={`text-sm sm:text-base font-semibold leading-snug ${item.checked ? 'line-through text-gray-400' : 'text-gray-100'}`}>
                              {item.label}
                            </span>
                            {isTimedDueNow && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-black uppercase tracking-wider bg-cyan-400 text-slate-950 shrink-0">
                                🔔 DUE NOW
                              </span>
                            )}
                            {isNextUp && !isTimedDueNow && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-black uppercase tracking-wider bg-amber-950 text-amber-300 border border-amber-500/60 shrink-0">
                                NEXT UP
                              </span>
                            )}
                            {isTimedFuture && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-cyan-950/90 text-cyan-300 border border-cyan-700/60 shrink-0">
                                TIMED PROMPT
                              </span>
                            )}
                          </div>

                          {/* Live Timer-Linked Countdown Badge for Timed Reminders */}
                          {isTimedItem && !item.checked && (
                            <div className="mt-1 flex items-center flex-wrap gap-1.5">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border shrink-0 ${
                                isTimedDueNow
                                  ? 'bg-cyan-950 text-cyan-200 border-cyan-400'
                                  : 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                              }`}>
                                ⏱️ Alert @ {Math.round((item.triggerRemainingSec || 0) / 60)}m left
                                {isTimedFuture && timerStatus !== 'idle' && (
                                  <span className="ml-1.5 pl-1.5 border-l border-cyan-700 text-amber-300">
                                    in {formatWaitTime(waitSecForTimed)}
                                  </span>
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </button>

                      {/* Info Button in Primary Row */}
                      {item.explanation && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveExplanationItem(item);
                          }}
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-cyan-300 bg-slate-900/60 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 touch-press transition-colors shrink-0 ml-2"
                          title="View reminder explanation"
                          aria-label={`Explanation for ${item.label}`}
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Full-Width Unclipped Stepper Row for Items with Measurement Steppers */}
                    {hasStepper && (
                      <div 
                        className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 w-full px-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[11px] font-mono uppercase tracking-wider text-gray-300 font-bold shrink-0">
                          {isMashPh ? 'Recorded pH:' : 'Recorded SG:'}
                        </span>

                        <div className="flex items-center space-x-1.5 shrink-0">
                          {/* Stepper - */}
                          <button
                            type="button"
                            onClick={() => {
                              if (isMashPh) updateMetric('mashPhActual', measurements.mashPhActual, -0.05, 5.25);
                              else if (isPreBoilSg) updateMetric('preBoilGravityActual', measurements.preBoilGravityActual, -0.001, recipe?.preBoilGravity || 1.039);
                              else if (isPostBoilSg) updateMetric('postBoilGravityActual', measurements.postBoilGravityActual, -0.001, recipe?.og || 1.045);
                            }}
                            className={`h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-xs font-bold font-mono border border-slate-700 touch-press flex items-center justify-center ${
                              isMashPh ? 'text-cyan-400' : isPreBoilSg ? 'text-emerald-400' : 'text-purple-400'
                            }`}
                            title="Decrease"
                          >
                            {isMashPh ? '-0.05' : '-1pt'}
                          </button>

                          {/* Value Display (Centered between - and + for ergonomic thumb stepping) */}
                          <span className={`text-xs sm:text-sm font-black font-mono px-2.5 py-1 rounded-lg bg-slate-950 border min-w-[56px] text-center ${
                            isMashPh
                              ? 'text-cyan-300 border-cyan-800/60'
                              : isPreBoilSg
                              ? 'text-emerald-300 border-emerald-800/60'
                              : 'text-purple-300 border-purple-800/60'
                          }`}>
                            {isMashPh
                              ? (measurements.mashPhActual ? measurements.mashPhActual.toFixed(2) : '5.25')
                              : isPreBoilSg
                              ? (measurements.preBoilGravityActual ? measurements.preBoilGravityActual.toFixed(3) : (recipe?.preBoilGravity ? recipe.preBoilGravity.toFixed(3) : '1.039'))
                              : (measurements.postBoilGravityActual ? measurements.postBoilGravityActual.toFixed(3) : (recipe?.og ? recipe.og.toFixed(3) : '1.045'))
                            }
                          </span>

                          {/* Stepper + */}
                          <button
                            type="button"
                            onClick={() => {
                              if (isMashPh) updateMetric('mashPhActual', measurements.mashPhActual, 0.05, 5.25);
                              else if (isPreBoilSg) updateMetric('preBoilGravityActual', measurements.preBoilGravityActual, 0.001, recipe?.preBoilGravity || 1.039);
                              else if (isPostBoilSg) updateMetric('postBoilGravityActual', measurements.postBoilGravityActual, 0.001, recipe?.og || 1.045);
                            }}
                            className={`h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-xs font-bold font-mono border border-slate-700 touch-press flex items-center justify-center ${
                              isMashPh ? 'text-cyan-400' : isPreBoilSg ? 'text-emerald-400' : 'text-purple-400'
                            }`}
                            title="Increase"
                          >
                            {isMashPh ? '+0.05' : '+1pt'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* 2. ADDITIONS TAB (SECOND) */}
        {activeTab === 'additions' && (
          <div className="space-y-1.5">
            {currentStage.additions.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-xs font-mono">
                No ingredient additions in this stage.
              </div>
            ) : (
              currentStage.additions.map((addition) => {
                const isDue =
                  !addition.confirmed &&
                  (!currentStage.isTimed ||
                    ((timerStatus !== 'idle' || currentStage.flowPhase === 'finished') &&
                      activeRemainingSec <= addition.triggerRemainingSec));
                const waitSec =
                  currentStage.isTimed && !addition.confirmed && activeRemainingSec > addition.triggerRemainingSec
                    ? activeRemainingSec - addition.triggerRemainingSec
                    : 0;
                const badge = getAdditionBadge(addition);
                const typeInfo = getAdditionTypeInfo(addition);
                const IconComponent = typeInfo.icon;

                return (
                  <div
                    key={addition.id}
                    className={`p-2 sm:p-2.5 rounded-lg border transition-all flex items-center justify-between ${typeInfo.borderAccent} ${
                      addition.confirmed
                        ? 'bg-slate-950/40 border-slate-900 opacity-60'
                        : isDue
                        ? typeInfo.isHop
                          ? 'bg-emerald-950/80 border-emerald-400 ring-2 ring-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.35)] animate-pulse'
                          : 'bg-amber-950/50 border-amber-500 ring-1 ring-amber-500 shadow-md animate-pulse'
                        : typeInfo.isHop
                        ? 'bg-gradient-to-r from-emerald-950/40 via-slate-950/80 to-slate-950/80 border-emerald-900/60 shadow-sm'
                        : 'bg-slate-950/70 border-slate-800'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        {/* Timing Badge */}
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-black uppercase border shrink-0 ${badge.bg}`}>
                          {badge.label}
                        </span>

                        {/* Live Timer Countdown or Due Now Pill */}
                        {!addition.confirmed && currentStage.isTimed && (
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold border shrink-0 ${
                            isDue
                              ? 'bg-amber-400 text-slate-950 border-amber-300 font-black'
                              : 'bg-slate-900 text-cyan-300 border-slate-700'
                          }`}>
                            {isDue
                              ? '🔥 DUE NOW'
                              : timerStatus !== 'idle'
                              ? `⏱️ in ${formatWaitTime(waitSec)}`
                              : `⏱️ @ ${addition.triggerTimeMin}m`}
                          </span>
                        )}

                        {/* Distinct Categorization Badge (🌿 HOP vs 🧪 FINING vs 💊 NUTRIENT etc.) */}
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-black uppercase tracking-wider border shrink-0 flex items-center space-x-1 ${typeInfo.tagColor}`}>
                          <IconComponent className="w-2.5 h-2.5 stroke-[2.5]" />
                          <span>{typeInfo.tag}</span>
                        </span>

                        {/* Addition Name */}
                        <span className={`font-bold text-xs truncate ${typeInfo.isHop ? 'text-white' : 'text-gray-200'}`}>
                          {addition.name}
                        </span>
                      </div>

                      {/* Amount & Notes */}
                      <div className="flex items-baseline space-x-2 mt-1">
                        <span className={`font-mono font-black text-sm tracking-tight ${typeInfo.amountColor}`}>
                          {addition.amount} {addition.unit || 'g'}
                        </span>
                        {addition.notes && (
                          <span className={`text-[11px] font-medium truncate ${typeInfo.isHop ? 'text-emerald-300/80' : 'text-gray-400'}`}>
                            {addition.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Tactile Confirm Button */}
                    <button
                      onClick={() => (addition.confirmed ? unconfirmAddition(addition.id) : confirmAddition(addition.id))}
                      title={addition.confirmed ? 'Added. Tap to undo' : undefined}
                      className={`shrink-0 px-3 py-2 rounded-lg text-xs font-black font-mono transition-all touch-press ${
                        addition.confirmed
                          ? 'bg-slate-900 text-gray-500 border border-slate-800 hover:border-slate-600'
                          : isDue
                          ? typeInfo.isHop
                            ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 shadow-md ring-1 ring-white'
                            : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md'
                          : typeInfo.isHop
                          ? 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/80'
                          : 'bg-slate-800 hover:bg-slate-700 text-gray-200 border border-slate-700'
                      }`}
                    >
                      {addition.confirmed ? (
                        <div className="flex items-center space-x-1">
                          <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-400" />
                          <span className="text-emerald-400">DONE</span>
                          <Undo2 className="w-3 h-3 text-gray-500" />
                        </div>
                      ) : (
                        <span>CONFIRM</span>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 3. SESSION LOG TAB (THIRD) */}
        {activeTab === 'log' && (
          <div className="space-y-2">
            {/* Summary Bar of Recorded Telemetry */}
            <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800 shrink-0">
              <span className="text-[10px] font-mono text-gray-400 font-bold uppercase block mb-1">
                Recorded Telemetry Summary
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                <div className="flex justify-between bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
                  <span className="text-gray-400">Strike Temp</span>
                  <span className="text-amber-400 font-bold">
                    {measurements.strikeTempActual !== undefined
                      ? `${measurements.strikeTempActual.toFixed(1)}°C`
                      : `${(currentStage.parameters.targetTemp ?? 71.5).toFixed(1)}°C (target)`}
                  </span>
                </div>
                <div className="flex justify-between bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
                  <span className="text-gray-400">Mash pH</span>
                  <span className="text-cyan-400 font-bold">
                    {measurements.mashPhActual !== undefined ? `${measurements.mashPhActual.toFixed(2)}` : '5.25 (target)'}
                  </span>
                </div>
                <div className="flex justify-between bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
                  <span className="text-gray-400">Pre-Boil SG</span>
                  <span className="text-emerald-400 font-bold">
                    {measurements.preBoilGravityActual !== undefined
                      ? `${measurements.preBoilGravityActual.toFixed(3)}`
                      : `${recipe?.preBoilGravity ? recipe.preBoilGravity.toFixed(3) : '1.039'}`}
                  </span>
                </div>
                <div className="flex justify-between bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
                  <span className="text-gray-400">Knockout SG</span>
                  <span className="text-purple-400 font-bold">
                    {measurements.postBoilGravityActual !== undefined
                      ? `${measurements.postBoilGravityActual.toFixed(3)}`
                      : `${recipe?.og ? recipe.og.toFixed(3) : '1.045'}`}
                  </span>
                </div>
                <div className="flex justify-between bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
                  <span className="text-gray-400">Lauter Time</span>
                  <span className={lauterStage?.actualDurationSec !== undefined && lauterStage.actualDurationSec > 0 ? "text-emerald-400 font-bold" : "text-gray-500 font-bold"}>
                    {lauterStage?.actualDurationSec !== undefined && lauterStage.actualDurationSec > 0
                      ? `⏱️ ${Math.floor(lauterStage.actualDurationSec / 60)}m ${(lauterStage.actualDurationSec % 60).toString().padStart(2, '0')}s`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
                  <span className="text-gray-400">Chill Time (60°C)</span>
                  <span className={coolingStage?.actualDurationSec !== undefined && coolingStage.actualDurationSec > 0 ? "text-emerald-400 font-bold" : "text-gray-500 font-bold"}>
                    {coolingStage?.actualDurationSec !== undefined && coolingStage.actualDurationSec > 0
                      ? `⏱️ ${Math.floor(coolingStage.actualDurationSec / 60)}m ${(coolingStage.actualDurationSec % 60).toString().padStart(2, '0')}s`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between bg-slate-900/90 px-2 py-1 rounded border border-slate-800">
                  <span className="text-gray-400">Knockout Time</span>
                  <span className={knockoutStage?.actualDurationSec !== undefined && knockoutStage.actualDurationSec > 0 ? "text-emerald-400 font-bold" : "text-gray-500 font-bold"}>
                    {knockoutStage?.actualDurationSec !== undefined && knockoutStage.actualDurationSec > 0
                      ? `⏱️ ${Math.floor(knockoutStage.actualDurationSec / 60)}m ${(knockoutStage.actualDurationSec % 60).toString().padStart(2, '0')}s`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Activity Timeline */}
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-gray-400 font-bold uppercase block px-1">
                Live Session Timeline ({auditLogs.length} events)
              </span>
              {auditLogs.length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-xs font-mono">
                  No activity recorded yet.
                </div>
              ) : (
                auditLogs.slice().reverse().map((log, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs font-mono flex items-start space-x-2"
                  >
                    <span className="text-[10px] text-gray-500 shrink-0 mt-0.5">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className={`text-[10px] font-bold px-1 rounded mr-1.5 ${
                        log.type === 'ADDITION_CONFIRMED'
                          ? 'bg-emerald-950 text-emerald-400'
                          : log.type === 'MEASUREMENT_RECORDED'
                          ? 'bg-cyan-950 text-cyan-400'
                          : log.type === 'STAGE_START' || log.type === 'STAGE_END'
                          ? 'bg-amber-950 text-amber-400'
                          : 'bg-slate-800 text-gray-300'
                      }`}>
                        {log.type.replace('_', ' ')}
                      </span>
                      <span className="text-gray-300 text-[11px] leading-snug">
                        {log.message}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reminder Explanation Pop-up Dialog */}
      {activeExplanationItem && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 select-none"
          onClick={() => setActiveExplanationItem(null)}
        >
          <div 
            className="w-full max-w-sm sm:max-w-md bg-slate-900/95 border border-cyan-500/50 shadow-[0_0_25px_rgba(6,182,212,0.25)] rounded-2xl p-4 sm:p-5 flex flex-col space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shrink-0">
                  <Info className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold block">
                    Stage Reminder
                  </span>
                  <h4 className="text-base sm:text-lg font-bold text-white leading-tight font-mono">
                    {activeExplanationItem.label}
                  </h4>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveExplanationItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-sm sm:text-base text-gray-200 leading-relaxed font-sans">
              {activeExplanationItem.explanation}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setActiveExplanationItem(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 active:bg-cyan-800 text-cyan-300 border border-cyan-500/60 font-mono font-bold text-xs uppercase tracking-wider touch-press transition-all"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
