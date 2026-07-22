# DNS SimCenter Promo Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 2:30 (150s, 30fps, 1920×1080) Remotion video promoting DNS SimCenter to
employees — problem → solution → how it works → competency profile → PDF report → personal
growth pitch → CTA — using real screenshots of the running app and a self-generated ambient
background track, rendered to `out/simcenter-promo.mp4`.

**Architecture:** A fully isolated Remotion project at `video/simcenter-promo/` (own
`package.json`, zero impact on the main app's dependencies). Content lives in a single typed
`scenes.ts` data array; four reusable, prop-driven scene components (`LogoCard`,
`TextOnlyScene`, `ScreenshotScene`, `PdfExportScene`) render whichever scene kind is requested.
Pure animation math (`fadeInOut`, `kenBurnsScale`) and audio synthesis
(`synthesizeAmbientPad`, `encodeWav`) are extracted into testable, hook-free functions; the
Remotion-hook-dependent scene components themselves are verified via Remotion Studio preview
and the final render, per the approved spec.

**Tech Stack:** Remotion 4.x (`remotion`, `@remotion/cli`), React 18, TypeScript, Vitest (unit
tests), Playwright (one-off screenshot capture of the live app), Node built-ins only for audio
synthesis (no external audio library/license).

**Spec:** `docs/superpowers/specs/2026-07-22-simcenter-promo-video-design.md`

## Global Constraints

- Video project is fully isolated in `video/simcenter-promo/` — never add `remotion` or its
  deps to the root/`client`/`server` `package.json`.
- No real employee data (names, emails, scores) appears in any screenshot — use a synthetic
  test session only (e.g. participant name "Тест Тестов").
- No licensed third-party music — background track is synthesized from scratch in Node and
  committed as `public/audio/bg-music.wav`.
- No voice-over/TTS — on-screen text + music only (per spec).
- Composition is exactly `1920×1080`, `30fps`, `4500` frames (`150s`) — the sum of every
  scene's `durationInFrames` in `scenes.ts` must equal `4500`.
- Design tokens (`theme.ts`) are copied verbatim from `client/src/styles/dns-theme.ts`
  (`DNS_COLORS`, font `Inter`) — do not invent new colors.
- Commands below assume Git Bash on Windows (the project's shell) and are run from the repo
  root unless a `cd` is shown.

---

### Task 1: Scaffold the Remotion project + video config

**Files:**
- Create: `video/simcenter-promo/` (via `create-video` CLI scaffold)
- Create: `video/simcenter-promo/src/videoConfig.ts`
- Create: `video/simcenter-promo/src/__tests__/videoConfig.test.ts`
- Modify: `video/simcenter-promo/src/index.ts` (overwrite scaffold default)
- Modify: `video/simcenter-promo/src/Root.tsx` (overwrite scaffold default)
- Create: `video/simcenter-promo/vitest.config.ts`
- Create: `video/simcenter-promo/.gitignore`
- Modify: `video/simcenter-promo/package.json` (add `vitest`, `tsx`, `@types/node`, `test` script)

**Interfaces:**
- Produces: `VIDEO_CONFIG: { id: 'SimCenterPromo'; durationInFrames: 4500; fps: 30; width: 1920; height: 1080 }` from `src/videoConfig.ts` — every later task that touches `Root.tsx` or writes a duration-related test imports this.

- [ ] **Step 1: Scaffold via the official Remotion CLI**

```bash
mkdir -p video
npx create-video@latest --yes --blank --no-tailwind video/simcenter-promo
cd video/simcenter-promo
npm i
npm i -D vitest tsx @types/node
```

- [ ] **Step 2: Write the failing config test**

```ts
// video/simcenter-promo/src/__tests__/videoConfig.test.ts
import { describe, expect, it } from "vitest";
import { VIDEO_CONFIG } from "../videoConfig";

describe("VIDEO_CONFIG", () => {
  it("matches the approved spec: 150s at 30fps, 1920x1080", () => {
    expect(VIDEO_CONFIG.id).toBe("SimCenterPromo");
    expect(VIDEO_CONFIG.fps).toBe(30);
    expect(VIDEO_CONFIG.width).toBe(1920);
    expect(VIDEO_CONFIG.height).toBe(1080);
    expect(VIDEO_CONFIG.durationInFrames).toBe(4500);
    expect(VIDEO_CONFIG.durationInFrames / VIDEO_CONFIG.fps).toBe(150);
  });
});
```

- [ ] **Step 3: Add the vitest config**

```ts
// video/simcenter-promo/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

Add to `video/simcenter-promo/package.json` `"scripts"`: `"test": "vitest run"`.

- [ ] **Step 4: Run test to verify it fails**

Run: `cd video/simcenter-promo && npm test`
Expected: FAIL — `Cannot find module '../videoConfig'` (file doesn't exist yet).

- [ ] **Step 5: Create `videoConfig.ts`**

```ts
// video/simcenter-promo/src/videoConfig.ts
export const VIDEO_CONFIG = {
  id: "SimCenterPromo",
  durationInFrames: 4500,
  fps: 30,
  width: 1920,
  height: 1080,
} as const;
```

- [ ] **Step 6: Overwrite the scaffold's entry point and root**

```ts
// video/simcenter-promo/src/index.ts
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
```

```tsx
// video/simcenter-promo/src/Root.tsx
import { Composition } from "remotion";
import { VIDEO_CONFIG } from "./videoConfig";

// Placeholder component until Task 11 wires up the real timeline.
const Placeholder: React.FC = () => null;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id={VIDEO_CONFIG.id}
      component={Placeholder}
      durationInFrames={VIDEO_CONFIG.durationInFrames}
      fps={VIDEO_CONFIG.fps}
      width={VIDEO_CONFIG.width}
      height={VIDEO_CONFIG.height}
      defaultProps={{}}
    />
  );
};
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd video/simcenter-promo && npm test`
Expected: PASS (1 test).

- [ ] **Step 8: Add `.gitignore` for the video project**

```
# video/simcenter-promo/.gitignore
node_modules
out
.remotion
```

- [ ] **Step 9: Commit**

```bash
git add video/simcenter-promo
git commit -m "feat(video): scaffold isolated Remotion project for SimCenter promo"
```

---

### Task 2: Design tokens

**Files:**
- Create: `video/simcenter-promo/src/theme.ts`
- Create: `video/simcenter-promo/src/__tests__/theme.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `COLORS: { primary, primaryLight, primaryDark, bgDark, bgCard, bgElevated, textPrimary, textSecondary, textMuted }`, `FONT_FAMILY: string`, `GRADIENTS: { dark, hero }` — every scene component (Tasks 7-10) imports these.

