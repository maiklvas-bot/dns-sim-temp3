import { randomUUID } from "crypto";
import type { ErrorRequestHandler, Request } from "express";

const DEFAULT_INTERNAL_MESSAGE = "На сервере произошла ошибка. Попробуйте повторить действие.";
const DEFAULT_REQUEST_MESSAGE = "Не удалось обработать запрос.";
const SAFE_STATUS_MESSAGES: Record<number, string> = {
  400: "Некорректный запрос.",
  401: "Требуется авторизация.",
  403: "Недостаточно прав для выполнения действия.",
  404: "Запрошенные данные не найдены.",
  409: "Действие недоступно для текущего состояния.",
  413: "Размер запроса превышает допустимый.",
  429: "Слишком много запросов. Попробуйте позже.",
};

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    readonly publicMessage: string,
    readonly originalError?: unknown,
  ) {
    super(publicMessage);
    this.name = "ApiError";
  }
}

export function internalApiError(code: string, publicMessage: string, originalError?: unknown) {
  return new ApiError(500, code, publicMessage, originalError);
}

function getStatusCode(error: unknown): number {
  if (error instanceof ApiError) {
    return error.statusCode;
  }

  const candidate = Number((error as { status?: unknown; statusCode?: unknown } | null)?.status)
    || Number((error as { statusCode?: unknown } | null)?.statusCode);
  return Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : 500;
}

function getErrorCode(error: unknown, statusCode: number): string {
  if (error instanceof ApiError) {
    return error.code;
  }

  if ((error as { type?: unknown } | null)?.type === "entity.parse.failed") {
    return "INVALID_JSON";
  }

  const candidate = (error as { code?: unknown } | null)?.code;
  if (statusCode < 500 && typeof candidate === "string" && /^[A-Z0-9_]{3,80}$/.test(candidate)) {
    return candidate;
  }

  return statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_FAILED";
}

function getPublicMessage(error: unknown, statusCode: number): string {
  if (error instanceof ApiError) {
    return error.publicMessage;
  }

  if ((error as { type?: unknown } | null)?.type === "entity.parse.failed") {
    return "Некорректный формат JSON в теле запроса.";
  }

  return statusCode >= 500
    ? DEFAULT_INTERNAL_MESSAGE
    : SAFE_STATUS_MESSAGES[statusCode] || DEFAULT_REQUEST_MESSAGE;
}

function getLogError(error: unknown) {
  const source = error instanceof ApiError && error.originalError !== undefined
    ? error.originalError
    : error;

  if (source instanceof Error) {
    return {
      name: source.name,
      message: source.message,
      stack: source.stack,
    };
  }

  return {
    name: "UnknownError",
    message: String(source),
  };
}

function getRequestPath(req: Request) {
  return req.originalUrl || req.path || req.url;
}

export const apiErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const statusCode = getStatusCode(error);
  const requestId = randomUUID();
  const code = getErrorCode(error, statusCode);

  const logEntry = {
    requestId,
    method: req.method,
    path: getRequestPath(req),
    statusCode,
    code,
    error: getLogError(error),
  };

  if (statusCode >= 500) {
    console.error("[api-error]", logEntry);
  } else {
    console.warn("[api-error]", logEntry);
  }

  res.setHeader("X-Request-Id", requestId);
  res.status(statusCode).json({
    message: getPublicMessage(error, statusCode),
    code,
    requestId,
  });
};
