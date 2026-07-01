'use client';

import { useEffect, useState, Fragment } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle2, ChevronDown, ChevronRight, Download, Loader2, RefreshCw, X, XCircle } from "lucide-react";
import { createPortal } from "react-dom";

interface FileUpload {
  id: number;
  filename: string;
  uploaded_by: string | null;
  uploaded_at: string | null;
  job_status: string | null;
  error_count: number | null;
  variants_count?: number | null;
}

interface UploadStep {
  id: number;
  job_id: number;
  step_name: string;
  status: 'running' | 'done' | 'failed';
  message: string | null;
  created_at: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ITEMS_PER_PAGE = 10;

// ── Step label map ────────────────────────────────────────────────────────────

const STEP_LABELS: Record<string, string> = {
  csv_parsed:       "CSV Parsed",
  s3_upload:        "S3 Upload",
  db_upsert:        "DB Upsert",
  middleware_called: "Middleware Called",
  s3_download:      "S3 Download (Middleware)",
  csv_parse:        "CSV Parse (Middleware)",
  shopify_sync:     "Shopify Price Sync",
  upload:           "Upload",
};

function stepLabel(name: string) {
  return STEP_LABELS[name] ?? name.replace(/_/g, " ");
}

// ── Step status icon/color ────────────────────────────────────────────────────

function StepIcon({ status }: { status: string }) {
  if (status === "done")    return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
  if (status === "failed")  return <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
  return <Loader2 className="h-4 w-4 text-blue-400 animate-spin shrink-0" />;
}

function StepStatusBadge({ status }: { status: string }) {
  const cls =
    status === "done"    ? "bg-green-500/15 text-green-400 border-green-500/30" :
    status === "failed"  ? "bg-red-500/15   text-red-400   border-red-500/30"   :
                           "bg-blue-500/15  text-blue-400  border-blue-500/30";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border capitalize ${cls}`}>
      {status}
    </span>
  );
}

function toIST(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
}

// ── Steps panel ───────────────────────────────────────────────────────────────

function StepsPanel({ jobId, onClose }: { jobId: number; onClose: () => void }) {
  const [steps,   setSteps]   = useState<UploadStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/file-upload/steps?jobId=${jobId}`);
        const data = await res.json();
        if (!cancelled) setSteps(data.steps ?? []);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed to load steps");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    // auto-refresh every 4s if any step is still running
    const interval = setInterval(() => {
      if (!cancelled) load();
    }, 4000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [jobId]);

  // Stop auto-refresh once no running steps remain
  const hasRunning = steps.some(s => s.status === "running");

