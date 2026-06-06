import { QueryClient, QueryFunction } from "@tanstack/react-query";

export const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
const CSRF_STORAGE_KEY = "dns-simcenter.csrfToken";

function getCsrfToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(CSRF_STORAGE_KEY);
}

function setCsrfToken(token: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (token) {
    window.localStorage.setItem(CSRF_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(CSRF_STORAGE_KEY);
  }
}

function isMutatingMethod(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const fallbackByStatus: Record<number, string> = {
      400: "Запрос заполнен некорректно. Проверьте данные и попробуйте ещё раз.",
      401: "Сессия истекла. Войдите заново.",
      403: "Недостаточно прав для этого действия.",
      404: "Запрошенные данные не найдены.",
      409: "Действие нельзя выполнить для текущего состояния.",
      413: "Файл или запрос слишком большой.",
      429: "Слишком много запросов. Подождите немного и попробуйте снова.",
      500: "На сервере произошла ошибка. Попробуйте повторить действие.",
    };

    const rawText = await res.text();
    let message = "";

    try {
      const payload = rawText ? JSON.parse(rawText) : null;
      message = payload?.message || payload?.error || "";
      if (payload?.errors && typeof payload.errors === "string") {
        message = message ? `${message}: ${payload.errors}` : payload.errors;
      }
    } catch {
      message = rawText || "";
    }

    const normalized = message.trim().toLowerCase();
    if (normalized === "unauthorized" || normalized === "auth_required") {
      message = fallbackByStatus[401];
    } else if (normalized === "forbidden" || normalized === "admin_required") {
      message = fallbackByStatus[403];
    } else if (normalized.includes("csrf token")) {
      message = "Сессия безопасности устарела. Обновите страницу и войдите заново.";
    } else if (normalized === "internal error" || normalized === "internal server error") {
      message = fallbackByStatus[500];
    }

    throw new Error(message || fallbackByStatus[res.status] || res.statusText || "Не удалось выполнить запрос.");
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  const csrfToken = getCsrfToken();
  if (csrfToken && isMutatingMethod(method)) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const res = await fetch(`${API_BASE}${url}`, {
    method,
    credentials: "same-origin",
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  if (url === "/api/staff/login" || url === "/api/staff/elevate") {
    try {
      const payload = await res.clone().json();
      setCsrfToken(typeof payload?.csrfToken === "string" ? payload.csrfToken : null);
    } catch {
      setCsrfToken(null);
    }
  } else if (url === "/api/staff/logout") {
    setCsrfToken(null);
  }

  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(`${API_BASE}${queryKey.join("/")}`, {
      credentials: "same-origin",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    const payload = await res.json();
    if (payload?.csrfToken && typeof payload.csrfToken === "string") {
      setCsrfToken(payload.csrfToken);
    }
    return payload;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
