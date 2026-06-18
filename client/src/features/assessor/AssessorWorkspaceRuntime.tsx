import { useState, useEffect, useMemo, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { RealisticMetrics } from "@/context/SimulationContext";
import { CASES_DATA } from "@/data/cases";
import { EMAIL_CASES } from "@/data/email-cases";
import { MESSENGER_CASES } from "@/data/messenger-cases";
import { VIDEO_CASES } from "@/data/video-cases";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { ThemeToggle, useDnsTheme } from "@/components/theme-toggle";
import { BrandMark, BrandVisualBackdrop } from "@/components/brand-access-shell";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { getSimulationSettingsSnapshot } from "@/lib/runtime-content";
import type { SimulationRuntimeSettings } from "@shared/simulation-content";
import {
  ArrowLeft, Play, Shield, Zap, Flame,
  GraduationCap, Award, Mail, MessageSquare, Video, Phone, BarChart3, Eye, Users,
  ArrowRight, Trash2, FileText, ChevronDown, ChevronUp, HelpCircle,
  UserCheck, Timer, CheckCircle2, Rocket, Info, BookOpen, Workflow,
  MousePointerClick, ListChecks, Settings2, Target, GitBranch,
  ArrowUpRight, ArrowDownRight, SlidersHorizontal, ClipboardCheck, Map,
  Activity, Gauge, Copy, ShieldCheck,
  LogOut, Save, HeartPulse,
} from "lucide-react";

// Иконка «активные сессии» — сердечный ритм (мягкая пульсация).
function SessionsHeartIcon({ className }: { className?: string }) {
  return <HeartPulse className={`dns-assessor-v2-rail-heart ${className ?? ""}`} />;
}
// Иконка «результаты» — прыгающие красные/зелёные столбики (анимированный график).
function ResultsBarsIcon({ className }: { className?: string }) {
  return (
    <span className={`dns-assessor-v2-rail-bars ${className ?? ""}`} aria-hidden="true">
      <i /><i /><i /><i />
    </span>
  );
}
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
import { DEFAULT_METRICS, DIFFICULTY_INFO, HR_TOOLTIPS, SIMULATION_ROLE_CARDS, TIME_PROFILE_RATIO } from "./assessor-constants";
import type {
  AssessorChannelItemIds,
  AssessorChannels,
  AssessorDifficulty,
  AssessorLaunchResult,
  AssessorPanel,
  AssessorParticipantConfig,
  AssessorSetupMode,
  AssessorSimulationRoleId,
} from "./assessor-types";
import { cloneChannelItemIds, cloneMetrics, createAssessorParticipantId, createDefaultParticipantSetup } from "./assessor-utils";
import { AssessorWiki } from "./components/AssessorWiki";
import { AssessorTooltip as Tooltip } from "./components/AssessorTooltip";
import { WizardSteps } from "./components/WizardSteps";
import { useSetupValidation } from "./hooks/useSetupValidation";
import { BRAND_ASSETS } from "@/lib/brand-assets";
import { FeedbackButton } from "@/components/feedback-dialog";
import { ProductFooter } from "@/components/product-footer";

// ═══════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════
export interface AssessorPageProps {
  staffRole?: "admin" | "evaluator";
}

export default function AssessorPage({ staffRole = "evaluator" }: AssessorPageProps) {
  const [, navigate] = useLocation();
  const { theme, themeClass, toggleTheme } = useDnsTheme();
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
  const [participantSetups, setParticipantSetups] = useState<AssessorParticipantConfig[]>(() => [
    createDefaultParticipantSetup("participant-1"),
  ]);
  const [activeParticipantId, setActiveParticipantId] = useState("participant-1");
  const [simulationRole, setSimulationRole] = useState<AssessorSimulationRoleId>("participant");
  const [difficulty, setDifficulty] = useState<AssessorDifficulty>("medium");

  // ── Advanced settings (hidden behind toggle) ──
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualSelection, setManualSelection] = useState(false);
  const [repeatCases, setRepeatCases] = useState(false);
  const [selectedCases, setSelectedCases] = useState<string[]>(CASES_DATA.map(c => c.id));
  const [isTestMode, setIsTestMode] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [channels, setChannels] = useState<AssessorChannels>({ audio: true, email: true, messenger: true, video: false });
  const [selectedChannelItemIds, setSelectedChannelItemIds] = useState<AssessorChannelItemIds>({
    email: EMAIL_CASES.map((item) => item.id),
    messenger: MESSENGER_CASES.map((item) => item.id),
    video: VIDEO_CASES.map((item) => item.id),
  });
  const [initialMetrics, setInitialMetrics] = useState<RealisticMetrics>(DEFAULT_METRICS);

  // ── Loading & errors ──
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [observeLoadingId, setObserveLoadingId] = useState<string | null>(null);
  const [removeLoadingId, setRemoveLoadingId] = useState<string | null>(null);
  const [copiedAccessCode, setCopiedAccessCode] = useState<string | null>(null);
  const [launchResults, setLaunchResults] = useState<AssessorLaunchResult[]>([]);

  // ── Wiki toggle ──
  const [showWiki, setShowWiki] = useState(false);
  const [wikiProcessOpen, setWikiProcessOpen] = useState(false);
  const [adminAccessOpen, setAdminAccessOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminAccessError, setAdminAccessError] = useState("");
  const [adminAccessLoading, setAdminAccessLoading] = useState(false);
  const [activePanel, setActivePanel] = useState<AssessorPanel>("participant");
  const [setupMode, setSetupMode] = useState<AssessorSetupMode>("recommended");
  const [scenarioConfirmed, setScenarioConfirmed] = useState(false);
  const [compositionConfirmed, setCompositionConfirmed] = useState(false);
  const [channelReviewDone, setChannelReviewDone] = useState(false);
  const { getAutoCases, getCasesForSetup, getSetupValidation } = useSetupValidation({
    assessorName,
    easyCount,
    mediumCount,
    hardCount,
  });

  const liveSessionsQuery = useQuery({
    queryKey: ["/api/staff/live-sessions"],
    queryFn: getQueryFn<LiveSimulationMonitorSummary[]>({ on401: "throw" }),
    refetchInterval: 2500,
  });
  const staffPrincipalQuery = useQuery({
    queryKey: ["/api/staff/me"],
    queryFn: getQueryFn<{ username: string; displayName: string; role: "admin" | "evaluator" }>({ on401: "throw" }),
  });

  const handleLogout = async () => {
    await apiRequest("POST", "/api/staff/logout");
    queryClient.clear();
    navigate("/staff-login");
  };

  const handleAdminAccess = () => {
    if (staffRole === "admin") {
      navigate("/admin");
      return;
    }

    setAdminPassword("");
    setAdminAccessError("");
    setAdminAccessOpen(true);
  };

  const handleAdminElevation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (adminAccessLoading) {
      return;
    }

    if (!adminPassword) {
      setAdminAccessError("Введите пароль администратора.");
      return;
    }

    setAdminAccessLoading(true);
    setAdminAccessError("");
    try {
      const response = await apiRequest("POST", "/api/staff/elevate", { password: adminPassword });
      const principal = await response.json();
      queryClient.setQueryData(["/api/staff/me"], principal);
      setAdminAccessOpen(false);
      navigate("/admin");
    } catch (error: any) {
      setAdminAccessError(error.message || "Не удалось подтвердить административный доступ.");
    } finally {
      setAdminAccessLoading(false);
    }
  };

  // Auto-set channels based on difficulty
  useEffect(() => {
    setLiveSimulationRole("assessor-setup");
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

  const captureCurrentParticipantSetup = (): AssessorParticipantConfig => ({
    id: activeParticipantId,
    name: participantName,
    simulationRole,
    difficulty,
    setupMode,
    scenarioConfirmed,
    compositionConfirmed,
    channelReviewDone,
    showAdvanced,
    manualSelection,
    repeatCases,
    selectedCases: [...selectedCases],
    channels: { ...channels },
    selectedChannelItemIds: cloneChannelItemIds(selectedChannelItemIds),
    initialMetrics: cloneMetrics(initialMetrics),
    isTestMode,
    speedMultiplier,
  });

  const applyParticipantSetup = (setup: AssessorParticipantConfig) => {
    setParticipantName(setup.name);
    setSimulationRole(setup.simulationRole);
    setDifficulty(setup.difficulty);
    setSetupMode(setup.setupMode);
    setScenarioConfirmed(setup.scenarioConfirmed);
    setCompositionConfirmed(setup.compositionConfirmed);
    setChannelReviewDone(setup.channelReviewDone);
    setShowAdvanced(setup.showAdvanced);
    setManualSelection(setup.manualSelection);
    setRepeatCases(setup.repeatCases);
    setSelectedCases([...setup.selectedCases]);
    setChannels({ ...setup.channels });
    setSelectedChannelItemIds(cloneChannelItemIds(setup.selectedChannelItemIds));
    setInitialMetrics(cloneMetrics(setup.initialMetrics));
    setIsTestMode(setup.isTestMode);
    setSpeedMultiplier(setup.speedMultiplier);
    setStartError(null);
  };

  const saveActiveParticipantSetup = () => {
    const nextSetup = captureCurrentParticipantSetup();
    setParticipantSetups((current) => current.map((item) => (
      item.id === activeParticipantId ? nextSetup : item
    )));
    return nextSetup;
  };

  const switchParticipantSetup = (id: string) => {
    if (id === activeParticipantId) return;
    const nextSetup = participantSetups.find((item) => item.id === id);
    if (!nextSetup) return;
    saveActiveParticipantSetup();
    setActiveParticipantId(id);
    applyParticipantSetup(nextSetup);
    setActivePanel("participant");
  };

  const addParticipantSetup = (mode: "blank" | "copy" = "blank") => {
    saveActiveParticipantSetup();
    const sourceSetup = captureCurrentParticipantSetup();
    const nextSetup = mode === "copy"
      ? {
          ...sourceSetup,
          id: createAssessorParticipantId(),
          name: "",
        }
      : createDefaultParticipantSetup();
    setParticipantSetups((current) => [...current, nextSetup]);
    setActiveParticipantId(nextSetup.id);
    applyParticipantSetup(nextSetup);
    setActivePanel("participant");
  };

  const removeParticipantSetup = (id: string) => {
    if (participantSetups.length <= 1) {
      const resetSetup = createDefaultParticipantSetup(id);
      setParticipantSetups([resetSetup]);
      setActiveParticipantId(resetSetup.id);
      applyParticipantSetup(resetSetup);
      return;
    }

    const savedCurrent = captureCurrentParticipantSetup();
    const withSavedCurrent = participantSetups.map((item) => (
      item.id === activeParticipantId ? savedCurrent : item
    ));
    const nextSetups = withSavedCurrent.filter((item) => item.id !== id);
    setParticipantSetups(nextSetups);

    if (id === activeParticipantId) {
      const nextActive = nextSetups[0];
      setActiveParticipantId(nextActive.id);
      applyParticipantSetup(nextActive);
    }
  };

  const markCompositionDirty = () => {
    setCompositionConfirmed(false);
    setChannelReviewDone(false);
  };

  const toggleCase = (id: string) => {
    markCompositionDirty();
    setSelectedCases(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleChannelItem = (channelType: "email" | "messenger" | "video", id: string) => {
    markCompositionDirty();
    setSelectedChannelItemIds((current) => {
      const currentIds = current[channelType] || [];
      const nextIds = currentIds.includes(id)
        ? currentIds.filter((itemId) => itemId !== id)
        : [...currentIds, id];

      return { ...current, [channelType]: nextIds };
    });
  };

  const setAllChannelItems = (channelType: "email" | "messenger" | "video", ids: string[]) => {
    markCompositionDirty();
    setSelectedChannelItemIds((current) => ({ ...current, [channelType]: ids }));
  };

  // ── Quick start: запускает симуляцию в 1 клик с предустановленными настройками ──
  const quickStart = async (diff: AssessorDifficulty) => {
    if (!participantName.trim()) {
      setStartError("Введите ФИО участника");
      setWizardStep(1);
      setActivePanel("participant");
      return;
    }
    setDifficulty(diff);
    setIsTestMode(false);
    setSpeedMultiplier(1);
    setChannels({ ...DIFFICULTY_INFO[diff].channels });
    await handleStartInternal(diff, false, 1, { ...DIFFICULTY_INFO[diff].channels }, initialMetrics);
  };

  const buildLiveConfigPayload = (setup: AssessorParticipantConfig) => {
    const casesToUse = getCasesForSetup(setup);
    const baseTimeLimit =
      setup.difficulty === "hard"
        ? hardSimulationMinutes
        : Math.max(casesToUse.length * defaultTimePerCaseMinutes, minSimulationMinutes);
    const resolvedTimeLimit = Boolean(settings?.timeInfluenceEnabled)
      ? Math.max(5, Math.round(baseTimeLimit * TIME_PROFILE_RATIO[setup.difficulty]))
      : baseTimeLimit;
    const roleCard = SIMULATION_ROLE_CARDS.find((item) => item.id === setup.simulationRole);

    return {
      assessorName,
      participantName: setup.name.trim(),
      participantRole: roleCard?.participantRole || "Участник",
      difficulty: setup.difficulty,
      selectedCaseIds: casesToUse,
      manualSelection: setup.manualSelection,
      repeatCases: setup.repeatCases,
      timeLimit: resolvedTimeLimit,
      isTestMode: setup.isTestMode,
      speedMultiplier: setup.isTestMode ? setup.speedMultiplier : 1,
      enabledChannels: setup.channels,
      selectedChannelItemIds: setup.selectedChannelItemIds,
      initialMetrics: setup.initialMetrics,
    };
  };

  const createLiveSessionForSetup = async (setup: AssessorParticipantConfig) => {
    const config = await createRemoteLiveSimulation(buildLiveConfigPayload(setup));
    return {
      participantName: config.participantName,
      liveSessionId: config.liveSessionId,
      accessCode: config.accessCode,
    };
  };

  // ── Основная логика запуска ──
  const handleStartInternal = async (
    diff: AssessorDifficulty,
    testMode: boolean,
    speed: number,
    channelOverride = channels,
    metricsOverride = initialMetrics,
  ) => {
    const currentSetup = {
      ...captureCurrentParticipantSetup(),
      difficulty: diff,
      scenarioConfirmed: true,
      compositionConfirmed: true,
      channelReviewDone: true,
      isTestMode: testMode,
      speedMultiplier: speed,
      channels: { ...channelOverride },
      initialMetrics: cloneMetrics(metricsOverride),
    };

    setStartError(null);
    setIsStarting(true);
    try {
      await primeAudioPlayback();
      resetLiveSimulation();
      const result = await createLiveSessionForSetup(currentSetup);
      setLaunchResults([result]);
      setLiveSimulationRole("assessor-setup");
      await liveSessionsQuery.refetch();
      setActivePanel("sessions");
    } catch (error) {
      console.error("Failed to create live session", error);
      setStartError("Не удалось запустить симуляцию. Проверьте соединение и попробуйте ещё раз.");
    } finally {
      setIsStarting(false);
    }
  };

  const handleStart = async () => {
    const savedActive = saveActiveParticipantSetup();
    const launchSetups = participantSetups
      .map((item) => (item.id === activeParticipantId ? savedActive : item))
      .filter(isSetupReadyToLaunch);

    if (launchSetups.length === 0) {
      setStartError("Подготовьте хотя бы одного участника: ФИО, режим оценки, состав и подтверждение каналов.");
      return;
    }

    setStartError(null);
    setIsStarting(true);
    try {
      await primeAudioPlayback();
      resetLiveSimulation();
      const results: AssessorLaunchResult[] = [];
      for (const setup of launchSetups) {
        results.push(await createLiveSessionForSetup(setup));
      }
      setLaunchResults(results);
      setLiveSimulationRole("assessor-setup");
      await liveSessionsQuery.refetch();
      setActivePanel("sessions");
    } catch (error) {
      console.error("Failed to create live sessions", error);
      setStartError("Не удалось запустить очередь симуляций. Проверьте соединение и попробуйте ещё раз.");
    } finally {
      setIsStarting(false);
    }
  };

  const applyMetricPreset = (presetId: string) => {
    const preset = STORE_STATE_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    markCompositionDirty();
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

  const visibleParticipantSetups = participantSetups.map((item) => (
    item.id === activeParticipantId ? captureCurrentParticipantSetup() : item
  ));
  const activeParticipantIndex = Math.max(
    0,
    visibleParticipantSetups.findIndex((item) => item.id === activeParticipantId),
  );
  const activeParticipantLabel = participantName.trim() || `Участник ${activeParticipantIndex + 1}`;
  const isSetupReadyToLaunch = (setup: AssessorParticipantConfig) => getSetupValidation(setup).readyToLaunch;
  const readyParticipantSetups = visibleParticipantSetups.filter(isSetupReadyToLaunch);

  const activeCaseCount = manualSelection ? selectedCases.length : getAutoCases(difficulty).length;
  const selectedSimulationCard = SIMULATION_ROLE_CARDS.find((item) => item.id === simulationRole) || SIMULATION_ROLE_CARDS[0];
  const isParticipantSimulation = simulationRole === "participant";
  const updateMetric = <K extends keyof RealisticMetrics>(key: K, value: number) => {
    markCompositionDirty();
    const normalizedValue = key === "nps"
      ? Math.max(1, Math.min(5, Math.round((Number.isFinite(value) ? value : 3.3) * 100) / 100))
      : Number.isFinite(value) ? value : 0;
    setInitialMetrics((current) => ({ ...current, [key]: normalizedValue }));
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
  const channelSignalGroups = [
    {
      key: "email" as const,
      title: "Письма",
      enabled: channels.email,
      color: "#4a9eff",
      items: EMAIL_CASES.map((item) => ({
        id: item.id,
        title: item.subject || item.id,
        subtitle: item.from || "Корпоративная почта",
      })),
    },
    {
      key: "messenger" as const,
      title: "Мессенджер",
      enabled: channels.messenger,
      color: "#00C853",
      items: MESSENGER_CASES.map((item) => ({
        id: item.id,
        title: item.senderName || item.id,
        subtitle: item.senderRole || "Сообщение",
      })),
    },
    {
      key: "video" as const,
      title: "Видео",
      enabled: channels.video,
      color: "#a78bfa",
      items: VIDEO_CASES.map((item) => ({
        id: item.id,
        title: item.title || item.id,
        subtitle: item.sender || "Видеообращение",
      })),
    },
  ];
  const selectedChannelSignalCount = channelSignalGroups.reduce((sum, group) => (
    sum + (group.enabled ? selectedChannelItemIds[group.key].length : 0)
  ), 0);

  const activeSetupValidation = getSetupValidation(captureCurrentParticipantSetup());
  const participantReady = activeSetupValidation.nameReady;
  const compositionReady = activeSetupValidation.compositionReady;
  const firstValidationIssue = activeSetupValidation.issues[0] || "Проверьте заполнение предыдущего шага.";
  const enabledChannelLabels = channelInfo
    .filter((item) => channels[item.key])
    .map((item) => item.label);
  const estimatedBaseTime =
    difficulty === "hard"
      ? hardSimulationMinutes
      : Math.max(activeCaseCount * defaultTimePerCaseMinutes, minSimulationMinutes);
  const estimatedTimeLimit = Boolean(settings?.timeInfluenceEnabled)
    ? Math.max(5, Math.round(estimatedBaseTime * TIME_PROFILE_RATIO[difficulty]))
    : estimatedBaseTime;
  const scenarioName =
    manualSelection
      ? "Экспертный"
      : difficulty === "easy"
        ? "Лёгкий"
        : difficulty === "hard"
          ? "Сложный"
          : "Стандартный";
  const reviewItems = [
    {
      title: "Участник и оценщик указаны",
      detail: participantReady ? `${participantName || "Участник"} · ${assessorName || "Оценщик"}` : "Заполните ФИО оценщика и участника.",
      done: participantReady,
    },
    {
      title: "Режим выбран",
      detail: scenarioConfirmed ? `${scenarioName}, ${estimatedTimeLimit} минут.` : "Выберите режим оценки.",
      done: activeSetupValidation.scenarioReady,
    },
    {
      title: "Состав оценки проверен",
      detail: compositionReady ? `${activeCaseCount} ситуаций, ${enabledChannelLabels.length} каналов.` : `Проверьте состав: ${firstValidationIssue}.`,
      done: compositionReady,
    },
    {
      title: "Каналы подтверждены",
      detail: compositionReady ? "Все включенные каналы содержат выбранные события." : "Выберите события для каждого включенного канала.",
      done: compositionReady,
    },
  ];
  const setupProgress = reviewItems.filter((item) => item.done).length;
  const completedSessionCount = monitorSessions.filter((item) => item.status === "completed").length;

  const copyAccessCode = async (code: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = code;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedAccessCode(code);
      window.setTimeout(() => {
        setCopiedAccessCode((current) => (current === code ? null : current));
      }, 1600);
    } catch {
      setCopiedAccessCode(null);
    }
  };

  const renderCopyAccessCodeButton = (code: string) => {
    const copied = copiedAccessCode === code;
    return (
      <button
        type="button"
        title={copied ? "Скопировано" : "Скопировать"}
        aria-label={`Скопировать код ${code}`}
        className="dns-assessor-v2-code-button group relative inline-flex items-center gap-1.5 rounded-lg border border-[#4a9eff]/35 bg-[#101826]/90 px-2 py-1 font-mono text-sm font-black tracking-[0.16em] text-white transition-all hover:border-[#ff6b00] hover:bg-[#ff6b00]/12 focus:outline-none focus:ring-2 focus:ring-[#ff6b00]/50"
        onClick={() => copyAccessCode(code)}
      >
        <span>{code}</span>
        <Copy className="h-3.5 w-3.5 text-[#8ec5ff] transition-colors group-hover:text-[#ffd0a6]" />
        <span className="pointer-events-none absolute bottom-[calc(100%+0.45rem)] left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md border border-[#2a3a4e] bg-[#0d1421] px-2 py-1 text-[10px] font-semibold tracking-normal text-[#f2f7ff] opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus:opacity-100">
          {copied ? "Скопировано" : "Скопировать"}
        </span>
      </button>
    );
  };

  const applyScenario = (nextDifficulty: AssessorDifficulty, manual = false) => {
    setDifficulty(nextDifficulty);
    setManualSelection(manual);
    setChannels({ ...DIFFICULTY_INFO[nextDifficulty].channels });
    setScenarioConfirmed(true);
    setCompositionConfirmed(false);
    setChannelReviewDone(false);
    setStartError(null);
    if (manual) {
      setSetupMode("expert");
    }
  };

  const chooseSetupMode = (nextMode: AssessorSetupMode) => {
    setSetupMode(nextMode);
    setCompositionConfirmed(false);
    setChannelReviewDone(false);
    setStartError(null);

    if (nextMode === "recommended") {
      setManualSelection(false);
      setShowAdvanced(false);
      setChannels({ ...DIFFICULTY_INFO[difficulty].channels });
      return;
    }

    setManualSelection(true);
    setShowAdvanced(true);
  };

  const openPanel = (panel: AssessorPanel) => {
    setActivePanel(panel);
  };

  const continueFromParticipant = () => {
    if (!participantReady) {
      setStartError("Заполните ФИО оценщика и участника");
      return;
    }
    setStartError(null);
    setWizardStep(2);
    setActivePanel("scenario");
  };

  const continueFromScenario = () => {
    if (!participantReady) {
      setActivePanel("participant");
      setStartError("Заполните ФИО оценщика и участника");
      return;
    }
    if (!activeSetupValidation.scenarioReady) {
      setStartError("Выберите режим оценки");
      return;
    }
    setStartError(null);
    setWizardStep(3);
    setActivePanel("composition");
  };

  const continueFromComposition = () => {
    if (!compositionReady) {
      setStartError(`Проверьте состав: ${firstValidationIssue}`);
      return;
    }
    setCompositionConfirmed(true);
    setStartError(null);
    setActivePanel("review");
  };

  const confirmChannels = () => {
    if (!compositionReady) {
      setStartError(`Проверьте состав: ${firstValidationIssue}`);
      setActivePanel("composition");
      return;
    }
    setChannelReviewDone(true);
    setStartError(null);
  };

  const validateCurrentSetup = () => {
    const validation = getSetupValidation(captureCurrentParticipantSetup());
    if (!validation.nameReady) {
      setStartError("Заполните ФИО оценщика и участника.");
      setActivePanel("participant");
      return;
    }
    if (!validation.scenarioReady) {
      setStartError("Выберите режим оценки.");
      setActivePanel("scenario");
      return;
    }
    if (!validation.compositionReady) {
      setStartError(`Проверьте состав: ${validation.issues[0] || "заполнены не все обязательные параметры"}.`);
      setActivePanel("composition");
      return;
    }

    setCompositionConfirmed(true);
    setChannelReviewDone(true);
    setStartError(null);
    saveActiveParticipantSetup();
    setActivePanel("review");
  };

  const isSetupPanel = activePanel === "scenario" || activePanel === "composition" || activePanel === "review";
  // Гид по заполнению: порядок шагов настройки и их готовность.
  // «Настройка оценки» завершена, только когда состав подтверждён И всё готово к запуску
  // (гид ведёт пользователя через под-шаги, а не загорается раньше времени).
  const setupStepReady = compositionConfirmed && activeSetupValidation.readyToLaunch;
  const readyByPanel: Partial<Record<AssessorPanel, boolean>> = {
    participant: participantReady,
    scenario: setupStepReady,
  };
  const fillOrder: AssessorPanel[] = ["participant", "scenario"];
  const nextToFill = fillOrder.find((id) => !readyByPanel[id]);
  const baseRailItems: Array<{
    id: AssessorPanel;
    title: string;
    state: string;
    icon: React.ComponentType<{ className?: string }>;
    active: boolean;
  }> = [
    { id: "participant", title: "Кандидаты", state: `${visibleParticipantSetups.length}`, icon: Users, active: activePanel === "participant" },
    { id: "scenario", title: "Настройка оценки", state: `${setupProgress}/4`, icon: Settings2, active: isSetupPanel },
    { id: "sessions", title: "Активные сессии", state: `${monitorSessions.filter((item) => item.status !== "completed").length}`, icon: SessionsHeartIcon, active: activePanel === "sessions" },
    { id: "results", title: "Результаты", state: `${completedSessionCount}`, icon: ResultsBarsIcon, active: activePanel === "results" },
  ];
  const railItems = baseRailItems.map((item) => ({
    ...item,
    ready: readyByPanel[item.id] === true,
    // Пульс — у следующего незаполненного шага, если пользователь не находится на нём.
    pulse: item.id === nextToFill && !item.active,
  }));

  const renderRailItem = (item: (typeof railItems)[number]) => {
    const Icon = item.icon;
    const className = [
      "dns-assessor-v2-rail-item",
      item.active ? "dns-assessor-v2-rail-item--active" : "",
      item.ready ? "dns-assessor-v2-rail-item--ready" : "",
      item.pulse ? "dns-assessor-v2-rail-item--pulse" : "",
    ].filter(Boolean).join(" ");
    return (
      <button
        key={item.id}
        type="button"
        className={className}
        onClick={() => openPanel(item.id)}
        aria-current={item.active ? "page" : undefined}
      >
        <Icon className="dns-assessor-v2-rail-icon" />
        <span className="dns-assessor-v2-rail-title">{item.title}</span>
        <span className="dns-assessor-v2-rail-count">{item.state}</span>
      </button>
    );
  };

  const setupRailItems = railItems.filter((item) => item.id === "participant" || item.id === "scenario");
  const monitorRailItems = railItems.filter((item) => item.id === "sessions" || item.id === "results");

  const renderRail = () => (
    <nav className="dns-assessor-v2-rail" aria-label="Разделы меню оценщика">
      <div className="dns-assessor-v2-rail-brand">
        <span>D</span>
        <div><strong>DNS SIM</strong><small>Кабинет оценщика</small></div>
      </div>
      {/* Шаги запуска: заполнить и подтвердить два блока */}
      <div className="dns-assessor-v2-rail-group-label">Запуск симуляции</div>
      <div className="dns-assessor-v2-rail-nav">
        {setupRailItems.map(renderRailItem)}
      </div>
      {/* Мониторинг и отчётность — отделены от шагов запуска */}
      <div className="dns-assessor-v2-rail-group-label">Мониторинг</div>
      <div className="dns-assessor-v2-rail-nav">
        {monitorRailItems.map(renderRailItem)}
      </div>
      <div className="dns-assessor-v2-rail-footer">
        <button type="button" className="dns-assessor-v2-rail-footer-button" onClick={() => setShowWiki(true)} title="База знаний">
          <BookOpen className="h-4 w-4" /><span>Wiki</span>
        </button>
        <div className="dns-assessor-v2-rail-profile">
          <span>{(staffPrincipalQuery.data?.displayName || "О").slice(0, 1).toUpperCase()}</span>
          <div><strong>{staffPrincipalQuery.data?.displayName || "Оценщик"}</strong><small>{staffRole === "admin" ? "Администратор" : "Оценщик"}</small></div>
        </div>
        <button type="button" className="dns-assessor-v2-rail-footer-button" onClick={handleAdminAccess} title="В администратора">
          <ShieldCheck className="h-4 w-4" /><span>Администратор</span>
        </button>
        <button type="button" className="dns-assessor-v2-rail-footer-button" onClick={handleLogout} title="Выйти">
          <LogOut className="h-4 w-4" /><span>Выйти</span>
        </button>
      </div>
    </nav>
  );

  const renderCandidateSummary = () => {
    const ready = isSetupReadyToLaunch(captureCurrentParticipantSetup());
    return (
      <section className="dns-assessor-v2-candidate-summary">
        <div className="dns-assessor-v2-candidate-identity">
          <span className="dns-assessor-v2-session-avatar">{(participantName.trim() || "К").slice(0, 1).toUpperCase()}</span>
          <div>
            <span className="dns-assessor-v2-kicker">Текущий кандидат</span>
            <strong>{participantName.trim() || "ФИО не указано"}</strong>
            <p>{scenarioName} · {DIFFICULTY_INFO[difficulty].label}</p>
          </div>
        </div>
        <div className="dns-assessor-v2-candidate-kpis">
          <div><span>Готовность</span><strong className={ready ? "dns-assessor-v2-ok" : "dns-assessor-v2-warn"}>{setupProgress}/4</strong></div>
          <div><span>Кейсы</span><strong>{activeCaseCount}</strong></div>
          <div><span>Каналы</span><strong>{enabledChannelLabels.length}</strong></div>
          <div><span>Время</span><strong>{estimatedTimeLimit} мин</strong></div>
        </div>
      </section>
    );
  };

  const renderSetupNavigation = () => {
    // Готовность под-шагов настройки и подсказка «куда дальше».
    const tabReady: Record<"scenario" | "composition" | "review", boolean> = {
      scenario: scenarioConfirmed,
      composition: compositionConfirmed,
      review: compositionConfirmed && activeSetupValidation.readyToLaunch,
    };
    const tabOrder: Array<"scenario" | "composition" | "review"> = ["scenario", "composition", "review"];
    const nextTab = tabOrder.find((id) => !tabReady[id]);
    return (
      <div className="dns-assessor-v2-setup-tabs" role="tablist" aria-label="Настройка запуска">
        {([
          ["scenario", "Режим", Target],
          ["composition", "Состав", ListChecks],
          ["review", "Проверка", ClipboardCheck],
        ] as const).map(([id, title, Icon]) => {
          const className = [
            "dns-assessor-v2-setup-tab",
            activePanel === id ? "dns-assessor-v2-setup-tab--active" : "",
            tabReady[id] ? "dns-assessor-v2-setup-tab--ready" : "",
            id === nextTab && activePanel !== id ? "dns-assessor-v2-setup-tab--pulse" : "",
          ].filter(Boolean).join(" ");
          return (
            <button key={id} type="button" className={className} onClick={() => setActivePanel(id)}>
              <Icon className="h-4 w-4" />{title}
              {tabReady[id] && <CheckCircle2 className="dns-assessor-v2-setup-tab-check h-3.5 w-3.5" />}
            </button>
          );
        })}
      </div>
    );
  };

  const renderParticipantPanel = () => (
    <section className="dns-assessor-v2-panel dns-assessor-v2-main-panel">
      <div className="dns-assessor-v2-panel-head">
        <div>
          <div className="dns-assessor-v2-kicker">Шаг 1</div>
          <h2>Кто проходит оценку</h2>
          <p>Сначала фиксируем оценщика, участника и роль симуляции. Следующие шаги откроются после заполнения этих данных.</p>
        </div>
        <span className={`dns-assessor-v2-pill ${participantReady ? "dns-assessor-v2-pill--ok" : "dns-assessor-v2-pill--warn"}`}>
          {participantReady ? "Готово" : "Нужно заполнить"}
        </span>
      </div>

      <div className="dns-assessor-v2-field-grid">
        <div>
          <Label className="dns-assessor-v2-label">ФИО оценщика</Label>
          <Input
            value={assessorName}
            onChange={(event) => setAssessorName(event.target.value)}
            placeholder="Иванов И.И."
            className="dns-assessor-v2-input"
            data-testid="input-assessor-name"
          />
        </div>
        <div>
          <Label className="dns-assessor-v2-label">ФИО участника</Label>
          <Input
            value={participantName}
            onChange={(event) => setParticipantName(event.target.value)}
            placeholder="Петров П.П."
            className="dns-assessor-v2-input"
            data-testid="input-participant-name"
          />
        </div>
      </div>

      <div className="dns-assessor-v2-section-title">Очередь участников</div>
      <div className="dns-assessor-v2-participant-queue">
        <div className="dns-assessor-v2-queue-head">
          <div>
            <strong>{visibleParticipantSetups.length} участников</strong>
            <p>{readyParticipantSetups.length} готовы к запуску. Настройки сохраняются отдельно для каждого участника.</p>
          </div>
          <div className="dns-assessor-v2-inline-actions">
            <button type="button" className="dns-assessor-v2-light-button" onClick={() => addParticipantSetup("copy")}>
              <ClipboardCheck className="h-4 w-4" />
              Копировать настройки
            </button>
            <button type="button" className="dns-assessor-v2-light-button" onClick={() => addParticipantSetup("blank")}>
              <Users className="h-4 w-4" />
              Пустые поля
            </button>
          </div>
        </div>
        <div className="dns-assessor-v2-participant-list">
          {visibleParticipantSetups.map((item, index) => {
            const active = item.id === activeParticipantId;
            const ready = isSetupReadyToLaunch(item);
            const casesCount = getCasesForSetup(item).length;
            return (
              <div
                key={item.id}
                className={`dns-assessor-v2-participant-card ${active ? "dns-assessor-v2-participant-card--active" : ""} ${ready ? "dns-assessor-v2-participant-card--ready" : ""}`}
                onClick={() => switchParticipantSetup(item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    switchParticipantSetup(item.id);
                  }
                }}
              >
                <span className="dns-assessor-v2-participant-num">{index + 1}</span>
                <div>
                  <strong>{item.name.trim() || `Участник ${index + 1}`}</strong>
                  <p>{ready ? "готов к запуску" : item.name.trim() ? "нужно завершить настройку" : "укажите ФИО"} · {casesCount} кейсов · {DIFFICULTY_INFO[item.difficulty].label}</p>
                </div>
                {visibleParticipantSetups.length > 1 && (
                  <button
                    type="button"
                    className="dns-assessor-v2-participant-remove"
                    aria-label="Удалить участника"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeParticipantSetup(item.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="dns-assessor-v2-section-title">Тип симуляции</div>
      <div className="dns-assessor-v2-card-grid dns-assessor-v2-card-grid--roles">
        {SIMULATION_ROLE_CARDS.map((item) => {
          const active = simulationRole === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`dns-assessor-v2-choice-card ${active ? "dns-assessor-v2-choice-card--active" : ""} ${!item.available ? "dns-assessor-v2-choice-card--disabled" : ""}`}
              onClick={() => item.available && setSimulationRole(item.id)}
              disabled={!item.available}
            >
              <span>{item.title}</span>
              <p>{item.description}</p>
              {!item.available && <em>В разработке</em>}
            </button>
          );
        })}
      </div>

      <div className="dns-assessor-v2-note">
        После заполнения участника активируется раздел выбора режима. Так оценщик не видит все настройки сразу и не теряется в структуре.
      </div>
    </section>
  );

  const renderScenarioPanel = () => (
    <section className="dns-assessor-v2-panel dns-assessor-v2-main-panel">
      <div className="dns-assessor-v2-mode-switch" role="group" aria-label="Режим настройки">
        <button
          type="button"
          className={setupMode === "recommended" ? "dns-assessor-v2-mode dns-assessor-v2-mode--active" : "dns-assessor-v2-mode"}
          onClick={() => chooseSetupMode("recommended")}
        >
          Автоподбор
        </button>
        <button
          type="button"
          className={setupMode === "expert" ? "dns-assessor-v2-mode dns-assessor-v2-mode--active" : "dns-assessor-v2-mode"}
          onClick={() => chooseSetupMode("expert")}
        >
          Ручная настройка
        </button>
      </div>
      <div className="dns-assessor-v2-mode-explainer">
        <div className={setupMode === "recommended" ? "dns-assessor-v2-mode-note dns-assessor-v2-mode-note--active" : "dns-assessor-v2-mode-note"}>
          <strong>Автоподбор</strong>
          <p>Оценщик выбирает режим оценки, а система сама подбирает кейсы, каналы, время и стартовые параметры.</p>
        </div>
        <div className={setupMode === "expert" ? "dns-assessor-v2-mode-note dns-assessor-v2-mode-note--active" : "dns-assessor-v2-mode-note"}>
          <strong>Ручная настройка</strong>
          <p>Открывает ручной выбор кейсов, событий каналов, метрик и скорости для методической настройки.</p>
        </div>
      </div>

      <div className="dns-assessor-v2-panel-head">
        <div>
          <div className="dns-assessor-v2-kicker">Шаг 2</div>
          <h2>Выберите режим оценки</h2>
          <p>Выберите понятный режим нагрузки. Система сама подберёт кейсы, каналы, время и стартовые параметры.</p>
        </div>
        <span className={`dns-assessor-v2-pill ${scenarioConfirmed ? "dns-assessor-v2-pill--ok" : "dns-assessor-v2-pill--warn"}`}>
          {scenarioConfirmed ? "Режим выбран" : "Выберите"}
        </span>
      </div>

      <div className="dns-assessor-v2-card-grid dns-assessor-v2-card-grid--scenarios">
        <button
          type="button"
          className={`dns-assessor-v2-choice-card ${scenarioConfirmed && difficulty === "medium" && !manualSelection ? "dns-assessor-v2-choice-card--active" : ""}`}
          onClick={() => applyScenario("medium")}
        >
          <span>Стандартный</span>
          <p><strong>Кому подходит:</strong> Основная оценка кандидата.</p>
          <p><strong>Что проверяем:</strong> Приоритеты, ответственность, коммуникацию и принятие решений.</p>
          <div className="dns-assessor-v2-chip-row"><b>Средняя нагрузка.</b><b>Около 40 минут.</b></div>
        </button>
        <button
          type="button"
          className={`dns-assessor-v2-choice-card ${scenarioConfirmed && difficulty === "easy" && !manualSelection ? "dns-assessor-v2-choice-card--active" : ""}`}
          onClick={() => applyScenario("easy")}
        >
          <span>Лёгкий</span>
          <p><strong>Кому подходит:</strong> Первый проход и знакомство с форматом.</p>
          <p><strong>Что проверяем:</strong> Понимание магазина, базовую реакцию и ориентацию в ситуации.</p>
          <div className="dns-assessor-v2-chip-row"><b>Низкая нагрузка.</b><b>Около 20 минут.</b></div>
        </button>
        <button
          type="button"
          className={`dns-assessor-v2-choice-card ${scenarioConfirmed && difficulty === "hard" && !manualSelection ? "dns-assessor-v2-choice-card--active" : ""}`}
          onClick={() => applyScenario("hard")}
        >
          <span>Сложный</span>
          <p><strong>Кому подходит:</strong> Кандидат с хорошей базой.</p>
          <p><strong>Что проверяем:</strong> Многозадачность, устойчивость, контроль и работу под давлением.</p>
          <div className="dns-assessor-v2-chip-row"><b>Высокая нагрузка.</b><b>Около 60 минут.</b></div>
        </button>
        <button
          type="button"
          className={`dns-assessor-v2-choice-card dns-assessor-v2-choice-card--manual ${scenarioConfirmed && manualSelection ? "dns-assessor-v2-choice-card--active" : ""}`}
          onClick={() => applyScenario("medium", true)}
        >
          <span>Экспертный</span>
          <p><strong>Кому подходит:</strong> Методист или опытный оценщик.</p>
          <p><strong>Что проверяем:</strong> Можно вручную выбрать кейсы, каналы и параметры оценки.</p>
          <div className="dns-assessor-v2-chip-row"><b>Настраивается вручную.</b><b>Зависит от выбранного состава.</b></div>
        </button>
      </div>

      <div className="dns-assessor-v2-note">
        Раздел “Состав” откроется после выбора режима оценки. Это сохраняет понятность первого варианта и боковую навигацию второго.
      </div>
    </section>
  );

  const renderCompositionPanel = () => (
    <section className="dns-assessor-v2-panel dns-assessor-v2-main-panel">
      <div className="dns-assessor-v2-panel-head">
        <div>
          <div className="dns-assessor-v2-kicker">Шаг 3</div>
          <h2>Состав оценки</h2>
          <p>Проверьте кейсы, каналы и стартовое состояние магазина. В рекомендованном режиме достаточно подтвердить состав.</p>
        </div>
        <span className={`dns-assessor-v2-pill ${compositionConfirmed ? "dns-assessor-v2-pill--ok" : ""}`}>
          {activeCaseCount} ситуаций
        </span>
      </div>

      <div className="dns-assessor-v2-summary-strip">
        <div><span>Режим оценки</span><strong>{scenarioName}</strong></div>
        <div><span>Сложность</span><strong>{DIFFICULTY_INFO[difficulty].label}</strong></div>
        <div><span>Время</span><strong>{estimatedTimeLimit} мин</strong></div>
        <div><span>Каналы</span><strong>{enabledChannelLabels.length}</strong></div>
      </div>

      <div className="dns-assessor-v2-customizer">
        <div className="dns-assessor-v2-customizer-head">
          <div>
            <span>Настройка под участника</span>
            <strong>{activeParticipantLabel}</strong>
            <p>Эти параметры сохраняются только для выбранного участника из очереди.</p>
          </div>
          <div className="dns-assessor-v2-customizer-mode">
            <span>Ручной выбор кейсов</span>
            <Switch
              checked={manualSelection}
              onCheckedChange={(value) => {
                setManualSelection(value);
                setCompositionConfirmed(false);
                setChannelReviewDone(false);
                if (value) {
                  setShowAdvanced(true);
                  setSetupMode("expert");
                }
              }}
              data-testid="toggle-manual"
            />
          </div>
        </div>
        <div className="dns-assessor-v2-customizer-actions">
          <button type="button" className={difficulty === "easy" ? "dns-assessor-v2-customizer-button dns-assessor-v2-customizer-button--active" : "dns-assessor-v2-customizer-button"} onClick={() => applyScenario("easy", manualSelection)}>
            Снизить нагрузку
            <span>меньше кейсов и сигналов</span>
          </button>
          <button type="button" className={difficulty === "medium" ? "dns-assessor-v2-customizer-button dns-assessor-v2-customizer-button--active" : "dns-assessor-v2-customizer-button"} onClick={() => applyScenario("medium", manualSelection)}>
            Сбалансировать
            <span>типовая оценка</span>
          </button>
          <button type="button" className={difficulty === "hard" ? "dns-assessor-v2-customizer-button dns-assessor-v2-customizer-button--active" : "dns-assessor-v2-customizer-button"} onClick={() => applyScenario("hard", manualSelection)}>
            Усилить проверку
            <span>больше нагрузки и каналов</span>
          </button>
        </div>
        {manualSelection && (
          <div className="dns-assessor-v2-manual-case-block">
            <div className="dns-assessor-v2-case-tools">
              <strong>Кейсы участника</strong>
              <span>{selectedCases.length} выбрано</span>
              <button type="button" onClick={() => { markCompositionDirty(); setSelectedCases(CASES_DATA.map((item) => item.id)); }}>Все</button>
              <button type="button" onClick={() => { markCompositionDirty(); setSelectedCases([]); }}>Снять</button>
            </div>
            <div className="dns-assessor-v2-scroll-list">
              {CASES_DATA.map((item) => {
                const checked = selectedCases.includes(item.id);
                return (
                  <label key={item.id} className={`dns-assessor-v2-check-row ${checked ? "dns-assessor-v2-check-row--active" : ""}`}>
                    <Checkbox checked={checked} onCheckedChange={() => toggleCase(item.id)} />
                    <span>{item.title || item.id}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="dns-assessor-v2-toggle-line">
        <div>
          <strong>Расширенные настройки</strong>
          <p>Откройте, если нужно вручную выбрать кейсы, события каналов или стартовые метрики.</p>
        </div>
        <Switch checked={showAdvanced || setupMode === "expert"} onCheckedChange={(value) => chooseSetupMode(value ? "expert" : "recommended")} />
      </div>

      {!(showAdvanced || setupMode === "expert") ? (
        <div className="dns-assessor-v2-card-grid dns-assessor-v2-card-grid--compact">
          <div className="dns-assessor-v2-info-card">
            <h3>Кейсы</h3>
            <p>Автоподбор по сценарию: {activeCaseCount} ситуаций.</p>
          </div>
          <div className="dns-assessor-v2-info-card">
            <h3>Каналы</h3>
            <p>{enabledChannelLabels.join(", ") || "Каналы выключены"}</p>
          </div>
          <div className="dns-assessor-v2-info-card">
            <h3>События</h3>
            <p>Выбрано событий из каналов: {selectedChannelSignalCount}.</p>
          </div>
          <div className="dns-assessor-v2-info-card">
            <h3>Метрики</h3>
            <p>Стартовое состояние магазина можно уточнить в экспертном режиме.</p>
          </div>
        </div>
      ) : (
        <div className="dns-assessor-v2-expert-stack">
          <div className="dns-assessor-v2-section-title">Каналы коммуникации</div>
          <div className="dns-assessor-v2-card-grid dns-assessor-v2-card-grid--compact">
            {channelInfo.map(({ key, label, icon: Icon, color }) => {
              const checked = channels[key];
              return (
                <button
                  key={key}
                  type="button"
                  className={`dns-assessor-v2-channel-card ${checked ? "dns-assessor-v2-channel-card--active" : ""}`}
                  onClick={() => { markCompositionDirty(); setChannels((current) => ({ ...current, [key]: !current[key] })); }}
                  style={{ "--channel-color": color } as any}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="dns-assessor-v2-section-title">События из каналов</div>
          <div className="dns-assessor-v2-channel-groups">
            {channelSignalGroups.map((group) => (
              <div key={group.key} className={`dns-assessor-v2-channel-group ${!group.enabled ? "dns-assessor-v2-channel-group--disabled" : ""}`}>
                <div className="dns-assessor-v2-channel-group-head">
                  <strong>{group.title}</strong>
                  <span>{selectedChannelItemIds[group.key].length} из {group.items.length}</span>
                </div>
                <div className="dns-assessor-v2-channel-actions">
                  <button type="button" onClick={() => setAllChannelItems(group.key, group.items.map((item) => item.id))} disabled={!group.enabled}>Все</button>
                  <button type="button" onClick={() => setAllChannelItems(group.key, [])} disabled={!group.enabled}>Нет</button>
                </div>
              </div>
            ))}
          </div>

          <div className="dns-assessor-v2-section-title">Стартовые метрики магазина</div>
          <div className="dns-assessor-v2-card-grid dns-assessor-v2-card-grid--compact">
            {STORE_STATE_PRESETS.map((preset) => {
              const active = Object.entries(preset.metrics).every(([key, value]) => initialMetrics[key as keyof RealisticMetrics] === value);
              return (
                <button key={preset.id} type="button" className={`dns-assessor-v2-info-card ${active ? "dns-assessor-v2-info-card--active" : ""}`} onClick={() => applyMetricPreset(preset.id)}>
                  <h3>{preset.title}</h3>
                  <p>{preset.summary}</p>
                </button>
              );
            })}
          </div>
          <div className="dns-assessor-v2-metric-grid">
            {Object.keys(STORE_METRIC_LABELS).map((key) => {
              const metricKey = key as keyof RealisticMetrics;
              const isClientRating = metricKey === "nps";
              return (
                <div key={key}>
                  <Label className="dns-assessor-v2-label">{STORE_METRIC_LABELS[metricKey]}</Label>
                  <Input
                    type="number"
                    min={isClientRating ? 1 : 0}
                    max={isClientRating ? 5 : undefined}
                    step={isClientRating ? 0.01 : 1}
                    value={initialMetrics[metricKey]}
                    onChange={(event) => updateMetric(metricKey, Number(event.target.value))}
                    className="dns-assessor-v2-input"
                  />
                </div>
              );
            })}
          </div>

          <div className="dns-assessor-v2-toggle-line">
            <div>
              <strong>Тренировочный режим</strong>
              <p>Для тестового прохождения можно ускорить время симуляции.</p>
            </div>
            <Switch checked={isTestMode} onCheckedChange={setIsTestMode} />
          </div>
          {isTestMode && (
            <div className="dns-assessor-v2-slider-row">
              <span>Скорость: x{speedMultiplier}</span>
              <Slider value={[speedMultiplier]} min={0.5} max={3} step={0.5} onValueChange={([value]) => setSpeedMultiplier(value)} />
            </div>
          )}
        </div>
      )}
    </section>
  );

  const renderReviewPanel = () => (
    <section className="dns-assessor-v2-panel dns-assessor-v2-main-panel">
      <div className="dns-assessor-v2-panel-head">
        <div>
          <div className="dns-assessor-v2-kicker">Шаг 4</div>
          <h2>Проверка перед запуском</h2>
          <p>Финальный экран объясняет, почему запуск доступен или закрыт. Если что-то не готово, интерфейс показывает причину.</p>
        </div>
        <span className={`dns-assessor-v2-pill ${channelReviewDone ? "dns-assessor-v2-pill--ok" : "dns-assessor-v2-pill--warn"}`}>
          Готовность {setupProgress}/4
        </span>
      </div>

      <div className="dns-assessor-v2-review-list">
        {reviewItems.map((item, index) => (
          <div key={item.title} className="dns-assessor-v2-review-row">
            <span className={`dns-assessor-v2-review-num ${item.done ? "dns-assessor-v2-review-num--done" : ""}`}>{index + 1}</span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
            <span className={`dns-assessor-v2-pill ${item.done ? "dns-assessor-v2-pill--ok" : "dns-assessor-v2-pill--warn"}`}>
              {item.done ? "готово" : "нужно"}
            </span>
          </div>
        ))}
      </div>

      <div className="dns-assessor-v2-launch-list">
        <div className="dns-assessor-v2-section-title">Очередь запуска</div>
        {visibleParticipantSetups.map((item, index) => {
          const ready = isSetupReadyToLaunch(item);
          return (
            <div key={item.id} className={`dns-assessor-v2-launch-row ${ready ? "dns-assessor-v2-launch-row--ready" : ""}`}>
              <span>{index + 1}</span>
              <div>
                <strong>{item.name.trim() || `Участник ${index + 1}`}</strong>
                <p>{getCasesForSetup(item).length} кейсов · {DIFFICULTY_INFO[item.difficulty].label} · {item.manualSelection ? "ручная настройка" : "автоматический режим"}</p>
              </div>
              <em>{ready ? "готов" : "не готов"}</em>
            </div>
          );
        })}
      </div>

      <div className="dns-assessor-v2-note">
        Запуск появляется только после подтверждения состава. Это делает подготовку понятной и снижает риск случайно стартовать неподтверждённую оценку.
      </div>
    </section>
  );

  const renderSessionsPanel = (resultsOnly = false) => {
    const visibleSessions = monitorSessions.filter((session) => resultsOnly ? session.status === "completed" : session.status !== "completed");
    return (
    <section className="dns-assessor-v2-panel dns-assessor-v2-main-panel">
      <div className="dns-assessor-v2-panel-head">
        <div>
          <div className="dns-assessor-v2-kicker">{resultsOnly ? "Архив прохождений" : "Live-мониторинг"}</div>
          <h2>{resultsOnly ? "Результаты участников" : "Активные сессии"}</h2>
          <p>{resultsOnly ? "Завершенные прохождения, итоговые отчеты и экспорт PDF." : "Статус, прогресс и текущая оценка участников в реальном времени."}</p>
        </div>
        <span className={`dns-assessor-v2-pill ${resultsOnly ? "" : "dns-assessor-v2-pill--ok"}`}>
          {visibleSessions.length} {resultsOnly ? "завершено" : "в работе"}
        </span>
      </div>

      {!resultsOnly && <div className="dns-assessor-v2-summary-strip">
        <div><span>Всего</span><strong>{monitorSessions.length}</strong></div>
        <div><span>Идут</span><strong className="text-[#35d38a]">{monitorSessions.filter((item) => item.status === "running").length}</strong></div>
        <div><span>Ожидают</span><strong className="text-[#f5c04e]">{monitorSessions.filter((item) => item.status === "waiting").length}</strong></div>
        <div><span>Завершены</span><strong className="text-[#5eb1ff]">{monitorSessions.filter((item) => item.status === "completed").length}</strong></div>
      </div>}

      {!resultsOnly && launchResults.length > 0 && (
        <div className="dns-assessor-v2-launch-result">
          <div className="dns-assessor-v2-section-title">Последний запуск</div>
          {launchResults.map((item) => (
            <div key={item.liveSessionId} className="dns-assessor-v2-launch-result-row">
              <span>{item.participantName}</span>
              {renderCopyAccessCodeButton(item.accessCode)}
            </div>
          ))}
        </div>
      )}

      <div className="dns-assessor-v2-session-list">
        {visibleSessions.length === 0 && (
          <div className="dns-assessor-v2-empty">
            <Info className="h-4 w-4" />
            {resultsOnly ? "Завершенных прохождений пока нет." : "Активных симуляций пока нет. После запуска участники появятся здесь автоматически."}
          </div>
        )}
        {visibleSessions.map((session) => {
          const statusInfo = getStatusLabel(session.status);
          return (
            <div key={session.liveSessionId} className="dns-assessor-v2-session-card">
              <div className="dns-assessor-v2-session-person">
                <span className="dns-assessor-v2-session-avatar">
                  {(session.participantName || "У").trim().slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <strong>{session.participantName}</strong>
                  <p>Оценщик: {session.assessorName || "—"}</p>
                </div>
              </div>
              <div className="dns-assessor-v2-session-code">
                <span>Код студента</span>
                {renderCopyAccessCodeButton(session.accessCode)}
              </div>
              <div className="dns-assessor-v2-session-state">
                <span className={statusInfo.color}>{statusInfo.label}</span>
                <div className="dns-assessor-v2-progress">
                  <span style={{ width: Math.round(session.progressPercent) + "%" }} />
                </div>
                <em>{Math.round(session.progressPercent)}%</em>
              </div>
              <div className="dns-assessor-v2-session-score">
                <span>Текущий балл</span>
                <strong>{session.decisionsCount > 0 ? session.currentAverageScore.toFixed(1) : "—"}</strong>
                <small>{session.decisionsCount} решений</small>
              </div>
              <div className="dns-assessor-v2-session-actions">
                {session.status === "completed" && session.runtimeSessionId ? (
                  <Button type="button" size="sm" className="bg-[#35d38a] text-[#061018] hover:bg-[#2bc479]" onClick={() => navigate(`/results/${session.runtimeSessionId}`)}>
                    <FileText className="mr-2 h-4 w-4" />
                    Отчёт / PDF
                  </Button>
                ) : (
                  <Button type="button" size="sm" className="bg-[#5eb1ff] text-white hover:bg-[#4a9fe8]" onClick={() => observeLiveSession(session.liveSessionId)} disabled={observeLoadingId === session.liveSessionId}>
                    <Eye className="mr-2 h-4 w-4" />
                    {observeLoadingId === session.liveSessionId ? "Открытие..." : "Наблюдать"}
                  </Button>
                )}
                <Button type="button" size="sm" variant="outline" className="border-[#ff6472]/35 bg-transparent text-[#ffc2c8] hover:bg-[#ff6472]/10" onClick={() => removeLiveSession(session.liveSessionId)} disabled={removeLoadingId === session.liveSessionId}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {removeLoadingId === session.liveSessionId ? "Удаление..." : "Удалить"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
    );
  };

  const renderMainPanel = () => {
    switch (activePanel) {
      case "participant": return renderParticipantPanel();
      case "scenario": return renderScenarioPanel();
      case "composition": return renderCompositionPanel();
      case "review": return renderReviewPanel();
      case "sessions": return renderSessionsPanel();
      case "results": return renderSessionsPanel(true);
      default: return renderParticipantPanel();
    }
  };

  const goBackPanel = () => {
    if (activePanel === "scenario") setActivePanel("participant");
    if (activePanel === "composition") setActivePanel("scenario");
    if (activePanel === "review") setActivePanel("composition");
  };

  const renderBackAction = () => (
    activePanel === "scenario" || activePanel === "composition" || activePanel === "review" ? (
      <button type="button" className="dns-assessor-v2-secondary" onClick={goBackPanel}>
        <ArrowLeft className="h-4 w-4" />
        Назад
      </button>
    ) : null
  );

  const renderPrimaryAction = () => {
    if (activePanel === "participant") {
      return <Button type="button" className="dns-assessor-v2-primary" onClick={continueFromParticipant} disabled={!participantReady}>Продолжить к режиму</Button>;
    }
    if (activePanel === "scenario") {
      return <Button type="button" className="dns-assessor-v2-primary" onClick={continueFromScenario} disabled={!scenarioConfirmed}>Продолжить к составу</Button>;
    }
    if (activePanel === "composition") {
      return <Button type="button" className="dns-assessor-v2-primary" onClick={continueFromComposition} disabled={!compositionReady}>Перейти к проверке</Button>;
    }
    if (activePanel === "review") {
      if (!channelReviewDone) {
        return <Button type="button" className="dns-assessor-v2-primary" onClick={confirmChannels}>Подтвердить каналы</Button>;
      }
      return (
        <Button type="button" className="dns-assessor-v2-primary" onClick={handleStart} disabled={readyParticipantSetups.length === 0 || isStarting} data-testid="button-start">
          <Play className="mr-2 h-4 w-4" />
          {isStarting ? "Запускаем..." : `Запустить участников: ${readyParticipantSetups.length}`}
        </Button>
      );
    }
    return <Button type="button" className="dns-assessor-v2-primary" onClick={() => addParticipantSetup("blank")}>Следующий испытуемый</Button>;
  };

  const renderSidePanel = () => (
    <aside className="dns-assessor-v2-side">
      {activePanel === "sessions" || activePanel === "results" ? (
        <>
          <section className="dns-assessor-v2-panel dns-assessor-v2-side-card">
            <h3>{activePanel === "results" ? "Быстрый переход" : "Новая настройка"}</h3>
            <p>{activePanel === "results" ? "Вернитесь к активным сессиям или подготовьте следующего участника." : "Пока участник проходит симуляцию, можно подготовить следующего без остановки live-сессий."}</p>
            <div className="dns-assessor-v2-side-field">
              <span>Испытуемый</span>
              <strong>{participantName.trim() || "Новый сотрудник"}</strong>
            </div>
            <div className="dns-assessor-v2-side-field">
              <span>Режим оценки</span>
              <strong>{scenarioName}</strong>
            </div>
            <div className="dns-assessor-v2-side-actions">
              {activePanel === "results" && (
                <button type="button" className="dns-assessor-v2-secondary" onClick={() => setActivePanel("sessions")}>
                  <Activity className="h-4 w-4" />
                  Активные сессии
                </button>
              )}
              <Button type="button" className="dns-assessor-v2-primary" onClick={() => addParticipantSetup("copy")}>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Следующий с копией
              </Button>
              <button type="button" className="dns-assessor-v2-secondary" onClick={() => addParticipantSetup("blank")}>
                <Users className="h-4 w-4" />
                Пустая настройка
              </button>
            </div>
          </section>
          <section className="dns-assessor-v2-panel dns-assessor-v2-side-card">
            <h3>Длительность</h3>
            <div className="dns-assessor-v2-passport-grid">
              <div><strong>{estimatedTimeLimit}</strong><span>минут</span></div>
              <div><strong>{activeCaseCount}</strong><span>кейсов</span></div>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="dns-assessor-v2-panel dns-assessor-v2-side-card">
            <div className="dns-assessor-v2-side-title-row">
              <div><span className="dns-assessor-v2-kicker">Готовность оценки</span><h3>{setupProgress === 4 ? "Можно запускать" : "Нужна проверка"}</h3></div>
              <strong>{Math.round((setupProgress / 4) * 100)}%</strong>
            </div>
            <div className="dns-assessor-v2-progress dns-assessor-v2-progress--setup"><span style={{ width: `${Math.round((setupProgress / 4) * 100)}%` }} /></div>
            <div className="dns-assessor-v2-passport-grid">
              <div><strong>{scenarioName}</strong><span>режим оценки</span></div>
              <div><strong>{DIFFICULTY_INFO[difficulty].label}</strong><span>сложность</span></div>
              <div><strong>{estimatedTimeLimit} мин</strong><span>время</span></div>
              <div><strong>{activeCaseCount} / {enabledChannelLabels.length}</strong><span>кейсы / каналы</span></div>
            </div>
          </section>
          <section className="dns-assessor-v2-panel dns-assessor-v2-side-card">
            <h3>Перед запуском</h3>
            <div className="dns-assessor-v2-validation-list">
              {reviewItems.map((item, index) => (
                <button key={item.title} type="button" onClick={() => setActivePanel(item.title === "Участник" ? "participant" : item.title === "Сценарий" ? "scenario" : item.title === "Состав" ? "composition" : "review")}>
                  {item.done ? <CheckCircle2 className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                  <span><strong>{item.title}</strong><small>{[
                    "ФИО заполнены.",
                    "Выбран режим оценки.",
                    "Кейсы и стартовые параметры проверены.",
                    "Все включенные каналы содержат события.",
                  ][index]}</small></span>
                </button>
              ))}
            </div>
          </section>
          {startError && <div className="dns-assessor-v2-error">{startError}</div>}
          <section className="dns-assessor-v2-panel dns-assessor-v2-side-card dns-assessor-v2-action-card">
            <div className="dns-assessor-v2-side-actions">
              <button type="button" className="dns-assessor-v2-secondary" onClick={() => { saveActiveParticipantSetup(); }}>
                <Save className="h-4 w-4" />Сохранить настройку
              </button>
              <button type="button" className="dns-assessor-v2-secondary" onClick={validateCurrentSetup}>
                <ClipboardCheck className="h-4 w-4" />Проверить
              </button>
              <Button type="button" className="dns-assessor-v2-primary" onClick={handleStart} disabled={readyParticipantSetups.length === 0 || isStarting} data-testid="button-start">
                <Play className="mr-2 h-4 w-4" />
                {isStarting ? "Запускаем..." : "Запустить симуляцию"}
              </Button>
            </div>
          </section>
        </>
      )}
    </aside>
  );

  return (
    <div
      className={`dns-product-shell dns-assessor-shell dns-visual-shell dns-visual-shell--product ${themeClass} relative overflow-auto`}
      style={{
        backgroundImage: `url(${theme === "light" ? BRAND_ASSETS.backgrounds.cabinetLight : BRAND_ASSETS.backgrounds.cabinetDark})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <BrandVisualBackdrop variant="cabinet" />
      <div className="dns-theme-overlay absolute inset-0 bg-gradient-to-b from-[#0b101966] via-[#0d142199] to-[#0d1421cc]" />

      <div className="dns-page-frame dns-assessor-v2-frame">
        <header className="dns-brand-header dns-assessor-v2-header">
          <div className="dns-brand-title">
            <BrandMark compact />
            <div>
              <div className="dns-brand-kicker">DNS SimCenter</div>
              <h1 className="dns-brand-heading">Кабинет оценщика</h1>
              <p className="dns-brand-subtitle">Подготовка кандидатов, запуск и контроль симуляций.</p>
            </div>
          </div>
          <div className="dns-header-actions dns-assessor-v2-header-actions">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <FeedbackButton />
            <button
              onClick={() => navigate("/")}
              className="dns-assessor-v2-header-button"
              data-testid="back-button"
            >
              <ArrowLeft className="w-4 h-4" /> К ролям
            </button>
          </div>
        </header>

        <Dialog
          open={adminAccessOpen}
          onOpenChange={(open) => {
            if (adminAccessLoading) {
              return;
            }
            setAdminAccessOpen(open);
            if (!open) {
              setAdminPassword("");
              setAdminAccessError("");
            }
          }}
        >
          <DialogContent className="border-[#34465f] bg-[#162234] text-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Вход в меню администратора</DialogTitle>
              <DialogDescription className="text-[#aebbd0]">
                Подтвердите административный пароль. Учетные данные при этом не изменяются.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdminElevation} className="space-y-4">
              <div>
                <Label htmlFor="admin-access-password" className="mb-1.5 block text-xs text-[#aebbd0]">
                  Пароль администратора
                </Label>
                <Input
                  id="admin-access-password"
                  type="password"
                  value={adminPassword}
                  onChange={(event) => {
                    setAdminPassword(event.target.value);
                    if (adminAccessError) {
                      setAdminAccessError("");
                    }
                  }}
                  autoComplete="current-password"
                  autoFocus
                  disabled={adminAccessLoading}
                  aria-invalid={Boolean(adminAccessError)}
                  aria-describedby={adminAccessError ? "admin-access-error" : undefined}
                  className="border-[#34465f] bg-[#0f1826] text-white"
                  data-testid="admin-access-password"
                />
                {adminAccessError && (
                  <div id="admin-access-error" className="mt-2 text-sm text-[#ff9a9a]" role="alert">
                    {adminAccessError}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAdminAccessOpen(false)}
                  disabled={adminAccessLoading}
                  className="border-[#34465f] bg-transparent text-[#c1ccdc]"
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  disabled={adminAccessLoading}
                  className="border border-[#FF6B00] bg-[#FF6B00] text-white hover:bg-[#e06000]"
                  data-testid="confirm-admin-access"
                >
                  {adminAccessLoading ? "Проверка..." : "Перейти"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {showWiki ? (
          <AssessorWiki
            onBack={() => setShowWiki(false)}
            processOpen={wikiProcessOpen}
            onToggleProcess={() => setWikiProcessOpen(prev => !prev)}
          />
        ) : (
          <div className="dns-assessor-v2-shell">
            {renderRail()}
            <main className="dns-assessor-v2-main">
              {activePanel !== "sessions" && activePanel !== "results" && renderCandidateSummary()}
              {isSetupPanel && renderSetupNavigation()}
              {renderMainPanel()}
            </main>
            {renderSidePanel()}
          </div>
        )}
        <ProductFooter />
      </div>
    </div>
  );
}