- [ ] **Step 1: Write the failing test**

```ts
// video/simcenter-promo/src/__tests__/theme.test.ts
import { describe, expect, it } from "vitest";
import { COLORS, FONT_FAMILY, GRADIENTS } from "../theme";

describe("theme tokens", () => {
  it("matches client/src/styles/dns-theme.ts exactly", () => {
    expect(COLORS.primary).toBe("#F04E23");
    expect(COLORS.primaryLight).toBe("#FF6B35");
    expect(COLORS.primaryDark).toBe("#D84315");
    expect(COLORS.bgDark).toBe("#0F1923");
    expect(COLORS.bgCard).toBe("#1A2634");
    expect(COLORS.bgElevated).toBe("#243447");
    expect(COLORS.textPrimary).toBe("#FFFFFF");
    expect(COLORS.textSecondary).toBe("#94A3B8");
    expect(COLORS.textMuted).toBe("#64748B");
    expect(FONT_FAMILY).toBe("Inter, system-ui, -apple-system, sans-serif");
    expect(GRADIENTS.hero).toContain("#F04E23");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd video/simcenter-promo && npm test`
Expected: FAIL — `Cannot find module '../theme'`.

- [ ] **Step 3: Write `theme.ts`**

```ts
// video/simcenter-promo/src/theme.ts
// Copied verbatim from client/src/styles/dns-theme.ts — keep in sync if that file changes.
export const COLORS = {
  primary: "#F04E23",
  primaryLight: "#FF6B35",
  primaryDark: "#D84315",
  bgDark: "#0F1923",
  bgCard: "#1A2634",
  bgElevated: "#243447",
  textPrimary: "#FFFFFF",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
} as const;

export const FONT_FAMILY = "Inter, system-ui, -apple-system, sans-serif";

export const GRADIENTS = {
  dark: "linear-gradient(180deg, #0F1923 0%, #1A2634 100%)",
  hero: "linear-gradient(135deg, rgba(240,78,35,0.15) 0%, rgba(15,25,35,1) 60%)",
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd video/simcenter-promo && npm test`
Expected: PASS (2 tests total).

- [ ] **Step 5: Commit**

```bash
git add video/simcenter-promo/src/theme.ts video/simcenter-promo/src/__tests__/theme.test.ts
git commit -m "feat(video): add DNS design tokens"
```

---

### Task 3: Pure animation helpers

**Files:**
- Create: `video/simcenter-promo/src/lib/animation.ts`
- Create: `video/simcenter-promo/src/__tests__/animation.test.ts`

**Interfaces:**
- Consumes: `interpolate` from `remotion` (pure function, no hooks/context needed).
- Produces: `fadeInOut(frame: number, durationInFrames: number, fadeFrames?: number): number`, `kenBurnsScale(frame: number, durationInFrames: number): number` — every scene component (Tasks 7-10) imports these.

- [ ] **Step 1: Write the failing tests**

```ts
// video/simcenter-promo/src/__tests__/animation.test.ts
import { describe, expect, it } from "vitest";
import { fadeInOut, kenBurnsScale } from "../lib/animation";

describe("fadeInOut", () => {
  it("is 0 at frame 0", () => {
    expect(fadeInOut(0, 100)).toBe(0);
  });

  it("reaches 1 after the fade-in window", () => {
    expect(fadeInOut(15, 100)).toBe(1);
  });

  it("stays at 1 in the middle", () => {
    expect(fadeInOut(50, 100)).toBe(1);
  });

  it("starts fading out before the end", () => {
    expect(fadeInOut(85, 100)).toBe(1);
  });

  it("is 0 at the last frame", () => {
    expect(fadeInOut(100, 100)).toBe(0);
  });
});

describe("kenBurnsScale", () => {
  it("is 1 at frame 0", () => {
    expect(kenBurnsScale(0, 300)).toBe(1);
  });

  it("is 1.08 at the last frame", () => {
    expect(kenBurnsScale(300, 300)).toBeCloseTo(1.08, 5);
  });

  it("is roughly halfway at the midpoint", () => {
    expect(kenBurnsScale(150, 300)).toBeCloseTo(1.04, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd video/simcenter-promo && npm test`
