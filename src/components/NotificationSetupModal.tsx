import React, { useState } from 'react';
import { Bell, BellOff, BellRing, Check, Smartphone, X } from 'lucide-react';
import { notificationManager } from '../utils/notificationManager';
import { useNotificationPermission } from '../hooks/useNotificationPermission';

interface NotificationSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ALERT_BENEFITS = [
  'Hop and addition reminders on your lock screen',
  'Alerts when a stage timer finishes',
  'A live timer with pause and +1m controls in your notification shade'
];

export const NotificationSetupModal: React.FC<NotificationSetupModalProps> = ({ isOpen, onClose }) => {
  const permission = useNotificationPermission();
  const [isRequesting, setIsRequesting] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  if (!isOpen) return null;

  const diag = notificationManager.getDiagnostics();
  const isBlocked = !diag.isSecureContext || !diag.isSupported || permission === 'denied';

  const handleEnable = async () => {
    setIsRequesting(true);
    setStatusNote(null);
    const res = await notificationManager.requestPermission();
    setIsRequesting(false);
    if (!res.granted && res.permission === 'default') {
      setStatusNote('The permission prompt was closed without a choice. Tap Enable Alerts to try again.');
    }
  };

  const handleTest = async () => {
    const res = await notificationManager.sendNotification('BrewMate Test Alert', {
      body: 'Lock-screen notifications and vibration are active for your brew session.'
    });
    setStatusNote(res.sent
      ? 'Test alert sent. Check your status bar or lock screen.'
      : res.message || 'The test alert could not be delivered.');
  };

  const handleClose = () => {
    setStatusNote(null);
    onClose();
  };

  const accent = permission === 'granted'
    ? { border: 'border-emerald-500/50', text: 'text-emerald-400', Icon: BellRing }
    : isBlocked
      ? { border: 'border-red-500/50', text: 'text-red-400', Icon: BellOff }
      : { border: 'border-amber-500/50', text: 'text-amber-400', Icon: Bell };

  const title = permission === 'granted'
    ? 'Brew Alerts Are On'
    : isBlocked
      ? diag.errorReason || 'Alerts Are Blocked'
      : 'Turn On Brew Alerts';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className={`w-full max-w-md max-h-[96dvh] overflow-y-auto bg-slate-950/95 backdrop-blur-xl border ${accent.border} rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className={`flex items-center space-x-2 ${accent.text}`}>
            <accent.Icon className="w-5 h-5 shrink-0" />
            <h2 className="font-mono font-black text-sm uppercase tracking-widest">{title}</h2>
          </div>
          <button
            onClick={handleClose}
            title="Close"
            className="p-1 -m-1 rounded-lg text-slate-500 hover:text-slate-200 transition-colors touch-press"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {permission === 'granted' ? (
          <p className="text-sm text-gray-300">
            You'll get addition reminders and timer alerts on this device, even with the screen locked.
          </p>
        ) : isBlocked ? (
          <div className="space-y-2.5">
            <p className="text-sm text-gray-300">{diag.advice}</p>
            {diag.isSupported && diag.isSecureContext && (
              <p className="text-[11px] font-mono text-gray-500">This screen updates by itself once alerts are allowed.</p>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-sm text-gray-300">
              BrewMate needs permission to notify you so you don't miss a step while you're away from the screen:
            </p>
            <ul className="space-y-1.5">
              {ALERT_BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start space-x-2 text-sm text-gray-200">
                  <Check className="w-4 h-4 mt-0.5 text-amber-400 shrink-0 stroke-[3]" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] font-mono text-gray-500">Choose Allow when your browser asks.</p>
          </div>
        )}

        {!notificationManager.isStandalone() && permission !== 'denied' && (
          <p className="flex items-start space-x-2 text-[11px] text-gray-400">
            <Smartphone className="w-3.5 h-3.5 mt-px shrink-0" />
            <span>Tip: installing BrewMate to your home screen makes alerts more reliable while the screen is locked.</span>
          </p>
        )}

        {statusNote && (
          <p className="text-xs font-mono text-cyan-300 bg-cyan-950/30 border border-cyan-800/50 rounded-lg px-3 py-2">
            {statusNote}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          {permission === 'granted' ? (
            <button
              onClick={handleTest}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl font-mono font-black text-xs tracking-widest uppercase border bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 border-emerald-500/70 transition-all touch-press"
            >
              Send Test Alert
            </button>
          ) : !isBlocked && (
            <button
              onClick={handleEnable}
              disabled={isRequesting}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl font-mono font-black text-xs tracking-widest uppercase border bg-amber-950/60 hover:bg-amber-900/70 text-amber-300 border-amber-500/70 shadow-[0_0_20px_rgba(245,158,11,0.25)] disabled:opacity-60 transition-all touch-press"
            >
              {isRequesting ? 'Waiting for Browser…' : 'Enable Alerts'}
            </button>
          )}
          <button
            onClick={handleClose}
            className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 font-mono font-bold text-xs tracking-wider uppercase transition-all touch-press"
          >
            {permission === 'granted' || isBlocked ? 'Done' : 'Not Now'}
          </button>
        </div>
      </div>
    </div>
  );
};
