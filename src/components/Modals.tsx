import React from 'react';
import {
  Play,
  RotateCcw,
  Trophy,
  Skull,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Activity,
  Coins,
  ShieldCheck,
  User,
  Zap,
  Flame,
} from 'lucide-react';
import { GameState, PlayerStats } from '../types';

interface ModalsProps {
  state: GameState;
  stats: PlayerStats;
  onStart: () => void;
  onRestart: () => void;
  onResume: () => void;
  onPrestigeContinue: () => void;
}

export const Modals: React.FC<ModalsProps> = ({
  state,
  stats,
  onStart,
  onRestart,
  onResume,
  onPrestigeContinue,
}) => {
  if (state === 'playing') return null;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
      {/* 1. START MODAL */}
      {state === 'idle' && (
        <div className="w-full max-w-md bg-slate-900/95 border border-emerald-500/40 rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(16,185,129,0.2)] text-center flex flex-col items-center gap-5">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center shadow-inner">
              <Skull className="w-9 h-9 text-emerald-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center text-slate-950 font-black text-xs">
              3D
            </div>
          </div>

          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">
              SUBWAY RUNNER
            </h1>
            <h2 className="text-sm font-extrabold tracking-widest text-emerald-400 uppercase mt-0.5">
              The Zombie Cure Experiment
            </h2>
          </div>

          <p className="text-xs md:text-sm text-slate-300 leading-relaxed max-w-sm">
            You awaken as an infected zombie sprinting through toxic subway tracks.
            Collect <strong className="text-cyan-300">Antidote Syringes</strong> to trigger a dramatic transformation into a stylish human runner and survive towards the <strong className="text-emerald-400">150,000m</strong> extraction goal!
          </p>

          {/* Controls Cheat Sheet */}
          <div className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 flex flex-col gap-2 text-left">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Controls (Keyboard or Touch)
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-200">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono font-bold text-cyan-300">
                  A / ←
                </span>
                <span>Dash Left</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono font-bold text-cyan-300">
                  D / →
                </span>
                <span>Dash Right</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono font-bold text-emerald-400">
                  W / Space
                </span>
                <span>Jump Over</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono font-bold text-amber-400">
                  S / ↓
                </span>
                <span>Slide Under</span>
              </div>
            </div>
          </div>

          <button
            id="start-run-button"
            onClick={onStart}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:opacity-90 active:scale-[0.98] text-slate-950 font-black text-base uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-[0_10px_25px_rgba(16,185,129,0.4)] transition-all cursor-pointer"
          >
            <Play className="w-5 h-5 fill-slate-950" />
            Start Endless Run
          </button>
        </div>
      )}

      {/* 2. GAME OVER / CRASH DETECTED MODAL (DYNAMIC HUMAN vs ZOMBIE) */}
      {state === 'game_over' && (() => {
        const isHuman = stats.characterForm === 'human';

        return (
          <div
            id="crash-modal"
            className={`w-full max-w-md bg-slate-900/95 border ${
              isHuman
                ? 'border-cyan-400/50 shadow-[0_0_60px_rgba(6,182,212,0.35)]'
                : 'border-emerald-500/50 shadow-[0_0_60px_rgba(16,185,129,0.35)]'
            } rounded-3xl p-6 md:p-7 text-center flex flex-col items-center gap-4.5 backdrop-blur-xl`}
          >
            {/* Character Form Badge & Avatar */}
            <div className="relative">
              <div
                className={`w-20 h-20 rounded-3xl flex items-center justify-center border-2 shadow-xl ${
                  isHuman
                    ? 'bg-gradient-to-br from-cyan-500/30 to-blue-600/30 border-cyan-400 text-cyan-300 shadow-[0_0_30px_rgba(6,182,212,0.5)]'
                    : 'bg-gradient-to-br from-emerald-500/30 to-slate-800 border-emerald-400 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.5)]'
                }`}
              >
                {isHuman ? (
                  <User className="w-10 h-10 text-cyan-300 drop-shadow-md" />
                ) : (
                  <Skull className="w-10 h-10 text-emerald-400 drop-shadow-md animate-pulse" />
                )}
              </div>

              {/* Status Pill Badge */}
              <div
                className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase whitespace-nowrap shadow-md border ${
                  isHuman
                    ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                    : 'bg-emerald-500 text-slate-950 border-emerald-300'
                }`}
              >
                {isHuman ? 'Cured Human' : 'Infected Zombie'}
              </div>
            </div>

            {/* Crash Title and Subtext */}
            <div className="mt-1">
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase">
                {isHuman ? 'Human Surfer Downed!' : 'Zombie Runner Crashed!'}
              </h2>
              <p
                className={`text-xs font-bold tracking-wider uppercase mt-1 ${
                  isHuman ? 'text-cyan-300' : 'text-emerald-400'
                }`}
              >
                {isHuman
                  ? 'Cured Human Surfer Form Achieved'
                  : 'Collect 100% Antidote to Cure into Human'}
              </p>
            </div>

            {/* Distance Ribbon (Subway Surfers style) */}
            <div className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex flex-col items-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Run Distance
              </span>
              <span className="text-2xl md:text-3xl font-black text-white font-mono tracking-tight">
                {stats.distance.toLocaleString()} <span className="text-sm text-slate-400 font-sans font-bold">meters</span>
              </span>
            </div>

            {/* Stats Breakdown */}
            <div className="w-full grid grid-cols-3 gap-2.5">
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-2.5 flex flex-col items-center">
                <span className="text-[9px] uppercase font-bold text-slate-400">Score</span>
                <span className="text-base font-black text-amber-400 font-mono">
                  {stats.score.toLocaleString()}
                </span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-2.5 flex flex-col items-center">
                <span className="text-[9px] uppercase font-bold text-slate-400">Coins</span>
                <span className="text-base font-black text-amber-300 font-mono flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  {stats.coins}
                </span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-2.5 flex flex-col items-center">
                <span className="text-[9px] uppercase font-bold text-slate-400">Best</span>
                <span className="text-base font-black text-sky-300 font-mono">
                  {stats.highScore.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <button
              id="play-again-button"
              onClick={onRestart}
              className={`w-full py-3.5 px-6 rounded-2xl font-black text-base uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-lg active:scale-[0.98] ${
                isHuman
                  ? 'bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 text-slate-950 hover:opacity-95 shadow-[0_10px_25px_rgba(6,182,212,0.4)]'
                  : 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500 text-slate-950 hover:opacity-95 shadow-[0_10px_25px_rgba(16,185,129,0.4)]'
              }`}
            >
              <RotateCcw className="w-5 h-5" />
              Run Again
            </button>
          </div>
        );
      })()}

      {/* 3. VICTORY SEQUENCE (150,000m REACHED) */}
      {state === 'victory' && (
        <div className="w-full max-w-md bg-slate-900/95 border border-amber-400/50 rounded-3xl p-6 md:p-8 shadow-[0_0_60px_rgba(251,191,36,0.3)] text-center flex flex-col items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-400/20 border border-amber-400/60 flex items-center justify-center shadow-inner animate-pulse">
            <Trophy className="w-9 h-9 text-amber-300" />
          </div>

          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              150,000m CONQUERED!
            </h2>
            <p className="text-xs text-amber-400 font-bold uppercase tracking-wider mt-1">
              Complete Extraction & Permanent Cure
            </p>
          </div>

          <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
            You successfully survived the full 150,000-meter railway route! The infection has been completely synthesized, unlocking the ultimate <strong className="text-amber-300">Prestige Endless Run</strong>!
          </p>

          <div className="w-full bg-slate-950/80 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Prestige Unlocked</span>
            </div>
            <span className="text-sm font-black font-mono text-amber-300">
              Score: {stats.score.toLocaleString()}
            </span>
          </div>

          <button
            id="prestige-continue-button"
            onClick={onPrestigeContinue}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 hover:opacity-90 active:scale-[0.98] text-slate-950 font-black text-base uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-[0_10px_25px_rgba(251,191,36,0.4)] transition-all cursor-pointer"
          >
            <Sparkles className="w-5 h-5 fill-slate-950" />
            Enter Prestige Endless Run
          </button>
        </div>
      )}

      {/* 4. PAUSE MODAL */}
      {state === 'paused' && (
        <div className="w-full max-w-sm bg-slate-900/95 border border-slate-700 rounded-3xl p-6 text-center flex flex-col items-center gap-5 shadow-2xl">
          <h2 className="text-xl font-black text-white uppercase tracking-wider">
            Game Paused
          </h2>
          <div className="flex flex-col gap-3 w-full">
            <button
              id="resume-button"
              onClick={onResume}
              className="w-full py-3.5 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Play className="w-5 h-5 fill-slate-950" />
              Resume Run
            </button>
            <button
              id="restart-run-button"
              onClick={onRestart}
              className="w-full py-3 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Restart
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const VirtualControls: React.FC<{
  onLeft: () => void;
  onRight: () => void;
  onJump: () => void;
  onSlide: () => void;
}> = ({ onLeft, onRight, onJump, onSlide }) => {
  return (
    <div className="md:hidden absolute bottom-6 inset-x-0 px-6 pointer-events-none flex justify-between items-end select-none">
      {/* Left/Right Buttons */}
      <div className="flex gap-2 pointer-events-auto">
        <button
          id="virtual-left-button"
          onClick={onLeft}
          className="w-14 h-14 rounded-2xl bg-slate-950/70 active:bg-cyan-500/50 border border-slate-700/60 active:border-cyan-400 text-slate-200 flex items-center justify-center shadow-lg active:scale-90 transition-all backdrop-blur-sm"
        >
          <ArrowLeft className="w-7 h-7" />
        </button>
        <button
          id="virtual-right-button"
          onClick={onRight}
          className="w-14 h-14 rounded-2xl bg-slate-950/70 active:bg-cyan-500/50 border border-slate-700/60 active:border-cyan-400 text-slate-200 flex items-center justify-center shadow-lg active:scale-90 transition-all backdrop-blur-sm"
        >
          <ArrowRight className="w-7 h-7" />
        </button>
      </div>

      {/* Jump/Slide Buttons */}
      <div className="flex flex-col gap-2 pointer-events-auto">
        <button
          id="virtual-jump-button"
          onClick={onJump}
          className="w-14 h-14 rounded-2xl bg-slate-950/70 active:bg-emerald-500/50 border border-slate-700/60 active:border-emerald-400 text-emerald-300 flex items-center justify-center shadow-lg active:scale-90 transition-all backdrop-blur-sm"
        >
          <ArrowUp className="w-7 h-7" />
        </button>
        <button
          id="virtual-slide-button"
          onClick={onSlide}
          className="w-14 h-14 rounded-2xl bg-slate-950/70 active:bg-amber-500/50 border border-slate-700/60 active:border-amber-400 text-amber-300 flex items-center justify-center shadow-lg active:scale-90 transition-all backdrop-blur-sm"
        >
          <ArrowDown className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
};