Expected: FAIL — `Cannot find module '../lib/animation'`.

- [ ] **Step 3: Write `animation.ts`**

```ts
// video/simcenter-promo/src/lib/animation.ts
import { interpolate } from "remotion";

/**
 * Opacity curve: fades in over `fadeFrames`, holds at 1, fades out over the
 * last `fadeFrames` before the scene ends.
 */
export function fadeInOut(
  frame: number,
  durationInFrames: number,
  fadeFrames = 15,
): number {
  return interpolate(
    frame,
    [0, fadeFrames, durationInFrames - fadeFrames, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
}

/** Slow zoom from 1x to 1.08x across the full duration of the scene. */
export function kenBurnsScale(frame: number, durationInFrames: number): number {
  return interpolate(frame, [0, durationInFrames], [1, 1.08], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd video/simcenter-promo && npm test`
Expected: PASS (10 tests total).

- [ ] **Step 5: Commit**

```bash
git add video/simcenter-promo/src/lib video/simcenter-promo/src/__tests__/animation.test.ts
git commit -m "feat(video): add pure fade and Ken Burns animation helpers"
```

---

### Task 4: Scene content data

**Files:**
- Create: `video/simcenter-promo/src/scenes.ts`
- Create: `video/simcenter-promo/src/__tests__/scenes.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type Scene` (discriminated union on `kind: 'logo' | 'text' | 'screenshot' | 'pdf'`) and `SCENES: Scene[]` — Task 6's asset test derives expected screenshot filenames from this; Task 11's timeline assembler iterates over it.

- [ ] **Step 1: Write the failing test**

```ts
// video/simcenter-promo/src/__tests__/scenes.test.ts
import { describe, expect, it } from "vitest";
import { SCENES } from "../scenes";

describe("SCENES", () => {
  it("has exactly the 9 storyboard scenes", () => {
    expect(SCENES).toHaveLength(9);
  });

  it("has unique ids in storyboard order", () => {
    expect(SCENES.map((s) => s.id)).toEqual([
      "title",
      "problem",
      "solution",
      "how-it-works-launch",
      "how-it-works-cases",
      "how-it-works-competencies",
      "pdf-report",
      "growth-pitch",
      "cta",
    ]);
  });

  it("durations sum to exactly 4500 frames (150s at 30fps)", () => {
    const total = SCENES.reduce((sum, s) => sum + s.durationInFrames, 0);
    expect(total).toBe(4500);
  });

  it("carries the approved storyboard copy for key beats", () => {
    const title = SCENES.find((s) => s.id === "title");
    const problem = SCENES.find((s) => s.id === "problem");
    const cta = SCENES.find((s) => s.id === "cta");

    expect(title?.kind).toBe("logo");
    if (title?.kind === "logo") {
      expect(title.props.title).toBe("DNS SimCenter");
    }

    expect(problem?.kind).toBe("text");
    if (problem?.kind === "text") {
      expect(problem.props.text).toBe(
        "Каждый день — решения, которые негде потренировать. Ошибка на практике стоит дорого.",
      );
    }

    expect(cta?.kind).toBe("logo");
    if (cta?.kind === "logo") {
      expect(cta.props.title).toBe("Участвуйте в SimCenter");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd video/simcenter-promo && npm test`
Expected: FAIL — `Cannot find module '../scenes'`.

- [ ] **Step 3: Write `scenes.ts`**

```ts
// video/simcenter-promo/src/scenes.ts
export interface LogoSceneProps {
  title: string;
  subtitle: string;
}

export interface TextSceneProps {
  text: string;
}

export interface ScreenshotSceneProps {
  headline: string;
  subheadline?: string;
  screenshot: string;
}

export interface PdfSceneProps {
  headline: string;
  screenshot: string;
}

export type Scene =
  | { id: string; kind: "logo"; durationInFrames: number; props: LogoSceneProps }
  | { id: string; kind: "text"; durationInFrames: number; props: TextSceneProps }
  | { id: string; kind: "screenshot"; durationInFrames: number; props: ScreenshotSceneProps }
  | { id: string; kind: "pdf"; durationInFrames: number; props: PdfSceneProps };

export const SCENES: Scene[] = [
  {
    id: "title",
    kind: "logo",
    durationInFrames: 240,
    props: {
      title: "DNS SimCenter",
      subtitle: "Тренажёр управленческой готовности",
    },
  },
  {
    id: "problem",
    kind: "text",
    durationInFrames: 420,
    props: {
      text: "Каждый день — решения, которые негде потренировать. Ошибка на практике стоит дорого.",
    },
  },
  {
    id: "solution",
    kind: "screenshot",
    durationInFrames: 480,
    props: {
      headline: "Поэтому появился SimCenter",
      screenshot: "screenshots/role-select.png",
    },
  },
  {
    id: "how-it-works-launch",
    kind: "screenshot",
    durationInFrames: 600,
    props: {
      headline: "Оценщик запускает live-сессию — вам приходит код доступа",
      screenshot: "screenshots/evaluator-console.png",
    },
  },
  {
    id: "how-it-works-cases",
    kind: "screenshot",
    durationInFrames: 720,
    props: {
      headline:
        "Вы попадаете в симуляцию: почта, мессенджер, видеозвонки — реальные дилеммы бизнеса",
      screenshot: "screenshots/simulation-live.png",
    },
  },
  {
    id: "how-it-works-competencies",
    kind: "screenshot",
    durationInFrames: 660,
    props: {
      headline: "Пока вы принимаете решения — система строит ваш профиль компетенций",
      screenshot: "screenshots/results-competencies.png",
    },
  },
  {
    id: "pdf-report",
    kind: "pdf",
    durationInFrames: 420,
    props: {
      headline: "Полный отчёт: сильные стороны и зоны роста",
      screenshot: "screenshots/results-competencies.png",
    },
  },
  {
    id: "growth-pitch",
    kind: "screenshot",
    durationInFrames: 540,
    props: {
      headline: "Это не экзамен. Это тренажёр вашего роста.",
      subheadline: "Впереди — новые симуляции",
      screenshot: "screenshots/zrd-board.png",
    },
  },
  {
    id: "cta",
    kind: "logo",
    durationInFrames: 420,
    props: {
      title: "Участвуйте в SimCenter",
      subtitle: "Обратитесь к вашему HR-партнёру за кодом доступа",
    },
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd video/simcenter-promo && npm test`
Expected: PASS (14 tests total).

