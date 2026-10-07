import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { FlappyEngine, HEIGHT, WIDTH, type Phase } from './game/engine';
import { sound } from './game/sound';
import { loadBest, saveBest } from './game/storage';
import { GameOverScreen, PausedScreen, ReadyScreen, stopPointer } from './components/Screens';

// Ignore restart input right after dying so a panicked tap doesn't skip the score screen.
const RESTART_DELAY_MS = 600;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FlappyEngine | null>(null);
  const pausedRef = useRef(false);
  const overAtRef = useRef(0);
  const bestRef = useRef(loadBest());

  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(bestRef.current);
  const [isNewBest, setIsNewBest] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(sound.isMuted());

  // Game loop: the engine runs on requestAnimationFrame; React only re-renders on score/phase changes.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;

    const engine = new FlappyEngine({
      onScore: (s) => {
        setScore(s);
        if (s > 0) sound.point();
      },
      onFlap: sound.flap,
      onHit: sound.hit,
      onPhaseChange: (p) => {
        setPhase(p);
        if (p !== 'over') return;
        overAtRef.current = performance.now();
        const final = engine.score;
        const record = final > bestRef.current;
        setIsNewBest(record);
        if (record) {
          bestRef.current = final;
          setBest(final);
          saveBest(final);
        }
      },
    });
    engineRef.current = engine;

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!pausedRef.current) engine.update(dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      engine.render(ctx);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const setPausedState = useCallback((value: boolean) => {
    pausedRef.current = value;
    setPaused(value);
  }, []);

  const flap = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || engine.phase === 'over') return;
    if (pausedRef.current) setPausedState(false);
    else engine.flap();
  }, [setPausedState]);

  const restart = useCallback(() => {
    if (performance.now() - overAtRef.current < RESTART_DELAY_MS) return;
    setIsNewBest(false);
    engineRef.current?.reset();
  }, []);

  const togglePause = useCallback(() => {
    if (engineRef.current?.phase !== 'playing') return;
    setPausedState(!pausedRef.current);
  }, [setPausedState]);

  const toggleMute = useCallback(() => setMuted(sound.toggleMute()), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      switch (e.code) {
        case 'Space':
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          if (engineRef.current?.phase === 'over') restart();
          else flap();
          break;
        case 'KeyP':
        case 'Escape':
          togglePause();
          break;
        case 'KeyM':
          toggleMute();
          break;
      }
    };
    // Auto-pause when the tab is hidden so you don't die while away.
    const onVisibility = () => {
      if (document.hidden && engineRef.current?.phase === 'playing') setPausedState(true);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [flap, restart, togglePause, toggleMute, setPausedState]);

  const onStagePointer = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    flap();
  };

  return (
    <main className="app">
      <div className="stage" onPointerDown={onStagePointer}>
        <canvas ref={canvasRef} className="canvas" />

        <div className="hud">
          {phase === 'playing' && (
            <div key={score} className="score">
              {score}
            </div>
          )}
          <div className="controls" onPointerDown={stopPointer}>
            {phase === 'playing' && (
              <button className="icon-btn" onClick={togglePause} aria-label={paused ? 'Resume' : 'Pause'}>
                {paused ? '▶' : '❚❚'}
              </button>
            )}
            <button className="icon-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
              {muted ? '🔇' : '🔊'}
            </button>
          </div>
        </div>

        {phase === 'ready' && <ReadyScreen best={best} />}
        {phase === 'over' && (
          <GameOverScreen score={score} best={best} isNewBest={isNewBest} onRestart={restart} />
        )}
        {paused && <PausedScreen />}
      </div>
      <p className="help">Space / Click / Tap to flap · P to pause · M to mute</p>
    </main>
  );
}
