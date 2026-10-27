import { useEffect, useState } from 'react';
import { useBrewStore, CONFIRM_ADVANCE_EVENT, DONE_CARD_EVENT } from './store/brewStore';
import { HeaderBar } from './components/HeaderBar';
import { LandscapeHUD } from './components/LandscapeHUD';
import { PortraitHUD } from './components/PortraitHUD';
import { AdditionModal } from './components/AdditionModal';
import { TaskAlertModal } from './components/TaskAlertModal';
import { ConfirmAdvanceModal } from './components/ConfirmAdvanceModal';
import { RecipeUploadModal } from './components/RecipeUploadModal';
import { SessionAuditReportModal } from './components/SessionAuditReportModal';
import { ResetConfirmModal, type SessionClearMode } from './components/ResetConfirmModal';
import { MenuDrawer } from './components/MenuDrawer';
import { NotificationSetupModal } from './components/NotificationSetupModal';
import { WelcomeScreen } from './components/WelcomeScreen';
import { StageScreen } from './components/StageScreen';
import { StageCard } from './components/StageCard';
import { DoneCard, type ReadingCardMode } from './components/DoneCard';
import { DueBanner } from './components/DueBanner';
import { SessionLogSheet } from './components/SessionLogSheet';
import { notificationManager } from './utils/notificationManager';

const ALERT_PROMPT_SEEN_KEY = 'brewmate_alert_prompt_seen';

// Offer the alerts explainer once per device, while permission is still undecided
const shouldAutoOpenAlertSetup = (): boolean => {
  if (notificationManager.getPermission() !== 'default') return false;
  try {
    return localStorage.getItem(ALERT_PROMPT_SEEN_KEY) !== '1';
  } catch {
    return false;
  }
};

