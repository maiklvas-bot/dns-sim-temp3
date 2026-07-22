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
