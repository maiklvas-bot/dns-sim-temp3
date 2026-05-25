import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useSimulation, type RealisticMetrics } from "../context/SimulationContext";
import { CASES_DATA } from "../data/cases";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { getSimulationSettingsSnapshot } from "@/lib/runtime-content";
import type { SimulationRuntimeSettings } from "@shared/simulation-content";
import {
  ArrowLeft, Play, Shield, Zap, Flame,
  GraduationCap, Award, Mail, MessageSquare, Video, Phone, BarChart3, Eye, Users, ArrowRight, Trash2, FileText
} from "lucide-react";
import { primeAudioPlayback } from "@/data/audio-map";
import {
  createRemoteLiveSimulation,
  fetchRemoteLiveSimulation,
  resetLiveSimulation,
  setLiveSimulationConfig,
  setLiveSimulationRole,
} from "@/lib/live-session";
import type { LiveSimulationMonitorSummary } from "@shared/live-session";
import { STORE_METRIC_HELPERS, STORE_METRIC_LABELS, STORE_STATE_PRESETS } from "@/lib/store-metrics";
import storeBg from "@assets/store_bg.png";

const DIFFICULTY_INFO = {
  easy: {
    icon: Shield,
    label: "Лёгкий",
    color: "#00d4aa",
    description: "Очевидные правильные ответы, простые ситуации. Только аудиосигналы. Рекомендуется для первого прохождения.",
    channels: { audio: true, email: false, messenger: false, video: false },
  },
  medium: {
    icon: Zap,
    label: "Средний",
    color: "#ffc107",
    description: "Менее очевидные ответы, взаимосвязи между решениями. Аудио + почта + мессенджер.",
    channels: { audio: true, email: true, messenger: true, video: false },
  },
  hard: {
    icon: Flame,
    label: "Сложный",
    color: "#ff4444",
    description: "Сложные взаимозависимости, все каналы активны одновременно. Минимум подсказок.",
    channels: { audio: true, email: true, messenger: true, video: true },
  },
};

const START_OF_DAY_METRICS: RealisticMetrics = {
  customersInStore: 0,
  avgCheck: 0,
  conversion: 0,
  nps: 0,
  pickupSpeed: 0,
  warehouseLoad: 0,
  teamMorale: 7,
  dailyRevenue: 0,
};

const SIMULATION_ROLE_CARDS = [
  {
    id: "cosmonaut",
    title: "Симуляция Космонавта",
    description: "Полностью рабочий сценарий с настройкой кейсов, каналов, времени и live-наблюдением.",
    participantRole: "Симуляция Космонавта",
    available: true,
  },
  {
    id: "deputy-manager",
    title: "Симуляция Заместителя Управляющего",
    description: "Отдельный набор сценариев и настроек будет добавлен позже.",
    participantRole: "Симуляция Заместителя Управляющего",
    available: false,
  },
  {
    id: "manager",
    title: "Симуляция Управляющего",
    description: "Отдельный набор сценариев и настроек будет добавлен позже.",
    participantRole: "Симуляция Управляющего",
    available: false,
  },
] as const;

const ASSESSOR_WIKI_POINTS = [
  "Кейс в симуляции — это управленческая ситуация с сигналом, вариантами реакции и измеримым влиянием на метрики магазина и компетенции участника.",
  "Оценщик задаёт стартовый контекст: уровень сложности, набор кейсов, стартовое состояние магазина и рабочее время, в котором студент должен справиться.",
  "Каждое решение студента влияет сразу в двух плоскостях: на операционные показатели магазина и на итоговый профиль компетенций в отчёте.",
  "Готовые пресеты состояния магазина нужны, чтобы быстро запускать типовые сценарии: спокойная смена, напряжённый день, кризисный старт и другие.",
  "Режим наблюдения даёт видеть ход живой симуляции и журнал действий без возможности вмешаться в решения студента.",
] as const;