export function App() {
  const { tick, currentStageIndex, stages, reconcileTimerWithWallClock } = useBrewStore();
  const isByStage = useBrewStore(state => state.flowMode === 'byStage');
  const stageCardRequested = useBrewStore(state => state.stageCardRequested);
  const clearStageCardRequest = useBrewStore(state => state.clearStageCardRequest);

  // By stage cards and the menu's Session Log sheet
  const [isStageCardOpen, setIsStageCardOpen] = useState(false);
  const [doneCardMode, setDoneCardMode] = useState<ReadingCardMode | null>(null);
  const [isSessionLogOpen, setIsSessionLogOpen] = useState(false);
  // Switching to By stage mid-stage with items still to confirm opens the stage card straight away
  const showStageCard = isStageCardOpen || stageCardRequested;
  const closeStageCard = () => {
    setIsStageCardOpen(false);
    clearStageCardRequest();
  };

  const [isMenuDrawerOpen, setIsMenuDrawerOpen] = useState(false);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  // Stage chosen from the menu's Jump to Stage; null means "advance to the next stage"
  const [advanceTargetIndex, setAdvanceTargetIndex] = useState<number | null>(null);

  const openAdvanceModal = (targetIndex: number | null = null) => {
    setAdvanceTargetIndex(targetIndex);
    setIsAdvanceModalOpen(true);
  };
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [sessionClearMode, setSessionClearMode] = useState<SessionClearMode>('reset');

  const openSessionClearConfirm = (mode: SessionClearMode) => {
    setSessionClearMode(mode);
    setIsResetModalOpen(true);
  };
  const [isAlertSetupOpen, setIsAlertSetupOpen] = useState(shouldAutoOpenAlertSetup);

  const closeAlertSetup = () => {
    setIsAlertSetupOpen(false);
    try {
      localStorage.setItem(ALERT_PROMPT_SEEN_KEY, '1');
    } catch {}
  };

  // Landscape orientation detection
  const [isLandscape, setIsLandscape] = useState(true);

  // High-precision wall-clock timer tick
  useEffect(() => {
    const interval = setInterval(() => {
      tick();
    }, 250);

    return () => clearInterval(interval);
  }, [tick]);

  // Lock-screen "Next Stage" with unfinished items asks for the Complete Stage dialog instead of skipping it
  useEffect(() => {
    const openNextStageConfirm = () => {
      setAdvanceTargetIndex(null);
      setIsAdvanceModalOpen(true);
    };
    window.addEventListener(CONFIRM_ADVANCE_EVENT, openNextStageConfirm);
    return () => window.removeEventListener(CONFIRM_ADVANCE_EVENT, openNextStageConfirm);
  }, []);

  // Lock-screen "Next Stage" in By stage with a reading still to record opens the Done card
  useEffect(() => {
    const openDoneCard = () => setDoneCardMode('finish');
    window.addEventListener(DONE_CARD_EVENT, openDoneCard);
    return () => window.removeEventListener(DONE_CARD_EVENT, openDoneCard);
  }, []);

  // Mobile standby / sleep wake-up recovery
  useEffect(() => {
    const handleWakeUp = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        reconcileTimerWithWallClock();
      }
    };

    window.addEventListener('visibilitychange', handleWakeUp);
    window.addEventListener('pageshow', handleWakeUp);
    window.addEventListener('focus', handleWakeUp);

    return () => {
      window.removeEventListener('visibilitychange', handleWakeUp);
      window.removeEventListener('pageshow', handleWakeUp);
      window.removeEventListener('focus', handleWakeUp);
    };
  }, [reconcileTimerWithWallClock]);

  // Orientation listener
  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window !== 'undefined') {
        const landscape = window.innerWidth >= window.innerHeight;
        setIsLandscape(landscape);
      }
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const progressPercent = stages.length > 0 ? Math.round(((currentStageIndex + 1) / stages.length) * 100) : 0;
  const shellClassName = 'flex flex-col h-screen h-[100dvh] w-screen bg-brew-dark text-gray-100 overflow-hidden font-display pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]';

  // No recipe loaded yet: only the welcome screen. The alerts explainer (if still due) waits until after loading.
  if (stages.length === 0) {
    return (
      <div className={shellClassName}>
        <WelcomeScreen onLoadRecipe={() => setIsRecipeModalOpen(true)} />
        <RecipeUploadModal
          isOpen={isRecipeModalOpen}
          onClose={() => setIsRecipeModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className={shellClassName}>
      {/* 1. Slim Top Progress Line (3px) */}
      <div className="w-full h-[3px] bg-slate-950 shrink-0">
        <div
          className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-emerald-400 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* 2. Top Header Bar (36px); the By stage screen carries its own menu button instead */}
      {!isByStage && (
        <HeaderBar onOpenMenu={() => setIsMenuDrawerOpen(true)} onOpenAlerts={() => setIsAlertSetupOpen(true)} />
      )}

      {/* 3. Main Interactive Cockpit Area (Takes 100% of remaining vertical height) */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
        {isByStage ? (
          <StageScreen
            onOpenMenu={() => setIsMenuDrawerOpen(true)}
            onConfirmAdvance={() => openAdvanceModal()}
            onOpenReportModal={() => setIsReportModalOpen(true)}
            onOpenStageCard={() => setIsStageCardOpen(true)}
            onOpenDoneCard={() => setDoneCardMode('finish')}
            onRecordReading={() => setDoneCardMode('record')}
          />
        ) : isLandscape ? (
          <LandscapeHUD
            onConfirmAdvance={() => openAdvanceModal()}
            onOpenReportModal={() => setIsReportModalOpen(true)}
          />
        ) : (
          <PortraitHUD
            onConfirmAdvance={() => openAdvanceModal()}
            onOpenReportModal={() => setIsReportModalOpen(true)}
          />
        )}
      </main>

      {/* Overlays & Modals */}
      <AdditionModal />
      <TaskAlertModal />
      <DueBanner onRecord={() => setDoneCardMode('record')} />
      {/* Keyed by stage so each stage's card starts with fresh readings */}
      {showStageCard && <StageCard key={currentStageIndex} onClose={closeStageCard} />}
      {doneCardMode && <DoneCard mode={doneCardMode} onClose={() => setDoneCardMode(null)} />}
      <SessionLogSheet isOpen={isSessionLogOpen} onClose={() => setIsSessionLogOpen(false)} />

      <MenuDrawer
        isOpen={isMenuDrawerOpen}
        onClose={() => setIsMenuDrawerOpen(false)}
        onOpenRecipeModal={() => setIsRecipeModalOpen(true)}
        onOpenReportModal={() => setIsReportModalOpen(true)}
        onOpenResetConfirm={() => openSessionClearConfirm('reset')}
        onOpenRemoveConfirm={() => openSessionClearConfirm('remove')}
        onConfirmJump={(stageIndex) => openAdvanceModal(stageIndex)}
        onOpenSessionLog={() => setIsSessionLogOpen(true)}
        onOpenAlertSetup={() => setIsAlertSetupOpen(true)}
      />

      <ConfirmAdvanceModal
        isOpen={isAdvanceModalOpen}
        onClose={() => setIsAdvanceModalOpen(false)}
        targetStageIndex={advanceTargetIndex}
      />

      <RecipeUploadModal
        isOpen={isRecipeModalOpen}
        onClose={() => setIsRecipeModalOpen(false)}
      />

      <SessionAuditReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />

      <ResetConfirmModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        mode={sessionClearMode}
      />

      <NotificationSetupModal
        isOpen={isAlertSetupOpen}
        onClose={closeAlertSetup}
      />
    </div>
  );
}

export default App;
