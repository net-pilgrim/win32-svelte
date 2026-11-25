import MIDI from "midi.js";

// Win32 Multimedia MIDI Constants
export const MMSYSERR_NOERROR = 0;
export const MMSYSERR_ERROR = 1;
export const MMSYSERR_BADDEVICEID = 2;
export const MMSYSERR_INVALHANDLE = 5;
export const MMSYSERR_NODRIVER = 6;
export const MMSYSERR_NOMEM = 7;

export const MIDIMAPPER = 0xffffffff;

export const MOD_MIDIPORT = 1;
export const MOD_SYNTH = 2;
export const MOD_SQSYNTH = 3;
export const MOD_FMSYNTH = 4;
export const MOD_MAPPER = 5;
export const MOD_WAVETABLE = 6;
export const MOD_SWSYNTH = 7;

export const MIDICAPS_VOLUME = 0x0001;
export const MIDICAPS_LRVOLUME = 0x0002;
export const MIDICAPS_CACHE = 0x0004;
export const MIDICAPS_STREAM = 0x0008;

export interface MidiChannelState {
  channel: number;
  program: number; // 0..127 General MIDI instrument
  volume: number; // 0..127
  pan: number; // 0..127
  pitchBend: number; // 0..16383, center 8192
}

interface ActiveVoice {
  channel: number;
  note: number;
  oscillators: OscillatorNode[];
  gainNode: GainNode;
  stop: (releaseSec?: number) => void;
}

export class Win32MidiSubsystem {
  public midiLib = MIDI;
  private audioCtx: AudioContext | null = null;
  private activeVoices = new Map<string, ActiveVoice>();
  private channels: MidiChannelState[] = [];
  private openHandles = new Set<number>();
  private nextHandle = 1;

  public constructor() {
    this.resetChannels();
  }

  public resetChannels(): void {
    this.channels = [];
    for (let ch = 0; ch < 16; ch++) {
      this.channels.push({
        channel: ch,
        program: 0, // Acoustic Grand Piano
        volume: 100,
        pan: 64,
        pitchBend: 8192,
      });
    }
  }

