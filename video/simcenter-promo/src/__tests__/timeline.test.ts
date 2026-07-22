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
