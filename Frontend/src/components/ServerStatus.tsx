import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle, LoaderCircle } from "lucide-react";

export function ServerStatus() {
  const status = useQuery({
    queryKey: ["backend-health"],
    queryFn: async () => {
      const apiBase = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(
        /\/$/,
        "",
      );
      const response = await fetch(`${apiBase.replace(/\/v1$/, "")}/health`, {
        credentials: "include",
        signal: AbortSignal.timeout(5000),
      });
      const result = await response.json();
      if (!response.ok || result.success !== true)
        throw new Error("Server or database unavailable");
      return true;
    },
    retry: false,
    refetchInterval: 30_000,
  });
  return (
    <div
      role="status"
      className={`mt-5 flex items-center gap-2 rounded-lg border p-3 text-xs ${status.isPending ? "border-slate-200 text-slate-500" : status.error ? "border-amber-200 bg-amber-50 text-amber-900" : "border-teal-100 bg-teal-50 text-teal-800"}`}
    >
      {status.isPending ? (
        <LoaderCircle size={15} className="animate-spin" />
      ) : status.error ? (
        <AlertCircle size={15} />
      ) : (
        <CheckCircle2 size={15} />
      )}
      <span className="flex-1">
        {status.isPending
          ? "Checking server connection…"
          : status.error
            ? "Server offline. Start the backend to sign in."
            : "Connected to your backend"}
      </span>
      {status.error && (
        <button
          type="button"
          className="font-semibold underline disabled:opacity-50"
          disabled={status.isFetching}
          onClick={() => void status.refetch()}
        >
          Retry
        </button>
      )}
    </div>
  );
}
