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
  GraduationCap, Award, Mail, MessageSquare, Video, Phone, BarChart3, Eye, Users,
  ArrowRight, Trash2, FileText, ChevronDown, ChevronUp, HelpCircle,
  UserCheck, Timer, CheckCircle2, Rocket, Info,
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
import { STORE_METRIC_LABELS, STORE_STATE_PRESETS } from "@/lib/store-metrics";
import storeBg from "@assets/store_bg.png";

// ═══════════════════════════════════════════════════════════
// HR-подсказки для уровней сложности
// ═══════════════════════════════════════════════════════════
const HR_TOOLTIPS: Record<string, string> = {
  easy: "Для первого прохождения. Очевидные ситуации с понятными решениями. Только звонки.",
  medium: "Стандартная оценка. Баланс сложности для типового кандидата. Звонки, почта, чат.",
  hard: "Для опытных кандидатов. Сложные ситуации с неочевидными решениями. Все каналы.",
};

// ═══════════════════════════════════════════════════════════
// Упрощённые описания уровней сложности для HR
// ═══════════════════════════════════════════════════════════
const DIFFICULTY_INFO = {
  easy: {
    icon: Shield,
    label: "Лёгкий",
    color: "#00C853",
    description: "Простые ситуации. Подходит для первого раза.",
    duration: "~20 минут",
    channels: { audio: true, email: false, messenger: false, video: false },
  },
  medium: {
    icon: Zap,
    label: "Средний",
    color: "#FFB300",
    description: "Стандартная оценка. Баланс сложности.",
    duration: "~40 минут",
    channels: { audio: true, email: true, messenger: true, video: false },
  },
  hard: {
    icon: Flame,
    label: "Сложный",
    color: "#FF1744",
    description: "Для опытных. Неочевидные решения.",
    duration: "~60 минут",
    channels: { audio: true, email: true, messenger: true, video: true },
  },
};

// ═══════════════════════════════════════════════════════════
// Стартовые метрики по умолчанию (спокойная смена)
// ═══════════════════════════════════════════════════════════
const DEFAULT_METRICS: RealisticMetrics = {
  customersInStore: 8,
  avgCheck: 3200,
  conversion: 22,
  nps: 65,
  pickupSpeed: 12,
  warehouseLoad: 35,
  teamMorale: 7,
  dailyRevenue: 125000,
};

// ═══════════════════════════════════════════════════════════
// Роли симуляции — упрощённые для HR
// ═══════════════════════════════════════════════════════════
const SIMULATION_ROLE_CARDS = [
  {
    id: "participant",
    title: "Обычная симуляция",
    description: "Стандартный режим для оценки компетенций",
    participantRole: "Участник",
    available: true,
  },
  {
    id: "deputy-manager",
    title: "Заместитель управляющего",
    description: "Отдельный набор сценариев — в разработке",
    participantRole: "Заместитель управляющего",
    available: false,
  },
  {
    id: "manager",
    title: "Управляющий",
    description: "Отдельный набор сценариев — в разработке",
    participantRole: "Управляющий",
    available: false,
  },
] as const;

// ═══════════════════════════════════════════════════════════
// Методические подсказки (сворачиваемый блок)
// ═══════════════════════════════════════════════════════════
const ASSESSOR_WIKI_POINTS = [
  "Кейс — это управленческая ситуация с сигналом, вариантами реакции и влиянием на метрики магазина.",
  "Выбор сложности автоматически настраивает каналы связи, время и набор кейсов.",
  "Каждое решение участника влияет на операционные показатели магазина и итоговый профиль компетенций.",
  "Режим \"Наблюдать\" позволяет следить за симуляцией без влияния на решения участника.",
] as const;

const TIME_PROFILE_RATIO = {
  easy: 1.1,
  medium: 1,
  hard: 0.8,
} as const;

