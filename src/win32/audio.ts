// Web Audio API synthesizer for classic Windows 95/98 sound effects
class Win32AudioEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private getContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Classic Windows "Chord" (Error / Critical Stop)
  public playChord() {
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    // Dramatic minor-major chord cluster (A3, C4, E4, A4)
    const freqs = [220, 261.63, 329.63, 440];

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = idx % 2 === 0 ? "sawtooth" : "triangle";
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.65);
    });
  }

  // Classic Windows "Ding" (Warning / Default Beep)
  public playDing() {
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t); // A5
    osc.frequency.exponentialRampToValueAtTime(1320, t + 0.05);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.5);
  }

  // Classic Windows "Chime" (Information / Asterisk)
  public playChime() {
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 arpeggio

    notes.forEach((freq, i) => {
      const noteTime = t + i * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.15, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.4);
    });
  }

  // Mine explosion sound (Noise burst + sub rumble)
  public playExplosion() {
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.12));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.exponentialRampToValueAtTime(60, t + 0.5);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(t);
    noise.stop(t + 0.5);
  }

  // Tada / Victory fanfare
  public playTada() {
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const chord1 = [440, 554.37, 659.25]; // A major
    const chord2 = [587.33, 739.99, 880];  // D major

    chord1.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });

    chord2.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t + 0.25);
      gain.gain.setValueAtTime(0.2, t + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + 0.25);
      osc.stop(t + 0.85);
    });
  }

  // Subtle button click
  public playClick() {
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.02);

    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.02);
  }
}

export const audio = new Win32AudioEngine();

// Win32 MessageBeep API
export const MB_OK_BEEP = 0x00000000;
export const MB_ICONHAND_BEEP = 0x00000010;
export const MB_ICONQUESTION_BEEP = 0x00000020;
export const MB_ICONEXCLAMATION_BEEP = 0x00000030;
export const MB_ICONASTERISK_BEEP = 0x00000040;

export function MessageBeep(uType = MB_OK_BEEP) {
  switch (uType) {
    case MB_ICONHAND_BEEP:
      audio.playChord();
      break;
    case MB_ICONEXCLAMATION_BEEP:
      audio.playDing();
      break;
    case MB_ICONASTERISK_BEEP:
    case MB_ICONQUESTION_BEEP:
      audio.playChime();
      break;
    default:
      audio.playDing();
      break;
  }
}
