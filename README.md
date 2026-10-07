# 🐤 Flappy Bird

A Flappy Bird clone that runs in the browser, built with **React**, **TypeScript** and **HTML5 Canvas**.

Tap to keep the bird in the air and fly it through the gaps between the pipes. Each pipe you pass is worth one point. Touching a pipe or the ground ends the game.

## Features

- **Scoring:** +1 for each pipe passed. Your best score is saved in the browser, and a "NEW" badge appears when you beat it.
- **Medals:** Bronze (10), Silver (20), Gold (30) and Platinum (40).
- **Increasing difficulty:** the pipes speed up and the gaps get smaller as your score goes up.
- **Sound effects:** generated in code with the Web Audio API, so there are no audio files.
- **Polish:** the bird tilts and flaps, the background scrolls at several speeds, and the screen shakes and flashes when you crash.
- **Pause and mute:** the game also pauses itself when you switch tabs.
- **Works on desktop and mobile:** it scales to any screen and stays sharp on high-resolution displays.

## Controls

| Action        | Keyboard               | Mouse / Touch        |
| ------------- | ---------------------- | -------------------- |
| Flap / Start  | `Space`, `↑` or `W`    | Click / Tap          |
| Restart       | `Space`                | "Play again" button  |
| Pause / Resume| `P` or `Esc`           | ❚❚ button            |
| Mute / Unmute | `M`                    | 🔊 button            |

## How to run

### Prerequisites

