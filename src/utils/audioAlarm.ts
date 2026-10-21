class AudioAlarmEngine {
  private ctx: AudioContext | null = null;
  private isUnlocked: boolean = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    return this.ctx;
  }

  public async unlock(): Promise<boolean> {
    const ctx = this.getContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (e) {
        console.warn('Failed to resume AudioContext:', e);
      }
    }
    this.isUnlocked = ctx.state === 'running';
    return this.isUnlocked;
  }

  public playTone(freq: number, type: OscillatorType, duration: number, gainValue = 0.3, rampOut = true) {
    const ctx = this.getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(gainValue, ctx.currentTime);
      if (rampOut) {
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (err) {
      console.warn('Audio playback error:', err);
    }
  }

  public playAdditionAlert() {
    // 3 ascending chime notes: E5 (659Hz), G#5 (830Hz), B5 (987Hz)
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [659.25, 830.61, 987.77, 1318.51];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'sine', 0.35, 0.4);
      }, idx * 160);
    });
  }

  public playStageComplete() {
    // Reverberant triumph chime: 523Hz (C5), 659Hz (E5), 784Hz (G5), 1046Hz (C6)
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'triangle', 0.6, 0.5);
      }, idx * 140);
    });
  }

  public playWarningBeep() {
    // Short urgent double-beep
    this.playTone(880, 'square', 0.1, 0.2);
    setTimeout(() => {
      this.playTone(880, 'square', 0.1, 0.2);
    }, 150);
  }

  public playClick() {
    this.playTone(440, 'sine', 0.04, 0.15);
  }
}

export const audioAlarm = new AudioAlarmEngine();
