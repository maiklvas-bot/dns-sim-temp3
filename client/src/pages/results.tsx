import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useSimulation } from "../context/SimulationContext";
import CompetencyRadar from "@/components/competency-radar";
import DevelopmentPlan from "@/components/development-plan";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Award, TrendingUp, TrendingDown, Clock, FileText, Target,
  RotateCcw, Brain, ArrowRight, Users, BarChart3, Download, Loader2,
  Eye, BookOpen, Activity, FileSpreadsheet, Zap, Lightbulb,
  ChevronRight, AlertTriangle, CheckCircle, XCircle, MessageCircle,
  Shield, Calendar, Cpu, HeartHandshake, BarChart2, Sparkles
} from "lucide-react";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { getSimulationSettingsSnapshot } from "@/lib/runtime-content";
import { clearLiveSimulationRole, closeRemoteLiveSimulation, getLiveSimulationConfig, resetLiveSimulation } from "@/lib/live-session";
import type { SimulationRuntimeSettings } from "@shared/simulation-content";
import { buildPdfPayloadFromReport, buildReportFromSessionDetails, buildReportFromState } from "@/lib/report-data";
import { DNS_COLORS, DNS_GRADIENTS } from "@/styles/dns-theme";
import { BrandMark, BrandVisualBackdrop } from "@/components/brand-access-shell";
import storeBg from "@assets/store_bg.png";

// ============================================================
// Рекомендации по развитию для каждой компетенции
// ============================================================
function getLearningRecommendation(competencyId: string, score: number): string {
  const recommendations: Record<string, string> = {
    communication: 'Пройдите курс "Эффективные коммуникации в ритейле", практикуйте активное слушание на ежедневных брифингах',
    leadership: 'Изучите материалы по situational leadership, проведите 1-на-1 с каждым сотрудником раз в неделю',
    decision_making: 'Работайте с матрицей Eisenhower, практикуйте принятие решений под time-boxing',
    customer_focus: 'Пройдите тренинг "Клиентоориентированность DNS", изучите кейсы лидеров клиентской оценки',
    team_management: 'Используйте RACI-матрицу для распределения задач, внедрите систему KPI для команды',
    problem_solving: 'Изучите 5 Whys и Fishbone диаграмму, применяйте на еженедельных разборах',
    time_management: 'Внедрите time-blocking, используйте правило 2 минут для мелких задач',
    stress_resistance: 'Освойте техники box breathing и mindfulness, планируйте буферное время в расписании',
    strategic_thinking: 'Анализируйте P&L отдела еженедельно, изучайте тренды рынка электроники',
    operational_efficiency: 'Внедрите ежедневные Gemba walks, оптимизируйте 3 основных процесса магазина',
    emotional_intelligence: 'Пройдите оценку EQ, практикуйте техники рефрейминга в конфликтных ситуациях',
    conflict_resolution: 'Изучите модель Thomas-Kilmann, проведите ролевую тренировку с HR',
    adaptability: 'Работайте по методике Scrum в ежедневных задачах, фиксируйте уроки после изменений',
    mentoring: 'Создайте план наставничества для 2-3 сотрудников, используйте GROW-модель',
  };
  const baseRec = recommendations[competencyId] || 'Рекомендуется дополнительное обучение и практика';
  if (score < 2.5) {
    return `${baseRec}. Приоритет: высокий — начните в ближайшую неделю`;
  } else if (score < 3.5) {
    return `${baseRec}. Приоритет: средний — план на 2-4 недели`;
  }
  return `${baseRec}. Приоритет: низкий — закрепите текущий уровень`;
}

// ============================================================
// Иконки для компетенций
// ============================================================
function getCompetencyIcon(competencyId: string) {
  const iconMap: Record<string, React.ReactNode> = {
    communication: <MessageCircle className="w-4 h-4" />,
    leadership: <Users className="w-4 h-4" />,
    decision_making: <Zap className="w-4 h-4" />,
    customer_focus: <HeartHandshake className="w-4 h-4" />,
    team_management: <Users className="w-4 h-4" />,
    problem_solving: <Brain className="w-4 h-4" />,
    time_management: <Clock className="w-4 h-4" />,
    stress_resistance: <Shield className="w-4 h-4" />,
    strategic_thinking: <Target className="w-4 h-4" />,
    operational_efficiency: <Cpu className="w-4 h-4" />,
    emotional_intelligence: <HeartHandshake className="w-4 h-4" />,
    conflict_resolution: <Shield className="w-4 h-4" />,
    adaptability: <Sparkles className="w-4 h-4" />,
    mentoring: <BookOpen className="w-4 h-4" />,
  };
  return iconMap[competencyId] || <Activity className="w-4 h-4" />;
}

// ============================================================
// Цвет компетенции по баллу
// ============================================================
function getScoreColor(score: number): string {
  if (score >= 4) return DNS_COLORS.success;
  if (score >= 3) return DNS_COLORS.accentBlue;
  if (score >= 2) return DNS_COLORS.warning;
  return DNS_COLORS.error;
}

function getScoreGradient(score: number): string {
  if (score >= 4) return 'linear-gradient(90deg, #00C853 0%, #00D4AA 100%)';
  if (score >= 3) return 'linear-gradient(90deg, #2979FF 0%, #4A9EFF 100%)';
  if (score >= 2) return 'linear-gradient(90deg, #FFB300 0%, #FF6B35 100%)';
  return 'linear-gradient(90deg, #FF1744 0%, #FF6B35 100%)';
}

