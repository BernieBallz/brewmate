import React, { useState } from 'react';
import { useBrewStore, hasIncompleteStageItems } from '../store/brewStore';
import {
  FileText,
  FolderOpen,
  RotateCcw,
  Trash2,
  Volume2,
  X,
  ListOrdered,
  Sun,
  ChevronDown,
  Download,
  RefreshCw,
  Sparkles,
  ScrollText,
  Bell,
  Settings,
  type LucideIcon
} from 'lucide-react';
import type { FlowMode } from '../types/session';
import { wholeLitres } from '../utils/brewfatherParser';
import { appLifecycle, type UpdateCheckResult } from '../utils/appLifecycle';
import { useAppUpdateReady, useCanInstallApp } from '../hooks/useAppLifecycle';

const FLOW_OPTIONS: { mode: FlowMode; label: string; hint: string }[] = [
  { mode: 'full', label: 'Full step', hint: 'Tick each reminder and addition as you go' },
  { mode: 'byStage', label: 'By stage', hint: 'Confirm each stage in one go, full-screen timer' }
];

const formatBuildTime = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const ROW_CLASS = 'w-full min-h-[48px] px-3 py-2 flex items-center gap-3 text-left text-sm font-semibold transition-colors hover:bg-slate-800/70 active:bg-slate-800 touch-press';

interface MenuRowProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

const MenuRow: React.FC<MenuRowProps> = ({ icon: Icon, label, onClick, danger = false }) => (
  <button type="button" onClick={onClick} className={`${ROW_CLASS} ${danger ? 'text-rose-300' : 'text-gray-100'}`}>
    <Icon className={`w-5 h-5 shrink-0 ${danger ? 'text-rose-400' : 'text-slate-400'}`} />
    <span className="min-w-0 flex-1">{label}</span>
  </button>
);

interface MenuSwitchProps {
  icon: LucideIcon;
  label: string;
  isOn: boolean;
  onToggle: () => void;
}

