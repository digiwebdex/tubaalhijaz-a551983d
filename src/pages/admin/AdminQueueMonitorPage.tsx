import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Pause, Play, RefreshCw, RotateCcw, Trash2, XCircle } from "lucide-react";

type QueueStat = {
  name: string;
  enabled: boolean;
  paused?: boolean;
  counts?: Record<string, number> | null;
};

type FailedJob = {
  id: number;
  queue_name: string;
  job_id: string;
  job_name: string | null;
  attempts: number;
  error_message: string | null;
  failed_at: string;
};

const apiBase = (import.meta.env.VITE_API_URL as string) || "/api";

function authHeader(): HeadersInit {
  try {
    const tok = JSON.parse(localStorage.getItem("rk_session") || "null")?.access_token;
    return tok ? { Authorization: `Bearer ${tok}` } : {};
  } catch { return {}; }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeader(), ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
}

const STATE_COLOR: Record<string, string> = {
  active: "text-blue-600 bg-blue-500/10",
  waiting: "text-amber-600 bg-amber-500/10",
  delayed: "text-purple-600 bg-purple-500/10",
  completed: "text-emerald-600 bg-emerald-500/10",
  failed: "text-destructive bg-destructive/10",
  paused: "text-muted-foreground bg-muted",
};

export default function AdminQueueMonitorPage() {
  const [stats, setStats] = useState<QueueStat[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [failed, setFailed] = useState<FailedJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overview, failedRows] = await Promise.all([
        api<{ enabled: boolean; queues: QueueStat[] }>("/queues"),
        api<FailedJob[]>("/queues/failed?limit=50"),
      ]);
      setEnabled(overview.enabled);
      setStats(overview.queues);
      setFailed(failedRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load queues");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, []);

  const togglePause = async (q: QueueStat) => {
    try {
      await api(`/queues/${q.name}/${q.paused ? "resume" : "pause"}`, { method: "POST" });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  };

  const retryFailed = async (queue: string, jobId: string, rowId: number) => {
    try {
      await api(`/queues/${queue}/jobs/${jobId}/retry`, { method: "POST" });
      await api(`/queues/failed/${rowId}/resolve`, { method: "POST" });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed");
    }
  };

  const removeJob = async (queue: string, jobId: string, rowId: number) => {
    try {
      await api(`/queues/${queue}/jobs/${jobId}`, { method: "DELETE" });
      await api(`/queues/failed/${rowId}/resolve`, { method: "POST" });
      refresh();
    } catch {
      // job may already be gone — still resolve the SQL row
      await api(`/queues/failed/${rowId}/resolve`, { method: "POST" }).catch(() => {});
      refresh();
    }
  };

  const totalFailed = stats.reduce((sum, q) => sum + (q.counts?.failed || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Queue Monitor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time view of background workers. Auto-refreshes every 10 seconds.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border text-sm hover:bg-muted/50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {!enabled && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-700 rounded-md p-4 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div>
            <div className="font-medium">Queues disabled</div>
            <div>
              <code className="bg-muted px-1 py-0.5 rounded">REDIS_URL</code> is not set on the API server.
              Background jobs will run inline (synchronously) until Redis is configured.
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-md p-4 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((q) => (
          <div key={q.name} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold capitalize text-foreground">{q.name}</div>
              {q.enabled ? (
                <button
                  onClick={() => togglePause(q)}
                  className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-muted/50"
                >
                  {q.paused ? <><Play className="w-3 h-3" /> Resume</> : <><Pause className="w-3 h-3" /> Pause</>}
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">disabled</span>
              )}
            </div>
            {q.counts ? (
              <div className="grid grid-cols-3 gap-2 text-center">
                {(["active", "waiting", "delayed", "completed", "failed", "paused"] as const).map((s) => (
                  <div key={s} className={`rounded p-2 text-xs ${STATE_COLOR[s]}`}>
                    <div className="text-base font-semibold tabular-nums">{q.counts?.[s] ?? 0}</div>
                    <div className="capitalize">{s}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground py-4 text-center">No stats — Redis offline.</div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <XCircle className="w-4 h-4 text-destructive" />
            Failed Jobs
            <span className="text-xs text-muted-foreground font-normal">
              ({failed.length} unresolved · {totalFailed} live in Redis)
            </span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Queue</th>
                <th className="px-4 py-2 text-left">Job</th>
                <th className="px-4 py-2 text-left">Attempts</th>
                <th className="px-4 py-2 text-left">Error</th>
                <th className="px-4 py-2 text-left">Failed At</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {failed.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground text-sm">
                    <CheckCircle2 className="w-5 h-5 inline mr-2 text-emerald-600" />
                    No unresolved failures.
                  </td>
                </tr>
              )}
              {failed.map((f) => (
                <tr key={f.id} className="border-t border-border">
                  <td className="px-4 py-2 capitalize">{f.queue_name}</td>
                  <td className="px-4 py-2 font-mono text-xs">{f.job_name || f.job_id}</td>
                  <td className="px-4 py-2 tabular-nums">{f.attempts}</td>
                  <td className="px-4 py-2 text-destructive max-w-md truncate" title={f.error_message || ""}>
                    {f.error_message || "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground tabular-nums">
                    {new Date(f.failed_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => retryFailed(f.queue_name, f.job_id, f.id)}
                        className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-muted/50"
                      >
                        <RotateCcw className="w-3 h-3" /> Retry
                      </button>
                      <button
                        onClick={() => removeJob(f.queue_name, f.job_id, f.id)}
                        className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-3 h-3" /> Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
