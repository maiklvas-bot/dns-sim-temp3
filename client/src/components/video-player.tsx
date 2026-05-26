import { useState, useEffect, useRef } from "react";
import { VIDEO_CASES, type VideoCase } from "../data/video-cases";
import { setNonCriticalAudioSuppressed, stopCurrentAudio } from "../data/audio-map";
import { Play, Pause, RefreshCw, CheckCircle, Video, Volume2 } from "lucide-react";
import { useSimulation } from "../context/SimulationContext";
import DeadlineChip from "./deadline-chip";

function parseDurationMs(value: string): number | null {
  const match = value.match(/^(\d+):(\d{2})$/);
  if (!match) return null;
  return (Number(match[1]) * 60 + Number(match[2])) * 1000;
}

function estimateNarrationDurationMs(text: string, fallbackLabel: string): number {
  const fromLabel = parseDurationMs(fallbackLabel);
  if (fromLabel) return fromLabel;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(8, Math.min(40, Math.round(words / 2.2))) * 1000;
}

function TalkingAvatarPlayer({
  vc,
  isAnswered,
  onActivate,
  playbackEnabled,
  autoPlayKey,
}: {
  vc: VideoCase;
  isAnswered: boolean;
  onActivate: () => void;
  playbackEnabled: boolean;
  autoPlayKey: string | null;
}) {
  const [phase, setPhase] = useState<"idle" | "playing" | "paused" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [mouthOpen, setMouthOpen] = useState(false);
  const [mediaMode, setMediaMode] = useState<"video" | "fallback">(vc.videoUrl ? "video" : "fallback");
  const [mediaStatus, setMediaStatus] = useState("idle");
  const mediaAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaVideoRef = useRef<HTMLVideoElement | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mouthTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRecoveryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playedMsRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const playbackIdRef = useRef(0);
  const autoStartedRef = useRef<string | null>(null);
  const fallbackStartedRef = useRef(false);
  const hasVideoMedia = mediaMode === "video" && Boolean(vc.videoUrl);
  const narrationText = `${vc.title}. ${vc.sender}, ${vc.role}. ${vc.situation}`;
  const expectedDurationMs = estimateNarrationDurationMs(narrationText, vc.duration);

  const clearTimers = () => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    if (mouthTimer.current) clearInterval(mouthTimer.current);
    if (finishTimer.current) clearTimeout(finishTimer.current);
    if (videoRecoveryTimer.current) clearTimeout(videoRecoveryTimer.current);
    progressTimer.current = null;
    mouthTimer.current = null;
    finishTimer.current = null;
    videoRecoveryTimer.current = null;
  };

  const syncProgressLoop = () => {
    progressTimer.current = setInterval(() => {
      if (mediaVideoRef.current && vc.videoUrl) {
        const v = mediaVideoRef.current;
        const dur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration * 1000 : expectedDurationMs;
        setProgress((Math.min(dur, v.currentTime * 1000) / dur) * 100);
        return;
      }
      if (mediaAudioRef.current) {
        const a = mediaAudioRef.current;
        const dur = Number.isFinite(a.duration) && a.duration > 0 ? a.duration * 1000 : expectedDurationMs;
        setProgress((Math.min(dur, a.currentTime * 1000) / dur) * 100);
        return;
      }
      const inFlight = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
      setProgress((Math.min(expectedDurationMs, playedMsRef.current + inFlight) / expectedDurationMs) * 100);
    }, 200);
  };

  const stopAll = () => {
    clearTimers();
    playbackIdRef.current += 1;
    playedMsRef.current = 0;
    startedAtRef.current = null;
    if (mediaAudioRef.current) {
      mediaAudioRef.current.pause();
      mediaAudioRef.current.currentTime = 0;
      mediaAudioRef.current = null;
    }
    if (mediaVideoRef.current) {
      mediaVideoRef.current.pause();
      mediaVideoRef.current.currentTime = 0;
      mediaVideoRef.current.onended = null;
      mediaVideoRef.current.onerror = null;
      mediaVideoRef.current.onwaiting = null;
      mediaVideoRef.current.onplaying = null;
    }
    setNonCriticalAudioSuppressed(false);
    stopCurrentAudio();
    fallbackStartedRef.current = false;
    setMouthOpen(false);
  };

  const startPlay = () => {
    onActivate();
    stopAll();
    setProgress(0);
    setPhase("playing");
    setMediaStatus("starting");
    setNonCriticalAudioSuppressed(true);
    playedMsRef.current = 0;
    startedAtRef.current = Date.now();
    const playbackId = playbackIdRef.current;
    fallbackStartedRef.current = false;

    const finalizePlayback = () => {
      if (playbackIdRef.current !== playbackId) return;
      clearTimers();
      playedMsRef.current = expectedDurationMs;
      setMediaStatus("completed");
      setNonCriticalAudioSuppressed(false);
      startedAtRef.current = null;
      setProgress(100);
      setMouthOpen(false);
      setPhase("done");
    };

    const startAnimatedFallback = () => {
      finishTimer.current = setTimeout(finalizePlayback, expectedDurationMs);
      mouthTimer.current = setInterval(() => setMouthOpen((p) => !p), 180);
      syncProgressLoop();
    };

    const startAudioPlayback = () => {
      if (!vc.audioUrl) return startAnimatedFallback();
      const audio = new Audio(vc.audioUrl);
      mediaAudioRef.current = audio;
      audio.addEventListener("ended", finalizePlayback);
      audio.addEventListener("error", finalizePlayback);
      audio.play().catch(finalizePlayback);
      mouthTimer.current = setInterval(() => setMouthOpen((p) => !p), 180);
      syncProgressLoop();
    };

    const startFallbackPlayback = () => {
      if (fallbackStartedRef.current) return;
      fallbackStartedRef.current = true;
      setMediaMode("fallback");
      setMediaStatus(vc.audioUrl ? "fallback-audio" : "fallback-animated");
      if (vc.audioUrl) return startAudioPlayback();
      startAnimatedFallback();
    };

    if (vc.videoUrl && mediaVideoRef.current) {
      const video = mediaVideoRef.current;
      video.currentTime = 0;
      video.load();
      video.onended = finalizePlayback;
      video.onerror = () => {
        setMediaStatus("video-error");
        setMediaMode("fallback");
        video.onended = null;
        video.onerror = null;
        video.pause();
        video.currentTime = 0;
        startFallbackPlayback();
      };
      video.onwaiting = () => {
        setMediaStatus("video-buffering");
        if (videoRecoveryTimer.current) clearTimeout(videoRecoveryTimer.current);
        videoRecoveryTimer.current = setTimeout(() => {
          if (playbackIdRef.current !== playbackId || video.paused || video.ended) return;
          video.play().catch(() => startFallbackPlayback());
        }, 1800);
      };
      video.onplaying = () => {
        setMediaStatus("video-playing");
        if (videoRecoveryTimer.current) {
          clearTimeout(videoRecoveryTimer.current);
          videoRecoveryTimer.current = null;
        }
      };
      video.play().then(() => {
        setMediaStatus("video-playing");
        let lastTime = video.currentTime;
        let stuckTicks = 0;
        progressTimer.current = setInterval(() => {
          const dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration * 1000 : expectedDurationMs;
          setProgress((Math.min(dur, video.currentTime * 1000) / dur) * 100);

          if (Number.isFinite(video.duration) && video.duration > 0 && video.duration - video.currentTime <= 0.35) {
            finalizePlayback();
            return;
          }

          if (video.paused || video.ended) {
            lastTime = video.currentTime;
            stuckTicks = 0;
            return;
          }

          if (Math.abs(video.currentTime - lastTime) < 0.02) stuckTicks += 1;
          else stuckTicks = 0;
          lastTime = video.currentTime;

          if (stuckTicks >= 16) {
            stuckTicks = 0;
            video.play().catch(() => startFallbackPlayback());
          }
        }, 250);
      }).catch(() => {
        setMediaStatus("video-autoplay-blocked");
        setMediaMode("fallback");
        video.onended = null;
        video.onerror = null;
        video.onwaiting = null;
        video.onplaying = null;
        video.pause();
        video.currentTime = 0;
        startFallbackPlayback();
      });
      return;
    }

    startFallbackPlayback();
  };

  const pausePlay = () => {
    clearTimers();
    if (mediaAudioRef.current) {
      mediaAudioRef.current.pause();
      setMouthOpen(false);
      setPhase("paused");
      return;
    }
    if (mediaVideoRef.current && !mediaVideoRef.current.ended && mediaVideoRef.current.currentTime > 0) {
      mediaVideoRef.current.pause();
      setMouthOpen(false);
      setPhase("paused");
      return;
    }
    if (startedAtRef.current) {
      playedMsRef.current += Date.now() - startedAtRef.current;
      startedAtRef.current = null;
    }
    setMouthOpen(false);
    setPhase("paused");
  };

  const resumePlay = () => {
    if (mediaAudioRef.current) {
      mediaAudioRef.current.play().catch(() => undefined);
      setPhase("playing");
      mouthTimer.current = setInterval(() => setMouthOpen((p) => !p), 180);
      syncProgressLoop();
      return;
    }
    if (mediaVideoRef.current && !mediaVideoRef.current.ended && mediaVideoRef.current.currentTime > 0) {
      mediaVideoRef.current.play().catch(() => undefined);
      setPhase("playing");
      syncProgressLoop();
      return;
    }
    if (startedAtRef.current === null && playedMsRef.current > 0) {
      startedAtRef.current = Date.now();
      setPhase("playing");
      mouthTimer.current = setInterval(() => setMouthOpen((p) => !p), 180);
      finishTimer.current = setTimeout(() => {
        clearTimers();
        playedMsRef.current = expectedDurationMs;
        startedAtRef.current = null;
        setProgress(100);
        setMouthOpen(false);
        setPhase("done");
      }, Math.max(expectedDurationMs - playedMsRef.current, 0));
      syncProgressLoop();
    }
  };

  const restart = () => {
    stopAll();
    setProgress(0);
    setPhase("idle");
    setMediaStatus("idle");
  };

  useEffect(() => {
    if (!playbackEnabled || autoPlayKey !== vc.id || phase !== "idle" || autoStartedRef.current === autoPlayKey) return;
    autoStartedRef.current = autoPlayKey;
    startPlay();
  }, [autoPlayKey, playbackEnabled, phase, vc.id]);

  useEffect(() => {
    if (playbackEnabled) return;
    stopAll();
    setProgress(0);
    setPhase("idle");
  }, [playbackEnabled]);

  useEffect(() => () => stopAll(), []);

  const isPlaying = phase === "playing";
  const isDone = phase === "done";
  const isPaused = phase === "paused";
  const isIdle = phase === "idle";
  const showSituation = !isAnswered && (hasVideoMedia || !isIdle || isDone || isPaused);
  const barHeights = [3, 6, 9, 12, 9, 6, 3, 6, 9, 6, 3];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="relative min-h-[340px] flex-1 overflow-hidden rounded-xl" style={{ background: "linear-gradient(135deg, #0d1117 0%, #1a1a2e 50%, #0d1117 100%)" }}>
        {vc.imageUrl && !hasVideoMedia && (
          <>
            <img src={vc.imageUrl} alt={vc.title} loading="eager" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-30" />
            <div className="absolute inset-0 bg-[#0d1117]/70" />
          </>
        )}

        {hasVideoMedia && (
          <>
            <video ref={mediaVideoRef} src={vc.videoUrl || undefined} poster={vc.imageUrl || undefined} playsInline preload="auto" className="absolute inset-0 h-full w-full bg-black object-contain" />
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0d1117]/85 via-[#0d1117]/25 to-transparent pointer-events-none" />
          </>
        )}

        {isPlaying && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#FF6B00]/8 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#FF6B00]/5 to-transparent" />
          </div>
        )}

        {hasVideoMedia ? (
          <>
            <div className="absolute inset-x-0 bottom-4 flex items-end justify-between gap-3 px-4">
              <div className="max-w-[75%] rounded-2xl border border-white/10 bg-[#0d1117]/70 px-4 py-3 backdrop-blur-sm">
                <div className="text-sm font-bold text-white">{vc.sender}</div>
                <div className="mt-0.5 text-[13px] text-[#e1ebfa]">{vc.role}</div>
              </div>
              <div className="rounded-full border border-[#FF6B00]/30 bg-[#0d1117]/70 px-3 py-1 text-[11px] font-semibold text-[#FFB36B] backdrop-blur-sm">
                Реальное видео
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-20 flex justify-center px-4">
              <div className="rounded-full bg-[#0d1117]/72 px-4 py-1.5 text-xs text-white backdrop-blur-sm">
                {isIdle && "Нажмите ▶ для воспроизведения видео"}
                {isPlaying && "Видео воспроизводится"}
                {isPaused && "Видео на паузе"}
                {isDone && "✓ Видео просмотрено"}
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="relative">
              {isPlaying && (
                <div className="absolute inset-0 rounded-full border-2 border-[#FF6B00]/30 animate-ping scale-125" />
              )}
              <div
                className={`relative w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 ${
                  isPlaying ? "border-2 border-[#FF6B00]/60" : isDone ? "border-2 border-[#00d4aa]/60" : "border-2 border-[#2a3a4e]"
                }`}
                style={{ background: "linear-gradient(145deg, #1e2a3a, #0d1117)" }}
              >
                <div className="flex gap-4 mb-1.5">
                  <div className={`w-3 h-3 rounded-full transition-all ${isPlaying && mouthOpen ? "h-1 bg-[#c0c0d0]" : "bg-[#e0e0f0]"}`} />
                  <div className={`w-3 h-3 rounded-full transition-all ${isPlaying && mouthOpen ? "h-1 bg-[#c0c0d0]" : "bg-[#e0e0f0]"}`} />
                </div>
                <div className="w-1 h-1 rounded-full bg-[#8890a8] mb-1" />
                <div
                  className="transition-all duration-100 rounded-full bg-[#e0e0f0]"
                  style={{
                    width: isPlaying ? (mouthOpen ? 18 : 10) : isDone ? 18 : 8,
                    height: isPlaying ? (mouthOpen ? 10 : 3) : isDone ? 5 : 3,
                  }}
                />
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-[#FF6B00] flex items-center justify-center text-sm font-bold text-white shadow-lg">
                  {vc.senderAvatar}
                </div>
              </div>
            </div>

            <div className="text-center">
              <div className="text-sm font-bold text-white">{vc.sender}</div>
              <div className="text-[13px] text-[#d4e0f3] mt-0.5">{vc.role}</div>
            </div>

            {isPlaying && (
              <div className="flex items-end gap-1 h-8">
                {barHeights.map((h, i) => (
                  <div
                    key={i}
                    className="w-1.5 rounded-full bg-[#FF6B00] transition-all"
                    style={{
                      height: `${mouthOpen ? h * (1 + (i % 3) * 0.3) : h * 0.4}px`,
                      opacity: 0.7 + (i % 3) * 0.1,
                      transitionDuration: "180ms",
                    }}
                  />
                ))}
                <Volume2 className="w-4 h-4 text-[#FF6B00] ml-1 animate-pulse" />
              </div>
            )}

            <div className="text-xs text-center px-4">
              {isIdle && <span className="text-[#d4e0f3]">Нажмите ▶ для воспроизведения сообщения</span>}
              {isPlaying && <span className="text-[#FF6B00] animate-pulse">Воспроизведение...</span>}
              {isPaused && <span className="text-[#ffc107]">Пауза</span>}
              {isDone && <span className="text-[#00d4aa]">✓ Сообщение прослушано</span>}
            </div>

            <div className="rounded-full border border-[#2a3a4e] bg-[#0d1117]/70 px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-[#9fb4cf]">
              media: {mediaStatus}
            </div>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-[#1a1a2e]">
          <div className="h-full bg-[#FF6B00] transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center gap-2 px-2 py-2">
        {isIdle ? (
          <button onClick={startPlay} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF6B00] hover:bg-[#e06000] text-white text-xs font-semibold transition-all">
            <Play className="w-3.5 h-3.5" fill="white" /> Воспроизвести
          </button>
        ) : isPlaying ? (
          <button onClick={pausePlay} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1e2a3a] border border-[#2a3a4e] hover:border-[#FF6B00]/40 text-white text-xs transition-all">
            <Pause className="w-3.5 h-3.5" /> Пауза
          </button>
        ) : isPaused ? (
          <button onClick={resumePlay} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF6B00] hover:bg-[#e06000] text-white text-xs font-semibold transition-all">
            <Play className="w-3.5 h-3.5" fill="white" /> Продолжить
          </button>
        ) : null}

        <button onClick={restart} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1e2a3a] border border-[#2a3a4e] text-[#8890a8] hover:text-white hover:border-[#3a4a5e] text-xs transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Сначала
        </button>

        <div className="ml-auto text-[11px] text-[#c8d3e7] tabular-nums">{Math.round(progress)}%</div>
      </div>

      {showSituation && (
        <div className="flex-shrink-0 mx-0 mb-2 p-3 rounded-xl border border-[#FF6B00]/20 bg-[#FF6B00]/5">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#FFD19B]">Ситуация</div>
          <p className="text-[13px] text-[#eef3ff] leading-relaxed">{vc.situation}</p>
        </div>
      )}

      {!isAnswered && (
        <div className="flex-shrink-0 rounded-xl border border-[#31455f] bg-[#101a29]/80 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c7cfff]">Панель действий</div>
          <div className="mt-2 text-[13px] leading-relaxed text-[#e1ebfa]">
            После старта просмотра варианты решения будут доступны в нижней панели действий.
          </div>
        </div>
      )}

      {isAnswered && (
        <div className="flex-shrink-0 flex items-center gap-2 p-3 rounded-xl bg-[#00d4aa]/5 border border-[#00d4aa]/20">
          <CheckCircle className="w-4 h-4 text-[#00d4aa] flex-shrink-0" />
          <span className="text-xs text-[#00d4aa]">Реакция зафиксирована в профиле</span>
        </div>
      )}
    </div>
  );
}

export default function VideoMessages({
  arrivedVideos,
  answeredVideoIds,
}: {
  arrivedVideos: string[];
  answeredVideoIds: string[];
  onAnswer: (videoId: string, option: any) => void;
}) {
  const { state, dispatch } = useSimulation();
  const videos = VIDEO_CASES
    .filter((video) => arrivedVideos.includes(video.id))
    .sort((left, right) => {
      const leftArrivedAt = state.videoSignalMeta[left.id]?.arrivedAt ?? left.arrivalMinute * 60;
      const rightArrivedAt = state.videoSignalMeta[right.id]?.arrivedAt ?? right.arrivalMinute * 60;
      return leftArrivedAt - rightArrivedAt || left.sortOrder - right.sortOrder;
    });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const firstUnanswered = videos.find((v) => !answeredVideoIds.includes(v.id));
  const actionPanelVideoId =
    state.actionPanelSource === "video" && state.actionPanelContentId
      ? state.actionPanelContentId
      : null;
  const activeId = actionPanelVideoId ?? selectedId ?? firstUnanswered?.id ?? videos[0]?.id ?? null;
  const activeVc = videos.find((v) => v.id === activeId);
  const activeDecision = activeVc
    ? state.decisions.find((decision) => decision.sourceType === "video" && decision.caseId === activeVc.id) || null
    : null;

  const isVideoPlaybackEnabled =
    activeVc != null &&
    (state.actionPanelSource == null ||
      (state.actionPanelSource === "video" && state.actionPanelContentId === activeVc.id));

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center">
        <Video className="w-12 h-12 text-[#555570] mb-3" />
        <p className="text-sm text-[#555570]">Видеосообщений нет</p>
        <p className="text-xs text-[#3a3a50] mt-1">Видео появятся автоматически</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      {videos.length > 1 && (
        <div className="custom-scroll flex-shrink-0 flex gap-2 overflow-x-auto pb-1">
          {videos.map((v) => {
            const answered = answeredVideoIds.includes(v.id);
            const active = v.id === activeId;
            return (
              <button
                key={v.id}
                onClick={() => {
                  setSelectedId(v.id);
                  dispatch({ type: "CLEAR_ACTION_PANEL" });
                }}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                  active
                    ? "border-[#a78bfa] bg-[#a78bfa]/10 text-white"
                    : answered
                    ? "border-[#00d4aa]/30 bg-[#00d4aa]/5 text-[#00d4aa]"
                    : "border-[#2a3a4e] bg-[#141c2b]/60 text-[#8890a8] hover:border-[#3a4a5e]"
                }`}
              >
                {answered ? <CheckCircle className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                <span className="truncate max-w-[120px]">{v.sender}</span>
              </button>
            );
          })}
        </div>
      )}

      {activeVc && (
        <div className="custom-scroll min-h-[420px] flex-1 overflow-y-auto pr-1">
          {state.videoSignalMeta[activeVc.id]?.deadline && (
            <div className="mb-2">
              <DeadlineChip
                deadline={state.videoSignalMeta[activeVc.id]?.deadline}
                elapsedSeconds={state.elapsedSeconds}
                referenceElapsedSeconds={activeDecision?.timer?.resolvedAtElapsed ?? null}
              />
            </div>
          )}
          <TalkingAvatarPlayer
            key={activeVc.id}
            vc={activeVc}
            isAnswered={answeredVideoIds.includes(activeVc.id)}
            onActivate={() => dispatch({ type: "OPEN_VIDEO", payload: activeVc.id })}
            playbackEnabled={isVideoPlaybackEnabled}
            autoPlayKey={actionPanelVideoId === activeVc.id ? activeVc.id : null}
          />
        </div>
      )}
    </div>
  );
}
