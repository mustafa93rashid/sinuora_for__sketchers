import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadEnv } from "vite";

const frontend = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const backend = path.resolve(frontend, "../Backend");
const env = loadEnv("development", frontend, "");
const target = env.API_PROXY_TARGET || "http://127.0.0.1:3000";
const children = new Set();
let stopping = false;
function start(file, args, cwd) {
  const child = spawn(process.execPath, [file, ...args], {
    cwd,
    stdio: "inherit",
    windowsHide: true,
  });
  children.add(child);
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => {
    children.delete(child);
    if (!stopping) stop(code || 0);
  });
  return child;
}
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
process.once("SIGINT", () => stop());
process.once("SIGTERM", () => stop());
let existing = false;
try {
  const response = await fetch(`${target}/api/health`, {
    signal: AbortSignal.timeout(2000),
  });
  existing = (await response.json()).success !== undefined;
} catch {}
if (existing) console.log(`Using the backend already listening at ${target}`);
else {
  if (!existsSync(path.join(backend, "src/app.js")))
    throw new Error("Expected Backend/src/app.js next to the Frontend folder.");
  const targetUrl = new URL(target);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(targetUrl.hostname))
    throw new Error(
      "For a remote backend, start the frontend alone with npm run dev.",
    );
  start(path.join(backend, "src/app.js"), [], backend);
}
if (!stopping)
  start(path.join(frontend, "node_modules/vite/bin/vite.js"), [], frontend);
console.log(
  "Open http://localhost:5173. Ctrl+C stops only servers started by this command.",
);
