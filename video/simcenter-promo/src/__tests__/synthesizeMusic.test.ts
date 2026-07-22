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
