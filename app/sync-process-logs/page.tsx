"use client";

import { useEffect, useState, useCallback, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronRight,
  Clock, ExternalLink, Loader2, RefreshCw, X, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";
import Link from "next/link";
import axios from "axios";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SyncJob {
  id:                 number;
  status:             string;
  total_variants:     number;
  processed_variants: number;
  success_count:      number;
  fail_count:         number;
  started_at:         string;
  completed_at:       string | null;
  error_message:      string | null;
  duration_seconds:   number | null;
}

interface HealthData {
  latest: SyncJob | null;
}

interface SyncStep {
  id:         number;
  job_id:     number;
  step_name:  string;
  status:     "running" | "done" | "failed";
  message:    string | null;
  created_at: string;
}

interface Pagination {
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
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

function toISTFull(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
}

function timeAgo(d: string | null) {
  if (!d) return "—";
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60_000);
  const h = Math.floor(m / 60), days = Math.floor(h / 24);
  if (days > 0) return `${days}d ago`;
  if (h > 0)    return `${h}h ago`;
  if (m > 0)    return `${m}m ago`;
  return "just now";
}

function fmtDuration(secs: number | null) {
  if (secs == null || secs < 0) return "—";
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}m ${s}s`;
}

function successRate(job: SyncJob) {
  if (!job.total_variants) return null;
  return Math.round((job.success_count / job.total_variants) * 100);
}

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { icon: React.ReactNode; label: string; cardCls: string; badgeCls: string; innerCls: string }> = {
  completed: {
    icon:     <CheckCircle2 className="h-5 w-5 text-green-500" />,
    label:    "Completed",
    cardCls:  "border-green-500/30 bg-green-500/10",
    badgeCls: "bg-green-500/20 text-green-400 border-green-500/30",
    innerCls: "bg-card/60 dark:bg-card/40",
  },
  processing: {
    icon:     <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />,
    label:    "In Progress",
    cardCls:  "border-blue-500/30 bg-blue-500/10",
    badgeCls: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    innerCls: "bg-card/60 dark:bg-card/40",
  },
  failed: {
    icon:     <XCircle className="h-5 w-5 text-red-500" />,
    label:    "Failed",
    cardCls:  "border-red-500/30 bg-red-500/10",
    badgeCls: "bg-red-500/20 text-red-400 border-red-500/30",
    innerCls: "bg-card/60 dark:bg-card/40",
  },
};

function cfg(status: string) { return STATUS_CFG[status] ?? STATUS_CFG.failed; }

function StatusBadge({ status }: { status: string }) {
  const c = cfg(status);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${c.badgeCls}`}>
      {c.label}
    </span>
  );
}

// ── Step labels ────────────────────────────────────────────────────────────────

const STEP_LABELS: Record<string, string> = {
  fetch_variants:       "Fetch Variants",
  fetch_reference_data: "Fetch Reference Data",
  price_calculation:    "Price Calculation",
  delta_filter:         "Delta Filter",
  shopify_jsonl_upload: "Shopify JSONL Upload",
  shopify_bulk_op:      "Shopify Bulk Operation",
  db_price_update:      "DB Price Update",
};

function stepLabel(name: string) {
  return STEP_LABELS[name] ?? name.replace(/_/g, " ");
}

function StepIcon({ status }: { status: string }) {
  if (status === "done")   return <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-red-600 shrink-0" />;
  return <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />;
}

// ── Steps panel ───────────────────────────────────────────────────────────────

