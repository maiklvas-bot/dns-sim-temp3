import express, { type Express, type Response } from "express";
import path from "path";

const staticMediaOptions = {
  etag: true,
  immutable: true,
  maxAge: "30d",
  setHeaders: (res: Response) => {
    res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
  },
} as const;

export function createMediaNotFoundHandler() {
  return (_req: express.Request, res: express.Response) => {
    res.status(404).json({
      message: "Media asset not found",
      code: "MEDIA_ASSET_NOT_FOUND",
    });
  };
}

export function serveMediaStatic(app: Express) {
  app.use("/library", express.static(path.resolve(process.cwd(), "attached_assets"), staticMediaOptions));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads"), staticMediaOptions));

  const mediaNotFoundHandler = createMediaNotFoundHandler();
  app.use("/library", mediaNotFoundHandler);
  app.use("/uploads", mediaNotFoundHandler);
}
