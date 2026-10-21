import React from 'react';
import { TimerCockpit } from './TimerCockpit';
import { StageFeed } from './StageFeed';

interface LandscapeHUDProps {
  onConfirmAdvance: () => void;
  onOpenReportModal?: () => void;
}

export const LandscapeHUD: React.FC<LandscapeHUDProps> = ({ onConfirmAdvance, onOpenReportModal }) => {
  return (
    <div className="flex-1 min-h-0 grid grid-cols-12 gap-1.5 p-1 sm:p-2 overflow-hidden">
      {/* Left Cockpit: Timer, countdown, extends & primary controls */}
      <div className="col-span-6 lg:col-span-5 h-full min-h-0 flex flex-col overflow-hidden">
        <TimerCockpit onConfirmAdvance={onConfirmAdvance} onOpenReportModal={onOpenReportModal} />
      </div>

      {/* Right Cockpit: Stage Reminders, Ingredient Additions & Telemetry inputs */}
      <div className="col-span-6 lg:col-span-7 h-full min-h-0 flex flex-col overflow-hidden">
        <StageFeed />
      </div>
    </div>
  );
};