// ============================================================
// Компонент градиентного прогресс-бара
// ============================================================
function GradientProgressBar({ score, expected = 4.0, showExpected = true }: { score: number; expected?: number; showExpected?: boolean }) {
  const pct = Math.min(100, (score / 5) * 100);
  const expectedPct = (expected / 5) * 100;
  const color = getScoreColor(score);

  return (
    <div className="flex-1 h-3 rounded-full bg-[#0F1923] relative overflow-hidden">
      {/* Ожидаемый уровень — пунктирная линия */}
      {showExpected && (
        <div
          className="absolute top-0 bottom-0 w-0.5 z-10"
          style={{
            left: `${expectedPct}%`,
            background: 'repeating-linear-gradient(to bottom, #64748B 0, #64748B 3px, transparent 3px, transparent 6px)',
          }}
          title={`Ожидаемый уровень: ${expected}`}
        />
      )}
      {/* Фактический результат */}
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${pct}%`, background: getScoreGradient(score) }}
      />
    </div>
  );
}

// ============================================================
// Главный компонент страницы
// ============================================================
export default function ResultsPage(props: any) {
  const [, navigate] = useLocation();
  const { state, getCompetencyAverage, dispatch } = useSimulation();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);
  const persistedSessionId = props?.params?.sessionId ? Number(props.params.sessionId) : null;
  const [activeTab, setActiveTab] = useState<"results" | "preview">(persistedSessionId != null ? "preview" : "results");
  const runtimeSettings = getSimulationSettingsSnapshot<SimulationRuntimeSettings>();
  const persistedResultQuery = useQuery({
    queryKey: ["/api/staff/results", persistedSessionId],
    queryFn: getQueryFn<any>({ on401: "throw" }),
    enabled: persistedSessionId != null,
  });

  const report = useMemo(() => {
    if (persistedSessionId != null && persistedResultQuery.data) {
      return buildReportFromSessionDetails(persistedResultQuery.data, runtimeSettings);
    }
    return buildReportFromState(state, getCompetencyAverage, runtimeSettings);
  }, [getCompetencyAverage, persistedResultQuery.data, persistedSessionId, runtimeSettings, state]);

  const {
    participantName,
    assessorName,
    difficulty,
    isTestMode,
    decisions,
    totalDecisions,
    totalScore,
    avgScore,
    totalMinutes,
    pauseEntries,
    totalPauseSeconds,
    impactfulDecisions,
    compScores,
    compScoresMap,
    overallAvg,
    verdict,
    strengths,
    weaknesses,
    weakForPlan,
    patterns,
    finalMetrics,
  } = report;
  const reportDecisions = decisions as any[];
  const reportPauses = pauseEntries as any[];

  const getReportCompetencyAverage = (compId: string) => compScoresMap[compId] || 0;

  // Сортируем компетенции по баллу (по возрастанию) для секции слабых сторон
  const sortedWeaknesses = useMemo(() => {
    return [...weaknesses].sort((a, b) => a.avg - b.avg);
  }, [weaknesses]);

  // Считаем количество решений по категориям
  const excellentDecisions = reportDecisions.filter((d: any) => d.score >= 4).length;
  const weakDecisions = reportDecisions.filter((d: any) => d.score <= 2).length;

  if (persistedSessionId != null && persistedResultQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1117] text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: DNS_COLORS.primary }} />
          <span className="text-sm text-[#94A3B8]">Загрузка результата...</span>
        </div>
      </div>
    );
  }

  if (persistedSessionId != null && persistedResultQuery.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1117] px-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-[#2a3a4e] bg-[#141c2b]/85 p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-[#FFB300]" />
          <h2 className="text-lg font-semibold">Не удалось загрузить результат</h2>
          <p className="mt-2 text-sm text-[#94A3B8]">
            Проверьте соединение и попробуйте снова. Если ошибка повторяется, обратитесь к администратору.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Button variant="outline" onClick={() => navigate('/evaluator')}>
              Вернуться к оценщику
            </Button>
            <Button onClick={() => persistedResultQuery.refetch()}>
              Повторить
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleRestart = async () => {
    if (persistedSessionId != null) {
      navigate("/evaluator");
      return;
    }
    const liveConfig = getLiveSimulationConfig();
    if (liveConfig) {
      try {
        await closeRemoteLiveSimulation(liveConfig.liveSessionId);
      } catch (error) {
        console.error("Failed to close live session", error);
      }
    }
    resetLiveSimulation();
    clearLiveSimulationRole();
    dispatch({ type: "RESET" });
    navigate("/");
  };

  const handleExportPdf = async () => {
    setPdfLoading(true);
    setPdfError(null);
    try {
      const payload = buildPdfPayloadFromReport(report);
      const response = await apiRequest("POST", "/api/export-pdf", payload);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const name = (participantName || "participant").replace(/\s+/g, "_");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `report_${name}_${dateStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("PDF export failed:", err);
      setPdfError(err.message || "Не удалось сгенерировать PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleExportExcel = async () => {
    setExcelLoading(true);
    setExcelError(null);
    try {
      const session =
        persistedSessionId != null
          ? (persistedResultQuery.data?.session || null)
          : state.sessionId != null
            ? await apiRequest("GET", `/api/sessions/${state.sessionId}`).then((response) => response.json())
          : null;

      const timerRows = reportDecisions
        .filter((item: any) => item.timer)
        .map((item: any) => item.timer!)
        .map((timer: any) => ([
          timer.title,
          timer.taskType,
          timer.responsibility,
          timer.zoneLabel,
          timer.label,
          timer.totalSeconds,
          timer.resolvedSimTime || "",
          timer.wasOverdue ? "Да" : "Нет",
          timer.overdueSeconds,
          timer.status,
        ]));

      const summaryRows = [
        ["Участник", participantName || "Участник"],
        ["Оценщик", assessorName || ""],
        ["Сложность", difficulty === "easy" ? "Лёгкий" : difficulty === "hard" ? "Сложный" : "Средний"],
        ["Режим", isTestMode ? "Тестирование" : "В зачёт"],
        ["Дата и время старта", session?.startedAt || ""],
        ["Дата и время завершения", session?.completedAt || new Date().toISOString()],
        ["Статус прохождения", session?.technicalStatus || "completed"],
        ["Итоговый балл", totalScore],
        ["Средний балл", avgScore],
        ["Кейсы", reportDecisions.map((item: any) => item.caseTitle).join(" | ")],
        ["Просрочки", reportDecisions.filter((item: any) => item.timer?.wasOverdue).length],
        ["Сработавшие таймеры", timerRows.length],
      ];

      const detailRows = [
        [
          "Кейс", "Тип задачи", "Время в симуляции", "Вариант ответа",
          "Оценка", "Базовый балл", "Штраф за просрочку", "Просрочено",
          "Таймер", "Зона", "Ответственный", "Комментарий оценщика",
        ],
        ...reportDecisions.map((item: any) => ([
          item.caseTitle,
          item.taskType,
          item.simTime,
          item.optionText,
          item.score,
          item.baseScore,
          item.timerPenalty,
          item.timer?.wasOverdue ? "Да" : "Нет",
          item.timer?.label || "",
          item.zoneLabel,
          item.responsibility,
          "",
        ])),
      ];

      const response = await apiRequest("POST", "/api/export-xlsx", {
        sheets: [
          { name: "Результат", rows: summaryRows },
          { name: "Кейсы", rows: detailRows },
          ...(timerRows.length > 0
            ? [{
              name: "Таймеры",
              rows: [[
                "Задача", "Тип", "Ответственный", "Зона", "Таймер",
                "Лимит, сек", "Время закрытия", "Просрочено", "Просрочка, сек", "Статус",
              ], ...timerRows],
            }]
            : []),
        ],
      });

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const participantSlug = (participantName || "participant").replace(/\s+/g, "_");
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `results_${participantSlug}_${dateStr}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Excel export failed:", err);
      setExcelError(err.message || "Не удалось сформировать Excel");
    } finally {
      setExcelLoading(false);
    }
  };

  return (
    <div
      className="dns-product-shell dns-visual-shell dns-visual-shell--results relative"
      style={{
        backgroundImage: `url(${storeBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <BrandVisualBackdrop variant="results" />
      {/* Градиентный оверлей */}
      <div className="absolute inset-0" style={{ background: DNS_GRADIENTS.dark }} />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0d1421f2] via-[#16213ef5] to-[#0d1421f7]" />

      <div className="dns-page-frame max-w-6xl">

        {/* ═══════════════════════════════════════════
            HEADER
        ═══════════════════════════════════════════ */}
        <header className="dns-brand-header">
          <div className="dns-brand-title">
            <BrandMark compact />
            <div>
              <div className="dns-brand-kicker">DNS SimCenter</div>
              <h1 className="dns-brand-heading">{participantName || "Результаты симуляции"}</h1>
              <p className="dns-brand-subtitle">
                Оценщик: {assessorName || "—"} • Сложность: {difficulty === "easy" ? "Лёгкий" : difficulty === "hard" ? "Сложный" : "Средний"}
              </p>
            </div>
          </div>
          <div className="dns-header-actions">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FF6B00]/35 bg-[#FF6B00]/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#ffb27a]">
              <Award className="w-4 h-4" />
              Результаты
            </div>
          </div>
        </header>

        {/* ═══════════════════════════════════════════
            TEST MODE BANNER
        ═══════════════════════════════════════════ */}
        {isTestMode && (
          <div className="mb-6 p-4 rounded-xl border flex items-center gap-3" style={{ borderColor: `${DNS_COLORS.warning}40`, background: `${DNS_COLORS.warning}10` }}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: DNS_COLORS.warning }} />
            <div>
              <div className="text-sm font-semibold" style={{ color: DNS_COLORS.warning }}>Тестовый режим</div>
              <div className="text-xs text-[#94A3B8]">Результаты не засчитываются в официальный профиль — это было пробное прохождение.</div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            TAB BAR
        ═══════════════════════════════════════════ */}
        <div className="mb-6 flex justify-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab("results")}
            className={`dns-tab-button flex items-center gap-2 whitespace-nowrap px-4 py-2 text-sm font-medium ${
              activeTab === "results"
                ? "dns-tab-button-active"
                : "hover:text-white hover:border-[#FF6B35]/40"
            }`}
            data-testid="tab-results"
          >
            <BarChart3 className="w-4 h-4" /> Итоги
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`dns-tab-button flex items-center gap-2 whitespace-nowrap px-4 py-2 text-sm font-medium ${
              activeTab === "preview"
                ? "dns-tab-button-active"
                : "hover:text-white hover:border-[#FF6B35]/40"
            }`}
            data-testid="tab-preview"
          >
            <Eye className="w-4 h-4" /> Предпросмотр отчёта
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            TAB: RESULTS — основная вкладка с улучшенной визуализацией
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "results" ? (<>

          {/* ═══════════════════════════════════════════
              HERO RESULT CARD — быстрый скан
          ═══════════════════════════════════════════ */}
          <div
            className="rounded-2xl border-2 p-6 mb-6 dns-animate-fade-in"
            style={{
              borderColor: verdict.color + '40',
              background: `linear-gradient(135deg, ${verdict.color}10 0%, #1A2634 60%)`,
            }}
          >
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              {/* Большая иконка */}
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: verdict.color + '20' }}
              >
                <Award className="w-8 h-8" style={{ color: verdict.color }} />
              </div>
              {/* Описание уровня */}
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold" style={{ color: verdict.color }}>{verdict.level}</h2>
                <p className="text-sm mt-1" style={{ color: DNS_COLORS.textSecondary }}>{verdict.description}</p>
              </div>
              {/* Общий балл */}
              <div className="text-right flex-shrink-0">
                <div className="text-3xl font-bold tabular-nums" style={{ color: verdict.color }}>{overallAvg}/5</div>
                <div className="text-xs" style={{ color: DNS_COLORS.textMuted }}>Общий балл</div>
              </div>
            </div>

            {/* Быстрые метрики */}
            <div
              className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t"
              style={{ borderColor: verdict.color + '20' }}
            >
              <div className="text-center">
                <div className="text-xl font-bold text-white tabular-nums">{totalDecisions}</div>
                <div className="text-xs mt-0.5" style={{ color: DNS_COLORS.textMuted }}>Решений</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold tabular-nums" style={{ color: DNS_COLORS.primaryLight }}>{avgScore}</div>
                <div className="text-xs mt-0.5" style={{ color: DNS_COLORS.textMuted }}>Средний балл</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-white tabular-nums">{totalMinutes} мин</div>
                <div className="text-xs mt-0.5" style={{ color: DNS_COLORS.textMuted }}>Время</div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              ОЖИДАЕМЫЙ vs ФАКТИЧЕСКИЙ — сравнение
          ═══════════════════════════════════════════ */}
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1A2634] p-5 mb-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: DNS_COLORS.primaryLight }}>
              <Target className="w-4 h-4" /> Сравнение с ожиданиями
            </h3>
            <div className="space-y-3">
              {compScores.map(c => {
                const expected = 4.0;
                const actual = c.avg;
                const gap = actual - expected;
                const isGood = gap >= 0;
                const isClose = gap > -1;
                return (
                  <div key={c.id} className="flex items-center gap-3">
                    {/* Иконка компетенции */}
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: getScoreColor(c.avg) + '15', color: getScoreColor(c.avg) }}>
                      {getCompetencyIcon(c.id)}
                    </div>
                    {/* Название */}
                    <span className="text-xs w-36 truncate flex-shrink-0" style={{ color: DNS_COLORS.textSecondary }}>{c.name}</span>
                    {/* Градиентный бар с пунктирной линией ожиданий */}
                    <GradientProgressBar score={c.avg} expected={expected} />
                    {/* Балл */}
                    <span
                      className="text-xs font-bold tabular-nums w-10 text-right flex-shrink-0"
                      style={{ color: getScoreColor(c.avg) }}
                    >
                      {actual > 0 ? actual.toFixed(1) : '—'}
                    </span>
                    {/* Статус */}
                    <span className="text-[10px] w-24 flex-shrink-0 flex items-center gap-1">
                      {isGood ? (
                        <><CheckCircle className="w-3 h-3" style={{ color: DNS_COLORS.success }} /> <span style={{ color: DNS_COLORS.success }}>На уровне</span></>
                      ) : isClose ? (
                        <><AlertTriangle className="w-3 h-3" style={{ color: DNS_COLORS.warning }} /> <span style={{ color: DNS_COLORS.warning }}>Ниже</span></>
                      ) : (
                        <><XCircle className="w-3 h-3" style={{ color: DNS_COLORS.error }} /> <span style={{ color: DNS_COLORS.error }}>Требует работы</span></>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Легенда */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[#2a3a4e]">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5" style={{ background: 'repeating-linear-gradient(to right, #64748B 0, #64748B 3px, transparent 3px, transparent 6px)' }} />
                <span className="text-[10px]" style={{ color: DNS_COLORS.textMuted }}>Ожидаемый уровень (4.0)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-1.5 rounded-full" style={{ background: DNS_GRADIENTS.primary }} />
                <span className="text-[10px]" style={{ color: DNS_COLORS.textMuted }}>Фактический результат</span>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              PAUSE ENTRIES
          ═══════════════════════════════════════════ */}
          {pauseEntries.length > 0 && (
            <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5 mb-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: DNS_COLORS.primaryLight }}>
                <Clock className="w-4 h-4" /> Паузы в симуляции
              </h3>
              <p className="text-xs mb-3" style={{ color: DNS_COLORS.textMuted }}>
                Всего пауз: {pauseEntries.length} • суммарно {Math.floor(totalPauseSeconds / 60)} мин {totalPauseSeconds % 60} сек
              </p>
              <div className="space-y-2">
                {reportPauses.map((pause: any) => (
                  <div key={pause.id} className="flex items-center justify-between rounded-lg border border-[#2a3a4e] bg-[#141c2b]/50 px-3 py-2 text-xs">
                    <span style={{ color: DNS_COLORS.textSecondary }}>
                      Пауза на отметке <span className="font-mono text-white">{pause.startedSimTime}</span>
                    </span>
                    <span className="font-mono" style={{ color: DNS_COLORS.textMuted }}>
                      {Math.floor(pause.durationSeconds / 60)}м {pause.durationSeconds % 60}с
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════
              IMPACTFUL DECISIONS
          ═══════════════════════════════════════════ */}
          {impactfulDecisions.length > 0 && (
            <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5 mb-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: DNS_COLORS.accentBlue }}>
                <Activity className="w-4 h-4" /> Решения с самой сильной реакцией системы
              </h3>
              <div className="space-y-3">
                {impactfulDecisions.map((decision, index) => (
                  <div key={`${decision.caseId}-${index}`} className="rounded-xl border border-[#2a3a4e] bg-[#141c2b]/45 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">{decision.caseTitle}</div>
                        <div className="mt-1 text-xs" style={{ color: DNS_COLORS.textMuted }}>
                          {decision.simTime} • {decision.taskType} • Балл {decision.score}/5
                        </div>
                      </div>
                      <div className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: `${DNS_COLORS.accentBlue}40`, background: `${DNS_COLORS.accentBlue}10`, color: '#8ec5ff' }}>
                        Реакция: {decision.impactMagnitude}
                      </div>
                    </div>
                    <div className="mt-3 text-sm leading-relaxed" style={{ color: '#d4dced' }}>{decision.optionText}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════
              RADAR + STRENGTHS/WEAKNESSES
          ═══════════════════════════════════════════ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Radar */}
            <div className="rounded-xl border border-[#2a3a4e] bg-[#1A2634] p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: DNS_COLORS.primaryLight }}>
                <BarChart2 className="w-4 h-4 inline mr-1.5" />
                Профиль компетенций
              </h3>
              <div className="flex justify-center">
                <CompetencyRadar getAverage={getReportCompetencyAverage} size={320} showExpectedLine={true} />
              </div>
              {/* Легенда радара */}
              <div className="flex items-center justify-center gap-4 mt-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ background: DNS_COLORS.primary }} />
                  <span className="text-[10px]" style={{ color: DNS_COLORS.textMuted }}>Фактический</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full border border-dashed" style={{ borderColor: '#64748B' }} />
                  <span className="text-[10px]" style={{ color: DNS_COLORS.textMuted }}>Ожидаемый (4.0)</span>
                </div>
              </div>
            </div>

            {/* Strengths & Weaknesses */}
            <div className="space-y-4">
              {/* Strengths */}
              <div className="rounded-xl border border-[#2a3a4e] bg-[#1A2634] p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: DNS_COLORS.success }}>
                  <TrendingUp className="w-4 h-4" /> Сильные стороны
                </h3>
                <div className="space-y-2">
                  {strengths.map(c => (
                    <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg border" style={{ background: `${DNS_COLORS.success}08`, borderColor: `${DNS_COLORS.success}15` }}>
                      <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${DNS_COLORS.success}15`, color: DNS_COLORS.success }}>
                        {getCompetencyIcon(c.id)}
                      </div>
                      <span className="text-sm text-white flex-1 min-w-0 truncate">{c.name}</span>
                      <span className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color: DNS_COLORS.success }}>{c.avg.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weaknesses */}
              <div className="rounded-xl border border-[#2a3a4e] bg-[#1A2634] p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: DNS_COLORS.error }}>
                  <TrendingDown className="w-4 h-4" /> Зоны развития
                </h3>
                <div className="space-y-2">
                  {sortedWeaknesses.map(c => (
                    <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg border" style={{ background: `${DNS_COLORS.error}08`, borderColor: `${DNS_COLORS.error}15` }}>
                      <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${DNS_COLORS.error}15`, color: DNS_COLORS.error }}>
                        {getCompetencyIcon(c.id)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{c.name}</div>
                        <div className="mt-1 h-1 rounded-full bg-[#0F1923]">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.max(0, (c.avg / 5) * 100)}%`, background: getScoreGradient(c.avg) }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color: DNS_COLORS.error }}>{c.avg.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              LEARNING PLAN — персонализированный план
          ═══════════════════════════════════════════ */}
          {sortedWeaknesses.length > 0 && (
            <div className="rounded-xl border bg-[#1A2634] p-5 mb-6" style={{ borderColor: `${DNS_COLORS.error}30` }}>
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: DNS_COLORS.error }}>
                <Lightbulb className="w-4 h-4" /> Рекомендации по развитию
              </h3>
              <div className="space-y-3">
                {sortedWeaknesses.map((c, i) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-3 p-4 rounded-lg border transition-all hover:translate-x-1"
                    style={{ background: `${DNS_COLORS.error}06`, borderColor: `${DNS_COLORS.error}12` }}
                  >
                    {/* Номер приоритета */}
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `${DNS_COLORS.error}20` }}
                    >
                      <span className="text-xs font-bold" style={{ color: DNS_COLORS.error }}>{i + 1}</span>
                    </div>
                    {/* Контент */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: getScoreColor(c.avg) + '15', color: getScoreColor(c.avg) }}>
                          {getCompetencyIcon(c.id)}
                        </div>
                        <span className="text-sm font-semibold text-white">{c.name}</span>
                      </div>
                      <div className="text-xs mt-1.5" style={{ color: DNS_COLORS.textSecondary }}>
                        Текущий балл: <span className="font-bold" style={{ color: DNS_COLORS.error }}>{c.avg.toFixed(1)}/5</span>
                        {' · '}Цель: <span className="font-bold" style={{ color: DNS_COLORS.success }}>4.0/5</span>
                        {' · '}Разрыв: <span className="font-bold" style={{ color: (4.0 - c.avg) > 1.5 ? DNS_COLORS.error : DNS_COLORS.warning }}>{(4.0 - c.avg).toFixed(1)}</span>
                      </div>
                      <div className="text-xs mt-1.5" style={{ color: DNS_COLORS.textMuted }}>
                        {getLearningRecommendation(c.id, c.avg)}
                      </div>
                    </div>
                    {/* Стрелка */}
                    <ChevronRight className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: DNS_COLORS.textMuted }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════
              PATTERN ANALYSIS
          ═══════════════════════════════════════════ */}
          {patterns.length > 0 && (
            <div className="rounded-xl border border-[#2a3a4e] bg-[#1A2634] p-5 mb-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: DNS_COLORS.primaryLight }}>
                <Brain className="w-4 h-4" /> Анализ поведенческих паттернов
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {patterns.map((p, i) => (
                  <div key={i} className="p-3 rounded-lg border border-[#2a3a4e] bg-[#141c2b]/40">
                    <div className="flex items-center gap-2 mb-1.5" style={{ color: DNS_COLORS.textMuted }}>
                      {p.icon}
                      <span className="text-[10px] uppercase tracking-wider">{p.label}</span>
                    </div>
                    <div className="text-sm text-white font-medium">{p.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════
              INDIVIDUAL DEVELOPMENT PLAN (IDP)
          ═══════════════════════════════════════════ */}
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1A2634] p-5 mb-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-1 flex items-center gap-2" style={{ color: DNS_COLORS.primaryLight }}>
              <ArrowRight className="w-4 h-4" /> Индивидуальный план развития (ИПР) на 3 месяца
            </h3>
            <p className="text-xs mb-4" style={{ color: DNS_COLORS.textMuted }}>
              Персонализированный план для всех компетенций, где результат ещё не достиг 5.0/5.
            </p>
            <DevelopmentPlan weakCompetencies={weakForPlan.map(c => ({ id: c.id, name: c.name, score: c.avg }))} />
          </div>

          {/* ═══════════════════════════════════════════
              DECISION REGISTRY
          ═══════════════════════════════════════════ */}
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1A2634] p-5 mb-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: DNS_COLORS.primaryLight }}>
              <FileText className="w-4 h-4" /> Реестр решений
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a3a4e]">
                    <th className="text-left py-2 px-2 font-medium" style={{ color: DNS_COLORS.textMuted }}>Время</th>
                    <th className="text-left py-2 px-2 font-medium" style={{ color: DNS_COLORS.textMuted }}>Кейс</th>
                    <th className="text-left py-2 px-2 font-medium" style={{ color: DNS_COLORS.textMuted }}>Этап</th>
                    <th className="text-left py-2 px-2 font-medium" style={{ color: DNS_COLORS.textMuted }}>Решение</th>
                    <th className="text-center py-2 px-2 font-medium" style={{ color: DNS_COLORS.textMuted }}>Балл</th>
                  </tr>
                </thead>
                <tbody>
                  {reportDecisions.map((d: any, i: number) => (
                    <tr key={i} className="border-b border-[#2a3a4e]/30 hover:bg-[#1a1a2e]/30 transition-colors">
                      <td className="py-2 px-2 tabular-nums" style={{ color: '#555570' }}>{d.simTime}</td>
                      <td className="py-2 px-2 text-white">{d.caseTitle}</td>
                      <td className="py-2 px-2" style={{ color: DNS_COLORS.textMuted }}>{d.cycle}</td>
                      <td className="py-2 px-2 max-w-[300px] truncate" style={{ color: '#a0a0b8' }}>{d.optionText}</td>
                      <td className="py-2 px-2 text-center">
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                          style={{
                            borderColor: d.score >= 4 ? `${DNS_COLORS.success}40` : d.score >= 3 ? `${DNS_COLORS.warning}40` : `${DNS_COLORS.error}40`,
                            color: d.score >= 4 ? DNS_COLORS.success : d.score >= 3 ? DNS_COLORS.warning : DNS_COLORS.error,
                          }}
                        >
                          {d.score}/5
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              ACTIONS
          ═══════════════════════════════════════════ */}
          <div className="flex flex-col items-center gap-3 pb-8">
            <div className="dns-result-action-block">
              <Button
                onClick={handleRestart}
                variant="outline"
                className="border-[#2a3a4e] text-[#a0a0b8] hover:text-white hover:border-[#FF6B00] bg-transparent transition-all"
                data-testid="button-restart"
              >
                <RotateCcw className="w-4 h-4 mr-2" /> Новая симуляция
              </Button>
              <Button
                onClick={handleExportPdf}
                disabled={pdfLoading}
                className="font-semibold transition-all hover:scale-105"
                style={{ background: DNS_COLORS.primary, color: '#fff' }}
                data-testid="button-export-pdf"
              >
                {pdfLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Генерация PDF...</>
                ) : (
                  <><Download className="w-4 h-4 mr-2" /> Скачать отчёт PDF</>
                )}
              </Button>
              <Button
                onClick={handleExportExcel}
                disabled={excelLoading}
                className="font-semibold transition-all hover:scale-105"
                style={{ background: '#1f8f6a', color: '#fff' }}
                data-testid="button-export-excel"
              >
                {excelLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Excel...</>
                ) : (
                  <><FileSpreadsheet className="w-4 h-4 mr-2" /> Скачать Excel</>
                )}
              </Button>
            </div>
            {pdfError && <p className="text-xs mt-1" style={{ color: DNS_COLORS.error }}>{pdfError}</p>}
            {excelError && <p className="text-xs mt-1" style={{ color: DNS_COLORS.error }}>{excelError}</p>}
          </div>

        </>) : (
        /* ═══════════════════════════════════════════════════════════════
            TAB: PREVIEW — предпросмотр отчёта
        ═══════════════════════════════════════════════════════════════ */
        <div className="space-y-6">

          {/* Hero verdict */}
          <div
            className="rounded-2xl border-2 p-6"
            style={{
              borderColor: verdict.color + '40',
              background: `linear-gradient(135deg, ${verdict.color}10 0%, #1A2634 60%)`,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: verdict.color + '20' }}>
                  <Award className="w-6 h-6" style={{ color: verdict.color }} />
                </div>
                <h2 className="text-lg font-bold" style={{ color: verdict.color }}>{verdict.level}</h2>
              </div>
              <span className="text-2xl font-bold tabular-nums" style={{ color: verdict.color }}>{overallAvg}/5</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: DNS_COLORS.textSecondary }}>{verdict.description}</p>
          </div>

          {/* KPI Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[{
              label: "Решений", value: totalDecisions,
            }, {
              label: "Средний балл", value: avgScore,
            }, {
              label: "Отличных (4-5)", value: excellentDecisions,
            }, {
              label: "Слабых (1-2)", value: weakDecisions,
            }, {
              label: "Время", value: `${totalMinutes} мин`,
            }].map((kpi, i) => (
              <div key={i} className="dns-kpi-card text-center">
                <div className="dns-kpi-card__metric text-lg tabular-nums">{kpi.value}</div>
                <div className="dns-kpi-card__caption text-[10px]">{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Pauses */}
          {pauseEntries.length > 0 && (
            <div className="rounded-xl border border-[#2a3a4e] bg-[#1A2634] p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: DNS_COLORS.primaryLight }}>Журнал пауз</h3>
              <div className="space-y-2">
                {reportPauses.map((pause: any) => (
                  <div key={pause.id} className="flex items-center justify-between rounded-lg border border-[#2a3a4e] bg-[#141c2b]/40 px-3 py-2 text-xs">
                    <span style={{ color: DNS_COLORS.textSecondary }}>Пауза на {pause.startedSimTime}</span>
                    <span className="font-mono" style={{ color: DNS_COLORS.textMuted }}>{Math.floor(pause.durationSeconds / 60)}м {pause.durationSeconds % 60}с</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Competency Profile with gradient bars */}
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1A2634] p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: DNS_COLORS.primaryLight }}>
              <Activity className="w-4 h-4" /> Профиль компетенций (все {compScores.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <div className="flex justify-center mb-4 md:mb-0">
                <CompetencyRadar getAverage={getReportCompetencyAverage} size={280} showExpectedLine={true} />
              </div>
              <div className="space-y-2">
                {compScores.map(c => (
                  <div key={c.id} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: getScoreColor(c.avg) + '15', color: getScoreColor(c.avg) }}>
                      {getCompetencyIcon(c.id)}
                    </div>
                    <span className="text-xs w-36 truncate flex-shrink-0" style={{ color: DNS_COLORS.textSecondary }}>{c.name}</span>
                    <GradientProgressBar score={c.avg} />
                    <span className="text-xs font-bold tabular-nums w-8 text-right flex-shrink-0" style={{ color: getScoreColor(c.avg) }}>{c.avg > 0 ? c.avg.toFixed(1) : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Strengths & Weaknesses side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[#2a3a4e] bg-[#1A2634] p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: DNS_COLORS.success }}>
                <TrendingUp className="w-4 h-4" /> Сильные стороны
              </h3>
              {strengths.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg border mb-1.5" style={{ background: `${DNS_COLORS.success}08`, borderColor: `${DNS_COLORS.success}15` }}>
                  <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: `${DNS_COLORS.success}15`, color: DNS_COLORS.success }}>
                    {getCompetencyIcon(c.id)}
                  </div>
                  <span className="text-sm text-white flex-1 min-w-0 truncate">{c.name}</span>
                  <span className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color: DNS_COLORS.success }}>{c.avg.toFixed(1)}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-[#2a3a4e] bg-[#1A2634] p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: DNS_COLORS.error }}>
                <TrendingDown className="w-4 h-4" /> Зоны развития
              </h3>
              {sortedWeaknesses.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg border mb-1.5" style={{ background: `${DNS_COLORS.error}08`, borderColor: `${DNS_COLORS.error}15` }}>
                  <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: `${DNS_COLORS.error}15`, color: DNS_COLORS.error }}>
                    {getCompetencyIcon(c.id)}
                  </div>
                  <span className="text-sm text-white flex-1 min-w-0 truncate">{c.name}</span>
                  <span className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color: DNS_COLORS.error }}>{c.avg.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Learning Plan in preview */}
          {sortedWeaknesses.length > 0 && (
            <div className="rounded-xl border bg-[#1A2634] p-5" style={{ borderColor: `${DNS_COLORS.error}30` }}>
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: DNS_COLORS.error }}>
                <Lightbulb className="w-4 h-4" /> Рекомендации по развитию
              </h3>
              <div className="space-y-3">
                {sortedWeaknesses.slice(0, 5).map((c, i) => (
                  <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg border" style={{ background: `${DNS_COLORS.error}06`, borderColor: `${DNS_COLORS.error}12` }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${DNS_COLORS.error}20` }}>
                      <span className="text-xs font-bold" style={{ color: DNS_COLORS.error }}>{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{c.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: DNS_COLORS.textSecondary }}>
                        Балл: <span className="font-bold" style={{ color: DNS_COLORS.error }}>{c.avg.toFixed(1)}</span>
                        {' → '}Цель: <span className="font-bold" style={{ color: DNS_COLORS.success }}>4.0</span>
                      </div>
                      <div className="text-xs mt-1" style={{ color: DNS_COLORS.textMuted }}>
                        {getLearningRecommendation(c.id, c.avg)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Patterns */}
          {patterns.length > 0 && (
            <div className="rounded-xl border border-[#2a3a4e] bg-[#1A2634] p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: DNS_COLORS.primaryLight }}>
                <Brain className="w-4 h-4" /> Поведенческие паттерны
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {patterns.map((p, i) => (
                  <div key={i} className="p-3 rounded-lg border border-[#2a3a4e] bg-[#141c2b]/40">
                    <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: DNS_COLORS.textMuted }}>{p.label}</div>
                    <div className="text-sm text-white font-medium">{p.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Store Metrics */}
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1A2634] p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: DNS_COLORS.primaryLight }}>Финальные показатели магазина</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Покупатели в зале", value: finalMetrics.customersInStore },
                { label: "Средний чек", value: `${finalMetrics.avgCheck}₽` },
                { label: "Конверсия", value: `${finalMetrics.conversion}%` },
                {
                  label: "Клиентская оценка",
                  value: Number(finalMetrics.nps || 3.3).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                },
                { label: "Скорость выдачи", value: `${finalMetrics.pickupSpeed} мин` },
                { label: "Загрузка склада", value: `${finalMetrics.warehouseLoad}%` },
                { label: "Настроение команды", value: finalMetrics.teamMorale },
                { label: "Выручка за день", value: `${(Number(finalMetrics.dailyRevenue || 0) * 1000).toLocaleString("ru-RU")}₽` },
              ].map((m, i) => (
                <div key={i} className="p-3 rounded-lg border border-[#2a3a4e] bg-[#141c2b]/40">
                  <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: DNS_COLORS.textMuted }}>{m.label}</div>
                  <div className="text-sm text-white font-bold tabular-nums">{m.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Decision Registry */}
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1A2634] p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: DNS_COLORS.primaryLight }}>
              <FileText className="w-4 h-4" /> Реестр решений
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a3a4e]">
                    <th className="text-left py-2 px-2 font-medium" style={{ color: DNS_COLORS.textMuted }}>Время</th>
                    <th className="text-left py-2 px-2 font-medium" style={{ color: DNS_COLORS.textMuted }}>Кейс</th>
                    <th className="text-left py-2 px-2 font-medium" style={{ color: DNS_COLORS.textMuted }}>Этап</th>
                    <th className="text-left py-2 px-2 font-medium" style={{ color: DNS_COLORS.textMuted }}>Решение</th>
                    <th className="text-center py-2 px-2 font-medium" style={{ color: DNS_COLORS.textMuted }}>Балл</th>
                  </tr>
                </thead>
                <tbody>
                  {reportDecisions.map((d: any, i: number) => (
                    <tr key={i} className="border-b border-[#2a3a4e]/30">
                      <td className="py-2 px-2 tabular-nums" style={{ color: '#555570' }}>{d.simTime}</td>
                      <td className="py-2 px-2 text-white">{d.caseTitle}</td>
                      <td className="py-2 px-2" style={{ color: DNS_COLORS.textMuted }}>{d.cycle}</td>
                      <td className="py-2 px-2 max-w-[300px] truncate" style={{ color: '#a0a0b8' }}>{d.optionText}</td>
                      <td className="py-2 px-2 text-center">
                        <Badge variant="outline" className="text-[10px]" style={{
                          borderColor: d.score >= 4 ? `${DNS_COLORS.success}40` : d.score >= 3 ? `${DNS_COLORS.warning}40` : `${DNS_COLORS.error}40`,
                          color: d.score >= 4 ? DNS_COLORS.success : d.score >= 3 ? DNS_COLORS.warning : DNS_COLORS.error,
                        }}>
                          {d.score}/5
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* IDP Section */}
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1A2634] p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-1 flex items-center gap-2" style={{ color: DNS_COLORS.primaryLight }}>
              <BookOpen className="w-4 h-4" /> Индивидуальный план развития (ИПР) на 3 месяца
            </h3>
            <p className="text-xs mb-4" style={{ color: DNS_COLORS.textMuted }}>Все компетенции ниже 5.0 • Современные российские источники для DNS</p>
            <DevelopmentPlan weakCompetencies={weakForPlan.map(c => ({ id: c.id, name: c.name, score: c.avg }))} />
          </div>

          {/* Actions (preview tab) */}
          <div className="flex flex-col items-center gap-3 pb-8">
            <div className="dns-result-action-block">
              <Button
                onClick={handleExportPdf}
                disabled={pdfLoading}
                className="font-semibold px-8 transition-all hover:scale-105"
                style={{ background: DNS_COLORS.primary, color: '#fff' }}
                data-testid="button-export-pdf-preview"
              >
                {pdfLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Генерация PDF...</>
                ) : (
                  <><Download className="w-4 h-4 mr-2" /> Скачать этот отчёт в PDF</>
                )}
              </Button>
              <Button
                onClick={handleExportExcel}
                disabled={excelLoading}
                className="font-semibold px-8 transition-all hover:scale-105"
                style={{ background: '#1f8f6a', color: '#fff' }}
                data-testid="button-export-excel-preview"
              >
                {excelLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Подготовка Excel...</>
                ) : (
                  <><FileSpreadsheet className="w-4 h-4 mr-2" /> Скачать этот отчёт в Excel</>
                )}
              </Button>
            </div>
            {pdfError && <p className="text-xs" style={{ color: DNS_COLORS.error }}>{pdfError}</p>}
            {excelError && <p className="text-xs" style={{ color: DNS_COLORS.error }}>{excelError}</p>}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
