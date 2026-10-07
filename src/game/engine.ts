export type Phase = 'ready' | 'playing' | 'over';

// Logical canvas size; the canvas is scaled to fit the screen.
export const WIDTH = 400;
export const HEIGHT = 600;
const GROUND_H = 90;
const PLAY_H = HEIGHT - GROUND_H;

// Bird physics (pixels / seconds)
const GRAVITY = 1500;
const FLAP_VELOCITY = -430;
const MAX_FALL_SPEED = 720;
const BIRD_X = 120;
const BIRD_R = 14;
const HITBOX_R = 12; // a little smaller than the sprite so near-misses feel fair

// Pipes
const PIPE_W = 66;
const CAP_H = 26;
const CAP_OVERHANG = 4;
const PIPE_SPACING = 210;
const EDGE_MARGIN = 60;
const MAX_GAP_SHIFT = 170;

// Difficulty ramps up with score
const BASE_SPEED = 150;
const MAX_SPEED = 230;
const BASE_GAP = 165;
const MIN_GAP = 125;

interface Pipe {
  x: number;
  gapY: number;
  gap: number;
  passed: boolean;
}

interface Cloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
}

export interface EngineEvents {
  onScore: (score: number) => void;
  onPhaseChange: (phase: Phase) => void;
  onFlap?: () => void;
  onHit?: () => void;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function circleHitsRect(cx: number, cy: number, r: number, x: number, y: number, w: number, h: number) {
  const dx = cx - clamp(cx, x, x + w);
  const dy = cy - clamp(cy, y, y + h);
  return dx * dx + dy * dy < r * r;
}

export class FlappyEngine {
  phase: Phase = 'ready';
  score = 0;

  private birdY = PLAY_H / 2;
  private velocity = 0;
  private rotation = 0;
  private wingPhase = 0;
  private time = 0;
  private distance = 0; // total scrolled distance, drives ground + hills
  private pipes: Pipe[] = [];
  private clouds: Cloud[];
  private flash = 0;
  private shake = 0;
  private readonly events: EngineEvents;

  constructor(events: EngineEvents) {
    this.events = events;
    this.clouds = Array.from({ length: 5 }, (_, i) => ({
      x: i * 100 + Math.random() * 60,
      y: 40 + Math.random() * 180,
      scale: 0.6 + Math.random() * 0.7,
      speed: 8 + Math.random() * 14,
    }));
  }

  reset() {
    this.score = 0;
    this.birdY = PLAY_H / 2;
    this.velocity = 0;
    this.rotation = 0;
    this.pipes = [];
    this.flash = 0;
    this.shake = 0;
    this.events.onScore(0);
    this.setPhase('ready');
  }

  flap() {
    if (this.phase === 'over') return;
    if (this.phase === 'ready') this.setPhase('playing');
    this.velocity = FLAP_VELOCITY;
    this.events.onFlap?.();
  }

  private setPhase(phase: Phase) {
    this.phase = phase;
    this.events.onPhaseChange(phase);
  }

  private get speed() {
    return Math.min(MAX_SPEED, BASE_SPEED + this.score * 2.5);
  }

  private get gapSize() {
    return Math.max(MIN_GAP, BASE_GAP - this.score * 1.5);
  }

  update(rawDt: number) {
    // Clamp dt so a lag spike / tab switch can't teleport the bird through a pipe.
    const dt = Math.min(rawDt, 1 / 30);
    this.time += dt;
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.shake = Math.max(0, this.shake - dt);

    for (const c of this.clouds) {
      c.x -= c.speed * dt * (this.phase === 'over' ? 0.3 : 1);
      if (c.x < -80 * c.scale) {
        c.x = WIDTH + 60;
        c.y = 40 + Math.random() * 180;
      }
    }

    if (this.phase !== 'over') {
      this.distance += this.speed * dt;
      this.wingPhase += dt * 16;
    }

    if (this.phase === 'ready') {
      this.birdY = PLAY_H / 2 + Math.sin(this.time * 3) * 8;
      this.rotation = 0;
      return;
    }

    const grounded = this.birdY + BIRD_R >= PLAY_H;
    if (this.phase === 'over' && grounded) return;

    this.velocity = Math.min(this.velocity + GRAVITY * dt, MAX_FALL_SPEED);
    this.birdY += this.velocity * dt;
    const targetRotation =
      this.velocity < 0 ? -0.45 : Math.min(Math.PI / 2, (this.velocity / MAX_FALL_SPEED) * 1.6);
    this.rotation += (targetRotation - this.rotation) * Math.min(1, dt * 10);

    if (this.birdY - BIRD_R < 0) {
      this.birdY = BIRD_R;
      this.velocity = 0;
    }

    if (this.birdY + BIRD_R >= PLAY_H) {
      this.birdY = PLAY_H - BIRD_R;
      this.velocity = 0;
      this.rotation = Math.PI / 2;
      if (this.phase === 'playing') this.die();
      return;
    }

    if (this.phase === 'playing') this.updatePipes(dt);
  }

