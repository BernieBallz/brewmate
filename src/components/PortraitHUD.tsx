import React, { useEffect, useRef } from 'react';
import { useBrewStore } from '../store/brewStore';
import { TimerCockpit } from './TimerCockpit';
import { StageFeed } from './StageFeed';

interface PortraitHUDProps {
  onConfirmAdvance: () => void;
  onOpenReportModal?: () => void;
}

export const PortraitHUD: React.FC<PortraitHUDProps> = ({ onConfirmAdvance, onOpenReportModal }) => {
  const currentStageIndex = useBrewStore(state => state.currentStageIndex);

  // Bring the new stage's timer, tabs and first reminders back into view on stage change
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [currentStageIndex]);

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 flex flex-col p-2 pb-6 space-y-2 overflow-y-auto">
      {/* Top Section: Timer Cockpit */}
      <div className="shrink-0">
        <TimerCockpit onConfirmAdvance={onConfirmAdvance} onOpenReportModal={onOpenReportModal} />
      </div>

      {/* Bottom Section: Stage Feed */}
      <div className="flex-1 min-h-[300px]">
        <StageFeed />
      </div>
    </div>
  );
};
