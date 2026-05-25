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
  Eye, BookOpen, Activity, FileSpreadsheet
} from "lucide-react";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { getSimulationSettingsSnapshot } from "@/lib/runtime-content";
import { clearLiveSimulationRole, closeRemoteLiveSimulation, getLiveSimulationConfig, resetLiveSimulation } from "@/lib/live-session";
import type { SimulationRuntimeSettings } from "@shared/simulation-content";
import { buildPdfPayloadFromReport, buildReportFromSessionDetails, buildReportFromState } from "@/lib/report-data";
import storeBg from "@assets/store_bg.png";
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

  if (persistedSessionId != null && persistedResultQuery.isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0d1117] text-white">Загрузка результата...</div>;
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
          "Кейс",
          "Тип задачи",
          "Время в симуляции",
          "Вариант ответа",
          "Оценка",
          "Базовый балл",
          "Штраф за просрочку",
          "Просрочено",
          "Таймер",
          "Зона",
          "Ответственный",
          "Комментарий оценщика",
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
                "Задача",
                "Тип",
                "Ответственный",
                "Зона",
                "Таймер",
                "Лимит, сек",
                "Время закрытия",
                "Просрочено",
                "Просрочка, сек",
                "Статус",
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
      className="min-h-screen relative"
      style={{
        backgroundImage: `url(${storeBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a2ef2] via-[#16213ef5] to-[#1a1a2ef5]" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FF6B00]/10 border border-[#FF6B00]/30 mb-4">
            <Award className="w-4 h-4 text-[#FF6B00]" />
            <span className="text-xs text-[#FF6B00] font-medium uppercase tracking-wider">Результаты симуляции</span>
          </div>
          {participantName && (
            <h1 className="text-xl font-bold text-white mb-1">{participantName}</h1>
          )}
          <p className="text-sm text-[#8890a8]">
            Оценщик: {assessorName || "—"} • Сложность: {difficulty === "easy" ? "Лёгкий" : difficulty === "hard" ? "Сложный" : "Средний"}
          </p>
        </div>

        {/* Test mode banner */}
        {isTestMode && (
          <div className="mb-4 p-3 rounded-lg border border-[#ffc107]/40 bg-[#ffc107]/8 flex items-center gap-2">
            <span className="text-base">⚗️</span>
            <div>
              <div className="text-sm font-semibold text-[#ffc107]">Тестовый режим</div>
              <div className="text-xs text-[#8890a8]">Результаты не засчитываются в официальный профиль — это было пробное прохождение.</div>
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex justify-center gap-2 mb-6">
          <button
            onClick={() => setActiveTab("results")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "results"
                ? "bg-[#FF6B00] text-white"
                : "bg-[#1e2a3a]/80 text-[#8890a8] border border-[#2a3a4e] hover:text-white hover:border-[#FF6B00]/40"
            }`}
            data-testid="tab-results"
          >
            <BarChart3 className="w-4 h-4" /> Итоги
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "preview"
                ? "bg-[#FF6B00] text-white"
                : "bg-[#1e2a3a]/80 text-[#8890a8] border border-[#2a3a4e] hover:text-white hover:border-[#FF6B00]/40"
            }`}
            data-testid="tab-preview"
          >
            <Eye className="w-4 h-4" /> Предпросмотр отчёта
          </button>
        </div>

        {activeTab === "results" ? (<>
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-4 text-center">
            <FileText className="w-5 h-5 text-[#FF6B00] mx-auto mb-2" />
            <div className="text-2xl font-bold text-white tabular-nums">{totalDecisions}</div>
            <div className="text-xs text-[#8890a8] mt-0.5">Решений принято</div>
          </div>
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-4 text-center">
            <Target className="w-5 h-5 text-[#FF6B00] mx-auto mb-2" />
            <div className="text-2xl font-bold tabular-nums" style={{ color: verdict.color }}>{avgScore}</div>
            <div className="text-xs text-[#8890a8] mt-0.5">Средний балл</div>
          </div>
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-4 text-center">
            <Clock className="w-5 h-5 text-[#FF6B00] mx-auto mb-2" />
            <div className="text-2xl font-bold text-white tabular-nums">{totalMinutes} мин</div>
            <div className="text-xs text-[#8890a8] mt-0.5">Время прохождения</div>
          </div>
        </div>

        {/* Verdict */}
        <div className="rounded-xl border-2 p-5 mb-6" style={{ borderColor: verdict.color + "40", background: verdict.color + "08" }}>
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-5 h-5" style={{ color: verdict.color }} />
            <h2 className="text-lg font-bold" style={{ color: verdict.color }}>{verdict.level}</h2>
            <span className="text-sm text-[#8890a8] ml-auto tabular-nums">{overallAvg}/5</span>
          </div>
          <p className="text-sm text-[#c0c0d0] leading-relaxed">{verdict.description}</p>
        </div>

        {pauseEntries.length > 0 && (
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5 mb-6">
            <h3 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Паузы в симуляции
            </h3>
            <p className="text-xs text-[#8890a8] mb-3">
              Всего пауз: {pauseEntries.length} • суммарно {Math.floor(totalPauseSeconds / 60)} мин {totalPauseSeconds % 60} сек
            </p>
            <div className="space-y-2">
              {reportPauses.map((pause: any) => (
                <div key={pause.id} className="flex items-center justify-between rounded-lg border border-[#2a3a4e] bg-[#141c2b]/50 px-3 py-2 text-xs">
                  <span className="text-[#c0c0d0]">
                    Пауза на отметке <span className="font-mono text-white">{pause.startedSimTime}</span>
                  </span>
                  <span className="font-mono text-[#8890a8]">
                    {Math.floor(pause.durationSeconds / 60)}м {pause.durationSeconds % 60}с
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {impactfulDecisions.length > 0 && (
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5 mb-6">
            <h3 className="text-sm font-semibold text-[#4a9eff] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Решения с самой сильной реакцией системы
            </h3>
            <div className="space-y-3">
              {impactfulDecisions.map((decision, index) => (
                <div key={`${decision.caseId}-${index}`} className="rounded-xl border border-[#2a3a4e] bg-[#141c2b]/45 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{decision.caseTitle}</div>
                      <div className="mt-1 text-xs text-[#8890a8]">
                        {decision.simTime} • {decision.taskType} • Балл {decision.score}/5
                      </div>
                    </div>
                    <div className="rounded-full border border-[#4a9eff]/35 bg-[#4a9eff]/10 px-3 py-1 text-xs font-semibold text-[#8ec5ff]">
                      Реакция: {decision.impactMagnitude}
                    </div>
                  </div>
                  <div className="mt-3 text-sm leading-relaxed text-[#d4dced]">{decision.optionText}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Radar + Strengths/Weaknesses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Radar */}
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5">
            <h3 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-wider mb-3">
              Профиль компетенций
            </h3>
            <CompetencyRadar getAverage={getReportCompetencyAverage} size={300} />
          </div>

          {/* Strengths & Weaknesses */}
          <div className="space-y-4">
            <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5">
              <h3 className="text-sm font-semibold text-[#00d4aa] uppercase tracking-wider mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Сильные стороны
              </h3>
              <div className="space-y-2">
                {strengths.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-[#00d4aa]/5 border border-[#00d4aa]/10">
                    <span className="text-sm text-white">{c.name}</span>
                    <span className="text-sm font-bold text-[#00d4aa] tabular-nums">{c.avg.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5">
              <h3 className="text-sm font-semibold text-[#ff4444] uppercase tracking-wider mb-3 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" /> Зоны развития
              </h3>
              <div className="space-y-2">
                {weaknesses.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-[#ff4444]/5 border border-[#ff4444]/10">
                    <span className="text-sm text-white">{c.name}</span>
                    <span className="text-sm font-bold text-[#ff4444] tabular-nums">{c.avg.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Pattern Analysis */}
        {patterns.length > 0 && (
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5 mb-6">
            <h3 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Brain className="w-4 h-4" /> Анализ поведенческих паттернов
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {patterns.map((p, i) => (
                <div key={i} className="p-3 rounded-lg border border-[#2a3a4e] bg-[#141c2b]/40">
                  <div className="flex items-center gap-2 mb-1.5 text-[#8890a8]">
                    {p.icon}
                    <span className="text-[10px] uppercase tracking-wider">{p.label}</span>
                  </div>
                  <div className="text-sm text-white font-medium">{p.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Individual Development Plan */}
        <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5 mb-6">
          <h3 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-wider mb-1 flex items-center gap-2">
            <ArrowRight className="w-4 h-4" /> Индивидуальный план развития (ИПР) на 3 месяца
          </h3>
          <p className="text-xs text-[#8890a8] mb-4">
            Персонализированный план для всех компетенций, где результат ещё не достиг 5.0/5.
          </p>
          <DevelopmentPlan weakCompetencies={weakForPlan.map(c => ({ id: c.id, name: c.name, score: c.avg }))} />
        </div>

        {/* Decision Registry */}
        <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5 mb-6">
          <h3 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-wider mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Реестр решений
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#2a3a4e]">
                  <th className="text-left py-2 px-2 text-[#8890a8] font-medium">Время</th>
                  <th className="text-left py-2 px-2 text-[#8890a8] font-medium">Кейс</th>
                  <th className="text-left py-2 px-2 text-[#8890a8] font-medium">Этап</th>
                  <th className="text-left py-2 px-2 text-[#8890a8] font-medium">Решение</th>
                  <th className="text-center py-2 px-2 text-[#8890a8] font-medium">Балл</th>
                </tr>
              </thead>
              <tbody>
                {reportDecisions.map((d: any, i: number) => (
                  <tr key={i} className="border-b border-[#2a3a4e]/30 hover:bg-[#1a1a2e]/30">
                    <td className="py-2 px-2 text-[#555570] tabular-nums">{d.simTime}</td>
                    <td className="py-2 px-2 text-white">{d.caseTitle}</td>
                    <td className="py-2 px-2 text-[#8890a8]">{d.cycle}</td>
                    <td className="py-2 px-2 text-[#a0a0b8] max-w-[300px] truncate">{d.optionText}</td>
                    <td className="py-2 px-2 text-center">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          d.score >= 4 ? "border-[#00d4aa]/40 text-[#00d4aa]"
                            : d.score >= 3 ? "border-[#ffc107]/40 text-[#ffc107]"
                            : "border-[#ff4444]/40 text-[#ff4444]"
                        }`}
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

        {/* Actions */}
        <div className="flex flex-col items-center gap-3 pb-8">
          <div className="flex gap-4">
            <Button
              onClick={handleRestart}
              variant="outline"
              className="border-[#2a3a4e] text-[#a0a0b8] hover:text-white hover:border-[#FF6B00] bg-transparent"
              data-testid="button-restart"
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Новая симуляция
            </Button>
            <Button
              onClick={handleExportPdf}
              disabled={pdfLoading}
              className="bg-[#FF6B00] hover:bg-[#e06000] text-white font-semibold"
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
              className="bg-[#1f8f6a] hover:bg-[#187353] text-white font-semibold"
              data-testid="button-export-excel"
            >
              {excelLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Excel...</>
              ) : (
                <><FileSpreadsheet className="w-4 h-4 mr-2" /> Скачать Excel</>
              )}
            </Button>
          </div>
          {pdfError && (
            <p className="text-xs text-[#ff4444] mt-1">{pdfError}</p>
          )}
          {excelError && (
            <p className="text-xs text-[#ff4444] mt-1">{excelError}</p>
          )}
        </div>
        </>) : (
        /* ====== PREVIEW TAB ====== */
        <div className="space-y-6">
          {/* Verdict */}
          <div className="rounded-xl border-2 p-5" style={{ borderColor: verdict.color + "40", background: verdict.color + "08" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5" style={{ color: verdict.color }} />
                <h2 className="text-lg font-bold" style={{ color: verdict.color }}>{verdict.level}</h2>
              </div>
              <span className="text-xl font-bold tabular-nums" style={{ color: verdict.color }}>{overallAvg}/5</span>
            </div>
            <p className="text-sm text-[#c0c0d0] leading-relaxed">{verdict.description}</p>
          </div>

          {/* KPI Summary */}
          <div className="grid grid-cols-5 gap-3">
            {[{
              label: "Решений", value: totalDecisions,
            }, {
              label: "Средний балл", value: avgScore,
            }, {
              label: "Отличных (4-5)", value: reportDecisions.filter((d: any) => d.score >= 4).length,
            }, {
              label: "Слабых (1-2)", value: reportDecisions.filter((d: any) => d.score <= 2).length,
            }, {
              label: "Время", value: `${totalMinutes} мин`,
            }].map((kpi, i) => (
              <div key={i} className="rounded-lg border border-[#2a3a4e] bg-[#1e2a3acc] p-3 text-center">
                <div className="text-lg font-bold text-white tabular-nums">{kpi.value}</div>
                <div className="text-[10px] text-[#8890a8]">{kpi.label}</div>
              </div>
            ))}
          </div>

          {pauseEntries.length > 0 && (
            <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-5">
              <h3 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-wider mb-3">Журнал пауз</h3>
              <div className="space-y-2">
                {reportPauses.map((pause: any) => (
                  <div key={pause.id} className="flex items-center justify-between rounded-lg border border-[#2a3a4e] bg-[#141c2b]/40 px-3 py-2 text-xs">
                    <span className="text-[#c0c0d0]">Пауза на {pause.startedSimTime}</span>
                    <span className="font-mono text-[#8890a8]">{Math.floor(pause.durationSeconds / 60)}м {pause.durationSeconds % 60}с</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Competency Table (full, like PDF) */}
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] backdrop-blur-sm p-5">
            <h3 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Профиль компетенций (все 14)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <div className="flex justify-center mb-4 md:mb-0">
                <CompetencyRadar getAverage={getReportCompetencyAverage} size={260} />
              </div>
              <div className="space-y-1.5">
                {compScores.map(c => {
                  const color = c.avg >= 4 ? "#00d4aa" : c.avg >= 3 ? "#4a9eff" : c.avg >= 2 ? "#FF6B00" : "#ff4444";
                  const pct = c.avg > 0 ? (c.avg / 5) * 100 : 0;
                  return (
                    <div key={c.id} className="flex items-center gap-3">
                      <span className="text-xs text-[#a0a0b8] w-36 truncate">{c.name}</span>
                      <div className="flex-1 h-2 rounded-full bg-[#1a1a2e]">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <span className="text-xs font-bold tabular-nums w-8 text-right" style={{ color }}>{c.avg > 0 ? c.avg.toFixed(1) : "—"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Strengths & Weaknesses side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-5">
              <h3 className="text-sm font-semibold text-[#00d4aa] uppercase tracking-wider mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Сильные стороны
              </h3>
              {strengths.map(c => (
                <div key={c.id} className="flex justify-between p-2 rounded bg-[#00d4aa]/5 border border-[#00d4aa]/10 mb-1.5">
                  <span className="text-sm text-white">{c.name}</span>
                  <span className="text-sm font-bold text-[#00d4aa] tabular-nums">{c.avg.toFixed(1)}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-5">
              <h3 className="text-sm font-semibold text-[#ff4444] uppercase tracking-wider mb-3 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" /> Зоны развития
              </h3>
              {weaknesses.map(c => (
                <div key={c.id} className="flex justify-between p-2 rounded bg-[#ff4444]/5 border border-[#ff4444]/10 mb-1.5">
                  <span className="text-sm text-white">{c.name}</span>
                  <span className="text-sm font-bold text-[#ff4444] tabular-nums">{c.avg.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Patterns */}
          {patterns.length > 0 && (
            <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-5">
              <h3 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-wider mb-3 flex items-center gap-2">
                <Brain className="w-4 h-4" /> Поведенческие паттерны
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {patterns.map((p, i) => (
                  <div key={i} className="p-3 rounded-lg border border-[#2a3a4e] bg-[#141c2b]/40">
                    <div className="text-[10px] uppercase tracking-wider text-[#8890a8] mb-1">{p.label}</div>
                    <div className="text-sm text-white font-medium">{p.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Store Metrics */}
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-5">
            <h3 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-wider mb-3">Финальные показатели магазина</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Покупатели в зале", value: finalMetrics.customersInStore },
                { label: "Средний чек", value: `${finalMetrics.avgCheck}₽` },
                { label: "Конверсия", value: `${finalMetrics.conversion}%` },
                { label: "NPS", value: finalMetrics.nps },
                { label: "Скорость выдачи", value: `${finalMetrics.pickupSpeed} мин` },
                { label: "Загрузка склада", value: `${finalMetrics.warehouseLoad}%` },
                { label: "Настроение команды", value: finalMetrics.teamMorale },
                { label: "Выручка за день", value: `${(Number(finalMetrics.dailyRevenue || 0) * 1000).toLocaleString("ru-RU")}₽` },
              ].map((m, i) => (
                <div key={i} className="p-3 rounded-lg border border-[#2a3a4e] bg-[#141c2b]/40">
                  <div className="text-[10px] uppercase tracking-wider text-[#8890a8] mb-1">{m.label}</div>
                  <div className="text-sm text-white font-bold tabular-nums">{m.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Decision Registry */}
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-5">
            <h3 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Реестр решений
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a3a4e]">
                    <th className="text-left py-2 px-2 text-[#8890a8] font-medium">Время</th>
                    <th className="text-left py-2 px-2 text-[#8890a8] font-medium">Кейс</th>
                    <th className="text-left py-2 px-2 text-[#8890a8] font-medium">Этап</th>
                    <th className="text-left py-2 px-2 text-[#8890a8] font-medium">Решение</th>
                    <th className="text-center py-2 px-2 text-[#8890a8] font-medium">Балл</th>
                  </tr>
                </thead>
                <tbody>
                  {reportDecisions.map((d: any, i: number) => (
                    <tr key={i} className="border-b border-[#2a3a4e]/30">
                      <td className="py-2 px-2 text-[#555570] tabular-nums">{d.simTime}</td>
                      <td className="py-2 px-2 text-white">{d.caseTitle}</td>
                      <td className="py-2 px-2 text-[#8890a8]">{d.cycle}</td>
                      <td className="py-2 px-2 text-[#a0a0b8] max-w-[300px] truncate">{d.optionText}</td>
                      <td className="py-2 px-2 text-center">
                        <Badge variant="outline" className={`text-[10px] ${
                          d.score >= 4 ? "border-[#00d4aa]/40 text-[#00d4aa]"
                            : d.score >= 3 ? "border-[#ffc107]/40 text-[#ffc107]"
                            : "border-[#ff4444]/40 text-[#ff4444]"
                        }`}>{d.score}/5</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ИПР Section */}
          <div className="rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-5">
            <h3 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-wider mb-1 flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Индивидуальный план развития (ИПР) на 3 месяца
            </h3>
            <p className="text-xs text-[#8890a8] mb-4">Все компетенции ниже 5.0 • Современные российские источники для DNS</p>
            <DevelopmentPlan weakCompetencies={weakForPlan.map(c => ({ id: c.id, name: c.name, score: c.avg }))} />
          </div>

          {/* Actions (preview tab) */}
          <div className="flex flex-col items-center gap-3 pb-8">
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                onClick={handleExportPdf}
                disabled={pdfLoading}
                className="bg-[#FF6B00] hover:bg-[#e06000] text-white font-semibold px-8"
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
                className="bg-[#1f8f6a] hover:bg-[#187353] text-white font-semibold px-8"
                data-testid="button-export-excel-preview"
              >
                {excelLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Подготовка Excel...</>
                ) : (
                  <><FileSpreadsheet className="w-4 h-4 mr-2" /> Скачать этот отчёт в Excel</>
                )}
              </Button>
            </div>
            {pdfError && <p className="text-xs text-[#ff4444]">{pdfError}</p>}
            {excelError && <p className="text-xs text-[#ff4444]">{excelError}</p>}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
