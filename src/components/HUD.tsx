import React from 'react';
import {
  Zap,
  Magnet,
  Footprints,
  Rocket,
  Coins,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Gauge,
  Sparkles,
} from 'lucide-react';
import { PlayerStats, PowerUpState } from '../types';

interface HUDProps {
  stats: PlayerStats;
  powerUps: Record<string, PowerUpState>;
  isMuted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  isPaused: boolean;
  onResume: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  stats,
  powerUps,
  isMuted,
  onToggleMute,
  onPause,
  isPaused,
  onResume,
}) => {
  const distancePct = Math.min(100, (stats.distance / stats.targetDistance) * 100);
  const isHuman = stats.cureMeter >= 100;

  return (
    <div className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between p-4 md:p-6 overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex items-start justify-between gap-3 w-full">
        {/* Left: Score & Coins */}
        <div className="flex flex-col gap-2">
          <div className="bg-slate-950/80 backdrop-blur-md border border-slate-700/60 rounded-xl px-4 py-2 flex items-center gap-3 shadow-lg">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Score</span>
              <span className="text-2xl font-black text-amber-400 font-mono tracking-tight">
                {stats.score.toLocaleString()}
              </span>
            </div>
            {stats.highScore > 0 && (
              <div className="pl-3 border-l border-slate-700/60 flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">High</span>
                <span className="text-sm font-bold text-slate-300 font-mono">
                  {stats.highScore.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-950/80 backdrop-blur-md border border-amber-500/40 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-md">
              <Coins className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
              <span className="text-base font-extrabold text-amber-300 font-mono">
                {stats.coins}
              </span>
            </div>

            <div className="bg-slate-950/80 backdrop-blur-md border border-sky-500/40 rounded-xl px-3 py-1.5 flex items-center gap-1.5 shadow-md">
              <Gauge className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-xs font-bold text-sky-200 font-mono">
                {stats.speed} km/h
              </span>
            </div>
          </div>
        </div>

        {/* Center: Distance Progress toward 150,000m and Cure Status */}
        <div className="flex flex-col items-center flex-1 max-w-[200px] sm:max-w-sm px-1 sm:px-4">
          <div className="w-full bg-slate-950/80 backdrop-blur-md border border-slate-700/60 rounded-xl p-2 sm:p-2.5 shadow-lg flex flex-col gap-1 sm:gap-1.5">
            <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold">
              <span className="text-emerald-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
                Goal: 150km
              </span>
              <span className="font-mono text-slate-200">
                {stats.distance.toLocaleString()}m ({distancePct.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full h-2 sm:h-2.5 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/50 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isHuman
                    ? 'bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-500 shadow-[0_0_12px_rgba(56,189,248,0.8)]'
                    : 'bg-gradient-to-r from-emerald-500 to-lime-400'
                }`}
                style={{ width: `${Math.max(1, distancePct)}%` }}
              />
            </div>

            {/* Cure / Infection Progress Indicator in Top HUD */}
            <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold mt-0.5 pt-1 border-t border-slate-800/60">
              <span className={isHuman ? 'text-cyan-300 flex items-center gap-1' : 'text-lime-400 flex items-center gap-1'}>
                <span className={`w-1.5 h-1.5 rounded-full ${isHuman ? 'bg-cyan-400' : 'bg-lime-400'}`} />
                {isHuman ? 'Cured' : 'Infected'}
              </span>
              <span className={`font-mono ${isHuman ? 'text-cyan-300' : 'text-lime-400'}`}>
                {stats.cureMeter}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/40 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isHuman
                    ? 'bg-gradient-to-r from-sky-400 to-cyan-300'
                    : 'bg-gradient-to-r from-emerald-600 to-lime-400'
                }`}
                style={{ width: `${stats.cureMeter}%` }}
              />
            </div>

            {stats.prestigeMode && (
              <span className="text-[9px] text-center font-bold text-amber-300 uppercase tracking-widest">
                PRESTIGE RUN ACTIVE
              </span>
            )}
          </div>
        </div>

        {/* Right: Sound & Pause Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            id="toggle-mute-button"
            onClick={onToggleMute}
            className="w-10 h-10 rounded-xl bg-slate-950/80 hover:bg-slate-800/80 active:scale-95 border border-slate-700/60 text-slate-200 flex items-center justify-center transition-all shadow-md cursor-pointer"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
          </button>
          <button
            id="pause-button"
            onClick={isPaused ? onResume : onPause}
            className="w-10 h-10 rounded-xl bg-slate-950/80 hover:bg-slate-800/80 active:scale-95 border border-slate-700/60 text-slate-200 flex items-center justify-center transition-all shadow-md cursor-pointer"
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play className="w-5 h-5 text-amber-400 fill-amber-400" /> : <Pause className="w-5 h-5 text-slate-300" />}
          </button>
        </div>
      </div>

      {/* Chaser Close Alert (Subway Surfers Inspector Alert) */}
      {stats.chaserClose && (
        <div className="self-center bg-rose-950/90 backdrop-blur-md border border-rose-500/70 text-rose-200 px-4 py-1.5 rounded-full flex items-center gap-2 shadow-[0_0_20px_rgba(244,63,94,0.6)] animate-bounce pointer-events-none">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
          <span className="text-xs font-black uppercase tracking-wider text-rose-200">
            ⚠️ 3 DOCTORS & HOUND IN PURSUIT! AVOID STUMBLING!
          </span>
        </div>
      )}

      {/* Bottom Area: Active Power-Ups */}
      <div className="flex flex-col gap-3">
        {/* Active Power-up Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {powerUps.jetpack.active && (
            <div className="bg-slate-950/90 backdrop-blur-md border border-orange-500/60 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-lg animate-pulse">
              <Rocket className="w-4 h-4 text-orange-400" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-orange-300 uppercase">Jetpack</span>
                <span className="text-xs font-mono font-extrabold text-orange-200">
                  {powerUps.jetpack.timeLeft.toFixed(1)}s
                </span>
              </div>
            </div>
          )}

          {powerUps.sneakers.active && (
            <div className="bg-slate-950/90 backdrop-blur-md border border-yellow-500/60 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-lg animate-pulse">
              <Footprints className="w-4 h-4 text-yellow-400" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-yellow-300 uppercase">Super Sneakers</span>
                <span className="text-xs font-mono font-extrabold text-yellow-200">
                  {powerUps.sneakers.timeLeft.toFixed(1)}s
                </span>
              </div>
            </div>
          )}

          {powerUps.magnet.active && (
            <div className="bg-slate-950/90 backdrop-blur-md border border-red-500/60 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-lg animate-pulse">
              <Magnet className="w-4 h-4 text-rose-400" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-rose-300 uppercase">Coin Magnet</span>
                <span className="text-xs font-mono font-extrabold text-rose-200">
                  {powerUps.magnet.timeLeft.toFixed(1)}s
                </span>
              </div>
            </div>
          )}

          {powerUps.multiplier.active && (
            <div className="bg-slate-950/90 backdrop-blur-md border border-purple-500/60 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-lg animate-pulse">
              <Zap className="w-4 h-4 text-purple-400" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-purple-300 uppercase">2X Boost</span>
                <span className="text-xs font-mono font-extrabold text-purple-200">
                  {powerUps.multiplier.timeLeft.toFixed(1)}s
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
