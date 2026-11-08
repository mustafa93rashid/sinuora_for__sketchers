import { demoRequest } from "./demo";
import type { Response } from "./types";
const base = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(
  /\/$/,
  "",
);
let refreshing: Promise<boolean> | null = null;
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export const isPreview = () =>
  sessionStorage.getItem("sinuora-preview") === "true";
const publicAuth = (path: string) =>
  path === "/auth/login" ||
  path === "/auth/forgot-password" ||
  path === "/users/activate-account" ||
  path.startsWith("/auth/reset-password/") ||
  path === "/auth/refresh-token";
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; key?: string } = {},
  retry = true,
): Promise<Response<T>> {
  const method = options.method || "GET";
  if (isPreview()) return (await demoRequest(path, method)) as Response<T>;
  const form = options.body instanceof FormData;
  let response: globalThis.Response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      credentials: "include",
      headers: {
        ...(!form && options.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.key ? { "Idempotency-Key": options.key } : {}),
      },
      body: options.body
        ? form
          ? (options.body as FormData)
          : JSON.stringify(options.body)
        : undefined,
    });
  } catch {
    throw new ApiError(
      "Unable to reach the server. Check your connection and try again.",
      0,
    );
  }
  if (response.status === 401 && retry && !publicAuth(path)) {
    refreshing ??= fetch(`${base}/auth/refresh-token`, {
      method: "POST",
      credentials: "include",
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
    if (await refreshing) return api<T>(path, options, false);
  }
  const result = await response.json().catch(() => null);
  if (!result || typeof result.success !== "boolean")
    throw new ApiError(
      "The API returned an unexpected response. Check the backend connection.",
      response.status,
    );
  if (!response.ok || !result.success) {
    if (response.status === 401 && !publicAuth(path))
      window.dispatchEvent(new Event("session-expired"));
    throw new ApiError(
      result.errors
        ?.map(
          (e: { field?: string; message?: string; msg?: string }) =>
            `${e.field ? `${e.field}: ` : ""}${e.message || e.msg}`,
        )
        .join(" · ") ||
        result.message ||
        "Request failed",
      response.status,
    );
  }
  return result;
}
export function query(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") q.set(k, String(v));
  });
  return q.size ? `?${q}` : "";
}
// Keep a key for the same payload after a network error; use a new one when input changes.
export function requestKey() {
  let payload = "",
    key = "";
  return (body: unknown) => {
    const next = JSON.stringify(body);
    if (next !== payload || !key) {
      payload = next;
      key = crypto.randomUUID();
    }
    return key;
  };
}
