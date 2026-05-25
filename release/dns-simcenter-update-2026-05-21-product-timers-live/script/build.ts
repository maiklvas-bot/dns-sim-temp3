import { build as viteBuild } from "vite";
import viteConfig from "../vite.config";
import { build as esbuild } from "esbuild";
import { copyFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");

async function main() {
  await viteBuild(viteConfig);

  await mkdir(distDir, { recursive: true });

  await esbuild({
    entryPoints: [path.join(root, "server", "index.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    outfile: path.join(distDir, "index.cjs"),
    tsconfig: path.join(root, "tsconfig.json"),
    packages: "external",
    define: {
      "process.env.NODE_ENV": "\"production\"",
    },
    logLevel: "info",
  });

  await copyFile(
    path.join(root, "server", "generate_pdf.py"),
    path.join(distDir, "generate_pdf.py"),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