  public getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public noteToFrequency(note: number): number {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  public noteOn(channel: number, note: number, velocity: number): void {
    if (velocity === 0) {
      this.noteOff(channel, note);
      return;
    }

    // Forward to midi.js if available
    try {
      if (typeof this.midiLib.noteOn === "function") {
        this.midiLib.noteOn(channel, note, velocity, 0);
      }
    } catch {}

    const ctx = this.getAudioContext();
    if (!ctx) return;

    // Release any previous active voice on this channel & note
    const key = `${channel}:${note}`;
    const existing = this.activeVoices.get(key);
    if (existing) {
      existing.stop(0.01);
      this.activeVoices.delete(key);
    }

    const chState = this.channels[channel] ?? {
      channel,
      program: 0,
      volume: 100,
      pan: 64,
      pitchBend: 8192,
    };

    const now = ctx.currentTime;
    const baseFreq = this.noteToFrequency(note);
    const velGain = Math.pow(Math.min(127, Math.max(0, velocity)) / 127, 2);
    const chGain = (chState.volume / 127) * 0.25;
    const targetGain = Math.max(0.001, velGain * chGain);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.connect(ctx.destination);

    const oscillators: OscillatorNode[] = [];
    const bendCents = ((chState.pitchBend - 8192) / 8192) * 200;

    if (channel === 9) {
      // Channel 10 (0-indexed 9): General MIDI Percussion Drum Kit
      this.synthesizeDrum(ctx, note, targetGain, now, masterGain, oscillators);
    } else {
      // Melodic Instruments based on GM Program Number
      this.synthesizeMelodic(
        ctx,
        chState.program,
        baseFreq,
        bendCents,
        targetGain,
        now,
        masterGain,
        oscillators
      );
    }

    const voice: ActiveVoice = {
      channel,
      note,
      oscillators,
      gainNode: masterGain,
      stop: (releaseSec = 0.08) => {
        try {
          const t = ctx.currentTime;
          masterGain.gain.cancelScheduledValues(t);
          masterGain.gain.setValueAtTime(masterGain.gain.value, t);
          masterGain.gain.exponentialRampToValueAtTime(0.00001, t + releaseSec);
          setTimeout(() => {
            oscillators.forEach((osc) => {
              try {
                osc.stop();
                osc.disconnect();
              } catch {}
            });
            try {
              masterGain.disconnect();
            } catch {}
          }, releaseSec * 1000 + 50);
        } catch {}
      },
    };

    this.activeVoices.set(key, voice);
  }

  public noteOff(channel: number, note: number): void {
    try {
      if (typeof this.midiLib.noteOff === "function") {
        this.midiLib.noteOff(channel, note, 0);
      }
    } catch {}

    const key = `${channel}:${note}`;
    const voice = this.activeVoices.get(key);
    if (voice) {
      voice.stop(0.08);
      this.activeVoices.delete(key);
    }
  }

  public programChange(channel: number, program: number): void {
    const prog = Math.min(127, Math.max(0, program));
    if (this.channels[channel]) {
      this.channels[channel].program = prog;
    }
    try {
      if (typeof this.midiLib.programChange === "function") {
        this.midiLib.programChange(channel, prog, 0);
      }
      if (this.midiLib.channels && this.midiLib.channels[channel]) {
        this.midiLib.channels[channel].instrument = prog;
      }
    } catch {}
  }

  public pitchBend(channel: number, bend: number): void {
    const ch = this.channels[channel];
    if (ch) {
      ch.pitchBend = bend;
      const bendCents = ((bend - 8192) / 8192) * 200;
      for (const voice of this.activeVoices.values()) {
        if (voice.channel === channel) {
          voice.oscillators.forEach((osc) => {
            try {
              osc.detune.setValueAtTime(
                bendCents,
                this.audioCtx ? this.audioCtx.currentTime : 0
              );
            } catch {}
          });
        }
      }
    }
    try {
      if (typeof this.midiLib.pitchBend === "function") {
        this.midiLib.pitchBend(channel, bend, 0);
      }
    } catch {}
  }

  public controlChange(channel: number, controller: number, value: number): void {
    const ch = this.channels[channel];
    if (!ch) return;

    if (controller === 7) {
      // Main Volume
      ch.volume = value;
      try {
        if (typeof this.midiLib.setVolume === "function") {
          this.midiLib.setVolume(channel, value, 0);
        }
      } catch {}
    } else if (controller === 123 || controller === 120) {
      // All Notes Off / All Sound Off
      this.allNotesOff(channel);
    } else if (controller === 121) {
      // Reset All Controllers
      ch.volume = 100;
      ch.pan = 64;
      ch.pitchBend = 8192;
    }
  }

  public allNotesOff(channel?: number): void {
    for (const [key, voice] of this.activeVoices.entries()) {
      if (channel === undefined || voice.channel === channel) {
        voice.stop(0.04);
        this.activeVoices.delete(key);
      }
    }
    try {
      if (typeof this.midiLib.stopAllNotes === "function") {
        this.midiLib.stopAllNotes();
      }
    } catch {}
  }

  private synthesizeMelodic(
    ctx: AudioContext,
    program: number,
    baseFreq: number,
    bendCents: number,
    targetGain: number,
    now: number,
    masterGain: GainNode,
    oscillators: OscillatorNode[]
  ): void {
    const category = Math.floor(program / 8);

    if (category === 2) {
      // Organ (Programs 16..23, e.g. 19 = Church Organ for BachTocc)
      const drawbars = [
        { mult: 1.0, type: "sine" as OscillatorType, vol: 0.6 },
        { mult: 2.0, type: "sine" as OscillatorType, vol: 0.35 },
        { mult: 3.0, type: "triangle" as OscillatorType, vol: 0.2 },
      ];

      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.linearRampToValueAtTime(targetGain, now + 0.03);

      drawbars.forEach((db) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = db.type;
        osc.frequency.setValueAtTime(baseFreq * db.mult, now);
        osc.detune.setValueAtTime(bendCents, now);
        g.gain.setValueAtTime(db.vol, now);

        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        oscillators.push(osc);
      });
    } else if (category === 5 || category === 6) {
      // Strings & Ensemble (40..55)
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.linearRampToValueAtTime(targetGain, now + 0.08);

      [-4, 4].forEach((detuneOffset) => {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.detune.setValueAtTime(bendCents + detuneOffset, now);

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(baseFreq * 4, now);

        osc.connect(filter);
        filter.connect(masterGain);
        osc.start(now);
        oscillators.push(osc);
      });
    } else if (category === 7) {
      // Brass (56..63)
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.linearRampToValueAtTime(targetGain, now + 0.04);

      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.detune.setValueAtTime(bendCents, now);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.setValueAtTime(3, now);
      filter.frequency.setValueAtTime(baseFreq * 1.5, now);
      filter.frequency.exponentialRampToValueAtTime(baseFreq * 5, now + 0.06);

      osc.connect(filter);
      filter.connect(masterGain);
      osc.start(now);
      oscillators.push(osc);
    } else {
      // Default: Piano / Acoustic instruments (Programs 0..15, 24..39, etc.)
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.linearRampToValueAtTime(targetGain, now + 0.008);
      masterGain.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, targetGain * 0.4),
        now + 1.2
      );