  private updatePipes(dt: number) {
    const dx = this.speed * dt;
    for (const p of this.pipes) p.x -= dx;
    this.pipes = this.pipes.filter((p) => p.x + PIPE_W + CAP_OVERHANG > 0);

    const last = this.pipes[this.pipes.length - 1];
    if (!last) this.spawnPipe(WIDTH + 40);
    else if (last.x <= WIDTH - PIPE_SPACING) this.spawnPipe(last.x + PIPE_SPACING, last);

    for (const p of this.pipes) {
      if (!p.passed && p.x + PIPE_W / 2 < BIRD_X) {
        p.passed = true;
        this.score++;
        this.events.onScore(this.score);
      }
      if (this.hitsPipe(p)) {
        this.die();
        return;
      }
    }
  }

  private spawnPipe(x: number, prev?: Pipe) {
    const gap = this.gapSize;
    const min = EDGE_MARGIN + gap / 2;
    const max = PLAY_H - EDGE_MARGIN - gap / 2;
    let gapY = min + Math.random() * (max - min);
    // Keep consecutive gaps reachable.
    if (prev) gapY = clamp(gapY, prev.gapY - MAX_GAP_SHIFT, prev.gapY + MAX_GAP_SHIFT);
    this.pipes.push({ x, gapY, gap, passed: false });
  }

  private hitsPipe(p: Pipe) {
    const top = p.gapY - p.gap / 2;
    const bottom = p.gapY + p.gap / 2;
    const capX = p.x - CAP_OVERHANG;
    const capW = PIPE_W + CAP_OVERHANG * 2;
    const rects: [number, number, number, number][] = [
      [p.x, 0, PIPE_W, top],
      [capX, top - CAP_H, capW, CAP_H],
      [p.x, bottom, PIPE_W, PLAY_H - bottom],
      [capX, bottom, capW, CAP_H],
    ];
    return rects.some(([x, y, w, h]) => circleHitsRect(BIRD_X, this.birdY, HITBOX_R, x, y, w, h));
  }

  private die() {
    this.flash = 1;
    this.shake = 0.35;
    this.events.onHit?.();
    this.setPhase('over');
  }