- [ ] **Step 5: Commit**

```bash
git add video/simcenter-promo/src/scenes.ts video/simcenter-promo/src/__tests__/scenes.test.ts
git commit -m "feat(video): add storyboard scene data"
```

---

### Task 5: Background music synthesis

**Files:**
- Create: `video/simcenter-promo/src/audio/synthesizeMusic.ts`
- Create: `video/simcenter-promo/src/audio/generate-music-cli.ts`
- Create: `video/simcenter-promo/src/__tests__/synthesizeMusic.test.ts`
- Modify: `video/simcenter-promo/package.json` (add `"generate:music"` script)

**Interfaces:**
- Consumes: nothing (Node built-ins only).
- Produces: `synthesizeAmbientPad(durationSeconds: number, sampleRate?: number): Int16Array`, `encodeWav(samples: Int16Array, sampleRate: number, channels: number, bitsPerSample: number): Buffer` — the CLI script and Task 6's asset test both depend on the resulting `public/audio/bg-music.wav` file.

- [ ] **Step 1: Write the failing tests**

```ts
// video/simcenter-promo/src/__tests__/synthesizeMusic.test.ts
import { describe, expect, it } from "vitest";
import { encodeWav, synthesizeAmbientPad } from "../audio/synthesizeMusic";

describe("synthesizeAmbientPad", () => {
  it("produces one sample per sample-rate tick per second", () => {
    const samples = synthesizeAmbientPad(1, 44100);
    expect(samples.length).toBe(44100);
  });

  it("stays within the 16-bit signed range", () => {
    const samples = synthesizeAmbientPad(2, 44100);
    for (const value of samples) {
      expect(value).toBeGreaterThanOrEqual(-32768);
      expect(value).toBeLessThanOrEqual(32767);
    }
  });
});

describe("encodeWav", () => {
  it("writes a valid RIFF/WAVE/fmt/data header", () => {
    const samples = synthesizeAmbientPad(0.1, 44100);
    const buffer = encodeWav(samples, 44100, 1, 16);

    expect(buffer.toString("ascii", 0, 4)).toBe("RIFF");
    expect(buffer.toString("ascii", 8, 12)).toBe("WAVE");
    expect(buffer.toString("ascii", 12, 16)).toBe("fmt ");
    expect(buffer.toString("ascii", 36, 40)).toBe("data");
    expect(buffer.readUInt32LE(24)).toBe(44100);
  });

  it("sizes the data chunk as sample count times 2 bytes", () => {
    const samples = synthesizeAmbientPad(1, 44100);
    const buffer = encodeWav(samples, 44100, 1, 16);

    expect(buffer.readUInt32LE(40)).toBe(samples.length * 2);
    expect(buffer.length).toBe(44 + samples.length * 2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd video/simcenter-promo && npm test`
Expected: FAIL — `Cannot find module '../audio/synthesizeMusic'`.

- [ ] **Step 3: Write `synthesizeMusic.ts`**

```ts
// video/simcenter-promo/src/audio/synthesizeMusic.ts

/**
 * Generates a simple ambient pad: three detuned sine waves (A major triad,
 * low register) with a slow volume swell so it doesn't feel static.
 * Kept quiet (12% amplitude) so it sits under on-screen text without a
 * voice-over to compete with.
 */
export function synthesizeAmbientPad(
  durationSeconds: number,
  sampleRate = 44100,
): Int16Array {
  const totalSamples = Math.round(sampleRate * durationSeconds);
  const samples = new Int16Array(totalSamples);
  const baseFreqs = [110, 138.59, 164.81]; // A2, C#3, E3
  const amplitude = 0.12 * 32767;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    for (const freq of baseFreqs) {
      sample += Math.sin(2 * Math.PI * freq * t);
    }
    sample /= baseFreqs.length;

    const swell = 0.7 + 0.3 * Math.sin((2 * Math.PI * t) / 20);
    samples[i] = Math.round(sample * amplitude * swell);
  }

  return samples;
}

/** Encodes 16-bit PCM samples as a WAV file buffer (RIFF/WAVE/fmt/data). */
export function encodeWav(
  samples: Int16Array,
  sampleRate: number,
  channels: number,
  bitsPerSample: number,
): Buffer {
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    buffer.writeInt16LE(samples[i], 44 + i * bytesPerSample);
  }

  return buffer;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd video/simcenter-promo && npm test`
