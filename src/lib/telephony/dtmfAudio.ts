// Dual-Tone Multi-Frequency (DTMF) Signaling Synthesizer
// Compliant with ITU-T Recommendation Q.23 standard frequencies

export const DTMF_FREQUENCIES: Record<string, [number, number]> = {
  '1': [697, 1209],
  '2': [697, 1336],
  '3': [697, 1477],
  '4': [770, 1209],
  '5': [770, 1336],
  '6': [770, 1477],
  '7': [852, 1209],
  '8': [852, 1336],
  '9': [852, 1477],
  '*': [941, 1209],
  '0': [941, 1336],
  '#': [941, 1477],
};

class DTMFSynthesizer {
  private ctx: AudioContext | null = null;

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

  playTone(digit: string, durationSeconds = 0.16) {
    const freqs = DTMF_FREQUENCIES[digit];
    if (!freqs) return;

    try {
      const ctx = this.getContext();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.frequency.value = freqs[0];
      osc2.frequency.value = freqs[1];

      // Blend sine waves
      osc1.type = 'sine';
      osc2.type = 'sine';

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      // Gentle attack and release envelope to prevent audible clicks
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.015);
      gain.gain.setValueAtTime(0.15, now + durationSeconds - 0.02);
      gain.gain.linearRampToValueAtTime(0.0001, now + durationSeconds);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + durationSeconds);
      osc2.stop(now + durationSeconds);
    } catch (e) {
      console.warn('DTMF playback error:', e);
    }
  }

  // Ringback tone for simulated PSTN calls (European/Indian standard 400Hz cadence)
  playPSTNRingback(onCycle: () => void): () => void {
    let stopped = false;
    let timer: any = null;

    const burst = () => {
      if (stopped) return;
      try {
        const ctx = this.getContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.frequency.value = 400; // Standard 400 Hz Indian/European tone
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.setValueAtTime(0.1, now + 1.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

        osc.start(now);
        osc.stop(now + 1.4);
        onCycle();
      } catch (e) {}

      if (!stopped) {
        timer = setTimeout(burst, 3000);
      }
    };

    burst();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }
}

export const dtmfAudio = typeof window !== 'undefined' ? new DTMFSynthesizer() : (null as any);
