import type { SimCase } from "@/data/cases";
import { EMAIL_CASES } from "@/data/email-cases";
import { MESSENGER_CASES } from "@/data/messenger-cases";
import { VIDEO_CASES } from "@/data/video-cases";

const preloadedMediaUrls = new Set<string>();
const loadedMediaUrls = new Set<string>();
const preloadedMediaElements: Array<HTMLImageElement | HTMLAudioElement | HTMLVideoElement> = [];

export function getLoadedMediaCount() {
  return loadedMediaUrls.size;
}

export function queueMediaPreload(url: string | null | undefined, kind: "image" | "audio" | "video") {
  if (typeof window === "undefined" || !url || preloadedMediaUrls.has(url)) return;

  preloadedMediaUrls.add(url);

  if (kind === "image") {
    const image = new Image();
    image.decoding = "async";
    image.loading = "eager";
    image.onload = () => {
      const decodePromise = typeof image.decode === "function" ? image.decode() : Promise.resolve();
      decodePromise.catch(() => undefined).finally(() => loadedMediaUrls.add(url));
    };
    image.onerror = () => preloadedMediaUrls.delete(url);
    image.src = url;
    preloadedMediaElements.push(image);
    return;
  }

  if (kind === "audio") {
    const audio = document.createElement("audio");
    audio.preload = "auto";
    audio.onloadeddata = () => loadedMediaUrls.add(url);
    audio.oncanplaythrough = () => loadedMediaUrls.add(url);
    audio.onerror = () => preloadedMediaUrls.delete(url);
    audio.src = url;
    audio.load();
    preloadedMediaElements.push(audio);
    return;
  }

  const video = document.createElement("video");
  video.preload = "auto";
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.onloadeddata = () => loadedMediaUrls.add(url);
  video.oncanplay = () => loadedMediaUrls.add(url);
  video.onerror = () => preloadedMediaUrls.delete(url);
  video.load();
  preloadedMediaElements.push(video);
}

export function preloadCaseMedia(caseItem: SimCase | null | undefined) {
  if (!caseItem) return;
  queueMediaPreload(caseItem.imageUrl, "image");
  queueMediaPreload(caseItem.audioUrl, "audio");
  (caseItem.cycles || []).forEach((cycle) => {
    queueMediaPreload(cycle.imageUrl || null, "image");
    queueMediaPreload(cycle.audioUrl || null, "audio");
  });
}

export function preloadEmailMedia(emailCase: (typeof EMAIL_CASES)[number] | null | undefined) {
  if (!emailCase) return;
  queueMediaPreload(emailCase.imageUrl, "image");
  queueMediaPreload(emailCase.audioUrl, "audio");
}

export function preloadMessengerMedia(messengerCase: (typeof MESSENGER_CASES)[number] | null | undefined) {
  if (!messengerCase) return;
  queueMediaPreload(messengerCase.imageUrl, "image");
  queueMediaPreload(messengerCase.audioUrl, "audio");
}

export function preloadVideoMedia(videoCase: (typeof VIDEO_CASES)[number] | null | undefined) {
  if (!videoCase) return;
  queueMediaPreload(videoCase.imageUrl, "image");
  queueMediaPreload(videoCase.audioUrl, "audio");
  queueMediaPreload(videoCase.videoUrl, "video");
}