Expected: PASS (18 tests total).

- [ ] **Step 5: Write the CLI generator script**

```ts
// video/simcenter-promo/src/audio/generate-music-cli.ts
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { encodeWav, synthesizeAmbientPad } from "./synthesizeMusic";

const DURATION_SECONDS = 150; // matches VIDEO_CONFIG.durationInFrames / fps
const SAMPLE_RATE = 44100;

const samples = synthesizeAmbientPad(DURATION_SECONDS, SAMPLE_RATE);
const wav = encodeWav(samples, SAMPLE_RATE, 1, 16);

const outDir = path.resolve(process.cwd(), "public", "audio");
mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "bg-music.wav");
writeFileSync(outPath, wav);

console.log(`Wrote ${outPath} (${DURATION_SECONDS}s, ${samples.length} samples)`);
```

Add to `video/simcenter-promo/package.json` `"scripts"`: `"generate:music": "tsx src/audio/generate-music-cli.ts"`.

- [ ] **Step 6: Run the generator and confirm the file exists**

Run: `cd video/simcenter-promo && npm run generate:music`
Expected: prints `Wrote .../public/audio/bg-music.wav (150s, 6615000 samples)`; `ls public/audio/bg-music.wav` shows a ~12.6MB file.

- [ ] **Step 7: Commit**

```bash
git add video/simcenter-promo/src/audio video/simcenter-promo/src/__tests__/synthesizeMusic.test.ts video/simcenter-promo/package.json video/simcenter-promo/public/audio/bg-music.wav
git commit -m "feat(video): synthesize self-generated ambient background track"
```

---

### Task 6: Capture reference screenshots + asset presence test

**Files:**
- Create: `video/simcenter-promo/src/__tests__/assets.test.ts`
- Create (binary, captured live): `video/simcenter-promo/public/screenshots/role-select.png`, `evaluator-console.png`, `simulation-live.png`, `results-competencies.png`, `zrd-board.png`

**Interfaces:**
- Consumes: `SCENES` from `../scenes` (Task 4).
- Produces: the screenshot files that Task 9/10's `ScreenshotScene`/`PdfExportScene` load via `staticFile(...)`.

This task is an operational, one-off capture (not something a fresh implementer should
improvise from scratch) — do it directly in the current session, which already has Playwright
access and the user's explicit go-ahead to temporarily reset the local evaluator password.

- [ ] **Step 1: Write the failing asset-presence test**

```ts
// video/simcenter-promo/src/__tests__/assets.test.ts
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SCENES } from "../scenes";

const PUBLIC_DIR = path.resolve(__dirname, "../../public");

const expectedScreenshots = Array.from(
  new Set(
    SCENES.flatMap((scene) =>
      "screenshot" in scene.props ? [scene.props.screenshot] : [],
    ),
  ),
);

describe("reference screenshots", () => {
  it.each(expectedScreenshots)("%s exists and is non-trivial", (relativePath) => {
    const fullPath = path.join(PUBLIC_DIR, relativePath);
    expect(existsSync(fullPath)).toBe(true);
    expect(statSync(fullPath).size).toBeGreaterThan(1000);
  });
});

describe("background music", () => {
  it("bg-music.wav exists and is non-trivial", () => {
    const fullPath = path.join(PUBLIC_DIR, "audio/bg-music.wav");
    expect(existsSync(fullPath)).toBe(true);
    expect(statSync(fullPath).size).toBeGreaterThan(1_000_000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd video/simcenter-promo && npm test`
Expected: FAIL — 5 screenshot files missing (music already passes from Task 5).

- [ ] **Step 3: Start the dev server and seed content if needed**

Run: `npm run dev` (background) from repo root.
Check: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5000` returns `200`.
If `/api/simulation-content` returns an error/empty payload, run: `npm run db:seed-simulation`.

- [ ] **Step 4: Temporarily reset the local evaluator password**

Run: `EVALUATOR_PASSWORD='TempCapture#2026' npm run staff:reset`
This only changes the `evaluator` account (the `admin` account keeps its `.env` password,
since `ADMIN_PASSWORD` is already set in `.env` and is not overridden here).

- [ ] **Step 5: Log in as evaluator and capture `role-select.png` and `evaluator-console.png`**

Via Playwright: navigate to `http://localhost:5000/#/`, screenshot →
`video/simcenter-promo/public/screenshots/role-select.png`.
Navigate to `http://localhost:5000/#/staff-login`, log in as evaluator /
`TempCapture#2026`, launch a test live session with a synthetic participant name
("Тест Тестов"), copy the generated access code, screenshot the console with the
session visible → `evaluator-console.png`.

- [ ] **Step 6: Join as participant and capture `simulation-live.png` and `results-competencies.png`**

In a second Playwright browser context, navigate to `http://localhost:5000/#/student`,
enter the access code from Step 5, reach `/#/simulation`, interact with at least one
channel event, screenshot → `simulation-live.png`.
Navigate to the session's `/#/results/:sessionId`, screenshot the competency view →
`results-competencies.png`.

