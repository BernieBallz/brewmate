import React, { useState } from 'react';
import { useBrewStore, ALERT_SNOOZE_MIN } from '../store/brewStore';
import { BellRing, Check, CheckCheck, Leaf, Package, Layers } from 'lucide-react';
import type { StageAddition } from '../types/session';

export const AdditionModal: React.FC = () => {
  const { 
    activeAlertAdditions, 
    confirmAddition, 
    confirmAdditions,
    dismissAlertModal,
    stages,
    currentStageIndex 
  } = useBrewStore();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Once an alert starts as a simultaneous batch, keep the batch view until all are cleared
  const [isMultiBatch, setIsMultiBatch] = useState(() => (activeAlertAdditions?.length ?? 0) > 1);
  const [prevAdditions, setPrevAdditions] = useState(activeAlertAdditions);

  // Sync selection and batch mode with activeAlertAdditions (adjusted during render, not in an effect)
  if (activeAlertAdditions !== prevAdditions) {
    setPrevAdditions(activeAlertAdditions);
    const activeIds = activeAlertAdditions?.map(a => a.id) ?? [];
    // Keep selected IDs pruned to only active alerts
    setSelectedIds(prev => prev.filter(id => activeIds.includes(id)));
    setIsMultiBatch(activeIds.length > 1 || (activeIds.length > 0 && isMultiBatch));
  }

  if (!activeAlertAdditions || activeAlertAdditions.length === 0) return null;

  const currentStage = stages[currentStageIndex];
  const stageId = currentStage?.id;

  const checkIsHop = (addition: StageAddition) => 
    addition.type === 'hop' || addition.name.toLowerCase().includes('hop');

  const getAlertTitle = (addition: StageAddition) => {
    const isHop = checkIsHop(addition);
    if (stageId === 'BOIL') {
      if (addition.triggerTimeMin === 0) {
        return isHop ? 'FLAMEOUT HOP ADDITION' : 'FLAMEOUT ADDITION';
      }
      return isHop 
        ? `T-${addition.triggerTimeMin}M HOP ADDITION` 
        : `T-${addition.triggerTimeMin}M BOIL ADDITION`;
    }
    if (stageId === 'HOPSTAND_WHIRLPOOL') return isHop ? 'WHIRLPOOL HOP ADDITION' : 'WHIRLPOOL ADDITION';
    if (stageId === 'YEAST_PITCH') return 'PITCH ADDITION';
    if (stageId === 'WATER_PREP') return 'STRIKE LIQUOR ADDITION';
    if (stageId === 'LAUTER_SPARGE') return 'SPARGE LIQUOR ADDITION';
    if (stageId === 'MASH_IN' || stageId === 'MASH_SCHEDULE') return 'DOUGH-IN ADDITION';
    return isHop ? 'HOP ADDITION' : 'STAGE ADDITION';
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === activeAlertAdditions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(activeAlertAdditions.map(a => a.id));
    }
  };

  // Case 1: Standalone single addition alert (never was part of a simultaneous batch)
  if (activeAlertAdditions.length === 1 && !isMultiBatch) {
    const addition = activeAlertAdditions[0];
    const isHop = checkIsHop(addition);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
        <div className={`w-full max-w-xl max-h-[96dvh] bg-slate-950/95 backdrop-blur-xl border rounded-2xl p-3.5 sm:p-5 overflow-y-auto flex flex-col sm:flex-row items-center sm:items-stretch gap-3.5 sm:gap-4.5 text-center sm:text-left ${
          isHop 
            ? 'border-emerald-500/50 shadow-[0_0_35px_rgba(16,185,129,0.2)]' 
            : 'border-amber-500/50 shadow-[0_0_35px_rgba(245,158,11,0.2)]'
        }`}>
          {/* Left Side: Addition Information */}
          <div className="flex-1 flex flex-col justify-center min-w-0 py-0.5">
            <div className={`flex items-center justify-center sm:justify-start space-x-1.5 mb-1.5 ${
              isHop ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {isHop ? (
                <Leaf className="w-4 h-4 text-emerald-400 shrink-0 animate-bounce" />
              ) : (
                <BellRing className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
              )}
              <span className="font-mono font-black text-xs uppercase tracking-widest">
                {getAlertTitle(addition)}
              </span>
            </div>

            <h3 className="text-lg sm:text-xl font-black text-white leading-tight truncate">
              {addition.name}
            </h3>

            <div className={`mt-2 inline-flex items-baseline space-x-1.5 px-3 py-1.5 rounded-lg font-mono self-center sm:self-start backdrop-blur-sm ${
              isHop 
                ? 'bg-emerald-950/50 border border-emerald-500/40 text-emerald-300' 
                : 'bg-amber-950/50 border border-amber-500/40 text-amber-300'
            }`}>
              <span className={`text-2xl sm:text-3xl font-black ${
                isHop ? 'hud-glow-green text-emerald-300' : 'hud-glow text-amber-300'
              }`}>
                {addition.amount}
              </span>
              <span className="text-xs font-bold font-mono tracking-wider">
                {addition.unit || 'g'}
              </span>
            </div>

            {addition.notes && (
              <p className={`text-[11px] mt-1.5 italic truncate sm:whitespace-normal ${
                isHop ? 'text-emerald-300/80' : 'text-gray-400'
              }`}>
                "{addition.notes}"
              </p>
            )}
          </div>

          {/* Right Side: Touch Actions (HUD Glass Cockpit Buttons) */}
          <div className="w-full sm:w-52 flex flex-col justify-center space-y-2 shrink-0">
            <button
              onClick={() => confirmAddition(addition.id)}
              className={`w-full py-3 sm:py-3.5 px-4 rounded-xl font-mono font-black text-xs sm:text-sm tracking-widest uppercase border backdrop-blur-sm flex items-center justify-center space-x-2 touch-press active:scale-95 transition-all ${
                isHop 
                  ? 'bg-emerald-950/60 hover:bg-emerald-900/70 active:bg-emerald-800/80 text-emerald-300 hover:text-emerald-100 border-emerald-500/70 hover:border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]' 
                  : 'bg-amber-950/60 hover:bg-amber-900/70 active:bg-amber-800/80 text-amber-300 hover:text-amber-100 border-amber-500/70 hover:border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
              }`}
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isHop ? 'CONFIRM HOP' : 'CONFIRM ADDITION'}</span>
            </button>

            <button
              onClick={dismissAlertModal}
              className="w-full py-2 px-3 rounded-lg bg-slate-900/80 hover:bg-slate-800 active:bg-slate-950 text-slate-400 hover:text-amber-300 border border-slate-800 hover:border-amber-500/40 font-mono font-bold text-xs tracking-wider uppercase transition-all touch-press"
            >
              Snooze {ALERT_SNOOZE_MIN} min
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Several additions due together. Tick each one as it goes in, then confirm the ticked ones.
  const formatTiming = (addition: StageAddition): string | null => {
    if (!currentStage?.isTimed) return null;
    if (stageId === 'BOIL' && addition.triggerTimeMin === 0) return 'Flameout';
    return `T-${addition.triggerTimeMin}m`;
  };
  // Additions that come due together usually share a time; show it once in the header if so
  const sharedTiming = new Set(activeAlertAdditions.map(a => a.triggerTimeMin)).size === 1
    ? formatTiming(activeAlertAdditions[0])
    : null;

  const hasHops = activeAlertAdditions.some(checkIsHop);
  const allSelected = selectedIds.length === activeAlertAdditions.length;
  const someSelected = selectedIds.length > 0;

  const handleConfirmSelected = () => {
    if (!someSelected) return;
    confirmAdditions(selectedIds);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className={`w-full max-w-lg max-h-[92dvh] bg-slate-950/95 backdrop-blur-xl border rounded-2xl p-4 sm:p-5 flex flex-col gap-3 ${
        hasHops
          ? 'border-emerald-500/50 shadow-[0_0_35px_rgba(16,185,129,0.2)]'
          : 'border-amber-500/50 shadow-[0_0_35px_rgba(245,158,11,0.2)]'
      }`}>
        {/* Header: short title, stage and shared timing, select-all shortcut */}
        <div className="flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center space-x-2 text-amber-400">
              <Layers className="w-4 h-4 shrink-0" />
              <h2 className="font-mono font-black text-sm uppercase tracking-widest">
                {activeAlertAdditions.length} Additions Due
              </h2>
            </div>
            <p className="text-[11px] font-mono text-gray-400 mt-0.5 truncate">
              {currentStage?.title || 'Active Stage'}{sharedTiming ? ` · ${sharedTiming}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleSelectAll}
            className="shrink-0 px-2 py-1 -mr-1 rounded-md text-[11px] font-mono font-bold text-cyan-300 hover:text-cyan-200 hover:bg-slate-900 transition-colors touch-press"
          >
            {allSelected ? 'Clear' : 'Select all'}
          </button>
        </div>

        <p className="text-xs text-gray-400 -mt-1 shrink-0">Tick each one as you add it.</p>

        {/* Additions: whole row toggles; names wrap instead of truncating */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2 -mx-1 px-1">
          {activeAlertAdditions.map((addition) => {
            const isHop = checkIsHop(addition);
            const isSelected = selectedIds.includes(addition.id);
            const timing = sharedTiming ? null : formatTiming(addition);

            return (
              <button
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                key={addition.id}
                onClick={() => toggleSelection(addition.id)}
                className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-all touch-press ${
                  isSelected
                    ? isHop
                      ? 'bg-emerald-950/40 border-emerald-400/80'
                      : 'bg-amber-950/40 border-amber-400/80'
                    : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                }`}
              >
                <span className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border-2 transition-all ${
                  isSelected
                    ? isHop
                      ? 'bg-emerald-950 border-emerald-400 text-emerald-300'
                      : 'bg-amber-950 border-amber-400 text-amber-300'
                    : 'bg-slate-900 border-slate-600'
                }`}>
                  {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                </span>

                <span className="min-w-0 flex-1">
                  <span className={`block text-sm sm:text-base font-bold leading-snug break-words ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                    {addition.name}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`font-mono font-black text-sm ${isHop ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {addition.amount} {addition.unit || 'g'}
                    </span>
                    {isHop ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/40">
                        <Leaf className="w-3 h-3 mr-1" /> HOP
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/60 text-amber-300 border border-amber-500/40">
                        <Package className="w-3 h-3 mr-1" /> {addition.type.toUpperCase()}
                      </span>
                    )}
                    {timing && (
                      <span className="text-[11px] font-mono text-gray-400">{timing}</span>
                    )}
                  </span>
                  {addition.notes && (
                    <span className="block text-[11px] text-gray-400 italic mt-1 break-words">
                      "{addition.notes}"
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer: one confirm action, one snooze */}
        <div className="pt-1 flex flex-col sm:flex-row gap-2 shrink-0">
          <button
            type="button"
            onClick={handleConfirmSelected}
            disabled={!someSelected}
            className={`w-full sm:flex-1 py-3 px-4 rounded-xl font-mono font-black text-xs sm:text-sm tracking-widest uppercase flex items-center justify-center space-x-2 border transition-all touch-press ${
              someSelected
                ? 'bg-emerald-950/80 hover:bg-emerald-900 active:bg-emerald-800 text-emerald-200 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
                : 'bg-slate-900/60 text-slate-500 border-slate-800 cursor-not-allowed'
            }`}
          >
            <CheckCheck className="w-4 h-4 stroke-[2.5]" />
            <span>
              {allSelected
                ? `Confirm all (${selectedIds.length})`
                : someSelected
                  ? `Confirm ${selectedIds.length} of ${activeAlertAdditions.length}`
                  : 'Tick items to confirm'}
            </span>
          </button>

          <button
            type="button"
            onClick={dismissAlertModal}
            className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-800 hover:border-amber-500/40 font-mono font-bold text-xs tracking-wider uppercase transition-all touch-press"
          >
            Snooze {ALERT_SNOOZE_MIN} min
          </button>
        </div>
      </div>
    </div>
  );
};