  // ---------------------------------------------------------------- rendering

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    if (this.shake > 0) {
      const m = this.shake * 14;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    this.drawSky(ctx);
    this.drawClouds(ctx);
    this.drawHills(ctx, this.distance * 0.15, PLAY_H - 70, 30, 0.012, '#9bd8b0');
    this.drawHills(ctx, this.distance * 0.35, PLAY_H - 25, 22, 0.02, '#6cc47e');
    for (const p of this.pipes) this.drawPipePair(ctx, p);
    this.drawGround(ctx);
    this.drawBird(ctx);
    ctx.restore();

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.flash})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
  }

  private drawSky(ctx: CanvasRenderingContext2D) {
    const sky = ctx.createLinearGradient(0, 0, 0, PLAY_H);
    sky.addColorStop(0, '#4fc3f7');
    sky.addColorStop(0.6, '#a5e4ff');
    sky.addColorStop(1, '#fff3d6');
    ctx.fillStyle = sky;
    ctx.fillRect(-20, -20, WIDTH + 40, HEIGHT + 40);

    const sx = 310;
    const sy = 120;
    const glow = ctx.createRadialGradient(sx, sy, 10, sx, sy, 90);
    glow.addColorStop(0, 'rgba(255, 240, 180, 0.9)');
    glow.addColorStop(1, 'rgba(255, 240, 180, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6c9';
    ctx.beginPath();
    ctx.arc(sx, sy, 30, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawClouds(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (const { x, y, scale: s } of this.clouds) {
      ctx.beginPath();
      ctx.arc(x, y, 20 * s, 0, Math.PI * 2);
      ctx.arc(x + 22 * s, y - 10 * s, 26 * s, 0, Math.PI * 2);
      ctx.arc(x + 46 * s, y, 20 * s, 0, Math.PI * 2);
      ctx.arc(x + 24 * s, y + 6 * s, 20 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawHills(
    ctx: CanvasRenderingContext2D,
    offset: number,
    base: number,
    amp: number,
    freq: number,
    color: string,
  ) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-20, PLAY_H);
    for (let x = -20; x <= WIDTH + 20; x += 10) {
      const t = (x + offset) * freq;
      ctx.lineTo(x, base - (Math.sin(t) * amp + Math.sin(t * 2.3 + 1) * amp * 0.4));
    }
    ctx.lineTo(WIDTH + 20, PLAY_H);
    ctx.closePath();
    ctx.fill();
  }

  private drawPipePair(ctx: CanvasRenderingContext2D, p: Pipe) {
    const top = p.gapY - p.gap / 2;
    const bottom = p.gapY + p.gap / 2;
    const fill = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
    fill.addColorStop(0, '#4caf2e');
    fill.addColorStop(0.35, '#9be15d');
    fill.addColorStop(1, '#2e7d1a');
    ctx.fillStyle = fill;
    ctx.strokeStyle = '#1f4d12';
    ctx.lineWidth = 3;

    this.drawPipe(ctx, p.x, -10, top + 10, top - CAP_H);
    this.drawPipe(ctx, p.x, bottom, PLAY_H - bottom + 10, bottom);
  }

  private drawPipe(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, capY: number) {
    ctx.fillRect(x, y, PIPE_W, h);
    ctx.strokeRect(x, y, PIPE_W, h);
    ctx.beginPath();
    ctx.roundRect(x - CAP_OVERHANG, capY, PIPE_W + CAP_OVERHANG * 2, CAP_H, 6);
    ctx.fill();
    ctx.stroke();
  }

  private drawGround(ctx: CanvasRenderingContext2D) {
    const y = PLAY_H;
    ctx.fillStyle = '#ded895';
    ctx.fillRect(-20, y, WIDTH + 40, GROUND_H + 20);
    ctx.fillStyle = '#c9c27d';
    ctx.fillRect(-20, y + 19, WIDTH + 40, 4);

    // Scrolling striped grass strip
    ctx.fillStyle = '#73bf2e';
    ctx.fillRect(-20, y, WIDTH + 40, 16);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-20, y, WIDTH + 40, 16);
    ctx.clip();
    ctx.fillStyle = '#8fd94a';
    const offset = -(this.distance % 24);
    for (let x = offset - 24; x < WIDTH + 24; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, y + 16);
      ctx.lineTo(x + 12, y);
      ctx.lineTo(x + 24, y);
      ctx.lineTo(x + 12, y + 16);
      ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = '#3d6e16';
    ctx.fillRect(-20, y, WIDTH + 40, 2);
    ctx.fillStyle = '#5a9e22';
    ctx.fillRect(-20, y + 16, WIDTH + 40, 3);
  }

  private drawBird(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(BIRD_X, this.birdY);
    ctx.rotate(this.rotation);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#4a3200';

    // Body
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.ellipse(0, 0, BIRD_R + 3, BIRD_R, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Belly
    ctx.fillStyle = '#fff1b8';
    ctx.beginPath();
    ctx.ellipse(2, 6, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wing
    const flapY = this.phase === 'over' ? 0 : Math.sin(this.wingPhase) * 4;
    ctx.fillStyle = '#fff7d6';
    ctx.beginPath();
    ctx.ellipse(-6, 1 + flapY, 8, 5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(7, -5, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(9, -5, 2.6, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#ff7b29';
    ctx.beginPath();
    ctx.moveTo(12, -1);
    ctx.lineTo(25, 3);
    ctx.lineTo(12, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}