const TIME_PROFILE_RATIO = {
  easy: 1.1,
  medium: 1,
  hard: 0.8,
} as const;

export default function AssessorPage() {
  const [, navigate] = useLocation();
  const { dispatch } = useSimulation();
  const settings = getSimulationSettingsSnapshot<SimulationRuntimeSettings>();
  const easyCount = Number(settings?.easyAutoCaseCount ?? 6);
  const mediumCount = Number(settings?.mediumAutoCaseCount ?? 10);
  const hardCount = Number(settings?.hardAutoCaseCount ?? CASES_DATA.length);
  const hardSimulationMinutes = Number(settings?.hardSimulationMinutes ?? 60);
  const defaultTimePerCaseMinutes = Number(settings?.defaultTimePerCaseMinutes ?? 4);
  const minSimulationMinutes = Number(settings?.minSimulationMinutes ?? 20);

  const [assessorName, setAssessorName] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [simulationRole, setSimulationRole] = useState<(typeof SIMULATION_ROLE_CARDS)[number]["id"]>("cosmonaut");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [manualSelection, setManualSelection] = useState(false);
  const [repeatCases, setRepeatCases] = useState(false);
  const [selectedCases, setSelectedCases] = useState<string[]>(CASES_DATA.map(c => c.id));
  const [isTestMode, setIsTestMode] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [channels, setChannels] = useState({ audio: true, email: true, messenger: true, video: false });
  const [initialMetrics, setInitialMetrics] = useState<RealisticMetrics>(START_OF_DAY_METRICS);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [observeLoadingId, setObserveLoadingId] = useState<string | null>(null);
  const [removeLoadingId, setRemoveLoadingId] = useState<string | null>(null);

  const liveSessionsQuery = useQuery({
    queryKey: ["/api/staff/live-sessions"],
    queryFn: getQueryFn<LiveSimulationMonitorSummary[]>({ on401: "throw" }),
    refetchInterval: 2500,
  });

  // Auto-set channels based on difficulty
  useEffect(() => {
    setLiveSimulationRole("assessor-setup");
    setChannels(DIFFICULTY_INFO[difficulty].channels);
  }, [difficulty]);

  useEffect(() => {
    setLiveSimulationRole("assessor-setup");
  }, []);

  useEffect(() => {
    setSelectedCases(CASES_DATA.map((item) => item.id));
  }, [CASES_DATA.length]);

  const monitorSessions = useMemo(
    () => liveSessionsQuery.data || [],
    [liveSessionsQuery.data],
  );

  const toggleCase = (id: string) => {
    setSelectedCases(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleStart = async () => {
    setStartError(null);
    setIsStarting(true);
    const casesToUse = manualSelection ? selectedCases : getAutoCases(difficulty);
    const baseTimeLimit =
      difficulty === "hard"
        ? hardSimulationMinutes
        : Math.max(casesToUse.length * defaultTimePerCaseMinutes, minSimulationMinutes);
    const resolvedTimeLimit = Boolean(settings?.timeInfluenceEnabled)
      ? Math.max(5, Math.round(baseTimeLimit * TIME_PROFILE_RATIO[difficulty]))
      : baseTimeLimit;
    const liveConfigPayload = {
      assessorName,
      participantName,
      participantRole: SIMULATION_ROLE_CARDS.find((item) => item.id === simulationRole)?.participantRole || "Симуляция Космонавта",
      difficulty,
      selectedCaseIds: casesToUse,
      manualSelection,
      repeatCases,
      timeLimit: resolvedTimeLimit,
      isTestMode,
      speedMultiplier: isTestMode ? speedMultiplier : 1,
      enabledChannels: channels,
      initialMetrics,
    };

    try {
      await primeAudioPlayback();
      resetLiveSimulation();
      await createRemoteLiveSimulation(liveConfigPayload);
      setLiveSimulationRole("assessor-monitor");
      dispatch({ type: "RESET" });
      navigate("/simulation");
    } catch (error) {
      console.error("Failed to create live session", error);
      setStartError("Не удалось создать live-сессию для студента. Проверьте соединение и попробуйте ещё раз.");
    } finally {
      setIsStarting(false);
    }
  };

  const applyMetricPreset = (presetId: string) => {
    const preset = STORE_STATE_PRESETS.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    setInitialMetrics(preset.metrics);
  };

  const observeLiveSession = async (liveSessionId: string) => {
    setObserveLoadingId(liveSessionId);
    setStartError(null);
    try {
      const session = await fetchRemoteLiveSimulation(liveSessionId);
      setLiveSimulationConfig(session.config);
      setLiveSimulationRole("assessor-monitor");
      navigate("/simulation");
    } catch (error) {
      console.error("Failed to open live session monitor", error);
      setStartError("Не удалось открыть live-наблюдение. Попробуйте обновить список и повторить.");
    } finally {
      setObserveLoadingId(null);
    }
  };

  const removeLiveSession = async (liveSessionId: string) => {
    setRemoveLoadingId(liveSessionId);
    setStartError(null);
    try {
      await apiRequest("DELETE", `/api/live-sessions/${liveSessionId}`);
      await liveSessionsQuery.refetch();
    } catch (error) {
      console.error("Failed to remove live session", error);
      setStartError("Не удалось убрать участника из списка. Попробуйте ещё раз.");
    } finally {
      setRemoveLoadingId(null);
    }
  };

  const getAutoCases = (diff: string): string[] => {
    if (diff === "easy") return CASES_DATA.slice(0, easyCount).map(c => c.id);
    if (diff === "hard") return CASES_DATA.slice(0, hardCount).map(c => c.id);
    return CASES_DATA.slice(0, mediumCount).map(c => c.id);
  };

  const activeCaseCount = manualSelection ? selectedCases.length : getAutoCases(difficulty).length;
  const selectedSimulationCard = SIMULATION_ROLE_CARDS.find((item) => item.id === simulationRole) || SIMULATION_ROLE_CARDS[0];
  const isCosmonautSimulation = simulationRole === "cosmonaut";
  const updateMetric = <K extends keyof RealisticMetrics>(key: K, value: number) => {
    setInitialMetrics((current) => ({ ...current, [key]: Number.isFinite(value) ? value : 0 }));
  };

  const channelInfo = [
    { key: "audio", label: "Аудиозвонки", icon: Phone, color: "#FF6B00" },
    { key: "email", label: "Корпоративная почта", icon: Mail, color: "#4a9eff" },
    { key: "messenger", label: "ТёрКограмм", icon: MessageSquare, color: "#00d4aa" },
    { key: "video", label: "Видеосообщения", icon: Video, color: "#a78bfa" },
  ] as const;

  return (
    <div
      className="min-h-screen relative overflow-auto"
      style={{
        backgroundImage: `url(${storeBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a2ef0] via-[#16213ef2] to-[#1a1a2ef0]" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-[#8890a8] hover:text-white transition-colors mb-6 text-sm"
          data-testid="back-button"
        >
          <ArrowLeft className="w-4 h-4" /> Назад к выбору роли
        </button>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">Панель оценщика</h1>
          <p className="text-[#8890a8] text-sm mt-1">Настройте параметры симуляции перед запуском</p>
        </div>

        <div className="space-y-5">
          {/* Names */}
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5">
            <h3 className="text-sm font-semibold text-[#FF6B00] mb-4 uppercase tracking-wider">Участники</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label className="text-xs text-[#8890a8] mb-1.5 block">ФИО оценщика</Label>
                <Input
                  value={assessorName}
                  onChange={e => setAssessorName(e.target.value)}
                  placeholder="Иванов И.И."
                  className="bg-[#141c2b] border-[#2a3a4e] text-white placeholder:text-[#4a5068]"
                  data-testid="input-assessor-name"
                />
              </div>
              <div>
                <Label className="text-xs text-[#8890a8] mb-1.5 block">ФИО участника</Label>
                <Input
                  value={participantName}
                  onChange={e => setParticipantName(e.target.value)}
                  placeholder="Петров П.П."
                  className="bg-[#141c2b] border-[#2a3a4e] text-white placeholder:text-[#4a5068]"
                  data-testid="input-participant-name"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5">
            <h3 className="text-sm font-semibold text-[#FF6B00] mb-4 uppercase tracking-wider">Тип симуляции</h3>
            <div className="grid gap-3 md:grid-cols-3">
              {SIMULATION_ROLE_CARDS.map((item) => {
                const isActive = simulationRole === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSimulationRole(item.id)}
                    className={`relative min-h-[150px] overflow-hidden rounded-xl border p-4 text-left transition-all ${
                      isActive
                        ? "border-[#4a9eff] bg-[#4a9eff]/10"
                        : "border-[#2a3a4e] bg-[#141c2b]/45 hover:border-[#3a4a5e]"
                    }`}
                  >
                    <div className="min-w-0">
                      <div>
                        <div className="text-sm font-semibold leading-5 text-white">{item.title}</div>
                        <div className="mt-2 text-xs leading-relaxed text-[#a5b2c8]">{item.description}</div>
                      </div>
                      {!item.available && (
                        <span className="absolute bottom-3 right-3 rounded-full border border-[#ffc107]/35 bg-[#ffc107]/12 px-2 py-1 text-[8px] font-semibold uppercase leading-none tracking-[0.04em] text-[#ffd56e]">
                          В разработке
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            {!isCosmonautSimulation && (
              <div className="mt-4 rounded-xl border border-[#ffc107]/30 bg-[#ffc107]/8 px-4 py-3 text-sm text-[#ffe39f]">
                Для типа «{selectedSimulationCard.title}» отдельные блоки настроек ещё находятся на стадии разработки. Сейчас доступна только «Симуляция Космонавта».
              </div>
            )}
          </div>

          {/* Mode: Test vs Real */}
          {isCosmonautSimulation && (
            <>
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5">
            <h3 className="text-sm font-semibold text-[#FF6B00] mb-4 uppercase tracking-wider">Режим прохождения</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setIsTestMode(false)}
                className={`p-4 rounded-lg border text-left transition-all ${
                  !isTestMode
                    ? "border-[#00d4aa] bg-[#00d4aa]/10"
                    : "border-[#2a3a4e] bg-[#141c2b]/50 hover:border-[#3a4a5e]"
                }`}
                data-testid="mode-credit"
              >
                <Award className="w-5 h-5 mb-2 text-[#00d4aa]" />
                <div className="text-sm font-semibold text-white">В зачёт</div>
                <p className="text-xs text-[#8890a8] mt-1">Все решения записываются в итоговый профиль. Результат считается официальной оценкой.</p>
              </button>
              <button
                onClick={() => setIsTestMode(true)}
                className={`p-4 rounded-lg border text-left transition-all ${
                  isTestMode
                    ? "border-[#ffc107] bg-[#ffc107]/10"
                    : "border-[#2a3a4e] bg-[#141c2b]/50 hover:border-[#3a4a5e]"
                }`}
                data-testid="mode-test"
              >
                <GraduationCap className="w-5 h-5 mb-2 text-[#ffc107]" />
                <div className="text-sm font-semibold text-white">Тестирование</div>
                <p className="text-xs text-[#8890a8] mt-1">Режим знакомства с механиками. Результаты не засчитываются. Можно ускорить поток сигналов.</p>
              </button>
            </div>

            {isTestMode && (
              <div className="mt-4 p-4 rounded-lg border border-[#ffc107]/30 bg-[#ffc107]/5">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-xs text-[#ffc107] font-semibold">
                  Скорость симуляции: {speedMultiplier}x
                </Label>
                <span className="text-[10px] text-[#8890a8]">
                  {speedMultiplier === 1 ? "Нормальный темп" : speedMultiplier <= 3 ? "Ускоренный" : speedMultiplier <= 6 ? "Быстрый" : "Экстремальный"}
                </span>
              </div>
                <Slider
                  value={[speedMultiplier]}
                  onValueChange={([v]) => setSpeedMultiplier(v)}
                  min={1}
                  max={10}
                  step={1}
                  className="w-full"
                  data-testid="slider-speed"
                />
                <div className="flex justify-between text-[10px] text-[#555570] mt-1">
                  <span>x1</span>
                  <span>x5</span>
                  <span>x10</span>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-[#c9a94d]">
                  В тестовом режиме ускоряются и сигналы, и течение симуляционного времени. Если пройти все сценарии раньше, симуляция завершится автоматически.
                </p>
              </div>
            )}
          </div>

          {/* Difficulty */}
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5">
            <h3 className="text-sm font-semibold text-[#FF6B00] mb-4 uppercase tracking-wider">Уровень сложности</h3>
            <div className="grid grid-cols-3 gap-3">
              {(["easy", "medium", "hard"] as const).map(d => {
                const info = DIFFICULTY_INFO[d];
                const Icon = info.icon;
                const isActive = difficulty === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      isActive
                        ? "border-[color:var(--c)] bg-[color:var(--c)]/10"
                        : "border-[#2a3a4e] bg-[#141c2b]/50 hover:border-[#3a4a5e]"
                    }`}
                    style={{ "--c": info.color } as any}
                    data-testid={`difficulty-${d}`}
                  >
                    <Icon className="w-5 h-5 mb-2" style={{ color: info.color }} />
                    <div className="text-sm font-semibold text-white">{info.label}</div>
                    <p className="text-xs text-[#8890a8] mt-1 leading-relaxed">{info.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Communication Channels */}
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5">
            <h3 className="text-sm font-semibold text-[#FF6B00] mb-1 uppercase tracking-wider">Каналы коммуникации</h3>
            <p className="text-xs text-[#8890a8] mb-4">Автоматически подбираются по сложности. Можно изменить вручную.</p>
            <div className="grid grid-cols-2 gap-3">
              {channelInfo.map(({ key, label, icon: Icon, color }) => {
                const isOn = channels[key];
                return (
                  <div
                    key={key}
                    onClick={() => setChannels(prev => ({ ...prev, [key]: !prev[key] }))}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      isOn
                        ? "border-[color:var(--c)] bg-[color:var(--c)]/8"
                        : "border-[#2a3a4e] bg-[#141c2b]/30 opacity-50"
                    }`}
                    style={{ "--c": color } as any}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
                    <span className="text-sm text-white">{label}</span>
                    <div className={`ml-auto w-3 h-3 rounded-full flex-shrink-0 ${isOn ? "bg-[color:var(--c)]" : "bg-[#2a3a4e]"}`} style={{ "--c": color } as any} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#4a9eff]" />
              <div>
                <h3 className="text-sm font-semibold text-[#4a9eff] uppercase tracking-wider">Стартовые метрики смены</h3>
                <p className="mt-1 text-xs text-[#8890a8]">
                  Оценщик задаёт стартовые показатели магазина в начале рабочего дня. Дальше они изменяются только решениями космонавта.
                </p>
              </div>
            </div>
            <div className="mb-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#8ec5ff]">Готовые состояния магазина</div>
              <div className="grid gap-3 md:grid-cols-2">
                {STORE_STATE_PRESETS.map((preset) => {
                  const isActive = Object.entries(preset.metrics).every(([key, value]) => initialMetrics[key as keyof RealisticMetrics] === value);
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyMetricPreset(preset.id)}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        isActive
                          ? "border-[#4a9eff] bg-[#4a9eff]/10"
                          : "border-[#2a3a4e] bg-[#141c2b]/40 hover:border-[#3a4a5e]"
                      }`}
                    >
                      <div className="text-sm font-semibold text-white">{preset.title}</div>
                      <div className="mt-1 text-xs leading-relaxed text-[#8890a8]">{preset.summary}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <Label className="text-xs text-[#8890a8] mb-1.5 block">{STORE_METRIC_LABELS.customersInStore}</Label>
                <Input value={initialMetrics.customersInStore} onChange={(e) => updateMetric("customersInStore", Number(e.target.value))} className="bg-[#141c2b] border-[#2a3a4e] text-white" />
              </div>
              <div>
                <Label className="text-xs text-[#8890a8] mb-1.5 block">{STORE_METRIC_LABELS.avgCheck}, {STORE_METRIC_HELPERS.avgCheck}</Label>
                <Input value={initialMetrics.avgCheck} onChange={(e) => updateMetric("avgCheck", Number(e.target.value))} className="bg-[#141c2b] border-[#2a3a4e] text-white" />
              </div>
              <div>
                <Label className="text-xs text-[#8890a8] mb-1.5 block">{STORE_METRIC_LABELS.conversion}, {STORE_METRIC_HELPERS.conversion}</Label>
                <Input value={initialMetrics.conversion} onChange={(e) => updateMetric("conversion", Number(e.target.value))} className="bg-[#141c2b] border-[#2a3a4e] text-white" />
              </div>
              <div>
                <Label className="text-xs text-[#8890a8] mb-1.5 block">{STORE_METRIC_LABELS.nps}</Label>
                <Input value={initialMetrics.nps} onChange={(e) => updateMetric("nps", Number(e.target.value))} className="bg-[#141c2b] border-[#2a3a4e] text-white" />
              </div>
              <div>
                <Label className="text-xs text-[#8890a8] mb-1.5 block">{STORE_METRIC_LABELS.pickupSpeed}, {STORE_METRIC_HELPERS.pickupSpeed}</Label>
                <Input value={initialMetrics.pickupSpeed} onChange={(e) => updateMetric("pickupSpeed", Number(e.target.value))} className="bg-[#141c2b] border-[#2a3a4e] text-white" />
              </div>
              <div>
                <Label className="text-xs text-[#8890a8] mb-1.5 block">{STORE_METRIC_LABELS.warehouseLoad}, {STORE_METRIC_HELPERS.warehouseLoad}</Label>
                <Input value={initialMetrics.warehouseLoad} onChange={(e) => updateMetric("warehouseLoad", Number(e.target.value))} className="bg-[#141c2b] border-[#2a3a4e] text-white" />
              </div>
              <div>
                <Label className="text-xs text-[#8890a8] mb-1.5 block">{STORE_METRIC_LABELS.teamMorale}</Label>
                <Input value={initialMetrics.teamMorale} onChange={(e) => updateMetric("teamMorale", Number(e.target.value))} className="bg-[#141c2b] border-[#2a3a4e] text-white" />
              </div>
              <div>
                <Label className="text-xs text-[#8890a8] mb-1.5 block">{STORE_METRIC_LABELS.dailyRevenue}, {STORE_METRIC_HELPERS.dailyRevenue}</Label>
                <Input value={initialMetrics.dailyRevenue} onChange={(e) => updateMetric("dailyRevenue", Number(e.target.value))} className="bg-[#141c2b] border-[#2a3a4e] text-white" />
              </div>
            </div>
          </div>

          {/* Case Selection */}
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-wider">Выбор кейсов (аудио)</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#8890a8]">Ручной выбор</span>
                <Switch
                  checked={manualSelection}
                  onCheckedChange={setManualSelection}
                  data-testid="toggle-manual"
                />
              </div>
            </div>

            {!manualSelection ? (
              <div className="bg-[#141c2b]/60 rounded-lg p-4 border border-[#2a3a4e]/50">
                <p className="text-sm text-[#a0a0b8]">
                  Автогенерация по уровню сложности. Будет выбрано <span className="text-white font-medium">{activeCaseCount} кейсов</span> из {CASES_DATA.length}. Порядок перемешивается случайно.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scroll pr-2">
                {CASES_DATA.map(c => (
                  <label
                    key={c.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedCases.includes(c.id)
                        ? "border-[#FF6B00]/40 bg-[#FF6B00]/5"
                        : "border-[#2a3a4e]/50 bg-[#141c2b]/30 hover:border-[#3a4a5e]"
                    }`}
                  >
                    <Checkbox
                      checked={selectedCases.includes(c.id)}
                      onCheckedChange={() => toggleCase(c.id)}
                      className="mt-0.5 border-[#3a4a5e] data-[state=checked]:bg-[#FF6B00] data-[state=checked]:border-[#FF6B00]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-medium">{c.id}: {c.title}</div>
                      <p className="text-xs text-[#8890a8] mt-0.5 line-clamp-2">{c.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="mt-4 rounded-lg border border-[#2a3a4e]/50 bg-[#141c2b]/40 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  checked={repeatCases}
                  onCheckedChange={(checked) => setRepeatCases(Boolean(checked))}
                  className="mt-0.5 border-[#3a4a5e] data-[state=checked]:bg-[#FF6B00] data-[state=checked]:border-[#FF6B00]"
                />
                <div>
                  <div className="text-sm font-medium text-white">Повторять кейсы по циклам</div>
                  <p className="mt-1 text-xs leading-relaxed text-[#8890a8]">
                    Если включено, один и тот же кейс может вернуться следующей ситуацией. Если выключено, каждый кейс показывается только один раз.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5">
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-[#8ec5ff]" />
              <div>
                <h3 className="text-sm font-semibold text-[#8ec5ff] uppercase tracking-wider">Текущие симуляции</h3>
                <p className="mt-1 text-xs text-[#8890a8]">
                  Здесь можно следить за участниками, видеть их прогресс и проваливаться в режим наблюдения без влияния на симуляцию.
                </p>
              </div>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-[#2a3a4e] bg-[#141c2b]/40 p-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#6f7990]">Активных</div>
                <div className="mt-1 text-xl font-bold text-white">{monitorSessions.length}</div>
              </div>
              <div className="rounded-lg border border-[#2a3a4e] bg-[#141c2b]/40 p-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#6f7990]">Подключены</div>
                <div className="mt-1 text-xl font-bold text-white">
                  {monitorSessions.filter((item) => item.presence.studentConnected).length}
                </div>
              </div>
              <div className="rounded-lg border border-[#2a3a4e] bg-[#141c2b]/40 p-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#6f7990]">Выполняют</div>
                <div className="mt-1 text-xl font-bold text-white">
                  {monitorSessions.filter((item) => item.status === "running").length}
                </div>
              </div>
              <div className="rounded-lg border border-[#2a3a4e] bg-[#141c2b]/40 p-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#6f7990]">Ожидают</div>
                <div className="mt-1 text-xl font-bold text-white">
                  {monitorSessions.filter((item) => item.status === "waiting").length}
                </div>
              </div>
              <div className="rounded-xl border border-[#2a3a4e] bg-[#141c2b]/40 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-[#8890a8]">Завершено</div>
                <div className="mt-2 text-2xl font-bold text-white">
                  {monitorSessions.filter((item) => item.status === "completed").length}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {monitorSessions.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#31455f] bg-[#101826]/60 px-4 py-5 text-sm text-[#8aa2c4]">
                  Пока нет live-сессий. После запуска новых участников они появятся здесь автоматически.
                </div>
              )}
              {monitorSessions.map((session) => (
                <div key={session.liveSessionId} className="rounded-xl border border-[#2a3a4e] bg-[#141c2b]/45 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-white">{session.participantName}</div>
                        {session.participantRole && (
                          <span className="rounded-full border border-[#2a3a4e] bg-[#101826]/70 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-[#8ec5ff]">
                            {session.participantRole}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-[#8890a8]">
                        Код: {session.accessCode} • Сложность: {session.difficulty} • Оценщик: {session.assessorName || "—"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {session.status === "completed" && session.runtimeSessionId ? (
                        <Button
                          type="button"
                          size="sm"
                          className="bg-[#00d4aa] text-[#0d1117] hover:bg-[#00c19b]"
                          onClick={() => navigate(`/results/${session.runtimeSessionId}`)}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Результаты
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          className="bg-[#4a9eff] text-white hover:bg-[#3d8be0]"
                          onClick={() => observeLiveSession(session.liveSessionId)}
                          disabled={observeLoadingId === session.liveSessionId}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          {observeLoadingId === session.liveSessionId ? "Открытие..." : "Наблюдать"}
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-[#ff4444]/35 bg-transparent text-[#ffb0b0] hover:bg-[#ff4444]/10"
                        onClick={() => removeLiveSession(session.liveSessionId)}
                        disabled={removeLoadingId === session.liveSessionId}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {removeLoadingId === session.liveSessionId ? "Убираем..." : "Убрать"}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-5">
                    <div className="rounded-lg border border-[#2a3a4e] bg-[#101826]/70 p-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[#6f7990]">Статус</div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {session.status === "running" ? "Идёт" : session.status === "completed" ? "Завершена" : "Ожидает"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#2a3a4e] bg-[#101826]/70 p-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[#6f7990]">Старт</div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {session.startedAt ? new Date(session.startedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#2a3a4e] bg-[#101826]/70 p-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[#6f7990]">Финиш</div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {session.endedAt ? new Date(session.endedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#2a3a4e] bg-[#101826]/70 p-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[#6f7990]">Длительность</div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {Math.floor(session.elapsedSeconds / 60)} мин
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#2a3a4e] bg-[#101826]/70 p-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[#6f7990]">Успешность</div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {session.currentAverageScore ? `${session.currentAverageScore}/5` : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 rounded-full bg-[#101826] p-1">
                    <div className="h-2 rounded-full bg-[#2a3a4e]">
                      <div className="h-2 rounded-full bg-[#00d4aa]" style={{ width: `${session.progressPercent}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5">
            <div className="mb-3 flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-[#ffc107]" />
              <h3 className="text-sm font-semibold text-[#ffc107] uppercase tracking-wider">Методический блок для оценщика</h3>
            </div>
            <div className="space-y-3">
              {ASSESSOR_WIKI_POINTS.map((point) => (
                <div key={point} className="rounded-lg border border-[#2a3a4e] bg-[#141c2b]/40 px-4 py-3 text-sm leading-relaxed text-[#cdd8eb]">
                  {point}
                </div>
              ))}
            </div>
          </div>

          {/* Launch button */}
          <Button
            onClick={handleStart}
            disabled={activeCaseCount === 0 || isStarting}
            className={`w-full h-12 text-white font-semibold text-sm tracking-wider uppercase ${
              isTestMode
                ? "bg-[#ffc107] hover:bg-[#e6b000]"
                : "bg-[#FF6B00] hover:bg-[#e06000]"
            }`}
            data-testid="button-start"
          >
            <Play className="w-4 h-4 mr-2" />
            {isStarting
              ? "Создание live-сессии..."
              : isTestMode
              ? "Запустить тестирование у студента"
              : "Запустить симуляцию у студента"} ({activeCaseCount} кейсов
            {isTestMode && speedMultiplier > 1 ? `, ${speedMultiplier}x` : ""})
          </Button>
          {startError && (
            <div className="rounded-xl border border-[#d98f8f]/35 bg-[#d98f8f]/10 px-4 py-3 text-sm text-[#ffdede]">
              {startError}
            </div>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
