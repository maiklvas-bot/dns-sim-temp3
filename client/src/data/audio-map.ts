// System notification sounds
import audioRingtone from "@assets/audio_ringtone.mp3";
import audioMessenger from "@assets/audio_messenger.mp3";
import audioNotification from "@assets/audio_notification.mp3";
import audioVideocall from "@assets/audio_videocall.mp3";
import { getSimulationContentSnapshot } from "@/lib/runtime-content";

export { audioRingtone, audioMessenger, audioVideocall };

export type NotificationChannelKey = "call" | "messenger" | "video" | "email";

export interface SignalSoundOption {
  value: string;
  label: string;
  description: string;
  isPreset: boolean;
}

const DEFAULT_CHANNEL_SOUND_MAP: Record<NotificationChannelKey, string> = {
  call: audioRingtone,
  email: audioNotification,
  messenger: audioMessenger,
  video: audioVideocall,
};

const PRESET_SOUND_OPTIONS: Record<NotificationChannelKey, SignalSoundOption[]> = {
  call: [
    {
      value: "preset:call-classic",
      label: "Классический звонок",
      description: "Стандартный телефонный рингтон для звонка от магазина.",
      isPreset: true,
    },
    {
      value: "preset:call-soft",
      label: "Мягкий короткий сигнал",
      description: "Более спокойный сигнал без длинного рингтона.",
      isPreset: true,
    },
  ],
  email: [
    {
      value: "preset:email-classic",
      label: "Классический e-mail",
      description: "Обычный короткий сигнал нового письма.",
      isPreset: true,
    },
    {
      value: "preset:email-soft",
      label: "Мягкое уведомление",
      description: "Спокойный системный сигнал без резкого акцента.",
      isPreset: true,
    },
  ],
  messenger: [
    {
      value: "preset:messenger-classic",
      label: "Классический мессенджер",
      description: "Короткий двухтональный сигнал нового сообщения.",
      isPreset: true,
    },
    {
      value: "preset:messenger-soft",
      label: "Мягкий чат-сигнал",
      description: "Менее навязчивое уведомление для ТёрКограммы.",
      isPreset: true,
    },
  ],
  video: [
    {
      value: "preset:video-classic",
      label: "Классический видеозвонок",
      description: "Стандартный сигнал входящего видеозвонка.",
      isPreset: true,
    },
    {
      value: "preset:video-call",
      label: "Сигнал пропущенного вызова",
      description: "Короткий повторяемый сигнал для эмуляции пропущенного звонка.",
      isPreset: true,
    },
  ],
};

const PRESET_SOUND_SOURCE_MAP: Record<string, string> = {
  "preset:call-classic": audioRingtone,
  "preset:call-soft": audioNotification,
  "preset:email-classic": audioNotification,
  "preset:email-soft": audioMessenger,
  "preset:messenger-classic": audioMessenger,
  "preset:messenger-soft": audioNotification,
  "preset:video-classic": audioVideocall,
  "preset:video-call": audioRingtone,
};

export function getMediaAssetUrl(assetId?: string | null): string | null {
  if (!assetId) {
    return null;
  }

  return getSimulationContentSnapshot().assets.find((asset) => asset.id === assetId && asset.kind === "audio")?.publicUrl || null;
}

export function getSignalSoundOptions(channel: NotificationChannelKey, assetOptions: SignalSoundOption[] = []): SignalSoundOption[] {
  return [...PRESET_SOUND_OPTIONS[channel], ...assetOptions];
}

export function getDefaultChannelSound(channel: NotificationChannelKey): string {
  return DEFAULT_CHANNEL_SOUND_MAP[channel];
}

export function resolveChannelSoundSource(
  selection: string | null | undefined,
  channel: NotificationChannelKey,
): string {
  if (selection?.startsWith("preset:")) {
    return PRESET_SOUND_SOURCE_MAP[selection] || DEFAULT_CHANNEL_SOUND_MAP[channel];
  }

  return getMediaAssetUrl(selection) || DEFAULT_CHANNEL_SOUND_MAP[channel];
}

// ─── Global audio queue to prevent overlapping ───────────────────────────────
let currentAudio: HTMLAudioElement | null = null;
let currentNarration: SpeechSynthesisUtterance | null = null;
let loopingAudio: HTMLAudioElement | null = null;
let loopingSrc: string | null = null;
const audioQueue: Array<{ src: string; volume: number }> = [];
let isPlaying = false;
let audioUnlocked = false;
let nonCriticalAudioSuppressed = false;