- [ ] **Step 7: Obtain `zrd-board.png`**

Reuse one of the existing ZRD board screenshots already sitting at the repo root from
this session's earlier redesign work (e.g. `redesign-dark.png`) — these are genuine ZRD
UI captures, not placeholders. Copy the most representative one to
`video/simcenter-promo/public/screenshots/zrd-board.png`. If none look presentable,
capture a fresh one from `http://localhost:5000/#/zrd` instead.

- [ ] **Step 8: Restore the evaluator password**

Run: `npm run staff:reset` (no `EVALUATOR_PASSWORD` override this time) — this reloads the
real value from `.env` and restores the evaluator account to its normal password.

- [ ] **Step 9: Run test to verify it passes**

Run: `cd video/simcenter-promo && npm test`
Expected: PASS (all tests, including the 6 new asset checks).

- [ ] **Step 10: Commit**

```bash
git add video/simcenter-promo/public/screenshots video/simcenter-promo/src/__tests__/assets.test.ts
git commit -m "feat(video): add reference screenshots of the live app"
```

---

### Task 7: `LogoCard` scene component

**Files:**
- Create: `video/simcenter-promo/src/components/LogoCard.tsx`

**Interfaces:**
- Consumes: `LogoSceneProps` (Task 4), `fadeInOut` (Task 3), `COLORS`/`FONT_FAMILY`/`GRADIENTS` (Task 2), `useCurrentFrame`/`useVideoConfig`/`AbsoluteFill` from `remotion`.
- Produces: `LogoCard: React.FC<LogoSceneProps>` — used by Task 11 for the `title` and `cta` scenes.

Not unit-tested: `LogoCard` calls `useCurrentFrame()`, which requires Remotion's render
context (Player/renderer), not available in a plain Vitest/Node environment. Per the
approved spec's Verification section, visual correctness for scene components is checked
via Remotion Studio preview (Step 2 below) and the final render (Task 12), not
frame-level unit tests.

- [ ] **Step 1: Write `LogoCard.tsx`**

```tsx
// video/simcenter-promo/src/components/LogoCard.tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { fadeInOut } from "../lib/animation";
import { COLORS, FONT_FAMILY, GRADIENTS } from "../theme";
import type { LogoSceneProps } from "../scenes";

export const LogoCard: React.FC<LogoSceneProps> = ({ title, subtitle }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = fadeInOut(frame, durationInFrames);

  return (
    <AbsoluteFill
      style={{
        background: GRADIENTS.hero,
        backgroundColor: COLORS.bgDark,
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 96,
          fontWeight: 700,
          color: COLORS.textPrimary,
          textAlign: "center",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 36,
          fontWeight: 400,
          color: COLORS.primary,
          marginTop: 24,
          textAlign: "center",
        }}
      >
        {subtitle}
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Manual preview check**

Run: `cd video/simcenter-promo && npx remotion studio` (will only show real output once
Task 11 wires `LogoCard` into `Root.tsx`'s composition — for now, confirm the file compiles
with `npx tsc --noEmit`).

- [ ] **Step 3: Commit**

```bash
git add video/simcenter-promo/src/components/LogoCard.tsx
git commit -m "feat(video): add LogoCard scene component"
```

---

### Task 8: `TextOnlyScene` component

**Files:**
- Create: `video/simcenter-promo/src/components/TextOnlyScene.tsx`

**Interfaces:**
- Consumes: `TextSceneProps` (Task 4), `fadeInOut` (Task 3), `COLORS`/`FONT_FAMILY` (Task 2).
- Produces: `TextOnlyScene: React.FC<TextSceneProps>` — used by Task 11 for the `problem` scene.

- [ ] **Step 1: Write `TextOnlyScene.tsx`**

```tsx
// video/simcenter-promo/src/components/TextOnlyScene.tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { fadeInOut } from "../lib/animation";
import { COLORS, FONT_FAMILY } from "../theme";
import type { TextSceneProps } from "../scenes";

export const TextOnlyScene: React.FC<TextSceneProps> = ({ text }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = fadeInOut(frame, durationInFrames);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bgDark,
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 56,
          fontWeight: 500,
          color: COLORS.textPrimary,
          textAlign: "center",
          maxWidth: "70%",
          lineHeight: 1.4,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd video/simcenter-promo && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add video/simcenter-promo/src/components/TextOnlyScene.tsx
git commit -m "feat(video): add TextOnlyScene component"
```

---

### Task 9: `ScreenshotScene` component

**Files:**
- Create: `video/simcenter-promo/src/components/ScreenshotScene.tsx`

**Interfaces:**
- Consumes: `ScreenshotSceneProps` (Task 4), `fadeInOut`/`kenBurnsScale` (Task 3), `COLORS`/`FONT_FAMILY` (Task 2), `Img`/`staticFile` from `remotion`.
- Produces: `ScreenshotScene: React.FC<ScreenshotSceneProps>` — used by Task 11 for `solution`, `how-it-works-launch`, `how-it-works-cases`, `how-it-works-competencies`, and `growth-pitch`.

- [ ] **Step 1: Write `ScreenshotScene.tsx`**

```tsx
// video/simcenter-promo/src/components/ScreenshotScene.tsx
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fadeInOut, kenBurnsScale } from "../lib/animation";
import { COLORS, FONT_FAMILY } from "../theme";
import type { ScreenshotSceneProps } from "../scenes";