- [Node.js](https://nodejs.org/) version 20 or newer (check with `node -v`)
- npm, which comes with Node.js

### 1. Install dependencies (first time only)

```bash
npm install
```

### 2. Start the development server

```bash
npm run dev
```

Open the link it prints (usually **http://localhost:5173**) in your browser. The page reloads automatically when you save a code change. Press `Ctrl + C` in the terminal to stop the server.

### Play on your phone

Your phone and computer must be on the same Wi-Fi network.

```bash
npm run dev -- --host
```

Open the **Network** URL it prints (for example `http://192.168.1.5:5173`) in your phone's browser.

### Production build

```bash
npm run build     # type-checks and builds into the dist/ folder
npm run preview   # serves the built version locally to test it
```

The `dist/` folder is a static website. You can host it on Vercel, Netlify, GitHub Pages or any static host.

## Tech stack

| Technology | What it does here |
| --- | --- |
| **React 19** | Shows the menus, score, game-over card and buttons |
| **TypeScript** | Adds types to the JavaScript so mistakes are caught before the game runs |
| **Vite** | Runs the dev server with instant reload and builds the production version |
| **HTML5 Canvas 2D** | Draws the bird, pipes, sky, clouds, hills and ground every frame |
| **Web Audio API** | Generates the flap, point and crash sounds |
| **localStorage** | Saves the best score and the mute setting between visits |
| **CSS container query units (`cqw`)** | Scale the on-screen text and buttons with the size of the game area |

## Project structure

```
flappy-bird-dupli/
├── index.html               # Page shell, loads the font and the app
├── package.json             # Dependencies and npm scripts
├── tsconfig.json            # TypeScript settings
├── vite.config.ts           # Vite settings (React plugin)
└── src/
    ├── main.tsx             # Entry point: renders <App /> into the page
    ├── App.tsx              # Game loop, input handling, game state
    ├── styles.css           # All styling and animations
    ├── vite-env.d.ts        # Type declarations for Vite (e.g. CSS imports)
    ├── components/
    │   └── Screens.tsx      # Start, Game Over and Paused screens
    └── game/
        ├── engine.ts        # Game logic and drawing (no React)
        ├── sound.ts         # Sound effects via Web Audio
        ├── storage.ts       # Load/save best score
        └── medals.ts        # Which medal a score earns
```

## How the code works

### React and the game engine are kept separate

The game logic is not written in React. If React re-rendered 60 times a second the game would stutter, so the work is split:

- **`engine.ts`** is a plain TypeScript class (`FlappyEngine`). It moves the bird and pipes, checks for collisions and draws each frame on the canvas.
- **React (`App.tsx`)** shows the menus and score. It only re-renders when something the player sees in the menus changes: the score goes up, or the game moves between the start, playing and game-over states.

The engine reports those changes to React through callbacks (`onScore`, `onPhaseChange`, `onFlap`, `onHit`).

### The game loop (`App.tsx`)

```ts
const frame = (now: number) => {
  const dt = (now - last) / 1000;      // seconds since the last frame
  last = now;
  if (!paused) engine.update(dt);       // move everything
  engine.render(ctx);                   // draw everything
  requestAnimationFrame(frame);         // schedule the next frame
};
```

`requestAnimationFrame` asks the browser to run `frame` before each screen refresh, usually 60 times a second. All movement is multiplied by `dt` (the time since the last frame), so the game runs at the same speed on a 60 Hz or a 120 Hz screen.

### Game states

The game is always in one of three states (`Phase`):

```
ready ──(first flap)──▶ playing ──(hit pipe/ground)──▶ over ──(Play again)──▶ ready
```

- **ready:** the bird bobs in place and the start screen is shown.
- **playing:** gravity is on, pipes appear, and scoring and collisions are active.
- **over:** the bird falls to the ground and the score card with a medal is shown.

### Physics (`engine.ts` → `update`)

Each frame:

1. Gravity adds to the bird's speed: `velocity += GRAVITY * dt`
2. The speed moves the bird: `birdY += velocity * dt`
3. A flap sets the speed to a fixed upward value (`FLAP_VELOCITY`), which gives the classic jump.
4. The bird's tilt follows its speed, so it points up when rising and down when falling.

`dt` is capped at 1/30 of a second. Without the cap, a lag spike could move the bird far enough in one frame to pass straight through a pipe.

### Pipes and scoring

- A new pipe is added each time the last one has moved `PIPE_SPACING` pixels to the left.
- The gap position is random, but it can't be more than `MAX_GAP_SHIFT` pixels above or below the previous gap, so every gap can be reached.
- When the bird passes the middle of a pipe, the score goes up by 1.
- Pipes that have scrolled off the left edge are removed.

### Collision detection

The bird is treated as a **circle**, and each pipe as four **rectangles** (the top and bottom pipe bodies and their caps). The check finds the point on the rectangle closest to the circle's centre and measures its distance from the centre. If that distance is less than the radius, the bird has hit the pipe.

```ts
const dx = cx - clamp(cx, x, x + w);
const dy = cy - clamp(cy, y, y + h);
return dx * dx + dy * dy < r * r;
```

The collision circle (`HITBOX_R`) is slightly smaller than the drawn bird, so close passes count as misses. This makes the game feel fairer.

### Drawing (`engine.ts` → `render`)

Everything is drawn with Canvas shapes, with no image files. Layers are drawn back to front:

1. Sky gradient and sun
2. Clouds, which drift slowly
3. Two layers of hills made from sine waves. They scroll at 15% and 35% of the pipe speed, which creates a sense of depth (parallax).
4. Pipes, with a gradient for a rounded look
5. Ground with scrolling grass stripes
6. The bird: ellipses for the body, belly and flapping wing, circles for the eye and a triangle for the beak

The canvas is drawn at a fixed **400 × 600** size and scaled to fit the screen. Its pixel size is multiplied by `devicePixelRatio` so it stays sharp on high-resolution screens.

### Sound (`sound.ts`)

Each sound is a short tone from an `OscillatorNode` whose pitch and volume change quickly:

- **Flap:** a quick rise in pitch
- **Point:** two rising notes ("ding-ding")
- **Hit:** a falling buzz

Browsers only allow audio to start after the user has interacted with the page, so the `AudioContext` is created on the first flap.

### Saving data (`storage.ts`)

The best score and mute setting are saved in `localStorage`. Every read and write is wrapped in `try/catch`, so the game still works where storage is blocked, such as some private browsing modes.

## Adjusting the gameplay

All gameplay values are constants at the top of [`src/game/engine.ts`](src/game/engine.ts):

| Constant | Default | Effect |
| --- | --- | --- |
| `GRAVITY` | `1500` | Higher means the bird falls faster |
| `FLAP_VELOCITY` | `-430` | More negative means a stronger flap |
| `BASE_GAP` / `MIN_GAP` | `165` / `125` | Starting and smallest gap between pipes |
| `BASE_SPEED` / `MAX_SPEED` | `150` / `230` | Starting and top pipe speed |
| `PIPE_SPACING` | `210` | Horizontal distance between pipes |
| `HITBOX_R` | `12` | Bigger means a stricter collision check |

Medal thresholds are in [`src/game/medals.ts`](src/game/medals.ts).

## Ideas for improvement

- Online leaderboard (Supabase or Firebase)
- Installable on phones and playable offline (`vite-plugin-pwa`)
- Day and night themes, or different bird skins
- Sprite artwork, or a game framework such as Phaser or PixiJS
