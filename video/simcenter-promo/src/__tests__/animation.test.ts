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