const MenuSwitch: React.FC<MenuSwitchProps> = ({ icon: Icon, label, isOn, onToggle }) => (
  <button type="button" role="switch" aria-checked={isOn} onClick={onToggle} className={`${ROW_CLASS} text-gray-100`}>
    <Icon className="w-5 h-5 shrink-0 text-slate-400" />
    <span className="min-w-0 flex-1">{label}</span>
    <span className={`shrink-0 w-10 h-6 p-0.5 rounded-full transition-colors ${isOn ? 'bg-amber-500' : 'bg-slate-700'}`}>
      <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${isOn ? 'translate-x-4' : ''}`} />
    </span>
  </button>
);

const MenuGroup: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-xl bg-slate-900/80 border border-slate-800 divide-y divide-slate-800 overflow-hidden">
    {children}
  </div>
);

interface MenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRecipeModal: () => void;
  onOpenReportModal: () => void;
  onOpenResetConfirm: () => void;
  onOpenRemoveConfirm: () => void;
  onConfirmJump: (stageIndex: number) => void;
  onOpenSessionLog: () => void;
  onOpenAlertSetup: () => void;
}

export const MenuDrawer: React.FC<MenuDrawerProps> = ({
  isOpen,
  onClose,
  onOpenRecipeModal,
  onOpenReportModal,
  onOpenResetConfirm,
  onOpenRemoveConfirm,
  onConfirmJump,
  onOpenSessionLog,
  onOpenAlertSetup
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
    timerStatus,
    flowMode,
    setFlowMode
  } = useBrewStore();

  const canInstall = useCanInstallApp();
  const updateReady = useAppUpdateReady();
  const [updateCheck, setUpdateCheck] = useState<'idle' | 'checking' | UpdateCheckResult>('idle');
  // One section open at a time. The drawer stays mounted while hidden, so closing it folds them away again
  const [openSection, setOpenSection] = useState<'stages' | 'settings' | null>(null);

  if (!isOpen) return null;

  const toggleSection = (section: 'stages' | 'settings') => {
    setOpenSection(current => (current === section ? null : section));
  };

  const closeDrawer = () => {
    setOpenSection(null);
    onClose();
  };

  // Rows that open another screen close the drawer behind them
  const openAndClose = (open: () => void) => () => {
    open();
    closeDrawer();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/85 backdrop-blur-md animate-in fade-in duration-150"
      onClick={event => {
        if (event.target === event.currentTarget) closeDrawer();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="w-full max-w-xs h-full max-h-[100dvh] bg-slate-950/95 backdrop-blur-xl border-l border-slate-800 flex flex-col shadow-2xl pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
      >
        {/* Header: what is being brewed, and the way out */}
        <div className="shrink-0 flex items-start justify-between gap-2 pl-4 pr-2 py-2 border-b border-slate-800">
          <div className="min-w-0 py-1">
            <span className="block text-base font-bold text-gray-100 leading-snug break-words">{recipe?.name}</span>
            <span className="block text-xs text-gray-400 font-mono">{wholeLitres(recipe?.batchSize ?? 0)}L</span>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close menu"
            className="shrink-0 w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-3">
          {/* The brew in progress */}
          <MenuGroup>
            <button
              type="button"
              onClick={() => toggleSection('stages')}
              aria-expanded={openSection === 'stages'}
              className={`${ROW_CLASS} text-gray-100`}
            >
              <ListOrdered className="w-5 h-5 shrink-0 text-slate-400" />
              <span className="shrink-0">Stages</span>
              <span className="min-w-0 flex-1 text-right text-xs font-mono font-semibold text-amber-300 truncate">
                {currentStageIndex + 1}/{stages.length} {stages[currentStageIndex]?.shortCode}
              </span>
              <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${openSection === 'stages' ? 'rotate-180' : ''}`} />
            </button>

            {openSection === 'stages' && (
              <div className="p-1.5 space-y-0.5 bg-slate-950/50">
                {stages.map((stage, idx) => (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => {
                      // Jumping forward past unconfirmed additions or unticked reminders goes through the Complete Stage warning
                      if (idx > currentStageIndex && hasIncompleteStageItems(stages[currentStageIndex])) {
                        onConfirmJump(idx);
                      } else {
                        goToStage(idx);
                      }
                      closeDrawer();
                    }}
                    aria-current={idx === currentStageIndex ? 'step' : undefined}
                    className={`w-full min-h-[44px] text-left px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center justify-between transition-colors ${
                      idx === currentStageIndex
                        ? 'bg-amber-950/50 text-amber-300 font-bold border border-amber-500/50'
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
            )}

            <MenuRow icon={ScrollText} label="Session log" onClick={openAndClose(onOpenSessionLog)} />
            <MenuRow icon={FileText} label="Session report" onClick={openAndClose(onOpenReportModal)} />
          </MenuGroup>

          {/* Set-up */}
          <MenuGroup>
            <MenuRow icon={FolderOpen} label="Load recipe" onClick={openAndClose(onOpenRecipeModal)} />

            <button
              type="button"
              onClick={() => toggleSection('settings')}
              aria-expanded={openSection === 'settings'}
              className={`${ROW_CLASS} text-gray-100`}
            >
              <Settings className="w-5 h-5 shrink-0 text-slate-400" />
              <span className="flex-1 flex items-center gap-2">
                <span>Settings</span>
                {/* Points to "Reload to Update" inside while the section is closed */}
                {updateReady && openSection !== 'settings' && (
                  <span className="w-2 h-2 rounded-full bg-cyan-400" title="Update ready" />
                )}
              </span>
              <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${openSection === 'settings' ? 'rotate-180' : ''}`} />
            </button>

            {openSection === 'settings' && (
              <div className="bg-slate-950/50 divide-y divide-slate-800">
                {/* Brew flow: remembered on this device between sessions */}
                <div className="p-3 space-y-1.5">
                  <span className="block text-sm font-semibold text-gray-100">Brew flow</span>
                  <div role="radiogroup" aria-label="Brew flow" className="grid grid-cols-2 gap-1">
                    {FLOW_OPTIONS.map(option => (
                      <button
                        key={option.mode}
                        type="button"
                        role="radio"
                        aria-checked={flowMode === option.mode}
                        onClick={() => {
                          setFlowMode(option.mode);
                          closeDrawer();
                        }}
                        className={`min-h-[44px] rounded-md text-xs font-mono font-bold border transition-colors touch-press ${
                          flowMode === option.mode
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/50'
                            : 'text-gray-400 hover:text-gray-200 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <span className="block text-xs text-gray-400 leading-snug">
                    {FLOW_OPTIONS.find(option => option.mode === flowMode)?.hint}
                  </span>
                </div>

                <MenuSwitch icon={Volume2} label="Alarm sound" isOn={audioEnabled} onToggle={toggleAudio} />
                <MenuSwitch icon={Sun} label="Keep screen on" isOn={wakeLockActive} onToggle={toggleWakeLock} />
                <MenuRow icon={Bell} label="Notifications" onClick={openAndClose(onOpenAlertSetup)} />

                {canInstall && (
                  <MenuRow icon={Download} label="Install BrewMate app" onClick={() => void appLifecycle.promptInstall()} />
                )}

                {updateReady ? (
                  <div className="p-3 space-y-2 bg-cyan-950/40">
                    <span className="flex items-center space-x-1.5 text-xs font-mono font-bold text-cyan-300">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>A new version has downloaded</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => appLifecycle.applyUpdate()}
                      disabled={timerStatus === 'running'}
                      className="w-full min-h-[44px] rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-mono font-black tracking-wider uppercase transition-colors touch-press"
                    >
                      Reload to Update
                    </button>
                    {timerStatus === 'running' && (
                      <span className="block text-[11px] font-mono text-gray-400">
                        Pause the timer first. The update applies anyway next time the app opens.
                      </span>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      setUpdateCheck('checking');
                      setUpdateCheck(await appLifecycle.checkForUpdate());
                    }}
                    disabled={updateCheck === 'checking'}
                    className={`${ROW_CLASS} text-gray-100`}
                  >
                    <RefreshCw className={`w-5 h-5 shrink-0 text-slate-400 ${updateCheck === 'checking' ? 'animate-spin' : ''}`} />
                    <span className="min-w-0 flex-1">Check for updates</span>
                  </button>
                )}

                <div className="px-3 py-2 space-y-1">
                  {!updateReady && updateCheck !== 'idle' && updateCheck !== 'checking' && (
                    <span className="block text-xs font-mono text-gray-300">
                      {updateCheck === 'latest'
                        ? "You're on the latest version."
                        : updateCheck === 'downloading'
                          ? 'Downloading the new version…'
                          : "Couldn't check right now. Updates still install when you reopen the app."}
                    </span>
                  )}
                  <span className="block text-[11px] font-mono text-gray-500">
                    Version {__APP_BUILD__.commit} · built {formatBuildTime(__APP_BUILD__.builtAt)}
                  </span>
                </div>
              </div>
            )}
          </MenuGroup>

          {/* Starting over, kept apart at the bottom. Both ask for confirmation first */}
          <MenuGroup>
            <MenuRow icon={RotateCcw} label="Reset session" danger onClick={openAndClose(onOpenResetConfirm)} />
            <MenuRow icon={Trash2} label="Remove recipe" danger onClick={openAndClose(onOpenRemoveConfirm)} />
          </MenuGroup>
        </div>
      </div>
    </div>
  );
};
