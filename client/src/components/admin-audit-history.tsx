import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Eye, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AuditActorFacet {
  username: string;
  displayName: string | null;
  role: string | null;
}

interface AuditLogItem {
  id: number;
  createdAt: string;
  area: string;
  action: string;
  outcome: string;
  actorUsername: string | null;
  actorDisplayName: string | null;
  actorRole: string | null;
  ipAddress: string;
  userAgent: string | null;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  changedFields: string[];
  before: unknown;
  after: unknown;
  metadata: Record<string, unknown>;
}

interface AuditLogResponse {
  items: AuditLogItem[];
  total: number;
  limit: number;
  offset: number;
  facets: {
    actors: AuditActorFacet[];
    actions: string[];
    areas: string[];
  };
}

interface AdminAuditHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AREA_LABELS: Record<string, string> = {
  security: "Безопасность",
  admin: "Администратор",
  evaluator: "Оценщик",
  simulation: "Симуляция",
  system: "Система",
};

const ACTION_LABELS: Record<string, string> = {
  login_success: "Успешный вход",
  login_failed: "Ошибка входа",
  logout: "Выход",
  role_elevation_success: "Переход в администратора",
  role_elevation_failed: "Ошибка перехода в администратора",
  role_elevation_denied: "Запрещенный переход",
  admin_access_denied: "Отказ в административном доступе",
  simulation_session_created: "Создание симуляции",
  simulation_session_updated: "Изменение симуляции",
  simulation_answer_recorded: "Ответ участника",
  simulation_result_saved: "Сохранение результата",
  simulation_result_deleted: "Удаление результата",
  live_session_started: "Запуск live-сессии",
  live_session_recovered: "Восстановление live-сессии",
  live_session_closed: "Закрытие live-сессии",
  participant_joined: "Вход участника",
  participant_join_failed: "Ошибка входа участника",
  settings_updated: "Изменение настроек",
  media_uploaded: "Загрузка медиа",
  case_created: "Создание кейса",
  case_updated: "Изменение кейса",
  case_deleted: "Удаление кейса",
  cases_reordered: "Изменение порядка кейсов",
  chat_created: "Создание чата",
  chat_updated: "Изменение чата",
  chat_deleted: "Удаление чата",
  email_created: "Создание письма",
  email_updated: "Изменение письма",
  email_deleted: "Удаление письма",
  messenger_created: "Создание сообщения",
  messenger_updated: "Изменение сообщения",
  messenger_deleted: "Удаление сообщения",
  video_created: "Создание видео",
  video_updated: "Изменение видео",
  video_deleted: "Удаление видео",
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatJson(value: unknown) {
  if (value == null) {
    return "Нет данных";
  }
  return JSON.stringify(value, null, 2);
}

function compactValue(value: unknown) {
  if (value == null) return "—";
  if (typeof value === "string") return value.slice(0, 48);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const text = JSON.stringify(value);
  return text.length > 52 ? `${text.slice(0, 49)}...` : text;
}

function getRoleLabel(role: string | null) {
  if (role === "admin") return "Администратор";
  if (role === "evaluator") return "Оценщик";
  if (role === "participant") return "Участник";
  return role || "Система";
}

export function AdminAuditHistory({ open, onOpenChange }: AdminAuditHistoryProps) {
  const [area, setArea] = useState("all");
  const [actor, setActor] = useState("all");
  const [action, setAction] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AuditLogItem | null>(null);
  const limit = 50;

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(page * limit),
    });
    if (area !== "all") params.set("area", area);
    if (actor !== "all") params.set("actor", actor);
    if (action !== "all") params.set("action", action);
    if (outcome !== "all") params.set("outcome", outcome);
    if (search.trim()) params.set("search", search.trim());
    return params.toString();
  }, [action, actor, area, outcome, page, search]);

  const auditQuery = useQuery({
    queryKey: ["/api/admin/audit-logs", queryString],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/admin/audit-logs?${queryString}`);
      return response.json() as Promise<AuditLogResponse>;
    },
    enabled: open,
    staleTime: 0,
  });

  const data = auditQuery.data;
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / limit));

  const resetPage = (update: () => void) => {
    update();
    setPage(0);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[92vh] w-[96vw] max-w-[1500px] flex-col overflow-hidden border-[#2a3a4e] bg-[#101826] p-0 text-white">
          <DialogHeader className="border-b border-[#2a3a4e] px-6 py-5 pr-14 text-left">
            <DialogTitle className="flex items-center gap-3 text-xl">
              <span className="flex h-10 w-10 items-center justify-center rounded-md border border-[#4a9eff]/35 bg-[#4a9eff]/10 text-[#8ec5ff]">
                <ShieldCheck className="h-5 w-5" />
              </span>
              История изменений
            </DialogTitle>
            <DialogDescription className="text-[#9fb0c7]">
              Защищенный журнал действий, событий безопасности и изменений данных симуляции.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 border-b border-[#2a3a4e] bg-[#141e2d] px-6 py-4 md:grid-cols-2 xl:grid-cols-[1.3fr_repeat(4,minmax(150px,0.8fr))_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f829d]" />
              <Input
                value={search}
                onChange={(event) => resetPage(() => setSearch(event.target.value))}
                placeholder="Поиск по событию, IP или объекту"
                className="border-[#31445e] bg-[#0e1724] pl-9 text-white"
              />
            </div>
            <Select value={area} onValueChange={(value) => resetPage(() => setArea(value))}>
              <SelectTrigger className="border-[#31445e] bg-[#0e1724] text-white">
                <SelectValue placeholder="Раздел" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все разделы</SelectItem>
                {(data?.facets.areas || Object.keys(AREA_LABELS)).map((value) => (
                  <SelectItem key={value} value={value}>{AREA_LABELS[value] || value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actor} onValueChange={(value) => resetPage(() => setActor(value))}>
              <SelectTrigger className="border-[#31445e] bg-[#0e1724] text-white">
                <SelectValue placeholder="Пользователь" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все пользователи</SelectItem>
                {(data?.facets.actors || []).map((item) => (
                  <SelectItem key={item.username} value={item.username}>
                    {item.displayName || item.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={action} onValueChange={(value) => resetPage(() => setAction(value))}>
              <SelectTrigger className="border-[#31445e] bg-[#0e1724] text-white">
                <SelectValue placeholder="Тип изменения" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                {(data?.facets.actions || []).map((value) => (
                  <SelectItem key={value} value={value}>{ACTION_LABELS[value] || value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={outcome} onValueChange={(value) => resetPage(() => setOutcome(value))}>
              <SelectTrigger className="border-[#31445e] bg-[#0e1724] text-white">
                <SelectValue placeholder="Результат" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Любой результат</SelectItem>
                <SelectItem value="success">Успешно</SelectItem>
                <SelectItem value="failure">Ошибка</SelectItem>
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="border-[#31445e] bg-[#0e1724] text-[#b8c9df]"
                  onClick={() => auditQuery.refetch()}
                  aria-label="Обновить журнал"
                >
                  <RefreshCw className={`h-4 w-4 ${auditQuery.isFetching ? "animate-spin" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Обновить журнал</TooltipContent>
            </Tooltip>
          </div>

          <div className="min-h-0 flex-1 overflow-auto custom-scroll">
            <Table className="min-w-[1220px]">
              <TableHeader className="sticky top-0 z-10 bg-[#111b29]">
                <TableRow className="border-[#2a3a4e] hover:bg-[#111b29]">
                  <TableHead className="w-[150px] text-[#8ea1ba]">Дата и время</TableHead>
                  <TableHead className="w-[130px] text-[#8ea1ba]">Раздел</TableHead>
                  <TableHead className="w-[170px] text-[#8ea1ba]">Пользователь</TableHead>
                  <TableHead className="w-[140px] text-[#8ea1ba]">IP-адрес</TableHead>
                  <TableHead className="w-[190px] text-[#8ea1ba]">Тип изменения</TableHead>
                  <TableHead className="text-[#8ea1ba]">Данные и поля</TableHead>
                  <TableHead className="w-[230px] text-[#8ea1ba]">Было → стало</TableHead>
                  <TableHead className="w-[76px] text-right text-[#8ea1ba]">Детали</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditQuery.isLoading && (
                  <TableRow className="border-[#26374d]">
                    <TableCell colSpan={8} className="py-12 text-center text-[#93a5bc]">Загрузка журнала...</TableCell>
                  </TableRow>
                )}
                {!auditQuery.isLoading && auditQuery.isError && (
                  <TableRow className="border-[#26374d]">
                    <TableCell colSpan={8} className="py-12 text-center text-[#ff9a9a]">
                      Не удалось загрузить журнал изменений.
                    </TableCell>
                  </TableRow>
                )}
                {!auditQuery.isLoading && !auditQuery.isError && (data?.items.length || 0) === 0 && (
                  <TableRow className="border-[#26374d]">
                    <TableCell colSpan={8} className="py-12 text-center text-[#93a5bc]">
                      По выбранным фильтрам событий нет.
                    </TableCell>
                  </TableRow>
                )}
                {(data?.items || []).map((item) => (
                  <TableRow key={item.id} className="border-[#26374d] hover:bg-[#192638]">
                    <TableCell className="whitespace-nowrap text-xs text-[#b7c5d8]">{formatDateTime(item.createdAt)}</TableCell>
                    <TableCell>
                      <span className="inline-flex rounded border border-[#4a9eff]/25 bg-[#4a9eff]/10 px-2 py-1 text-xs text-[#a9d3ff]">
                        {AREA_LABELS[item.area] || item.area}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-[#edf4ff]">{item.actorDisplayName || item.actorUsername || "Система"}</div>
                      <div className="mt-1 text-xs text-[#7488a3]">{getRoleLabel(item.actorRole)}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-[#b8c9df]">{item.ipAddress}</TableCell>
                    <TableCell>
                      <div className={item.outcome === "failure" ? "text-[#ff9a9a]" : "text-[#dbe9f9]"}>
                        {ACTION_LABELS[item.action] || item.action}
                      </div>
                      <div className="mt-1 text-xs text-[#6f829d]">{item.entityType || "событие"}{item.entityId ? ` · ${item.entityId}` : ""}</div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[360px] text-sm text-[#c7d6e8]">{item.summary}</div>
                      <div className="mt-2 flex max-w-[380px] flex-wrap gap-1">
                        {item.changedFields.slice(0, 4).map((field) => (
                          <span key={field} className="rounded bg-[#26364a] px-1.5 py-0.5 font-mono text-[10px] text-[#9fc4ee]">{field}</span>
                        ))}
                        {item.changedFields.length > 4 && (
                          <span className="rounded bg-[#26364a] px-1.5 py-0.5 text-[10px] text-[#9fc4ee]">+{item.changedFields.length - 4}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 font-mono text-[10px]">
                        <span className="truncate rounded bg-[#281a22] px-2 py-1.5 text-[#ffb4bd]" title={formatJson(item.before)}>
                          {compactValue(item.before)}
                        </span>
                        <span className="text-[#657a96]">→</span>
                        <span className="truncate rounded bg-[#102b27] px-2 py-1.5 text-[#83e6cf]" title={formatJson(item.after)}>
                          {compactValue(item.after)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 border-[#3d536f] bg-[#172334] p-0 text-[#9fc8f5]"
                            onClick={() => setSelected(item)}
                            aria-label={`Открыть подробности события ${item.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Открыть подробности</TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between border-t border-[#2a3a4e] bg-[#111a28] px-6 py-3 text-sm">
            <div className="text-[#899cb5]">Записей: {data?.total || 0}</div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-[#31445e] bg-transparent text-[#b8c9df]"
                onClick={() => setPage((value) => Math.max(0, value - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Назад
              </Button>
              <span className="min-w-[100px] text-center text-[#b8c9df]">{page + 1} / {totalPages}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-[#31445e] bg-transparent text-[#b8c9df]"
                onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}
                disabled={page + 1 >= totalPages}
              >
                Далее
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={selected != null} onOpenChange={(nextOpen) => !nextOpen && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto border-[#2a3a4e] bg-[#101826] text-white custom-scroll">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{ACTION_LABELS[selected.action] || selected.action}</DialogTitle>
                <DialogDescription className="text-[#91a5bd]">
                  {formatDateTime(selected.createdAt)} · {selected.ipAddress} · {selected.actorDisplayName || selected.actorUsername || "Система"}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 border-y border-[#2a3a4e] py-4 md:grid-cols-3">
                <div>
                  <div className="text-xs uppercase text-[#7387a1]">Раздел</div>
                  <div className="mt-1 text-sm">{AREA_LABELS[selected.area] || selected.area}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-[#7387a1]">Объект</div>
                  <div className="mt-1 text-sm">{selected.entityType || "событие"} {selected.entityId ? `#${selected.entityId}` : ""}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-[#7387a1]">Результат</div>
                  <div className={`mt-1 text-sm ${selected.outcome === "failure" ? "text-[#ff9a9a]" : "text-[#83e6cf]"}`}>
                    {selected.outcome === "failure" ? "Ошибка" : "Успешно"}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold text-[#dce9f8]">Измененные поля</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selected.changedFields.length > 0 ? selected.changedFields.map((field) => (
                    <span key={field} className="rounded border border-[#38506d] bg-[#1a293c] px-2 py-1 font-mono text-xs text-[#a8cff8]">{field}</span>
                  )) : <span className="text-sm text-[#8295ad]">Событие не изменяло поля данных.</span>}
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="min-w-0">
                  <div className="mb-2 text-sm font-semibold text-[#ffb4bd]">Было</div>
                  <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-md border border-[#6d3340] bg-[#1c1117] p-4 font-mono text-xs leading-5 text-[#ffd0d6] custom-scroll">
                    {formatJson(selected.before)}
                  </pre>
                </div>
                <div className="min-w-0">
                  <div className="mb-2 text-sm font-semibold text-[#83e6cf]">Стало</div>
                  <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-md border border-[#246052] bg-[#0d1d1a] p-4 font-mono text-xs leading-5 text-[#b8f4e6] custom-scroll">
                    {formatJson(selected.after)}
                  </pre>
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm font-semibold text-[#dce9f8]">Технические сведения</div>
                <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-md border border-[#2f425a] bg-[#0d1622] p-4 font-mono text-xs text-[#a9bbd1] custom-scroll">
                  {formatJson({ metadata: selected.metadata, userAgent: selected.userAgent })}
                </pre>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