      const osc1 = ctx.createOscillator();
      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(baseFreq, now);
      osc1.detune.setValueAtTime(bendCents, now);

      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(baseFreq * 2, now);
      osc2.detune.setValueAtTime(bendCents + 2, now);

      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.3, now);

      osc1.connect(masterGain);
      osc2.connect(g2);
      g2.connect(masterGain);

      osc1.start(now);
      osc2.start(now);
      oscillators.push(osc1, osc2);
    }
  }

  private synthesizeDrum(
    ctx: AudioContext,
    note: number,
    targetGain: number,
    now: number,
    masterGain: GainNode,
    oscillators: OscillatorNode[]
  ): void {
    if (note === 35 || note === 36) {
      // Bass Drum (Kick)
      masterGain.gain.setValueAtTime(targetGain * 1.5, now);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.12);

      osc.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.3);
      oscillators.push(osc);
    } else if (note === 38 || note === 40) {
      // Snare Drum (Tone + Noise)
      masterGain.gain.setValueAtTime(targetGain * 1.2, now);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);

      const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;

      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(1000, now);

      osc.connect(masterGain);
      noise.connect(filter);
      filter.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.22);
      noise.start(now);
      noise.stop(now + 0.22);
      oscillators.push(osc);
    } else if (note === 42 || note === 44 || note === 46) {
      // Hi-Hat (Closed / Pedal / Open)
      const duration = note === 46 ? 0.35 : 0.06;
      masterGain.gain.setValueAtTime(targetGain * 0.8, now);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      const noiseBuf = ctx.createBuffer(
        1,
        Math.floor(ctx.sampleRate * duration),
        ctx.sampleRate
      );
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;

      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(7000, now);

      noise.connect(filter);
      filter.connect(masterGain);
      noise.start(now);
      noise.stop(now + duration);
    } else {
      // Generic Drum / Tom
      const tomFreq = Math.max(60, 200 - (note - 41) * 15);
      masterGain.gain.setValueAtTime(targetGain, now);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(tomFreq, now);
      osc.frequency.exponentialRampToValueAtTime(tomFreq * 0.6, now + 0.15);

      osc.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.25);
      oscillators.push(osc);
    }
  }

  // --- Win32 MMSYSTEM API Implementations ---

  public midiOutGetNumDevs(): number {
    return 1;
  }

  public midiOutGetDevCapsA(
    _uDeviceID: number,
    memoryBuffer?: ArrayBuffer,
    pmoc?: number,
    _cbmoc?: number
  ): number {
    if (typeof pmoc === "number" && memoryBuffer) {
      const view = new DataView(memoryBuffer);
      view.setUint16(pmoc + 0, 1, true); // wMid: MM_MICROSOFT
      view.setUint16(pmoc + 2, 1, true); // wPid
      view.setUint32(pmoc + 4, 0x0400, true); // vDriverVersion: 4.0

      // szPname: 32 bytes string
      const name = "MIDI.js WebAudio Synthesizer";
      const u8 = new Uint8Array(memoryBuffer, pmoc + 8, 32);
      for (let i = 0; i < 31 && i < name.length; i++) {
        u8[i] = name.charCodeAt(i);
      }
      u8[Math.min(31, name.length)] = 0;

      view.setUint16(pmoc + 40, MOD_SWSYNTH, true); // wTechnology
      view.setUint16(pmoc + 42, 32, true); // wVoices
      view.setUint16(pmoc + 44, 32, true); // wNotes
      view.setUint16(pmoc + 46, 0xffff, true); // wChannelMask (all channels)
      view.setUint32(pmoc + 48, MIDICAPS_VOLUME | MIDICAPS_LRVOLUME, true); // dwSupport
    }
    return MMSYSERR_NOERROR;
  }

  public midiOutGetDevCapsW(
    uDeviceID: number,
    memoryBuffer?: ArrayBuffer,
    pmoc?: number,
    cbmoc?: number
  ): number {
    return this.midiOutGetDevCapsA(uDeviceID, memoryBuffer, pmoc, cbmoc);
  }

  public midiOutOpen(
    phmo: number,
    _uDeviceID: number,
    memoryBuffer?: ArrayBuffer,
    _dwCallback?: number,
    _dwInstance?: number,
    _fdwOpen?: number
  ): number {
    const handle = this.nextHandle++;
    this.openHandles.add(handle);
    if (typeof phmo === "number" && memoryBuffer) {
      new DataView(memoryBuffer).setUint32(phmo, handle, true);
    }
    return MMSYSERR_NOERROR;
  }

  public midiOutClose(hmo: number): number {
    this.allNotesOff();
    this.openHandles.delete(hmo);
    return MMSYSERR_NOERROR;
  }

  public midiOutReset(hmo: number): number {
    this.allNotesOff();
    this.resetChannels();
    return MMSYSERR_NOERROR;
  }

  public midiOutShortMsg(_hmo: number, dwMsg: number): number {
    const status = dwMsg & 0xff;
    const cmd = status & 0xf0;
    const ch = status & 0x0f;
    const data1 = (dwMsg >> 8) & 0xff;
    const data2 = (dwMsg >> 16) & 0xff;

    switch (cmd) {
      case 0x80: // Note Off
        this.noteOff(ch, data1);
        break;
      case 0x90: // Note On
        this.noteOn(ch, data1, data2);
        break;
      case 0xb0: // Control Change
        this.controlChange(ch, data1, data2);
        break;
      case 0xc0: // Program Change
        this.programChange(ch, data1);
        break;
      case 0xe0: {
        // Pitch Bend
        const bend = (data2 << 7) | data1;
        this.pitchBend(ch, bend);
        break;
      }
    }

    return MMSYSERR_NOERROR;
  }

  public midiOutLongMsg(_hmo: number, _lpMidiOutHdr: number, _uSize: number): number {
    return MMSYSERR_NOERROR;
  }

  public midiOutSetVolume(_hmo: number, _dwVolume: number): number {
    return MMSYSERR_NOERROR;
  }

  public midiOutGetVolume(
    _hmo: number,
    memoryBuffer?: ArrayBuffer,
    pdwVolume?: number
  ): number {
    if (typeof pdwVolume === "number" && memoryBuffer) {
      new DataView(memoryBuffer).setUint32(pdwVolume, 0xffffffff, true);
    }
    return MMSYSERR_NOERROR;
  }
}

export const win32Midi = new Win32MidiSubsystem();