function normalizeAudioSrc(src: string) {
  try {
    return new URL(src, typeof window !== "undefined" ? window.location.href : "http://localhost").href;
  } catch {
    return src;
  }
}

function normalizeAudioVolume(volume: number) {
  return Math.max(0, Math.min(1, volume));
}

export async function primeAudioPlayback(): Promise<boolean> {
  if (audioUnlocked) {
    return true;
  }

  try {
    const audio = new Audio(audioNotification);
    audio.volume = 0.001;
    audio.muted = false;
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    audioUnlocked = true;
    return true;
  } catch {
    return false;
  }
}

function playNext() {
  if (audioQueue.length === 0) {
    isPlaying = false;
    return;
  }
  isPlaying = true;
  const { src, volume } = audioQueue.shift()!;
  try {
    const audio = new Audio(src);
    audio.volume = normalizeAudioVolume(volume);
    currentAudio = audio;
    audio.addEventListener("ended", () => {
      currentAudio = null;
      // Small gap between sounds
      setTimeout(playNext, 300);
    });
    audio.addEventListener("error", () => {
      currentAudio = null;
      setTimeout(playNext, 100);
    });
    audio.play().catch(() => {
      currentAudio = null;
      setTimeout(playNext, 100);
    });
  } catch {
    setTimeout(playNext, 100);
  }
}

// Play audio helper — queues instead of overlapping
export function playAudioFile(src: string, volume = 0.6): void {
  if (nonCriticalAudioSuppressed || loopingAudio) {
    return;
  }
  audioQueue.push({ src, volume: normalizeAudioVolume(volume) });
  if (!isPlaying) playNext();
}

export function playLoopingAudio(src: string, volume = 0.6): HTMLAudioElement | null {
  try {
    if (loopingAudio && loopingSrc === src) {
      loopingAudio.volume = normalizeAudioVolume(volume);
      return loopingAudio;
    }

    stopLoopingAudio();
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    audioQueue.length = 0;
    isPlaying = false;

    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = normalizeAudioVolume(volume);
    loopingAudio = audio;
    loopingSrc = src;
    audio.play().catch(() => {
      loopingAudio = null;
      loopingSrc = null;
    });
    return audio;
  } catch {
    return null;
  }
}

export function stopLoopingAudio(): void {
  if (!loopingAudio) {
    loopingSrc = null;
    return;
  }

  loopingAudio.pause();
  loopingAudio.currentTime = 0;
  loopingAudio = null;
  loopingSrc = null;
}

export function playTwoToneNotification(src: string, volume = 0.55, gapMs = 180): void {
  if (nonCriticalAudioSuppressed || loopingAudio) {
    return;
  }

  playAudioFile(src, volume);
  if (typeof window !== "undefined") {
    window.setTimeout(() => playAudioFile(src, volume), gapMs);
  }
}

// Stop current audio immediately
export function stopCurrentAudio(): void {
  stopLoopingAudio();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  currentNarration = null;
  audioQueue.length = 0;
  isPlaying = false;
}

export function isCurrentAudioSource(src: string | null | undefined): boolean {
  if (!currentAudio || !src) {
    return false;
  }

  const currentSrc = currentAudio.currentSrc || currentAudio.src;
  return currentSrc === normalizeAudioSrc(src);
}

// Play a file immediately (for replay button — skip queue)
export function playAudioImmediate(src: string, volume = 0.7): HTMLAudioElement | null {
  if (nonCriticalAudioSuppressed) {
    return null;
  }
  try {
    stopCurrentAudio();
    const audio = new Audio(src);
    audio.volume = normalizeAudioVolume(volume);
    currentAudio = audio;
    audio.addEventListener("ended", () => { currentAudio = null; isPlaying = false; });
    audio.play().catch(() => {});
    isPlaying = true;
    return audio;
  } catch {
    return null;
  }
}

export function speakNarration(text: string): void {
  // Robot narration is intentionally disabled.
  void text;
}

export { audioNotification };

export function setNonCriticalAudioSuppressed(value: boolean): void {
  nonCriticalAudioSuppressed = value;
  if (value) {
    stopCurrentAudio();
  }
}
