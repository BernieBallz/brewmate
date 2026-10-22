import React, { useState } from 'react';
import { useBrewStore, hasIncompleteStageItems } from '../store/brewStore';
import {
  FileText,
  FolderOpen,
  RotateCcw,
  Trash2,
  Volume2,
  VolumeX,
  X,
  ListOrdered,
  Sun,
  ChevronDown,
  Download,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { appLifecycle, type UpdateCheckResult } from '../utils/appLifecycle';
import { useAppUpdateReady, useCanInstallApp } from '../hooks/useAppLifecycle';

const formatBuildTime = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

interface MenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRecipeModal: () => void;
  onOpenReportModal: () => void;
  onOpenResetConfirm: () => void;
  onOpenRemoveConfirm: () => void;
  onConfirmJump: (stageIndex: number) => void;
}

export const MenuDrawer: React.FC<MenuDrawerProps> = ({
  isOpen,
  onClose,
  onOpenRecipeModal,
  onOpenReportModal,
  onOpenResetConfirm,
  onOpenRemoveConfirm,
  onConfirmJump
}) => {
  const { 
    stages, 
    currentStageIndex, 
    goToStage, 
    audioEnabled, 
    toggleAudio,
    wakeLockActive,
    toggleWakeLock,
    recipe,
    timerStatus
  } = useBrewStore();

  const canInstall = useCanInstallApp();
  const updateReady = useAppUpdateReady();
  const [updateCheck, setUpdateCheck] = useState<'idle' | 'checking' | UpdateCheckResult>('idle');
  // The drawer stays mounted while hidden, so this remembers open/closed for the rest of the visit
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-xs h-full max-h-[100dvh] bg-slate-950/95 backdrop-blur-xl border-l border-slate-800 p-3 sm:p-4 flex flex-col shadow-2xl overflow-y-auto overscroll-contain">
        {/* 1. Drawer Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 shrink-0">
          <div>
            <span className="font-mono font-bold text-sm text-gray-100 uppercase tracking-wider block">Session Controls</span>
            <span className="text-[10px] text-gray-400 font-mono">{recipe?.name} • {recipe?.batchSize}L</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Stage Jump Links (Placed first in the menu body) */}
        <div className="mt-3">
          <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block mb-1.5 flex items-center">
            <ListOrdered className="w-3.5 h-3.5 mr-1" /> Jump to Stage
          </span>
          <div className="space-y-1 pr-1">
            {stages.map((stage, idx) => (
              <button
                key={stage.id}
                onClick={() => {
                  // Jumping forward past unconfirmed additions or unticked reminders goes through the Complete Stage warning
                  if (idx > currentStageIndex && hasIncompleteStageItems(stages[currentStageIndex])) {
                    onConfirmJump(idx);
                  } else {
                    goToStage(idx);
                  }
                  onClose();
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center justify-between transition-colors ${
                  idx === currentStageIndex
                    ? 'bg-amber-950/50 text-amber-300 font-bold border border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                    : 'text-gray-300 hover:bg-slate-900 border border-transparent'
                }`}
              >
                <span className="truncate">{idx + 1}. {stage.shortCode}</span>
                {/* Stage length (timed) or Reminders (untimed): a glanceable outline of the brew.
                    Stopwatch stages run as long as they take, so their length is an estimate. */}
                <span className={`shrink-0 ml-2 text-[11px] font-mono font-semibold tabular-nums ${
                  stage.isTimed ? 'text-cyan-300' : 'text-gray-400'
                }`}>
                  {stage.isTimed
                    ? `${stage.timerType === 'stopwatch' ? 'est ' : ''}${Math.round(stage.plannedDurationSec / 60)}m`
                    : 'Reminders'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. New Options Underneath Stage Links at Bottom */}
        <div className="mt-4 pt-3 border-t border-slate-800 space-y-2 shrink-0">
          <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block mb-1">
            Session Tools
          </span>

          <button
            onClick={() => {
              onOpenReportModal();
              onClose();
            }}
            className="w-full flex items-center space-x-2.5 p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-gray-200 text-xs font-mono font-bold tracking-wider uppercase border border-slate-800 hover:border-slate-700 transition-all"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Session Report & Audit</span>
          </button>

          <button
            onClick={() => {
              onOpenRecipeModal();
              onClose();
            }}
            className="w-full flex items-center space-x-2.5 p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-gray-200 text-xs font-mono font-bold tracking-wider uppercase border border-slate-800 hover:border-slate-700 transition-all"
          >
            <FolderOpen className="w-4 h-4 text-cyan-400" />
            <span>Load Recipe</span>
          </button>

          {/* Reset Session Button */}
          <button
            onClick={() => {
              onOpenResetConfirm();
              onClose();
            }}
            className="w-full flex items-center justify-center space-x-2 p-2.5 mt-2 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 active:bg-rose-800/80 text-rose-300 hover:text-white font-mono font-bold text-xs tracking-widest uppercase border border-rose-500/60 transition-all touch-press shadow-[0_0_15px_rgba(244,63,94,0.2)]"
          >
            <RotateCcw className="w-4 h-4 stroke-[2.5]" />
            <span>Reset Session</span>
          </button>

          {/* Remove Recipe: clears the recipe and session from this device (back to the welcome screen) */}
          <button
            onClick={() => {
              onOpenRemoveConfirm();
              onClose();
            }}
            className="w-full flex items-center justify-center space-x-2 p-2 rounded-lg bg-transparent hover:bg-rose-950/40 text-rose-300/80 hover:text-rose-200 font-mono font-bold text-xs tracking-widest uppercase border border-rose-500/30 hover:border-rose-500/60 transition-all touch-press"
          >
            <Trash2 className="w-4 h-4" />
            <span>Remove Recipe</span>
          </button>
        </div>

        {/* 4. Advanced (collapsed by default): device settings, install, updates and version */}
        <div className="mt-4 pt-3 border-t border-slate-800 space-y-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsAdvancedOpen(open => !open)}
            aria-expanded={isAdvancedOpen}
            className="w-full flex items-center justify-between py-1 text-[10px] font-mono text-gray-400 hover:text-gray-200 uppercase tracking-wider transition-colors"
          >
            <span className="flex items-center space-x-1.5">
              <span>Advanced</span>
              {/* Points to "Reload to Update" inside while the section is closed */}
              {updateReady && !isAdvancedOpen && (
                <span className="w-2 h-2 rounded-full bg-cyan-400" title="Update ready" />
              )}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`} />
          </button>

          {isAdvancedOpen && (
            <>
              <button
                onClick={toggleAudio}
                className="w-full flex items-center space-x-2.5 p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-gray-200 text-xs font-mono font-bold tracking-wider uppercase border border-slate-800 hover:border-slate-700 transition-all"
              >
                {audioEnabled ? (
                  <>
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                    <span>Audio Alarms (On)</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-4 h-4 text-rose-400" />
                    <span>Audio Alarms (Muted)</span>
                  </>
                )}
              </button>

              <button
                onClick={toggleWakeLock}
                className="w-full flex items-center space-x-2.5 p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-gray-200 text-xs font-mono font-bold tracking-wider uppercase border border-slate-800 hover:border-slate-700 transition-all"
              >
                <Sun className={`w-4 h-4 ${wakeLockActive ? 'text-amber-400' : 'text-slate-500'}`} />
                <span>Screen Wake Lock ({wakeLockActive ? 'Active' : 'Off'})</span>
              </button>

              {canInstall && (
                <button
                  onClick={() => void appLifecycle.promptInstall()}
                  className="w-full flex items-center space-x-2.5 p-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-200 text-xs font-mono font-bold tracking-wider uppercase border border-emerald-500/50 transition-all touch-press"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Install BrewMate App</span>
                </button>
              )}

              {updateReady ? (
                <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-500/50 space-y-2">
                  <span className="flex items-center space-x-1.5 text-[11px] font-mono font-bold text-cyan-300">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>A new version has downloaded</span>
                  </span>
                  <button
                    onClick={() => appLifecycle.applyUpdate()}
                    disabled={timerStatus === 'running'}
                    className="w-full py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-mono font-black tracking-wider uppercase transition-all touch-press"
                  >
                    Reload to Update
                  </button>
                  {timerStatus === 'running' && (
                    <span className="block text-[10px] font-mono text-gray-400">
                      Pause the timer first. The update applies anyway next time the app opens.
                    </span>
                  )}
                </div>
              ) : (
                <button
                  onClick={async () => {
                    setUpdateCheck('checking');
                    setUpdateCheck(await appLifecycle.checkForUpdate());
                  }}
                  disabled={updateCheck === 'checking'}
                  className="w-full flex items-center space-x-2.5 p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-gray-200 text-xs font-mono font-bold tracking-wider uppercase border border-slate-800 hover:border-slate-700 transition-all touch-press"
                >
                  <RefreshCw className={`w-4 h-4 text-cyan-400 ${updateCheck === 'checking' ? 'animate-spin' : ''}`} />
                  <span>Check for Updates</span>
                </button>
              )}

              {!updateReady && updateCheck !== 'idle' && updateCheck !== 'checking' && (
                <span className="block text-[11px] font-mono text-gray-400 px-1">
                  {updateCheck === 'latest'
                    ? "You're on the latest version."
                    : updateCheck === 'downloading'
                      ? 'Downloading the new version…'
                      : "Couldn't check right now. Updates still install when you reopen the app."}
                </span>
              )}

              <span className="block text-[10px] font-mono text-gray-500 px-1">
                Version {__APP_BUILD__.commit} · built {formatBuildTime(__APP_BUILD__.builtAt)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
