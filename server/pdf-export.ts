import { spawn } from "node:child_process";

const DEFAULT_MAX_BUFFER_BYTES = 20 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 60_000;

interface PdfExportOptions {
  executable?: string;
  maxBufferBytes?: number;
  timeoutMs?: number;
}

export function generatePdfBuffer(
  payload: unknown,
  scriptPath: string,
  options: PdfExportOptions = {},
): Promise<Buffer> {
  const executable = options.executable || process.env.PYTHON_BIN || "python3";
  const maxBufferBytes = options.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const child = spawn(executable, [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let timer: NodeJS.Timeout | undefined;

    const finish = (error?: Error, output?: Buffer) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      if (error) {
        reject(error);
      } else {
        resolve(output || Buffer.alloc(0));
      }
    };

    const abortForSize = () => {
      child.kill();
      finish(new Error(`PDF generator exceeded the ${maxBufferBytes}-byte output limit`));
    };

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > maxBufferBytes) {
        abortForSize();
        return;
      }
      stdout.push(chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.length;
      if (stderrBytes > maxBufferBytes) {
        abortForSize();
        return;
      }
      stderr.push(chunk);
    });

    child.on("error", (error) => finish(error));
    child.on("close", (code, signal) => {
      if (code !== 0) {
        const detail = Buffer.concat(stderr).toString("utf8").slice(0, 2_000) || `signal ${signal || "unknown"}`;
        finish(new Error(`PDF generator exited with status ${code ?? "unknown"}: ${detail}`));
        return;
      }
      finish(undefined, Buffer.concat(stdout));
    });

    child.stdin.on("error", (error) => finish(error));
    child.stdin.end(Buffer.from(JSON.stringify(payload), "utf8"));

    timer = setTimeout(() => {
      child.kill();
      finish(new Error(`PDF generator timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    timer.unref();
  });
}
