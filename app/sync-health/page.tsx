"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2, XCircle, RefreshCw, Clock, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import axios from "axios";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SyncJob {
  id:                  number;
  status:              string;
  total_variants:      number;
  processed_variants:  number;
  success_count:       number;
  fail_count:          number;
  started_at:          string;
  completed_at:        string | null;
  error_message:       string | null;
  duration_seconds:    number | null;
}

interface SevenDay {
  totalRows:   number;
  failedRows:  number;
  successRows: number;
  jobsCount:   number;
}

interface HealthData {
  latest:   SyncJob | null;
  recent:   SyncJob[];
  sevenDay: SevenDay;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toIST(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function timeAgo(d: string | null) {
  if (!d) return "—";
  const diffMs = Date.now() - new Date(d).getTime();
  const mins   = Math.floor(diffMs / 60_000);
  const hrs    = Math.floor(mins / 60);
  const days   = Math.floor(hrs / 24);
  if (days > 0)  return `${days}d ago`;
  if (hrs > 0)   return `${hrs}h ago`;
  if (mins > 0)  return `${mins}m ago`;
  return "just now";
}

function fmtDuration(secs: number | null) {
  if (secs === null || secs < 0) return "—";
  if (secs < 60)  return `${secs}s`;
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}m ${s}s`;
}

function successRate(job: SyncJob) {
  if (!job.total_variants) return null;
  return Math.round((job.success_count / job.total_variants) * 100);
}

const STATUS_CFG: Record<string, { icon: React.ReactNode; label: string; cls: string; badgeCls: string }> = {
  completed: {
    icon:     <CheckCircle2 className="h-5 w-5 text-green-600" />,
    label:    "Completed",
    cls:      "border-green-200 bg-green-50",
    badgeCls: "bg-green-100 text-green-800 border-green-300",
  },
  processing: {
    icon:     <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />,
    label:    "In Progress",
    cls:      "border-blue-200 bg-blue-50",
    badgeCls: "bg-blue-100 text-blue-800 border-blue-300",
  },
  failed: {
    icon:     <XCircle className="h-5 w-5 text-red-600" />,
    label:    "Failed",
    cls:      "border-red-200 bg-red-50",
    badgeCls: "bg-red-100 text-red-800 border-red-300",
  },
};

function cfg(status: string) {
  return STATUS_CFG[status] ?? STATUS_CFG.failed;
}

function StatusBadge({ status }: { status: string }) {
  const c = cfg(status);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${c.badgeCls}`}>
      {c.label}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SyncHealthPage() {
  const [data,    setData]    = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get("/api/sync-health");
      setData(res.data);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const latest     = data?.latest;
  const latestCfg  = latest ? cfg(latest.status) : null;
  const sevenDay   = data?.sevenDay;
  const errorRate7 = sevenDay && sevenDay.totalRows > 0
    ? Math.round((sevenDay.failedRows / sevenDay.totalRows) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sync Health</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Last sync result, recent history, and 7-day error stats at a glance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/sync-process-logs">
              All Sync Jobs <ExternalLink className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-md">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-44 rounded-xl" />
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : data && (
        <>
          {/* Latest sync big card */}
          {latest ? (
            <div className={`rounded-xl border-2 p-5 ${latestCfg?.cls ?? ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {latestCfg?.icon}
                  <div>
                    <p className="font-semibold text-lg leading-none">Latest Sync</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Job #{latest.id} · {timeAgo(latest.started_at)}
                    </p>
                  </div>
                </div>
                <StatusBadge status={latest.status} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
                {[
                  { label: "Total SKUs",   value: latest.total_variants?.toLocaleString() ?? "—" },
                  { label: "Succeeded",    value: <span className="text-green-700">{latest.success_count?.toLocaleString() ?? "—"}</span> },
                  { label: "Failed",       value: <span className={latest.fail_count > 0 ? "text-red-600 font-semibold" : ""}>{latest.fail_count?.toLocaleString() ?? "—"}</span> },
                  { label: "Duration",     value: fmtDuration(latest.duration_seconds) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/60 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <p className="font-bold text-xl">{value}</p>
                  </div>
                ))}
              </div>

              {(() => {
                const rate = successRate(latest);
                if (rate === null) return null;
                return (
                  <div className="mt-4 space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Success rate</span>
                      <span className="font-medium">{rate}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/50 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${rate >= 90 ? "bg-green-500" : rate >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Started: <strong>{toIST(latest.started_at)}</strong>
                </div>
                {latest.completed_at && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Completed: <strong>{toIST(latest.completed_at)}</strong>
                  </div>
                )}
              </div>

              {latest.error_message && (
                <div className="mt-3 text-xs text-red-700 bg-red-100 rounded-md p-2 border border-red-200">
                  {latest.error_message}
                </div>
              )}

              {latest.status === "processing" && (
                <div className="mt-3">
                  <Button asChild size="sm">
                    <Link href={`/sync-dashboard?id=${latest.id}`}>
                      View Live Progress <ExternalLink className="h-3.5 w-3.5 ml-1" />
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border p-8 text-center text-muted-foreground">
              No sync jobs found yet. Trigger a price sync to get started.
            </div>
          )}

          {/* 7-day stats */}
          {sevenDay && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Jobs (7d)",         value: sevenDay.jobsCount,   cls: "" },
                { label: "Rows processed (7d)", value: sevenDay.totalRows.toLocaleString(),   cls: "" },
                { label: "Successful rows (7d)", value: sevenDay.successRows.toLocaleString(), cls: "text-green-700" },
                {
                  label: "Failed rows (7d)",
                  value: (
                    <span className={sevenDay.failedRows > 0 ? "text-red-600" : ""}>
                      {sevenDay.failedRows.toLocaleString()}
                      {sevenDay.totalRows > 0 && (
                        <span className="text-sm font-normal text-muted-foreground ml-1">
                          ({errorRate7}%)
                        </span>
                      )}
                    </span>
                  ),
                  cls: "",
                },
              ].map(({ label, value, cls }) => (
                <div key={label} className="rounded-xl border p-4 bg-background">
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className={`font-bold text-2xl ${cls}`}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Recent jobs table */}
          {data.recent.length > 0 && (
            <div>
              <h3 className="text-base font-semibold mb-3">Recent Jobs</h3>
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3">Job</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-right px-4 py-3">SKUs</th>
                      <th className="text-right px-4 py-3">✓ OK</th>
                      <th className="text-right px-4 py-3">✗ Failed</th>
                      <th className="text-right px-4 py-3">Duration</th>
                      <th className="text-left px-4 py-3">Started</th>
                      <th className="text-left px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((job, i) => {
                      const rate = successRate(job);
                      return (
                        <tr key={job.id} className={`border-t ${i === 0 ? "bg-muted/20" : ""}`}>
                          <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">#{job.id}</td>
                          <td className="px-4 py-2.5"><StatusBadge status={job.status} /></td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{job.total_variants?.toLocaleString() ?? "—"}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-green-700">{job.success_count?.toLocaleString() ?? "—"}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            <span className={job.fail_count > 0 ? "text-red-600 font-semibold" : "text-muted-foreground"}>
                              {job.fail_count?.toLocaleString() ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{fmtDuration(job.duration_seconds)}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{toIST(job.started_at)}</td>
                          <td className="px-4 py-2.5">
                            <Link
                              href={`/sync-dashboard?id=${job.id}`}
                              className="text-xs text-primary underline-offset-2 hover:underline"
                            >
                              Logs
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
