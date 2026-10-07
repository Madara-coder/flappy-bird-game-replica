import type { PointerEvent } from 'react';
import { medalFor } from '../game/medals';

// Stop taps on buttons from also triggering a flap on the stage underneath.
const stopPointer = (e: PointerEvent) => e.stopPropagation();

export function ReadyScreen({ best }: { best: number }) {
  return (
    <div className="screen ready">
      <h1 className="title">
        Flappy<span>Bird</span>
      </h1>
      <div className="ready-bottom">
        <div className="tap-hint">👆 Tap to flap</div>
        {best > 0 && <div className="chip">🏆 Best: {best}</div>}
      </div>
    </div>
  );
}

interface GameOverProps {
  score: number;
  best: number;
  isNewBest: boolean;
  onRestart: () => void;
}

export function GameOverScreen({ score, best, isNewBest, onRestart }: GameOverProps) {
  const medal = medalFor(score);
  return (
    <div className="screen over">
      <h2 className="title">Game Over</h2>
      <div className="card">
        <div className="medal-slot">
          <div className={`medal ${medal ? `medal-${medal.id}` : 'empty'}`}>{medal && '★'}</div>
          <small>{medal?.label ?? 'No medal'}</small>
        </div>
        <div className="stats">
          <div className="stat">
            <span className="stat-label">Score</span>
            <strong>{score}</strong>
          </div>
          <div className="stat">
            <span className="stat-label">
              {isNewBest && <em className="new">NEW</em>}Best
            </span>
            <strong>{best}</strong>
          </div>
        </div>
      </div>
      <button className="btn" onPointerDown={stopPointer} onClick={onRestart} autoFocus>
        ▶ Play again
      </button>
    </div>
  );
}

export function PausedScreen() {
  return (
    <div className="screen paused">
      <h2 className="title">Paused</h2>
      <div className="tap-hint">Tap or press P to resume</div>
    </div>
  );
}

export { stopPointer };
