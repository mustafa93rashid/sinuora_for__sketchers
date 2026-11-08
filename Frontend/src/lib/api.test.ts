import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { api, requestKey } from "./api";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
beforeEach(() => {
  vi.stubGlobal("sessionStorage", { getItem: () => null });
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

describe("backend integration", () => {
  it("sends same-origin requests with cookies and the mutation key", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        json({ success: true, data: { order: { _id: "1" } } }),
      );
    vi.stubGlobal("fetch", fetcher);
    await api("/orders", {
      method: "POST",
      body: { notes: "sample" },
      key: "mutation-key",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/orders",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "mutation-key",
        },
      }),
    );
  });
  it("does not refresh for a rejected login", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        json({ success: false, message: "Invalid credentials" }, 401),
      );
    vi.stubGlobal("fetch", fetcher);
    await expect(
      api("/auth/login", { method: "POST", body: {} }),
    ).rejects.toThrow("Invalid credentials");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });
  it("shares one refresh across concurrent expired requests", async () => {
    let refreshed = false;
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("/refresh-token")) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        refreshed = true;
        return json({ success: true });
      }
      return refreshed
        ? json({ success: true, data: {} })
        : json({ success: false }, 401);
    });
    vi.stubGlobal("fetch", fetcher);
    await Promise.all([api("/orders"), api("/inventory")]);
    expect(
      fetcher.mock.calls.filter(([url]) => url.endsWith("/refresh-token")),
    ).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
  it("lets the browser set the multipart upload boundary", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(json({ success: true, data: {} }));
    vi.stubGlobal("fetch", fetcher);
    const body = new FormData();
    body.append("name", "Sample");
    await api("/products", { method: "POST", body });
    expect(fetcher.mock.calls[0][1].headers).not.toHaveProperty("Content-Type");
    expect(fetcher.mock.calls[0][1].body).toBe(body);
  });
  it("does not accept an HTML fallback page as a successful API response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>Vite</html>")),
    );
    await expect(api("/orders")).rejects.toThrow("unexpected response");
  });
  it("retains retry keys for the same payload and replaces them when input changes", () => {
    const key = requestKey();
    const first = key({ quantity: 2 });
    expect(key({ quantity: 2 })).toBe(first);
    expect(key({ quantity: 3 })).not.toBe(first);
  });
});
