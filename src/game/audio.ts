import { CharacterForm } from '../types';

class SoundSystem {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private isMusicPlaying: boolean = false;
  private currentForm: CharacterForm = 'zombie';

  // Music sequencer state
  private musicTimer: number | null = null;
  private step: number = 0;
  private tempo: number = 136; // High tempo BPM for fast subway runner
  private nextNoteTime: number = 0;

  constructor() {
    // Lazy init on first user gesture
  }

  public init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);
    } catch {
      // Ignore if web audio blocked
    }
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.8, this.ctx.currentTime);
    }
  }

  public setVolume(musicVol: number, sfxVol: number) {
    if (this.ctx) {
      if (this.musicGain) this.musicGain.gain.setValueAtTime(Math.max(0, Math.min(1, musicVol)), this.ctx.currentTime);
      if (this.sfxGain) this.sfxGain.gain.setValueAtTime(Math.max(0, Math.min(1, sfxVol)), this.ctx.currentTime);
    }
  }

  public setForm(form: CharacterForm) {
    this.currentForm = form;
  }

  // High tempo procedurally generated music loop
  public startMusic() {
    this.init();
    this.resume();
    if (this.isMusicPlaying) return;
    this.isMusicPlaying = true;
    this.step = 0;
    if (this.ctx) {
      this.nextNoteTime = this.ctx.currentTime + 0.1;
      this.scheduleMusic();
    }
  }

  public stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicTimer !== null) {
      window.clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleMusic = () => {
    if (!this.isMusicPlaying || !this.ctx || !this.musicGain) return;

    const secondsPer16th = 60 / this.tempo / 4;

    while (this.nextNoteTime < this.ctx.currentTime + 0.2) {
      this.playMusicStep(this.step, this.nextNoteTime);
      this.nextNoteTime += secondsPer16th;
      this.step = (this.step + 1) % 32;
    }

    this.musicTimer = window.setTimeout(this.scheduleMusic, 50);
  };

  private playMusicStep(step: number, time: number) {
    if (!this.ctx || !this.musicGain || this.isMuted) return;

    const isZombie = this.currentForm === 'zombie';

    // 1. Kick Drum (every 4 steps for 4-on-the-floor, plus dynamic syncopation)
    if (step % 4 === 0 || (!isZombie && step % 8 === 6)) {
      const kickOsc = this.ctx.createOscillator();
      const kickGain = this.ctx.createGain();
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(isZombie ? 120 : 140, time);
      kickOsc.frequency.exponentialRampToValueAtTime(32, time + 0.08);

      kickGain.gain.setValueAtTime(isZombie ? 0.6 : 0.75, time);
      kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

      kickOsc.connect(kickGain);
      kickGain.connect(this.musicGain);

      kickOsc.start(time);
      kickOsc.stop(time + 0.1);
    }

    // 2. Snare / Clatter
    if (step % 8 === 4) {
      const bufferSize = this.ctx.sampleRate * 0.06;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = isZombie ? 'bandpass' : 'highpass';
      noiseFilter.frequency.setValueAtTime(isZombie ? 800 : 1600, time);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.3, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.06);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.musicGain);

      noise.start(time);
      noise.stop(time + 0.06);
    }

    // 3. Hi-Hats (every 2 steps or 16ths)
    if (step % 2 === 0) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(6000 + Math.random() * 2000, time);

      gain.gain.setValueAtTime(step % 4 === 2 ? 0.15 : 0.07, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + 0.035);
    }

    // 4. Bassline / Arpeggio
    // Zombie mode: Heavy brooding industrial saw bass (D minor / F / C / A#)
    // Human mode: Upbeat cyberpunk synthwave driving arp
    const zombieNotes = [58.27, 58.27, 65.41, 58.27, 77.78, 73.42, 65.41, 58.27];
    const humanNotes = [130.81, 155.56, 174.61, 196.0, 220.0, 261.63, 196.0, 155.56];

    const noteIndex = Math.floor(step / 2) % 8;
    const freq = isZombie ? zombieNotes[noteIndex] : humanNotes[noteIndex];

    const bassOsc = this.ctx.createOscillator();
    const bassFilter = this.ctx.createBiquadFilter();
    const bassGain = this.ctx.createGain();

    bassOsc.type = isZombie ? 'sawtooth' : 'square';
    bassOsc.frequency.setValueAtTime(freq, time);

    bassFilter.type = 'lowpass';
    bassFilter.frequency.setValueAtTime(isZombie ? 380 : 950, time);
    bassFilter.frequency.exponentialRampToValueAtTime(isZombie ? 160 : 350, time + 0.1);

    bassGain.gain.setValueAtTime(isZombie ? 0.35 : 0.25, time);
    bassGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    bassOsc.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(this.musicGain);

    bassOsc.start(time);
    bassOsc.stop(time + 0.13);
  }

  // --- SOUND EFFECTS ---

  public playFootstep(isZombie: boolean) {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (isZombie) {
      // Heavier, dragging stomp with low resonance
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(90, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.08);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
    } else {
      // Crisp athletic sneaker squeak / tap
      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.05);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
    }

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  public playLaneSwitch() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(480, t + 0.08);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  public playJump() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(650, t + 0.18);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.19);
  }

  public playSlide() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.22);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.22);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.23);
  }

  public playCoin() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    // Sparkly high dual tone
    osc1.frequency.setValueAtTime(987.77, t); // B5
    osc1.frequency.setValueAtTime(1318.51, t + 0.05); // E6
    osc2.frequency.setValueAtTime(1975.53, t + 0.05); // B6

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.005, t + 0.14);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.15);
    osc2.stop(t + 0.15);
  }

  public playTransformation() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;

    // Dramatic sonic riser + harmonic burst
    const oscRiser = this.ctx.createOscillator();
    const gainRiser = this.ctx.createGain();
    oscRiser.type = 'sawtooth';
    oscRiser.frequency.setValueAtTime(110, t);
    oscRiser.frequency.exponentialRampToValueAtTime(880, t + 0.35);

    gainRiser.gain.setValueAtTime(0.3, t);
    gainRiser.gain.exponentialRampToValueAtTime(0.6, t + 0.3);
    gainRiser.gain.exponentialRampToValueAtTime(0.01, t + 0.7);

    oscRiser.connect(gainRiser);
    gainRiser.connect(this.sfxGain);
    oscRiser.start(t);
    oscRiser.stop(t + 0.7);

    // Cosmic chime burst
    const chord = [523.25, 659.25, 783.99, 1046.5]; // C Major
    chord.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + 0.3 + idx * 0.04);
      g.gain.setValueAtTime(0.25, t + 0.3 + idx * 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.8 + idx * 0.05);

      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t + 0.3 + idx * 0.04);
      osc.stop(t + 0.9);
    });
  }

  public playPowerupCollect() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(330, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.2);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.23);
  }

  public playStumble() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;
    // Low thud + metallic scrape
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.18);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  public playChaserAlert() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;
    // Subway Surfers style high pitch double whistle chirp
    for (let i = 0; i < 2; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const startT = t + i * 0.12;
      osc.frequency.setValueAtTime(1400, startT);
      osc.frequency.linearRampToValueAtTime(1900, startT + 0.08);

      gain.gain.setValueAtTime(0.35, startT);
      gain.gain.exponentialRampToValueAtTime(0.01, startT + 0.09);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(startT);
      osc.stop(startT + 0.1);
    }
  }

  public playSyringeInject() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(500, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.35);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  public playTrainCrash() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;

    // 1. Authentic dual-tone Locomotive Train Horn blare (Eb4 & F#4)
    const hornFrequencies = [311.13, 369.99];
    hornFrequencies.forEach((freq) => {
      const hornOsc = this.ctx!.createOscillator();
      const hornGain = this.ctx!.createGain();
      hornOsc.type = 'sawtooth';
      hornOsc.frequency.setValueAtTime(freq, t);
      hornOsc.frequency.linearRampToValueAtTime(freq * 0.96, t + 0.6);

      hornGain.gain.setValueAtTime(0.35, t);
      hornGain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);

      hornOsc.connect(hornGain);
      hornGain.connect(this.sfxGain!);
      hornOsc.start(t);
      hornOsc.stop(t + 0.6);
    });

    // 2. Heavy metal smash / bumper impact
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.45);

    gain.gain.setValueAtTime(0.85, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.5);

    // 3. Metallic screech & crunch noise
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.55, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

    noise.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.4);
  }

  public playCrash() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;

    // Heavy bass impact
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 0.4);

    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.45);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.45);

    // Crunch noise
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    noise.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.3);
  }

  public playVictory() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;
    const victoryNotes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
    victoryNotes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.1);
      gain.gain.setValueAtTime(0.3, t + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.1 + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + idx * 0.1);
      osc.stop(t + idx * 0.1 + 0.45);
    });
  }
}

export const soundManager = new SoundSystem();
