import React from 'react';
import { useBrewStore } from '../store/brewStore';
import { useNotificationPermission } from '../hooks/useNotificationPermission';
import { useAppUpdateReady } from '../hooks/useAppLifecycle';
import { useFullscreen } from '../hooks/useFullscreen';
import {
  Bell,
  BellOff,
  Flame,
  Maximize,
  Minimize,
  Menu
} from 'lucide-react';

interface HeaderBarProps {
  onOpenMenu: () => void;
  onOpenAlerts: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({ onOpenMenu, onOpenAlerts }) => {
  const {
    recipe,
    currentStageIndex,
    stages,
    wakeLockActive
  } = useBrewStore();

  const currentStage = stages[currentStageIndex];
  const alertPermission = useNotificationPermission();
  const updateReady = useAppUpdateReady();
  const { isFullscreen, toggleFullscreen, canFullscreen } = useFullscreen();

  return (
    <header className="h-9 bg-brew-card/95 backdrop-blur border-b border-brew-border px-3 flex items-center justify-between shrink-0 z-20 select-none">
      {/* Left: Recipe Name & Active Stage Pill */}
      <div className="flex items-center space-x-2 min-w-0 flex-1 pr-2">
        <div className="flex items-center justify-center w-5 h-5 rounded bg-amber-500/20 text-brew-amber shrink-0 border border-amber-500/30">
          <Flame className="w-3 h-3" />
        </div>
        <div className="flex items-center space-x-1.5 min-w-0 flex-1">
          <span className="font-black text-xs text-gray-100 truncate tracking-wide min-w-0">
            {recipe?.name || 'Brew Session'}
          </span>
          {/* Hidden on phones, where the timer card directly below shows the same stage */}
          <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-slate-900 border border-brew-border text-[10px] font-mono text-brew-glow font-bold shrink-0 whitespace-nowrap">
            {currentStageIndex + 1}/{stages.length} {currentStage?.shortCode}
          </span>
          {wakeLockActive && (
            <span className="hidden sm:inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-[9px] font-mono text-emerald-400 font-bold tracking-wider shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>AWAKE</span>
            </span>
          )}
        </div>
      </div>

      {/* Right: Essential Header Actions (Alerts, Fullscreen & Menu); Install lives in the menu */}
      <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
        {/* Alerts Status: quiet when on, labelled and coloured when off or blocked */}
        <button
          onClick={onOpenAlerts}
          title={alertPermission === 'granted' ? 'Brew alerts are on' : 'Brew alerts are off. Tap to set up'}
          className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-black font-mono border transition-all touch-press ${
            alertPermission === 'granted'
              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40'
              : alertPermission === 'denied'
                ? 'bg-red-950/60 text-red-300 border-red-500/50'
                : 'bg-amber-950/60 text-amber-300 border-amber-500/60 animate-pulse'
          }`}
        >
          {alertPermission === 'granted' ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
          {alertPermission !== 'granted' && <span>ALERTS</span>}
        </button>

        {/* Fullscreen Toggle (not needed in the installed app, which has no address bar); icon-only on phones */}
        {canFullscreen && (
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen (Hide address bar)'}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold font-mono transition-all touch-press ${
              isFullscreen
                ? 'bg-amber-500/20 text-brew-amber border border-amber-500/40'
                : 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-sm'
            }`}
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5 stroke-[2.5]" />}
            <span className="hidden sm:inline">{isFullscreen ? 'EXIT' : 'FULL'}</span>
          </button>
        )}

        {/* Menu Drawer (dot marks a downloaded update waiting in the menu) */}
        <button
          onClick={onOpenMenu}
          title={updateReady ? 'Open Menu (update ready)' : 'Open Menu'}
          className="relative flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-gray-200 border border-slate-700 text-[11px] font-semibold transition-all touch-press"
        >
          <Menu className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">MENU</span>
          {updateReady && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 border-2 border-slate-950" />
          )}
        </button>
      </div>
    </header>
  );
};
