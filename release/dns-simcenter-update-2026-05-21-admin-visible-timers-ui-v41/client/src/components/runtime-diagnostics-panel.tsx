import { Activity, Clock3, Radio, ServerCog } from "lucide-react";
import { getRuntimeDiagnosticsSnapshot, useSimulation } from "../context/SimulationContext";

function formatEta(seconds: number | null) {
  if (seconds == null) {
    return "нет";
  }

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function getSourceLabel(source: ReturnType<typeof getRuntimeDiagnosticsSnapshot>["activeSource"]) {
  switch (source) {
    case "main_case":
      return "Звонок";
    case "email":
      return "Почта";
    case "messenger":
      return "ТёрКограмм";
    case "video":
      return "Видео";
    default:
      return "Ожидание";
  }
}

function getChannelLabel(channel: NonNullable<ReturnType<typeof getRuntimeDiagnosticsSnapshot>["nextChannelEvent"]>["channelType"]) {
  switch (channel) {
    case "email":
      return "Почта";
    case "messenger":
      return "ТёрКограмм";
    case "video":
      return "Видео";
    default:
      return channel;
  }
}

export default function RuntimeDiagnosticsPanel() {
  const { state, liveSocketConnected, liveStatus, mode } = useSimulation();
  const diagnostics = getRuntimeDiagnosticsSnapshot(state);
  const totalPending =
    diagnostics.pendingMainSignals +
    diagnostics.pendingEmailSignals +
    diagnostics.pendingMessengerSignals +
    diagnostics.pendingVideoSignals;

  return (
    <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-3 backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-2">
        <ServerCog className="h-4 w-4 text-[#8ec5ff]" />
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8ec5ff]">Диагностика сессии</div>
          <div className="text-[11px] text-[#9fb4cf]">
            {mode === "student" ? "Рантайм студента" : mode === "assessor-monitor" ? "Режим наблюдения" : "Локальная симуляция"}
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="rounded-xl border border-[#2a3a4e] bg-[#141c2b]/70 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase tracking-[0.16em] text-[#8b93ab]">Активный источник</span>
            <span className="rounded-full border border-[#35506f] bg-[#1a2435] px-2 py-0.5 text-[10px] font-semibold text-white">
              {getSourceLabel(diagnostics.activeSource)}
            </span>
          </div>
          <div className="mt-1 text-[12px] font-medium leading-5 text-[#eef3ff]">{diagnostics.activeTitle}</div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-[#2a3a4e] bg-[#141c2b]/70 p-2.5">
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-[#8b93ab]">
              <Activity className="h-3.5 w-3.5 text-[#FFB36B]" />
              В очереди
            </div>
            <div className="mt-1 text-sm font-semibold text-white">{totalPending}</div>
            <div className="mt-1 text-[11px] leading-5 text-[#aab7d0]">
              Звонки {diagnostics.pendingMainSignals} · Почта {diagnostics.pendingEmailSignals} · Чат {diagnostics.pendingMessengerSignals} · Видео {diagnostics.pendingVideoSignals}
            </div>
          </div>
          <div className="rounded-xl border border-[#2a3a4e] bg-[#141c2b]/70 p-2.5">
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-[#8b93ab]">
              <Radio className="h-3.5 w-3.5 text-[#00d4aa]" />
              Синхронизация
            </div>
            <div className="mt-1 text-sm font-semibold text-white">
              {liveSocketConnected ? "Онлайн" : liveStatus ? "Резервный канал" : "Локально"}
            </div>
            <div className="mt-1 text-[11px] text-[#aab7d0]">
              Статус: {liveStatus === "completed" ? "завершена" : liveStatus === "running" ? "идёт" : liveStatus === "waiting" ? "ожидание" : "не используется"}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#2a3a4e] bg-[#141c2b]/70 p-2.5">
          <div className="flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-[#8b93ab]">
            <Clock3 className="h-3.5 w-3.5 text-[#ffc107]" />
            Ближайшие события
          </div>
          <div className="mt-1 text-[12px] text-[#eef3ff]">
            Следующий кейс: <span className="font-semibold">{formatEta(diagnostics.nextMainSignalEtaSeconds)}</span>
          </div>
          <div className="mt-1 text-[12px] text-[#d3deee]">
            Следующий канал:{" "}
            {diagnostics.nextChannelEvent
              ? `${getChannelLabel(diagnostics.nextChannelEvent.channelType)} через ${formatEta(diagnostics.nextChannelEvent.etaSeconds)}`
              : "нет"}
          </div>
          {diagnostics.nextChannelEvent && (
            <div className="mt-1 max-h-10 overflow-hidden text-[11px] text-[#9fb4cf]">{diagnostics.nextChannelEvent.title}</div>
          )}
        </div>

        <div className="rounded-xl border border-[#2a3a4e] bg-[#141c2b]/70 p-2.5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-[#8b93ab]">Медиа-кэш</div>
          <div className="mt-1 text-sm font-semibold text-white">{diagnostics.preloadedMediaCount}</div>
          <div className="mt-1 text-[11px] text-[#aab7d0]">Количество уже прогретых изображений, аудио и видео в текущей сессии.</div>
        </div>
      </div>
    </div>
  );
}
