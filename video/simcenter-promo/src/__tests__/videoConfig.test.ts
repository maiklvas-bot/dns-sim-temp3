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
