export type GameState = 'idle' | 'playing' | 'paused' | 'game_over' | 'victory';

export type CharacterForm = 'zombie' | 'human';

export type Lane = -1 | 0 | 1;

export enum ObstacleType {
  TRAIN = 'TRAIN',
  BARRICADE_LOW = 'BARRICADE_LOW',
  BARRIER_HIGH = 'BARRIER_HIGH',
  INFECTED_SLUDGE = 'INFECTED_SLUDGE',
  LASER_GATE = 'LASER_GATE',
  CRANE = 'CRANE',
}

export enum CollectibleType {
  COIN = 'COIN',
  ANTIDOTE = 'ANTIDOTE',
  JETPACK = 'JETPACK',
  SNEAKERS = 'SNEAKERS',
  MAGNET = 'MAGNET',
  MULTIPLIER = 'MULTIPLIER',
}

export interface PowerUpState {
  active: boolean;
  timeLeft: number;
  duration: number;
}

export interface PlayerStats {
  distance: number;
  score: number;
  coins: number;
  highScore: number;
  speed: number;
  cureMeter: number; // 0 to 100
  targetDistance: number; // 150,000m
  prestigeMode: boolean;
  characterForm: CharacterForm;
  chaserClose: boolean;
}

export interface AudioSettings {
  muted: boolean;
  musicVolume: number;
  sfxVolume: number;
}
