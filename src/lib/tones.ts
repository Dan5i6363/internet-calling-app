// Web Audio API Ringtone and Tone Generator
// Zero external asset dependencies - works offline and in PWA seamlessly.

class ToneGenerator {
  private ctx: AudioContext | null = null;
  private ringInterval: any = null;
  private isPlayingRingback = false;
  private isPlayingRingtone = false;

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Caller hearing ringing (440Hz + 480Hz dual tone: 2s on, 3s off)
  startRingback() {
    if (this.isPlayingRingback) return;
    this.isPlayingRingback = true;
    const playBurst = () => {
      if (!this.isPlayingRingback) return;
      try {
        const ctx = this.getContext();
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.frequency.value = 440;
        osc2.frequency.value = 480;

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);

        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 1.8);
        osc2.stop(ctx.currentTime + 1.8);
      } catch (e) {
        console.warn('Tone error:', e);
      }
    };

    playBurst();
    this.ringInterval = setInterval(playBurst, 4000);
  }

  // Callee hearing incoming call melody (Chime pattern)
  startRingtone() {
    if (this.isPlayingRingtone) return;
    this.isPlayingRingtone = true;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const playChime = () => {
      if (!this.isPlayingRingtone) return;
      try {
        const ctx = this.getContext();
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.value = freq;

          osc.connect(gain);
          gain.connect(ctx.destination);

          const startTime = ctx.currentTime + (idx * 0.18);
          gain.gain.setValueAtTime(0.2, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

          osc.start(startTime);
          osc.stop(startTime + 0.35);
        });
      } catch (e) {
        console.warn('Ringtone error:', e);
      }
    };

    playChime();
    this.ringInterval = setInterval(playChime, 2500);
  }

  // Call ended short beep
  playEndBeep() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.frequency.value = 400;
      osc.connect(gain);
      gain.connect(ctx.destination);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
  }

  stopAll() {
    this.isPlayingRingback = false;
    this.isPlayingRingtone = false;
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
  }
}

export const toneGenerator = typeof window !== 'undefined' ? new ToneGenerator() : (null as any);
