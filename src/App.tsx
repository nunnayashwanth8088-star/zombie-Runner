import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/engine';
import { soundManager } from './game/audio';
import { GameState, PlayerStats, PowerUpState } from './types';
import { HUD } from './components/HUD';
import { Modals, VirtualControls } from './components/Modals';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [gameState, setGameState] = useState<GameState>('idle');
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const [stats, setStats] = useState<PlayerStats>({
    distance: 0,
    score: 0,
    coins: 0,
    highScore: 0,
    speed: 41,
    cureMeter: 25,
    targetDistance: 150000,
    prestigeMode: false,
    characterForm: 'zombie',
    chaserClose: false,
  });

  const [powerUps, setPowerUps] = useState<Record<string, PowerUpState>>({
    jetpack: { active: false, timeLeft: 0, duration: 10 },
    sneakers: { active: false, timeLeft: 0, duration: 12 },
    magnet: { active: false, timeLeft: 0, duration: 14 },
    multiplier: { active: false, timeLeft: 0, duration: 15 },
  });

  // Touch Swipe tracking
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize 3D Engine
    const engine = new GameEngine(containerRef.current, {
      onStatsUpdate: (newStats) => setStats(newStats),
      onPowerUpsUpdate: (newPowerups) => setPowerUps(newPowerups),
      onStateChange: (newState) => setGameState(newState),
      onVictory: () => setGameState('victory'),
    });
    engineRef.current = engine;

    // Keyboard controls
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default scrolling for arrows and space
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (engine.state === 'playing') {
          engine.pauseGame();
        } else if (engine.state === 'paused') {
          engine.resumeGame();
        }
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        engine.onSwipeLeft();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        engine.onSwipeRight();
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
        engine.onSwipeUp();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        engine.onSwipeDown();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Touch / Swipe event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      touchStartPos.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartPos.current || !engineRef.current || e.changedTouches.length === 0) return;

    const dx = e.changedTouches[0].clientX - touchStartPos.current.x;
    const dy = e.changedTouches[0].clientY - touchStartPos.current.y;
    const minSwipeDist = 25;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > minSwipeDist) {
        engineRef.current.onSwipeRight();
      } else if (dx < -minSwipeDist) {
        engineRef.current.onSwipeLeft();
      }
    } else {
      if (dy < -minSwipeDist) {
        engineRef.current.onSwipeUp();
      } else if (dy > minSwipeDist) {
        engineRef.current.onSwipeDown();
      }
    }

    touchStartPos.current = null;
  };

  // Sound toggle
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    soundManager.setMuted(nextMuted);
  };

  // Game actions
  const handleStart = () => {
    engineRef.current?.startGame();
  };

  const handleRestart = () => {
    engineRef.current?.restartGame();
  };

  const handlePause = () => {
    engineRef.current?.pauseGame();
  };

  const handleResume = () => {
    engineRef.current?.resumeGame();
  };

  const handlePrestigeContinue = () => {
    engineRef.current?.continuePrestigeRun();
  };

  return (
    <main
      id="game-canvas-root"
      className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none touch-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Real-time 3D HUD (Distance meter, Cure bar, Power-up badges, etc.) */}
      <HUD
        stats={stats}
        powerUps={powerUps}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onPause={handlePause}
        isPaused={gameState === 'paused'}
        onResume={handleResume}
      />

      {/* Virtual Controls for touch & mobile */}
      {gameState === 'playing' && (
        <VirtualControls
          onLeft={() => engineRef.current?.onSwipeLeft()}
          onRight={() => engineRef.current?.onSwipeRight()}
          onJump={() => engineRef.current?.onSwipeUp()}
          onSlide={() => engineRef.current?.onSwipeDown()}
        />
      )}

      {/* Modals: Start Screen, Game Over, Victory 150,000m, Pause */}
      <Modals
        state={gameState}
        stats={stats}
        onStart={handleStart}
        onRestart={handleRestart}
        onResume={handleResume}
        onPrestigeContinue={handlePrestigeContinue}
      />
    </main>
  );
}