export const ScreenshotScene: React.FC<ScreenshotSceneProps> = ({
  headline,
  subheadline,
  screenshot,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = fadeInOut(frame, durationInFrames);
  const scale = kenBurnsScale(frame, durationInFrames);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark, opacity }}>
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 48,
          fontWeight: 600,
          color: COLORS.textPrimary,
          textAlign: "center",
          padding: "48px 96px 0",
        }}
      >
        {headline}
      </div>
      {subheadline ? (
        <div
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 28,
            color: COLORS.primary,
            textAlign: "center",
            marginTop: 16,
          }}
        >
          {subheadline}
        </div>
      ) : null}
      <AbsoluteFill
        style={{
          top: subheadline ? 260 : 200,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Img
          src={staticFile(screenshot)}
          style={{
            maxWidth: "80%",
            maxHeight: "70%",
            transform: `scale(${scale})`,
            borderRadius: 16,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd video/simcenter-promo && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add video/simcenter-promo/src/components/ScreenshotScene.tsx
git commit -m "feat(video): add ScreenshotScene component with Ken Burns pan"
```

---

### Task 10: `PdfExportScene` component

**Files:**
- Create: `video/simcenter-promo/src/components/PdfExportScene.tsx`

**Interfaces:**
- Consumes: `PdfSceneProps` (Task 4), `fadeInOut` (Task 3), `COLORS`/`FONT_FAMILY` (Task 2), `interpolate`/`Img`/`staticFile` from `remotion`.
- Produces: `PdfExportScene: React.FC<PdfSceneProps>` — used by Task 11 for the `pdf-report` scene.

- [ ] **Step 1: Write `PdfExportScene.tsx`**

```tsx
// video/simcenter-promo/src/components/PdfExportScene.tsx
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fadeInOut } from "../lib/animation";
import { COLORS, FONT_FAMILY } from "../theme";
import type { PdfSceneProps } from "../scenes";

export const PdfExportScene: React.FC<PdfSceneProps> = ({ headline, screenshot }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = fadeInOut(frame, durationInFrames);

  const cueStart = Math.round(durationInFrames * 0.4);
  const cueOpacity = interpolate(frame, [cueStart, cueStart + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cueOffset = interpolate(frame, [cueStart, cueStart + 30], [0, 20], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark, opacity }}>
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 48,
          fontWeight: 600,
          color: COLORS.textPrimary,
          textAlign: "center",
          padding: "48px 96px 0",
        }}
      >
        {headline}
      </div>
      <AbsoluteFill style={{ top: 200, justifyContent: "center", alignItems: "center" }}>
        <Img
          src={staticFile(screenshot)}
          style={{
            maxWidth: "80%",
            maxHeight: "70%",
            borderRadius: 16,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        />
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          bottom: 96 - cueOffset,
          left: "50%",
          transform: "translateX(-50%)",
          opacity: cueOpacity,
          fontFamily: FONT_FAMILY,
          fontSize: 32,
          fontWeight: 600,
          color: COLORS.primary,
          backgroundColor: COLORS.bgCard,
          padding: "16px 32px",
          borderRadius: 999,
        }}
      >
        ⬇ report.pdf
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd video/simcenter-promo && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add video/simcenter-promo/src/components/PdfExportScene.tsx
git commit -m "feat(video): add PdfExportScene component with download cue"
```

---

### Task 11: Assemble the timeline and wire up audio

**Files:**
- Create: `video/simcenter-promo/src/SimCenterPromo.tsx`
- Modify: `video/simcenter-promo/src/Root.tsx` (swap `Placeholder` for `SimCenterPromo`)
- Create: `video/simcenter-promo/src/__tests__/timeline.test.ts`

**Interfaces:**
- Consumes: `SCENES` (Task 4), `LogoCard` (Task 7), `TextOnlyScene` (Task 8), `ScreenshotScene` (Task 9), `PdfExportScene` (Task 10), `COLORS` (Task 2), `VIDEO_CONFIG` (Task 1).
- Produces: `SimCenterPromo: React.FC` — the composition's `component` prop in `Root.tsx`; `computeSequenceOffsets(scenes: Scene[]): number[]` — a small pure helper extracted so the frame-offset math is unit-testable.

- [ ] **Step 1: Write the failing timeline test**

```ts
// video/simcenter-promo/src/__tests__/timeline.test.ts
import { describe, expect, it } from "vitest";
import { computeSequenceOffsets } from "../SimCenterPromo";
import { SCENES } from "../scenes";

describe("computeSequenceOffsets", () => {
  it("starts at 0 and each offset equals the sum of prior durations", () => {
    const offsets = computeSequenceOffsets(SCENES);
    expect(offsets[0]).toBe(0);
    expect(offsets[1]).toBe(SCENES[0].durationInFrames);
    expect(offsets[8]).toBe(
      SCENES.slice(0, 8).reduce((sum, s) => sum + s.durationInFrames, 0),
    );
  });

  it("last offset plus its duration equals the full composition length", () => {
    const offsets = computeSequenceOffsets(SCENES);
    const lastIndex = SCENES.length - 1;
    expect(offsets[lastIndex] + SCENES[lastIndex].durationInFrames).toBe(4500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd video/simcenter-promo && npm test`
Expected: FAIL — `Cannot find module '../SimCenterPromo'`.

- [ ] **Step 3: Write `SimCenterPromo.tsx`**

```tsx
// video/simcenter-promo/src/SimCenterPromo.tsx
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { SCENES, type Scene } from "./scenes";
import { COLORS } from "./theme";
import { LogoCard } from "./components/LogoCard";
import { TextOnlyScene } from "./components/TextOnlyScene";
import { ScreenshotScene } from "./components/ScreenshotScene";
import { PdfExportScene } from "./components/PdfExportScene";

/** Returns the `from` frame for each scene, in order. */
export function computeSequenceOffsets(scenes: Scene[]): number[] {
  const offsets: number[] = [];
  let cursor = 0;
  for (const scene of scenes) {
    offsets.push(cursor);
    cursor += scene.durationInFrames;
  }
  return offsets;
}

function renderScene(scene: Scene) {
  switch (scene.kind) {
    case "logo":
      return <LogoCard {...scene.props} />;
    case "text":
      return <TextOnlyScene {...scene.props} />;
    case "screenshot":
      return <ScreenshotScene {...scene.props} />;
    case "pdf":
      return <PdfExportScene {...scene.props} />;
  }
}

export const SimCenterPromo: React.FC = () => {
  const offsets = computeSequenceOffsets(SCENES);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDark }}>
      <Audio src={staticFile("audio/bg-music.wav")} volume={0.5} />
      {SCENES.map((scene, index) => (
        <Sequence key={scene.id} from={offsets[index]} durationInFrames={scene.durationInFrames}>
          {renderScene(scene)}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 4: Wire it into `Root.tsx`**

```tsx
// video/simcenter-promo/src/Root.tsx
import { Composition } from "remotion";
import { VIDEO_CONFIG } from "./videoConfig";
import { SimCenterPromo } from "./SimCenterPromo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id={VIDEO_CONFIG.id}
      component={SimCenterPromo}
      durationInFrames={VIDEO_CONFIG.durationInFrames}
      fps={VIDEO_CONFIG.fps}
      width={VIDEO_CONFIG.width}
      height={VIDEO_CONFIG.height}
      defaultProps={{}}
    />
  );
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd video/simcenter-promo && npm test`
Expected: PASS (all tests, including the 2 new timeline checks).

- [ ] **Step 6: Manual Studio preview**

Run: `cd video/simcenter-promo && npx remotion studio`
Open `SimCenterPromo`, scrub through all 9 scenes. Confirm: no text overflow, screenshots
appear at the right beats, audio waveform plays under the whole timeline, no console errors.

- [ ] **Step 7: Commit**

```bash
git add video/simcenter-promo/src/SimCenterPromo.tsx video/simcenter-promo/src/Root.tsx video/simcenter-promo/src/__tests__/timeline.test.ts
git commit -m "feat(video): assemble full timeline with audio"
```

---

### Task 12: Final render and verification

**Files:**
- No new files — produces `video/simcenter-promo/out/simcenter-promo.mp4` (gitignored).

**Interfaces:**
- Consumes: the fully wired `SimCenterPromo` composition (Task 11).
- Produces: `out/simcenter-promo.mp4`.

- [ ] **Step 1: Render the full video**

Run: `cd video/simcenter-promo && npx remotion render src/index.ts SimCenterPromo out/simcenter-promo.mp4`
Expected: exits 0, prints the output path.

- [ ] **Step 2: Verify the output file**

Run: `ls -la video/simcenter-promo/out/simcenter-promo.mp4`
Expected: file exists, size in the tens of MB (not 0 bytes).

- [ ] **Step 3: Confirm duration matches spec**

Run: `npx remotion render src/index.ts SimCenterPromo out/simcenter-promo.mp4 --log=verbose 2>&1 | grep -i duration` (or open the file in any media player and check the runtime shows 2:30).
Expected: ~150 seconds.

- [ ] **Step 4: Watch the full render once**

Open `out/simcenter-promo.mp4` and watch start to finish. Confirm against the spec's
Verification checklist: no text overlaps, subtitles/on-screen text readable at normal
reading speed, music doesn't clip or overpower transitions, no real employee data visible.

- [ ] **Step 5: Run the full test suite one last time**

Run: `cd video/simcenter-promo && npm test`
Expected: PASS (full suite, no regressions).

- [ ] **Step 6: Commit**

Nothing new to commit (render output is gitignored) — this task is verification-only. If
Step 4 surfaces an issue, fix the relevant scene/task above and re-render.

---

## Self-Review Notes

- **Spec coverage:** every storyboard beat (Task 4), the design tokens (Task 2), the
  screenshot pipeline (Task 6), the self-generated music (Task 5), the privacy constraint
  (Task 6 Step 1/synthetic name), and the final verification checklist (Task 12) all map to
  a spec section in `2026-07-22-simcenter-promo-video-design.md`.
- **Placeholder scan:** no TBD/TODO; every code step contains complete, runnable code.
- **Type consistency:** `Scene`'s discriminated union (Task 4) is the single type used by
  `renderScene` (Task 11) and every scene component's props (Tasks 7-10) — no renamed
  fields between tasks.
- **Scope:** single subsystem (one video), not split further.
