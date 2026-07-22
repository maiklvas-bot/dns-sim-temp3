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
