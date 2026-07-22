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