  return (
    <div className="bg-muted/30 border-t px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold">Job #{jobId} — Step-by-step log</p>
        <div className="flex items-center gap-2">
          {hasRunning && <span className="text-xs text-blue-600 animate-pulse">Live</span>}
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X className="h-3.5 w-3.5" /> Collapse
          </button>
        </div>
      </div>

      {loading && steps.length === 0 ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : steps.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No step logs recorded for this job yet.</p>
      ) : (
        <ol className="relative border-l border-muted-foreground/20 ml-2 space-y-0">
          {steps.map((step, idx) => (
            <li key={step.id} className="ml-4 pb-4">
              {/* Connector dot */}
              <span className={`absolute -left-[9px] mt-1 flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                step.status === "done"   ? "border-green-500 bg-green-500/10" :
                step.status === "failed" ? "border-red-500   bg-red-500/10"   :
                                          "border-blue-500  bg-blue-500/10"
              }`} style={{ top: `${idx === 0 ? 2 : undefined}` }}>
                <StepIcon status={step.status} />
              </span>

              <div className="flex flex-wrap items-start gap-2 pl-1">
                <span className="text-sm font-medium leading-tight">{stepLabel(step.step_name)}</span>
                <StepStatusBadge status={step.status} />
                <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                  {toIST(step.created_at)}
                </span>
              </div>
              {step.message && (
                <p className="text-xs text-muted-foreground mt-0.5 pl-1 leading-relaxed">
                  {step.message}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── Job status badge ──────────────────────────────────────────────────────────

function JobStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const cls =
    status === "completed"        ? "bg-green-500/15  text-green-400  border-green-500/30"  :
    status === "failed"           ? "bg-red-500/15    text-red-400    border-red-500/30"    :
    status === "processing"       ? "bg-blue-500/15   text-blue-400   border-blue-500/30"   :
    status === "upload_initiated" ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" :
                                    "bg-muted         text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function FileUploadManager() {
  const [uploads,     setUploads]     = useState<FileUpload[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm,  setSearchTerm]  = useState('');
  const [pagination,  setPagination]  = useState<Pagination>({
    total: 0, page: 1, limit: ITEMS_PER_PAGE, totalPages: 1,
  });
  const [loading,            setLoading]            = useState(false);
  const [errLogDownloading,  setErrLogDownloading]  = useState(false);
  const [error,              setError]              = useState<string | null>(null);
  const [toastMsg,           setToastMsg]           = useState<string | null>(null);
  const [toastShow,          setToastShow]          = useState(false);
  const [mounted,            setMounted]            = useState(false);
  const [expandedJobId,      setExpandedJobId]      = useState<number | null>(null);

  useEffect(() => setMounted(true), []);

  const fetchUploads = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/file-upload?page=${currentPage}&limit=${ITEMS_PER_PAGE}&search=${encodeURIComponent(searchTerm)}`
      );
      const data = await response.json();
      setUploads(data.data || []);
      setPagination(data.pagination || pagination);
    } catch {
      setError('Failed to fetch file uploads. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => fetchUploads(), 300);
    return () => clearTimeout(t);
  }, [currentPage, searchTerm]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(Math.max(1, Math.min(newPage, pagination.totalPages)));
  };

  const handleLogDownload = async (jobId: number) => {
    setToastMsg(null);
    setToastShow(false);
    setErrLogDownloading(true);
    const res = await fetch(`/api/get-error-logs-by-job?id=${jobId}`);
    const data = await res.json();
    if (data?.status === "success") {
      if (data?.data?.length > 0) {
        downloadCSV(data.data, `ErrLogs-JobId-${jobId}.csv`);
      } else {
        setToastMsg("No error data found to download");
        setToastShow(true);
      }
    } else {
      setToastMsg(data?.status || "Unknown error occurred while downloading error data");
      setToastShow(true);
    }
    setErrLogDownloading(false);
  };

  const toggleSteps = (jobId: number) => {
    setExpandedJobId(prev => prev === jobId ? null : jobId);
  };

  const { ready, can } = usePermissions();
  const router = useRouter();
  const { clearUser } = useAuth();
  if (!ready) return null;
  if (!can('File Upload', 'View')) {
    clearUser();
    router.replace('/login');
    return null;
  }

  return (
    <div>
      {mounted && toastShow && createPortal(
        <div className="fixed top-20 right-4 z-[9999] pointer-events-none">
          <div className="pointer-events-auto bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded flex items-center gap-2 shadow">
            <span className="leading-none">{toastMsg}</span>
            <button type="button" onClick={() => setToastShow(false)} className="inline-flex w-5 h-5 items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>,
        document.body
      )}

      {errLogDownloading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-white/20 cursor-not-allowed">
          <Loader2 className="animate-spin text-gray-600 w-8 h-8" />
        </div>
      )}

      {can('File Upload', 'View') && (
        <div className="p-6 space-y-6">
          <div className="flex flex-col space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">File Upload History</h2>
            <p className="text-sm text-muted-foreground">Click "Steps" on any row to see per-step progress and error details.</p>
          </div>

          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center gap-4">
              <Input
                type="text"
                placeholder="Search by filename"
                className="max-w-md"
                value={searchTerm}
                onChange={handleSearchChange}
              />
              <Button variant="outline" size="icon" onClick={fetchUploads} disabled={loading} title="Refresh">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : error ? (
              <div className="p-4 bg-destructive/10 text-destructive rounded-md">{error}</div>
            ) : uploads.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">No uploaded files found.</div>
            ) : (
              <>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">#</TableHead>
                        <TableHead>Filename</TableHead>
                        <TableHead>Uploaded By</TableHead>
                        <TableHead>Uploaded At</TableHead>
                        <TableHead>Job ID</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Total SKUs</TableHead>
                        <TableHead>Failed SKUs</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uploads.map((file, index) => (
                        <Fragment key={file.id}>
                          <TableRow
                            className={expandedJobId === file.id ? "bg-muted/30" : ""}
                          >
                            <TableCell>{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</TableCell>
                            <TableCell className="font-medium">{file.filename}</TableCell>
                            <TableCell>{file.uploaded_by ?? '—'}</TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {file.uploaded_at ? toIST(file.uploaded_at) : '—'}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{file.id}</TableCell>
                            <TableCell><JobStatusBadge status={file.job_status} /></TableCell>
                            <TableCell>{file.variants_count ?? '—'}</TableCell>
                            <TableCell>{file.error_count ?? '—'}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleSteps(file.id)}
                                  className="text-xs gap-1"
                                >
                                  {expandedJobId === file.id
                                    ? <><ChevronDown className="h-3.5 w-3.5" />Steps</>
                                    : <><ChevronRight className="h-3.5 w-3.5" />Steps</>
                                  }
                                </Button>
                                {(file.error_count && file.error_count > 0 && file.job_status?.toLowerCase() === "completed") && (
                                  <Button
                                    title={`Download ${file.error_count} error logs`}
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleLogDownload(file.id)}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>

                          {expandedJobId === file.id && (
                            <TableRow className="hover:bg-transparent">
                              <TableCell colSpan={9} className="p-0">
                                <StepsPanel jobId={file.id} onClose={() => setExpandedJobId(null)} />
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between px-2">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                    {Math.min(currentPage * ITEMS_PER_PAGE, pagination.total)} of{' '}
                    {pagination.total} entries
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === pagination.totalPages || pagination.totalPages === 0}>
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function downloadCSV(data: Record<string, any>[], filename = 'data.csv') {
  const csv = arrayToCSV(data);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

function arrayToCSV(data: Record<string, any>[]): string {
  if (!data.length) return '';
  const keys = Object.keys(data[0]);
  const csvRows = [
    keys.join(','),
    ...data.map(row => keys.map(k => JSON.stringify(row[k] ?? '')).join(','))
  ];
  return csvRows.join('\n');
}
