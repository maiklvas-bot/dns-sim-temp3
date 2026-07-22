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
