import React from 'react';
import { useStageTimerView } from '../hooks/useStageTimerView';

interface CountdownProgressBarProps {
  // 'large' thickens the bar and markers for the full-screen By stage view
  size?: 'normal' | 'large';
}

// Full-width countdown progress bar with timed reminder / addition milestone markers
export const CountdownProgressBar: React.FC<CountdownProgressBarProps> = ({ size = 'normal' }) => {
  const {
    milestoneGroups,
    countdownProgressPct,
    isCountdownDone,
    timerStatus,
    activeRemainingSec,
    nextTimedEvent
  } = useStageTimerView();

  const isLarge = size === 'large';

  return (
    <div className={`w-full h-2 bg-slate-950 rounded-full border border-slate-800/90 relative overflow-visible ${isLarge ? 'sm:h-3' : ''}`}>
      <div
        className={`h-full rounded-full transition-all duration-300 ${
          isCountdownDone
            ? 'bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]'
            : timerStatus === 'paused'
            ? 'bg-amber-500/60'
            : 'bg-gradient-to-r from-amber-600 via-amber-400 to-cyan-400'
        }`}
        style={{ width: `${countdownProgressPct}%` }}
      />
      {/* Plot Milestone Markers for Timed Reminders & Additions (Grouped by time to avoid shadow compounding) */}
      {milestoneGroups.map(group => {
        const allAdditionsConfirmed = group.additions.length === 0 || group.additions.every(a => a.confirmed);
        const allChecklistChecked = group.checklist.length === 0 || group.checklist.every(c => c.checked);
        const allCompleted = allAdditionsConfirmed && allChecklistChecked;

        const isDueNow = !allCompleted && activeRemainingSec <= group.triggerRemainingSec && timerStatus !== 'idle';
        const isNextUpcoming = !allCompleted && !isDueNow && nextTimedEvent !== undefined && nextTimedEvent.triggerRemainingSec === group.triggerRemainingSec;

        const hasAdditions = group.additions.length > 0;
        const itemLabels = [
          ...group.additions.map(a => `${a.name} (${a.amount}${a.unit || 'g'})`),
          ...group.checklist.map(c => c.label)
        ];
        const titleStr = `${itemLabels.join(' + ')} @ T-${Math.round(group.triggerRemainingSec / 60)}m${
          allCompleted ? ' (Completed)' : isDueNow ? ' (DUE NOW)' : isNextUpcoming ? ' (NEXT UP)' : ''
        }`;

        return (
          <div
            key={`milestone-${group.triggerRemainingSec}`}
            style={{ left: `${group.triggerPos}%` }}
            title={titleStr}
            className={`absolute -top-[2px] -ml-1.5 z-10 flex items-center justify-center pointer-events-auto ${isLarge ? 'sm:top-[-1px]' : ''}`}
          >
            {/* Intentional radar pulse ring on Next Upcoming milestone to visually tie into the NEXT ADDITION banner */}
            {isNextUpcoming && (
              <>
                <span className="absolute -inset-1 rounded-full border border-amber-300/80 animate-ping pointer-events-none" />
                <span className="absolute -inset-0.5 rounded-full ring-2 ring-amber-400/50 animate-pulse pointer-events-none" />
              </>
            )}

            {/* Flashing alert ring when milestone is due now */}
            {isDueNow && (
              <span className="absolute -inset-1 rounded-full bg-amber-400/80 animate-ping pointer-events-none" />
            )}

            <div
              className={`w-2.5 h-2.5 rounded-full border transition-all ${
                allCompleted
                  ? 'bg-emerald-400 border-slate-950'
                  : isDueNow
                  ? 'bg-amber-300 border-white'
                  : isNextUpcoming
                  ? 'bg-amber-400 border-white shadow-[0_0_8px_rgba(245,158,11,0.9)]'
                  : hasAdditions
                  ? 'bg-amber-400 border-slate-950 shadow-[0_0_5px_rgba(245,158,11,0.6)]'
                  : 'bg-cyan-400 border-slate-950 shadow-[0_0_5px_rgba(6,182,212,0.6)]'
              }`}
            />
          </div>
        );
      })}
    </div>
  );
};