// ═══════════════════════════════════════════════════════════
// Tooltip component
// ═══════════════════════════════════════════════════════════
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#0f1923] border border-[#2a3a4e] rounded-lg text-xs text-[#a5b2c8] whitespace-normal max-w-[280px] shadow-xl z-50">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#2a3a4e]" />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Wizard step indicator
// ═══════════════════════════════════════════════════════════
function WizardSteps({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: "Кто участник?", icon: UserCheck },
    { num: 2, label: "Уровень сложности", icon: Shield },
    { num: 3, label: "Запуск", icon: Rocket },
  ];
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, idx) => {
        const Icon = step.icon;
        const isActive = step.num === currentStep;
        const isDone = step.num < currentStep;
        return (
          <div key={step.num} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full border transition-all ${
                isActive
                  ? "border-[#FF6B00] bg-[#FF6B00]/10 text-[#FF6B00]"
                  : isDone
                  ? "border-[#00C853] bg-[#00C853]/10 text-[#00C853]"
                  : "border-[#2a3a4e] bg-[#141c2b]/50 text-[#6f7990]"
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Icon className="w-4 h-4" />
              )}
              <span className="text-xs font-medium whitespace-nowrap">{step.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <ArrowRight className="w-4 h-4 text-[#3a4a5e] flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════
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

  // ── Wizard state ──
  const [wizardStep, setWizardStep] = useState(1);

  // ── Basic fields ──
  const [assessorName, setAssessorName] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [simulationRole, setSimulationRole] = useState<(typeof SIMULATION_ROLE_CARDS)[number]["id"]>("participant");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");

  // ── Advanced settings (hidden behind toggle) ──
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualSelection, setManualSelection] = useState(false);
  const [repeatCases, setRepeatCases] = useState(false);
  const [selectedCases, setSelectedCases] = useState<string[]>(CASES_DATA.map(c => c.id));
  const [isTestMode, setIsTestMode] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [channels, setChannels] = useState({ audio: true, email: true, messenger: true, video: false });
  const [initialMetrics, setInitialMetrics] = useState<RealisticMetrics>(DEFAULT_METRICS);

  // ── Loading & errors ──
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [observeLoadingId, setObserveLoadingId] = useState<string | null>(null);
  const [removeLoadingId, setRemoveLoadingId] = useState<string | null>(null);

  // ── Wiki toggle ──
  const [showWiki, setShowWiki] = useState(false);

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

  // ── Quick start: запускает симуляцию в 1 клик с предустановленными настройками ──
  const quickStart = async (diff: "easy" | "medium" | "hard") => {
    if (!participantName.trim()) {
      setStartError("Введите ФИО участника");
      setWizardStep(1);
      return;
    }
    setDifficulty(diff);
    setIsTestMode(false);
    setSpeedMultiplier(1);
    // Автоматически применяем настройки сложности
    setChannels(DIFFICULTY_INFO[diff].channels);
    await handleStartInternal(diff, false, 1, DIFFICULTY_INFO[diff].channels, initialMetrics);
  };

  // ── Основная логика запуска ──
  const handleStartInternal = async (
    diff: "easy" | "medium" | "hard",
    testMode: boolean,
    speed: number,
    channelOverride = channels,
    metricsOverride = initialMetrics,
  ) => {
    setStartError(null);
    setIsStarting(true);
    const casesToUse = manualSelection ? selectedCases : getAutoCases(diff);
    const baseTimeLimit =
      diff === "hard"
        ? hardSimulationMinutes
        : Math.max(casesToUse.length * defaultTimePerCaseMinutes, minSimulationMinutes);
    const resolvedTimeLimit = Boolean(settings?.timeInfluenceEnabled)
      ? Math.max(5, Math.round(baseTimeLimit * TIME_PROFILE_RATIO[diff]))
      : baseTimeLimit;
    const roleCard = SIMULATION_ROLE_CARDS.find((item) => item.id === simulationRole);
    const liveConfigPayload = {
      assessorName,
      participantName,
      participantRole: roleCard?.participantRole || "Участник",
      difficulty: diff,
      selectedCaseIds: casesToUse,
      manualSelection,
      repeatCases,
      timeLimit: resolvedTimeLimit,
      isTestMode: testMode,
      speedMultiplier: testMode ? speed : 1,
      enabledChannels: channelOverride,
      initialMetrics: metricsOverride,
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
      setStartError("Не удалось запустить симуляцию. Проверьте соединение и попробуйте ещё раз.");
    } finally {
      setIsStarting(false);
    }
  };

  const handleStart = () => handleStartInternal(difficulty, isTestMode, speedMultiplier);

  const applyMetricPreset = (presetId: string) => {
    const preset = STORE_STATE_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
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
      setStartError("Не удалось открыть наблюдение. Попробуйте обновить список и повторить.");
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
      setStartError("Не удалось удалить сессию. Попробуйте ещё раз.");
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
  const isParticipantSimulation = simulationRole === "participant";
  const updateMetric = <K extends keyof RealisticMetrics>(key: K, value: number) => {
    setInitialMetrics((current) => ({ ...current, [key]: Number.isFinite(value) ? value : 0 }));
  };

  // ── Status badge helper ──
  const getStatusLabel = (status: string) => {
    switch (status) {
      case "running": return { label: "Идёт", color: "text-[#00C853]" };
      case "completed": return { label: "Завершена", color: "text-[#4a9eff]" };
      case "waiting": return { label: "Ожидает", color: "text-[#FFB300]" };
      default: return { label: status, color: "text-[#8890a8]" };
    }
  };

  const channelInfo = [
    { key: "audio", label: "Аудиозвонки", icon: Phone, color: "#FF6B00" },
    { key: "email", label: "Корпоративная почта", icon: Mail, color: "#4a9eff" },
    { key: "messenger", label: "ТёрКограмм", icon: MessageSquare, color: "#00C853" },
    { key: "video", label: "Видеосообщения", icon: Video, color: "#a78bfa" },
  ] as const;

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div
      className="dns-product-shell relative overflow-auto"
      style={{
        backgroundImage: `url(${storeBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#0d1421ee] via-[#16213ef2] to-[#0d1421f7]" />

      <div className="dns-page-frame max-w-4xl">
        <header className="dns-brand-header">
          <div className="dns-brand-title">
            <div className="dns-brand-mark">D</div>
            <div>
              <div className="dns-brand-kicker">DNS SimCenter</div>
              <h1 className="dns-brand-heading">Панель оценщика</h1>
              <p className="dns-brand-subtitle">Запуск, наблюдение и управление live-сессиями в едином HR-сценарии.</p>
            </div>
          </div>
          <div className="dns-header-actions">
            <button
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-2 rounded-xl border border-[#2a3a4e] bg-[#101826]/70 px-3 py-2 text-sm text-[#9fb0ca] hover:border-[#FF6B00]/50 hover:text-white"
              data-testid="back-button"
            >
              <ArrowLeft className="w-4 h-4" /> К ролям
            </button>
          </div>
        </header>

        {/* ── Wizard Steps Indicator ── */}
        <WizardSteps currentStep={wizardStep} />

        <div className="space-y-5">

          {/* ═══════════════════════════════════════════
              ШАГ 1: КТО УЧАСТНИК?
              ═══════════════════════════════════════════ */}
          {wizardStep === 1 && (
            <>
              <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5">
                <div className="flex items-center gap-2 mb-5">
                  <UserCheck className="w-5 h-5 text-[#FF6B00]" />
                  <h3 className="text-base font-semibold text-white">Кто участник?</h3>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-xs text-[#8890a8] mb-1.5 block">
                      ФИО оценщика <span className="text-[#ff4444]">*</span>
                    </Label>
                    <Input
                      value={assessorName}
                      onChange={e => setAssessorName(e.target.value)}
                      placeholder="Иванов И.И."
                      className="bg-[#141c2b] border-[#2a3a4e] text-white placeholder:text-[#4a5068]"
                      data-testid="input-assessor-name"
                    />
                    <p className="text-[10px] text-[#6f7990] mt-1">Тот, кто оценивает прохождение</p>
                  </div>
                  <div>
                    <Label className="text-xs text-[#8890a8] mb-1.5 block">
                      ФИО участника <span className="text-[#ff4444]">*</span>
                    </Label>
                    <Input
                      value={participantName}
                      onChange={e => setParticipantName(e.target.value)}
                      placeholder="Петров П.П."
                      className="bg-[#141c2b] border-[#2a3a4e] text-white placeholder:text-[#4a5068]"
                      data-testid="input-participant-name"
                    />
                    <p className="text-[10px] text-[#6f7990] mt-1">Кандидат или сотрудник, проходящий симуляцию</p>
                  </div>
                </div>
              </div>

              {/* Тип симуляции — компактный */}
              <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5">
                <h3 className="text-sm font-semibold text-[#FF6B00] mb-4 uppercase tracking-wider">Тип симуляции</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  {SIMULATION_ROLE_CARDS.map((item) => {
                    const isActive = simulationRole === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => item.available && setSimulationRole(item.id)}
                        disabled={!item.available}
                        className={`relative min-h-[100px] overflow-hidden rounded-xl border p-4 text-left transition-all ${
                          isActive
                            ? "border-[#4a9eff] bg-[#4a9eff]/10"
                            : item.available
                            ? "border-[#2a3a4e] bg-[#141c2b]/45 hover:border-[#3a4a5e]"
                            : "border-[#2a3a4e] bg-[#141c2b]/20 opacity-50 cursor-not-allowed"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold leading-5 text-white">{item.title}</div>
                          <div className="mt-2 text-xs leading-relaxed text-[#a5b2c8]">{item.description}</div>
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
              </div>

              {/* Quick Start — быстрый запуск если ФИО уже введены */}
              {participantName.trim() && assessorName.trim() && (
                <div className="rounded-xl border border-[#FF6B00]/20 bg-[#FF6B00]/5 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Rocket className="w-4 h-4 text-[#FF6B00]" />
                    <h3 className="text-sm font-semibold text-[#FF6B00]">Быстрый запуск</h3>
                    <Tooltip text="Выберите уровень сложности для мгновенного запуска симуляции с настройками по умолчанию.">
                      <HelpCircle className="w-3.5 h-3.5 text-[#6f7990] cursor-help" />
                    </Tooltip>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {(["easy", "medium", "hard"] as const).map(d => {
                      const info = DIFFICULTY_INFO[d];
                      const Icon = info.icon;
                      return (
                        <button
                          key={d}
                          onClick={() => quickStart(d)}
                          disabled={isStarting}
                          className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[#2a3a4e] bg-[#141c2b]/45 hover:border-[color:var(--c)] hover:bg-[color:var(--c)]/8 transition-all text-center"
                          style={{ "--c": info.color } as any}
                        >
                          <Icon className="w-6 h-6" style={{ color: info.color }} />
                          <div className="text-sm font-semibold text-white">{info.label}</div>
                          <div className="text-[10px] text-[#8890a8] leading-tight">{info.duration}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Next step button */}
              <Button
                onClick={() => {
                  if (!assessorName.trim() || !participantName.trim()) {
                    setStartError("Заполните ФИО оценщика и участника");
                    return;
                  }
                  setStartError(null);
                  setWizardStep(2);
                }}
                className="w-full h-12 bg-[#FF6B00] hover:bg-[#e06000] text-white font-semibold text-sm tracking-wider"
              >
                Далее: выбрать сложность
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              {startError && (
                <div className="rounded-xl border border-[#d98f8f]/35 bg-[#d98f8f]/10 px-4 py-3 text-sm text-[#ffdede]">
                  {startError}
                </div>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════
              ШАГ 2: ВЫБОР СЛОЖНОСТИ
              ═══════════════════════════════════════════ */}
          {wizardStep === 2 && (
            <>
              <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-5 h-5 text-[#FF6B00]" />
                  <h3 className="text-base font-semibold text-white">Выберите уровень сложности</h3>
                </div>
                <p className="text-xs text-[#8890a8] mb-5 ml-7">Сложность влияет на количество ситуаций, каналы связи и время прохождения</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  {(["easy", "medium", "hard"] as const).map(d => {
                    const info = DIFFICULTY_INFO[d];
                    const Icon = info.icon;
                    const isActive = difficulty === d;
                    return (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={`relative p-5 rounded-xl border text-left transition-all ${
                          isActive
                            ? "border-[color:var(--c)] bg-[color:var(--c)]/10"
                            : "border-[#2a3a4e] bg-[#141c2b]/50 hover:border-[#3a4a5e]"
                        }`}
                        style={{ "--c": info.color } as any}
                        data-testid={`difficulty-${d}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <Icon className="w-6 h-6" style={{ color: info.color }} />
                          {isActive && (
                            <CheckCircle2 className="w-5 h-5" style={{ color: info.color }} />
                          )}
                        </div>
                        <div className="text-base font-semibold text-white mb-1">{info.label}</div>
                        <p className="text-xs text-[#8890a8] leading-relaxed mb-3">{info.description}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-[#6f7990]">
                          <Timer className="w-3 h-3" />
                          {info.duration}
                        </div>

                        {/* HR Tooltip inline */}
                        <div className="mt-3 p-2 rounded-lg bg-[#0f1923]/60 border border-[#2a3a4e]/50">
                          <div className="flex items-start gap-1.5">
                            <Info className="w-3 h-3 text-[#6f7990] mt-0.5 flex-shrink-0" />
                            <p className="text-[10px] text-[#a5b2c8] leading-relaxed">{HR_TOOLTIPS[d]}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Резюме выбора */}
                <div className="rounded-lg border border-[#2a3a4e]/50 bg-[#141c2b]/40 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: DIFFICULTY_INFO[difficulty].color }} />
                      <div>
                        <div className="text-sm text-white">
                          <span className="font-semibold">{DIFFICULTY_INFO[difficulty].label}</span>
                          {" — "}{activeCaseCount} ситуаций, {DIFFICULTY_INFO[difficulty].duration}
                        </div>
                        <div className="text-[10px] text-[#6f7990] mt-0.5">
                          Каналы: {Object.entries(DIFFICULTY_INFO[difficulty].channels)
                            .filter(([, v]) => v)
                            .map(([k]) => ({ audio: "звонки", email: "почта", messenger: "чат", video: "видео" }[k]))
                            .join(", ")}
                        </div>
                      </div>
                    </div>
                    <Tooltip text="Количество ситуаций и каналы связи подбираются автоматически по уровню сложности">
                      <HelpCircle className="w-4 h-4 text-[#6f7990] cursor-help" />
                    </Tooltip>
                  </div>
                </div>
              </div>

              {/* Mode: Test vs Real — компактный */}
              <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5">
                <h3 className="text-sm font-semibold text-[#FF6B00] mb-4 uppercase tracking-wider">Режим прохождения</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setIsTestMode(false)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      !isTestMode
                        ? "border-[#00C853] bg-[#00C853]/10"
                        : "border-[#2a3a4e] bg-[#141c2b]/50 hover:border-[#3a4a5e]"
                    }`}
                    data-testid="mode-credit"
                  >
                    <Award className="w-5 h-5 mb-2 text-[#00C853]" />
                    <div className="text-sm font-semibold text-white">В зачёт</div>
                    <p className="text-xs text-[#8890a8] mt-1">Официальная оценка. Все решения сохраняются в отчёт.</p>
                  </button>
                  <button
                    onClick={() => setIsTestMode(true)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      isTestMode
                        ? "border-[#FFB300] bg-[#FFB300]/10"
                        : "border-[#2a3a4e] bg-[#141c2b]/50 hover:border-[#3a4a5e]"
                    }`}
                    data-testid="mode-test"
                  >
                    <GraduationCap className="w-5 h-5 mb-2 text-[#FFB300]" />
                    <div className="text-sm font-semibold text-white">Тренировка</div>
                    <p className="text-xs text-[#8890a8] mt-1">Результаты не сохраняются. Для знакомства с интерфейсом.</p>
                  </button>
                </div>

                {isTestMode && (
                  <div className="mt-4 p-4 rounded-lg border border-[#FFB300]/30 bg-[#FFB300]/5">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-xs text-[#FFB300] font-semibold">
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
                      В тренировочном режиме ускоряются сигналы и время. Симуляция завершится автоматически при прохождении всех кейсов.
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5">
                <div className="mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-[#4a9eff]" />
                  <div>
                    <h3 className="text-sm font-semibold text-[#4a9eff] uppercase tracking-wider">Показатели подразделения</h3>
                    <p className="mt-1 text-xs text-[#8890a8]">
                      Выберите один из 5 уровней стартовой нагрузки. Эти значения попадут в симуляцию участника.
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-5">
                  {STORE_STATE_PRESETS.map((preset) => {
                    const isActive = Object.entries(preset.metrics).every(([key, value]) => initialMetrics[key as keyof RealisticMetrics] === value);
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyMetricPreset(preset.id)}
                        className={`rounded-xl border p-3 text-left transition-all ${
                          isActive
                            ? "border-[#4a9eff] bg-[#4a9eff]/12 shadow-[0_14px_30px_rgba(74,158,255,0.12)]"
                            : "border-[#2a3a4e] bg-[#141c2b]/45 hover:border-[#3a4a5e]"
                        }`}
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8ec5ff]">{preset.title.replace("Уровень ", "Ур. ")}</div>
                        <div className="mt-2 text-[11px] leading-relaxed text-[#aebbd2]">{preset.summary}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Навигация между шагами */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setWizardStep(1)}
                  className="flex-1 h-12 border-[#2a3a4e] text-[#8890a8] hover:text-white hover:bg-[#2a3a4e]/30"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Назад
                </Button>
                <Button
                  onClick={() => setWizardStep(3)}
                  className="flex-[2] h-12 bg-[#FF6B00] hover:bg-[#e06000] text-white font-semibold text-sm tracking-wider"
                >
                  Далее: запуск
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════
              ШАГ 3: ПОДТВЕРЖДЕНИЕ И ЗАПУСК
              ═══════════════════════════════════════════ */}
          {wizardStep === 3 && (
            <>
              {/* Резюме настроек перед запуском */}
              <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5">
                <div className="flex items-center gap-2 mb-5">
                  <Rocket className="w-5 h-5 text-[#FF6B00]" />
                  <h3 className="text-base font-semibold text-white">Проверьте настройки</h3>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-[#2a3a4e]/50">
                    <div className="flex items-center gap-2 text-sm text-[#8890a8]">
                      <UserCheck className="w-4 h-4" />
                      Оценщик
                    </div>
                    <div className="text-sm font-medium text-white">{assessorName || "—"}</div>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-[#2a3a4e]/50">
                    <div className="flex items-center gap-2 text-sm text-[#8890a8]">
                      <Users className="w-4 h-4" />
                      Участник
                    </div>
                    <div className="text-sm font-medium text-white">{participantName || "—"}</div>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-[#2a3a4e]/50">
                    <div className="flex items-center gap-2 text-sm text-[#8890a8]">
                      {(() => { const I = DIFFICULTY_INFO[difficulty].icon; return <I className="w-4 h-4" style={{ color: DIFFICULTY_INFO[difficulty].color }} />; })()}
                      Уровень сложности
                    </div>
                    <div className="text-sm font-medium text-white" style={{ color: DIFFICULTY_INFO[difficulty].color }}>
                      {DIFFICULTY_INFO[difficulty].label}
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-[#2a3a4e]/50">
                    <div className="flex items-center gap-2 text-sm text-[#8890a8]">
                      <BarChart3 className="w-4 h-4" />
                      Количество ситуаций
                    </div>
                    <div className="text-sm font-medium text-white">{activeCaseCount}</div>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-[#2a3a4e]/50">
                    <div className="flex items-center gap-2 text-sm text-[#8890a8]">
                      <Timer className="w-4 h-4" />
                      Примерное время
                    </div>
                    <div className="text-sm font-medium text-white">{DIFFICULTY_INFO[difficulty].duration}</div>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2 text-sm text-[#8890a8]">
                      {isTestMode ? <GraduationCap className="w-4 h-4" /> : <Award className="w-4 h-4" />}
                      Режим
                    </div>
                    <div className={`text-sm font-medium ${isTestMode ? "text-[#FFB300]" : "text-[#00C853]"}`}>
                      {isTestMode ? "Тренировка" : "В зачёт"}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Toggle: Расширенные настройки ── */}
              <div className="rounded-xl border border-[#2a3a4e]/50 bg-[#1e2a3a]/60 p-4">
                <button
                  onClick={() => setShowAdvanced(prev => !prev)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#4a9eff]" />
                    <span className="text-sm font-medium text-[#8890a8]">Расширенные настройки</span>
                    <Tooltip text="Для опытных оценщиков: ручной выбор кейсов, каналов связи и стартовых метрик">
                      <HelpCircle className="w-3.5 h-3.5 text-[#6f7990] cursor-help" />
                    </Tooltip>
                  </div>
                  {showAdvanced ? (
                    <ChevronUp className="w-4 h-4 text-[#6f7990]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#6f7990]" />
                  )}
                </button>
              </div>

              {/* ═══════ РАСШИРЕННЫЕ НАСТРОЙКИ (скрыты по умолчанию) ═══════ */}
              {showAdvanced && (
                <>
                  {/* Case Selection */}
                  <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-wider">Выбор ситуаций</h3>
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
                          Автоподбор по сложности <span className="text-[#FF6B00] font-medium">{DIFFICULTY_INFO[difficulty].label}</span>.
                          Будет выбрано <span className="text-white font-medium">{activeCaseCount} ситуаций</span> из {CASES_DATA.length}.
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
                          <div className="text-sm font-medium text-white">Повторять ситуации по циклу</div>
                          <p className="mt-1 text-xs leading-relaxed text-[#8890a8]">
                            Если включено, одна ситуация может повторяться. Если выключено — каждая показывается один раз.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Communication Channels — в расширенном режиме */}
                  <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-wider">Каналы коммуникации</h3>
                      <Tooltip text="Выбираются автоматически по сложности. Изменяйте только если знаете, что делаете.">
                        <HelpCircle className="w-3.5 h-3.5 text-[#6f7990] cursor-help" />
                      </Tooltip>
                    </div>
                    <p className="text-xs text-[#8890a8] mb-4">Автоподбор по сложности. Можно изменить вручную.</p>
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

                  {/* Start Metrics — в расширенном режиме */}
                  <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-[#4a9eff]" />
                      <div>
                        <h3 className="text-sm font-semibold text-[#4a9eff] uppercase tracking-wider">Стартовые метрики магазина</h3>
                        <p className="mt-1 text-xs text-[#8890a8]">
                          Выберите готовый пресет или задайте значения вручную. По умолчанию — спокойная смена.
                        </p>
                      </div>
                    </div>
                    <div className="mb-4">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#8ec5ff]">Готовые состояния</div>
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
                      {Object.keys(STORE_METRIC_LABELS).map((key) => (
                        <div key={key}>
                          <Label className="text-xs text-[#8890a8] mb-1.5 block">{STORE_METRIC_LABELS[key as keyof typeof STORE_METRIC_LABELS]}</Label>
                          <Input
                            value={initialMetrics[key as keyof RealisticMetrics]}
                            onChange={(e) => updateMetric(key as keyof RealisticMetrics, Number(e.target.value))}
                            className="bg-[#141c2b] border-[#2a3a4e] text-white"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Launch button */}
              <Button
                onClick={handleStart}
                disabled={activeCaseCount === 0 || isStarting}
                className={`w-full h-14 text-white font-semibold text-base tracking-wider ${
                  isTestMode
                    ? "bg-[#FFB300] hover:bg-[#e6a000]"
                    : "bg-[#FF6B00] hover:bg-[#e06000]"
                }`}
                data-testid="button-start"
              >
                <Play className="w-5 h-5 mr-2" />
                {isStarting
                  ? "Запускаем симуляцию..."
                  : isTestMode
                  ? "Запустить тренировку"
                  : "Запустить симуляцию"}
                {!isStarting && ` (${activeCaseCount} ситуаций, ${DIFFICULTY_INFO[difficulty].duration.replace("~", "")})`}
              </Button>
              {startError && (
                <div className="rounded-xl border border-[#d98f8f]/35 bg-[#d98f8f]/10 px-4 py-3 text-sm text-[#ffdede]">
                  {startError}
                </div>
              )}

              {/* Навигация назад */}
              <Button
                variant="outline"
                onClick={() => setWizardStep(2)}
                className="w-full h-12 border-[#2a3a4e] text-[#8890a8] hover:text-white hover:bg-[#2a3a4e]/30"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Вернуться к выбору сложности
              </Button>
            </>
          )}

          {/* ═══════════════════════════════════════════
              ТЕКУЩИЕ СИМУЛЯЦИИ (всегда видимы)
              ═══════════════════════════════════════════ */}
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5">
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-[#8ec5ff]" />
              <div>
                <h3 className="text-sm font-semibold text-[#8ec5ff] uppercase tracking-wider">Текущие симуляции</h3>
                <p className="mt-1 text-xs text-[#8890a8]">
                  Следите за участниками, наблюдайте за прогрессом и открывайте результаты
                </p>
              </div>
            </div>

            {/* Stats summary */}
            <div className="mb-4 grid grid-cols-4 gap-3">
              <div className="rounded-lg border border-[#2a3a4e] bg-[#141c2b]/40 p-3 text-center">
                <div className="text-xl font-bold text-white">{monitorSessions.length}</div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#6f7990] mt-0.5">Всего</div>
              </div>
              <div className="rounded-lg border border-[#2a3a4e] bg-[#141c2b]/40 p-3 text-center">
                <div className="text-xl font-bold text-[#00C853]">
                  {monitorSessions.filter((item) => item.status === "running").length}
                </div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#6f7990] mt-0.5">Идут</div>
              </div>
              <div className="rounded-lg border border-[#2a3a4e] bg-[#141c2b]/40 p-3 text-center">
                <div className="text-xl font-bold text-[#FFB300]">
                  {monitorSessions.filter((item) => item.status === "waiting").length}
                </div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#6f7990] mt-0.5">Ожидают</div>
              </div>
              <div className="rounded-lg border border-[#2a3a4e] bg-[#141c2b]/40 p-3 text-center">
                <div className="text-xl font-bold text-[#4a9eff]">
                  {monitorSessions.filter((item) => item.status === "completed").length}
                </div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#6f7990] mt-0.5">Завершены</div>
              </div>
            </div>

            {/* Sessions list — упрощённая таблица */}
            <div className="space-y-3">
              {monitorSessions.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#31455f] bg-[#101826]/60 px-4 py-5 text-sm text-[#8aa2c4]">
                  <div className="flex items-center gap-2 justify-center">
                    <Info className="w-4 h-4" />
                    Пока нет симуляций. После запуска участники появятся здесь автоматически.
                  </div>
                </div>
              )}
              {monitorSessions.map((session) => {
                const statusInfo = getStatusLabel(session.status);
                return (
                  <div key={session.liveSessionId} className="rounded-xl border border-[#2a3a4e] bg-[#141c2b]/45 p-4">
                    {/* Верхняя строка: имя, статус, действия */}
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-white">{session.participantName}</div>
                          {session.participantRole && (
                            <span className="rounded-full border border-[#2a3a4e] bg-[#101826]/70 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-[#8ec5ff]">
                              {session.participantRole}
                            </span>
                          )}
                          <span className={`text-xs font-medium ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-[#8890a8]">
                          Код: <span className="text-[#a5b2c8]">{session.accessCode}</span>
                          {" • "}
                          Средний балл: <span className="text-white font-medium">{session.currentAverageScore ? `${session.currentAverageScore}/5` : "—"}</span>
                          {" • "}
                          Оценщик: {session.assessorName || "—"}
                        </div>
                      </div>

                      {/* Прогресс бар */}
                      <div className="w-full md:w-32">
                        <div className="flex items-center justify-between text-[10px] text-[#6f7990] mb-1">
                          <span>Прогресс</span>
                          <span className="text-[#a5b2c8]">{Math.round(session.progressPercent)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#2a3a4e]">
                          <div
                            className="h-2 rounded-full transition-all duration-500"
                            style={{
                              width: `${session.progressPercent}%`,
                              backgroundColor: session.status === "completed" ? "#4a9eff" : "#00C853",
                            }}
                          />
                        </div>
                      </div>

                      {/* Действия */}
                      <div className="flex items-center gap-2">
                        {session.status === "completed" && session.runtimeSessionId ? (
                          <Button
                            type="button"
                            size="sm"
                            className="bg-[#00C853] text-[#0d1117] hover:bg-[#00b34a]"
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
                          {removeLoadingId === session.liveSessionId ? "Удаление..." : "Удалить"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              МЕТОДИЧЕСКИЙ БЛОК (сворачиваемый)
              ═══════════════════════════════════════════ */}
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3a]/60 backdrop-blur-sm p-5">
            <button
              onClick={() => setShowWiki(prev => !prev)}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-[#ffc107]" />
                <h3 className="text-sm font-semibold text-[#ffc107] uppercase tracking-wider">Памятка оценщику</h3>
                <span className="text-[10px] text-[#6f7990] normal-case tracking-normal">({ASSESSOR_WIKI_POINTS.length} подсказки)</span>
              </div>
              {showWiki ? (
                <ChevronUp className="h-4 w-4 text-[#6f7990]" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[#6f7990]" />
              )}
            </button>
            {showWiki && (
              <div className="mt-4 space-y-3">
                {ASSESSOR_WIKI_POINTS.map((point, idx) => (
                  <div key={idx} className="flex items-start gap-3 rounded-lg border border-[#2a3a4e] bg-[#141c2b]/40 px-4 py-3">
                    <span className="text-xs font-semibold text-[#FF6B00] mt-0.5">{idx + 1}.</span>
                    <p className="text-sm leading-relaxed text-[#cdd8eb]">{point}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
