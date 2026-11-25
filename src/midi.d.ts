declare module "midi.js" {
  export interface GMInstrument {
    id: string;
    instrument: string;
    number: number;
    category: string;
  }

  export interface MIDIStatic {
    Soundfont: Record<string, any>;
    DEBUG: boolean;
    USE_XHR: boolean;
    soundfontUrl: string;
    loadPlugin(options: any): void;
    loadResource(options: any): void;
    setDefaultPlugin(plugin: any): void;
    GM: {
      byName: Record<string, GMInstrument>;
      byId: Record<number, GMInstrument>;
      byCategory: Record<string, GMInstrument[]>;
    };
    channels: Array<{
      number: number;
      instrument: number;
      volume: number;
      mute: boolean;
      mono: boolean;
      omni: boolean;
      solo: boolean;
      pitchBend?: number;
    }>;
    keyToNote: Record<string, number>;
    noteToKey: Record<number, string>;
    Player: any;
    WebMIDI: any;
    WebAudio?: any;
    AudioTag?: any;
    noteOn(channel: number, note: number, velocity?: number, delay?: number): void;
    noteOff(channel: number, note: number, delay?: number): void;
    chordOn(channel: number, chord: number[], velocity?: number, delay?: number): void;
    chordOff(channel: number, chord: number[], delay?: number): void;
    programChange(channel: number, program: number, delay?: number): void;
    pitchBend(channel: number, program: number, delay?: number): void;
    setVolume(channel: number, volume: number, delay?: number): void;
    stopAllNotes(): void;
  }

  const MIDI: MIDIStatic;
  export default MIDI;
}