function StepsPanel({ jobId, onClose }: { jobId: number; onClose: () => void }) {
  const [steps,   setSteps]   = useState<SyncStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(isFirstLoad = false) {
      if (isFirstLoad) setLoading(true);
      try {
        const res = await fetch(`/api/sync-jobs/steps?jobId=${jobId}`);
        const data = await res.json();
        if (cancelled) return;
        const fetched: SyncStep[] = data.steps ?? [];
        setSteps(fetched);
        // Stop polling once no steps are in-progress — completed/failed jobs never change
        if (!fetched.some(s => s.status === "running") && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed to load steps");
      } finally {
        if (isFirstLoad && !cancelled) setLoading(false);
      }
    }

    load(true);
    intervalRef.current = setInterval(() => load(false), 4000);

    return () => {
      cancelled = true;
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [jobId]);

  const hasRunning = steps.some(s => s.status === "running");

  return (
    <div className="bg-muted/30 border-t px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold">Job #{jobId} — Step-by-step log</p>
        <div className="flex items-center gap-2">
          {hasRunning && <span className="text-xs text-blue-600 animate-pulse">Live</span>}
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <X className="h-3.5 w-3.5" /> Collapse
          </button>
        </div>
      </div>
      {loading && steps.length === 0 ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full rounded-md" />)}</div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : steps.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No step logs recorded for this job yet.</p>
      ) : (
        <ol className="relative border-l border-muted-foreground/20 ml-2 space-y-0">
          {steps.map((step) => (
            <li key={step.id} className="ml-4 pb-4">
              <span className={`absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                step.status === "done"   ? "border-green-500 bg-green-500/10" :
                step.status === "failed" ? "border-red-500   bg-red-500/10"   :
                                          "border-blue-500  bg-blue-500/10"
              }`}>
                <StepIcon status={step.status} />
              </span>
              <div className="flex flex-wrap items-start gap-2 pl-1">
                <span className="text-sm font-medium leading-tight">{stepLabel(step.step_name)}</span>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border capitalize ${
                  step.status === "done"   ? "bg-green-500/15 text-green-400 border-green-500/30" :
                  step.status === "failed" ? "bg-red-500/15   text-red-400   border-red-500/30"   :
                                            "bg-blue-500/15  text-blue-400  border-blue-500/30"
                }`}>{step.status}</span>
                <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">{toISTFull(step.created_at)}</span>
              </div>
              {step.message && (
                <p className="text-xs text-muted-foreground mt-0.5 pl-1 leading-relaxed">{step.message}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── Latest sync card ──────────────────────────────────────────────────────────

function LatestSyncCard({ job }: { job: SyncJob }) {
  const c    = cfg(job.status);
  const rate = successRate(job);
  const totalSkus = job.total_variants != null ? job.total_variants.toLocaleString() : "—";
  return (
    <div className={`rounded-xl border-2 p-5 ${c.cardCls}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {c.icon}
          <div>
            <p className="font-semibold text-lg leading-none">Latest Sync</p>
            <p className="text-sm text-muted-foreground mt-1">Job #{job.id} · {timeAgo(job.started_at)}</p>
          </div>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
        {[
          { label: "Total SKUs",  value: totalSkus },
          { label: "Succeeded",   value: <span className="text-green-500">{job.success_count?.toLocaleString() ?? "—"}</span> },
          { label: "Failed",      value: <span className={job.fail_count > 0 ? "text-red-400 font-semibold" : ""}>{job.fail_count?.toLocaleString() ?? "—"}</span> },
          { label: "Duration",    value: fmtDuration(job.duration_seconds) },
        ].map(({ label, value }) => (
          <div key={label} className={`rounded-lg p-3 border border-border/30 ${c.innerCls}`}>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="font-bold text-xl">{value}</p>
          </div>
        ))}
      </div>

      {rate !== null && (
        <div className="mt-4 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Success rate</span><span className="font-medium">{rate}%</span>
          </div>
          <div className="h-2 rounded-full bg-foreground/10 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${rate >= 90 ? "bg-green-500" : rate >= 70 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${rate}%` }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Started: <strong className="text-foreground">{toIST(job.started_at)}</strong></div>
        {job.completed_at && (
          <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Completed: <strong className="text-foreground">{toIST(job.completed_at)}</strong></div>
        )}
      </div>

      {job.error_message && (
        <div className="mt-3 text-xs text-red-400 bg-red-500/10 rounded-md p-2 border border-red-500/20">{job.error_message}</div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 20;

export default function SyncMonitorPage() {
  const { ready, can } = usePermissions();
  const router         = useRouter();

  const [health,    setHealth]    = useState<HealthData | null>(null);
  const [jobs,      setJobs]      = useState<SyncJob[]>([]);
  const [pagination,setPagination]= useState<Pagination>({ total: 0, page: 1, limit: ITEMS_PER_PAGE, totalPages: 1 });
  const [page,      setPage]      = useState(1);
  const [from,      setFrom]      = useState("");
  const [to,        setTo]        = useState("");
  const [loading,   setLoading]   = useState(true);
  const [jobsLoading,setJobsLoading]= useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [expandedId,setExpandedId]= useState<number | null>(null);

  useEffect(() => {
    if (ready && !can("Dashboard", "View")) router.replace("/login");
  }, [ready, can, router]);

  // Load health data (latest card + 7-day stats)
  const loadHealth = useCallback(async () => {
    try {
      const res = await axios.get("/api/sync-health");
      setHealth(res.data);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || "Failed to load health");
    }
  }, []);

  // Load paginated jobs with optional date filter
  const loadJobs = useCallback(async (p = page, f = from, t = to) => {
    setJobsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(ITEMS_PER_PAGE) });
      if (f) params.set("from", f);
      if (t) params.set("to", t);
      const res = await axios.get(`/api/sync-jobs?${params}`);
      setJobs(res.data.data || []);
      setPagination(res.data.pagination);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || "Failed to load jobs");
    } finally {
      setJobsLoading(false);
    }
  }, [page, from, to]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([loadHealth(), loadJobs(page, from, to)]);
    setLoading(false);
  }, [loadHealth, loadJobs, page, from, to]);

  useEffect(() => { if (ready) loadAll(); }, [ready]);

  // Reload jobs when page/filters change (after initial mount)
  const [mounted, setMounted] = useState(false);
  useEffect(() => { if (mounted) loadJobs(page, from, to); }, [page]);
  useEffect(() => { setMounted(true); }, []);

  const applyFilter = () => { setPage(1); loadJobs(1, from, to); };
  const clearFilter = () => { setFrom(""); setTo(""); setPage(1); loadJobs(1, "", ""); };


  if (!ready) return null;

  return (
    <div className="p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sync Monitor</h2>
          <p className="text-sm text-muted-foreground mt-1">Latest sync status, 7-day stats, and full job history with step-by-step logs.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-md">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-44 rounded-xl" />
          <div className="grid grid-cols-4 gap-4">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <>
          {/* ── Latest sync card ── */}
          {health?.latest ? (
            <LatestSyncCard job={health.latest} />
          ) : (
            <div className="rounded-xl border p-8 text-center text-muted-foreground">
              No sync jobs found yet. Trigger a price sync to get started.
            </div>
          )}


          {/* ── Sync History ── */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h3 className="text-base font-semibold">Sync History</h3>

              {/* Date filter */}
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-muted-foreground">From</label>
                <input
                  type="date"
                  value={from}
                  onChange={e => setFrom(e.target.value)}
                  className="text-sm border rounded-md px-2 py-1 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <label className="text-xs text-muted-foreground">To</label>
                <input
                  type="date"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  className="text-sm border rounded-md px-2 py-1 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Button size="sm" onClick={applyFilter} disabled={jobsLoading}>Apply</Button>
                {(from || to) && (
                  <Button size="sm" variant="ghost" onClick={clearFilter} className="text-muted-foreground">Clear</Button>
                )}
              </div>
            </div>

            {jobsLoading ? (
              <div className="space-y-2">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : jobs.length === 0 ? (
              <div className="rounded-xl border p-8 text-center text-muted-foreground text-sm">
                No sync jobs found{(from || to) ? " for the selected date range" : ""}.
              </div>
            ) : (
              <>
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
                        <th className="text-left px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((job, i) => (
                        <Fragment key={job.id}>
                          <tr
                            className={`border-t ${i === 0 ? "bg-muted/20" : ""} ${expandedId === job.id ? "bg-muted/30" : ""}`}
                          >
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
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setExpandedId(prev => prev === job.id ? null : job.id)}
                                  className="text-xs gap-1"
                                >
                                  {expandedId === job.id
                                    ? <><ChevronDown className="h-3.5 w-3.5" />Steps</>
                                    : <><ChevronRight className="h-3.5 w-3.5" />Steps</>
                                  }
                                </Button>
                                <Link
                                  href={`/sync-dashboard?id=${job.id}`}
                                  className="text-xs text-primary hover:underline flex items-center gap-0.5"
                                >
                                  Logs <ExternalLink className="h-3 w-3" />
                                </Link>
                              </div>
                            </td>
                          </tr>

                          {expandedId === job.id && (
                            <tr className="hover:bg-transparent">
                              <td colSpan={8} className="p-0">
                                <StepsPanel jobId={job.id} onClose={() => setExpandedId(null)} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-1">
                  <p className="text-sm text-muted-foreground">
                    Showing {pagination.total === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, pagination.total)} of {pagination.total}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages || pagination.totalPages === 0}>Next</Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
