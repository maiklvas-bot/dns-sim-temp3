import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type { Request, Response, NextFunction } from "express";

const ALLOWED_ASSET_TYPES = new Map<string, { extension: string; kind: "image" | "audio" | "video"; maxBytes: number }>([
  ["image/png", { extension: ".png", kind: "image", maxBytes: 5 * 1024 * 1024 }],
  ["image/jpeg", { extension: ".jpg", kind: "image", maxBytes: 5 * 1024 * 1024 }],
  ["image/webp", { extension: ".webp", kind: "image", maxBytes: 5 * 1024 * 1024 }],
  ["audio/mpeg", { extension: ".mp3", kind: "audio", maxBytes: 20 * 1024 * 1024 }],
  ["audio/mp3", { extension: ".mp3", kind: "audio", maxBytes: 20 * 1024 * 1024 }],
  ["audio/wav", { extension: ".wav", kind: "audio", maxBytes: 20 * 1024 * 1024 }],
  ["audio/x-wav", { extension: ".wav", kind: "audio", maxBytes: 20 * 1024 * 1024 }],
  ["audio/ogg", { extension: ".ogg", kind: "audio", maxBytes: 20 * 1024 * 1024 }],
  ["audio/webm", { extension: ".webm", kind: "audio", maxBytes: 20 * 1024 * 1024 }],
  ["audio/mp4", { extension: ".m4a", kind: "audio", maxBytes: 20 * 1024 * 1024 }],
  ["audio/x-m4a", { extension: ".m4a", kind: "audio", maxBytes: 20 * 1024 * 1024 }],
  ["audio/aac", { extension: ".aac", kind: "audio", maxBytes: 20 * 1024 * 1024 }],
  ["video/mp4", { extension: ".mp4", kind: "video", maxBytes: 150 * 1024 * 1024 }],
  ["video/webm", { extension: ".webm", kind: "video", maxBytes: 150 * 1024 * 1024 }],
  ["video/quicktime", { extension: ".mov", kind: "video", maxBytes: 150 * 1024 * 1024 }],
]);

export function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (!req.session.staff) {
    return res.status(401).json({ message: "Unauthorized", code: "AUTH_REQUIRED" });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.staff || req.session.staff.role !== "admin") {
    return res.status(403).json({
      message: "Недостаточно прав для этого действия. Войдите под учётной записью администратора.",
      code: "ADMIN_REQUIRED",
    });
  }
  next();
}

export function ensureUploadDir(): string {
  const uploadDir = path.resolve(process.cwd(), "uploads");
  fs.mkdirSync(uploadDir, { recursive: true });
  return uploadDir;
}

export function saveMediaUpload(params: {
  data: string;
  mimeType: string;
  originalFilename?: string;
}) {
  const definition = ALLOWED_ASSET_TYPES.get(params.mimeType);
  if (!definition) {
    throw new Error("Допустимы PNG, JPEG, WEBP, MP3, WAV, OGG, WEBM, M4A, MP4 и MOV");
  }

  const base64 = params.data.includes(",") ? params.data.split(",")[1] : params.data;
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0 || buffer.length > definition.maxBytes) {
    const sizeLabel = definition.kind === "image" ? "5 МБ" : definition.kind === "audio" ? "20 МБ" : "150 МБ";
    throw new Error(`Размер файла должен быть в диапазоне до ${sizeLabel}`);
  }

  const uploadDir = ensureUploadDir();
  const filename = `${nanoid()}${definition.extension}`;
  const outputPath = path.join(uploadDir, filename);
  const resolvedOutputPath = path.resolve(outputPath);
  const resolvedUploadDir = path.resolve(uploadDir);
  if (!resolvedOutputPath.startsWith(resolvedUploadDir + path.sep)) {
    throw new Error("Некорректный путь файла");
  }

  fs.writeFileSync(outputPath, buffer);

  return {
    kind: definition.kind,
    storagePath: `uploads/${filename}`,
    sizeBytes: buffer.length,
    originalFilename: params.originalFilename || filename,
  };
}
