import React from 'react';
import { useBrewStore } from '../store/brewStore';
import { Check, Clock } from 'lucide-react';

export const StageProgressBar: React.FC = () => {
  const { stages, currentStageIndex, goToStage } = useBrewStore();

  return (
    <div className="bg-slate-950 border-b border-brew-border overflow-x-auto scrollbar-none py-1 px-2 shrink-0">
      <div className="flex items-center space-x-1 min-w-max">
        {stages.map((stage, idx) => {
          const isCurrent = idx === currentStageIndex;
          const isCompleted = stage.status === 'completed' || (idx < currentStageIndex && stage.status !== 'skipped');

          return (
            <button
              key={stage.id}
              onClick={() => goToStage(idx)}
              className={`flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-mono transition-all select-none touch-press ${
                isCurrent
                  ? 'bg-amber-500/20 text-brew-glow border border-brew-amber font-bold ring-1 ring-amber-500/50'
                  : isCompleted
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 hover:bg-emerald-900/40'
                  : 'bg-slate-900/60 text-gray-500 border border-slate-800 hover:text-gray-300'
              }`}
            >
              <span className="w-3.5 h-3.5 flex items-center justify-center rounded-full text-[9px] font-bold">
                {isCompleted ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : isCurrent ? (
                  <Clock className="w-3 h-3 text-brew-amber animate-spin" style={{ animationDuration: '4s' }} />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </span>
              <span className="truncate max-w-[90px]">{stage.shortCode}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
