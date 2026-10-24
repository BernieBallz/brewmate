import React from 'react';
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';
import { useBrewStore } from '../store/brewStore';

interface AppErrorBoundaryState {
  error: Error | null;
}

// Last-resort safety net: without it, a render crash leaves a blank screen, and because the session is
// saved, the app would crash again on every open with no way to reach Reset or Remove Recipe.
export class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('BrewMate crashed:', error, info.componentStack);
  }

  private clearSessionAndRestart = () => {
    // Goes through the store's storage, which also drops any queued (not yet written) save
    useBrewStore.persist.clearStorage();
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-brew-dark text-gray-100 font-display">
        <div className="w-full max-w-sm text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h1 className="font-mono font-black text-lg tracking-widest text-white uppercase">Something went wrong</h1>
          <p className="text-sm text-gray-300 mt-2">
            BrewMate hit a problem showing this brew session. Reloading may fix it. If it keeps happening,
            clear the saved session and load the recipe again.
          </p>

          <button
            onClick={() => window.location.reload()}
            className="mt-6 w-full min-h-[48px] py-2.5 rounded-xl font-mono font-black text-sm tracking-widest uppercase flex items-center justify-center space-x-2 border bg-slate-900/80 hover:bg-slate-800 text-gray-200 border-slate-700 transition-all touch-press"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reload</span>
          </button>
          <button
            onClick={this.clearSessionAndRestart}
            className="mt-2 w-full min-h-[48px] py-2.5 rounded-xl font-mono font-black text-sm tracking-widest uppercase flex items-center justify-center space-x-2 border bg-rose-950/60 hover:bg-rose-900/70 text-rose-200 border-rose-500/60 transition-all touch-press"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear Session &amp; Start Again</span>
          </button>
          <p className="text-[11px] text-gray-500 mt-2">
            Clears this brew session and its log from this device. Sound and vibration settings reset to on.
          </p>

          <p className="text-[10px] font-mono text-gray-600 mt-4 break-words max-w-full">{this.state.error.message}</p>
        </div>
      </div>
    );
  }
}
