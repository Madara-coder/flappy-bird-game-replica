// Tiny synthesized sound effects via the Web Audio API — no audio files needed.
const MUTE_KEY = 'flappy-muted';

let ctx: AudioContext | null = null;
let muted = readMuted();

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function audio(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(from: number, to: number, duration: number, type: OscillatorType, volume: number, delay = 0) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + duration);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

export const sound = {
  flap: () => tone(380, 640, 0.1, 'triangle', 0.15),
  point: () => {
    tone(988, 988, 0.08, 'square', 0.06);
    tone(1319, 1319, 0.16, 'square', 0.06, 0.08);
  },
  hit: () => tone(300, 60, 0.35, 'sawtooth', 0.12),
  isMuted: () => muted,
  toggleMute: () => {
    muted = !muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      // storage unavailable (private mode) — mute still works for this session
    }
    return muted;
  },
};
