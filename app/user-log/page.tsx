'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { X } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserLog {
  id: number;
  user_id: number;
  module: string;
  action: string;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  created_at: string;
  created_by: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Filters {
  modules: string[];
  actions: string[];
  users:   string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACTION_BADGE: Record<string, string> = {
  add:     'bg-green-100  text-green-800  border-green-300',
  edit:    'bg-blue-100   text-blue-800   border-blue-300',
  delete:  'bg-red-100    text-red-800    border-red-300',
  upload:  'bg-purple-100 text-purple-800 border-purple-300',
  trigger: 'bg-orange-100 text-orange-800 border-orange-300',
};

const MODULE_BADGE: Record<string, string> = {
  'Metal Prices':   'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Stone Prices':   'bg-sky-100    text-sky-800    border-sky-300',
  'Making Charges': 'bg-indigo-100 text-indigo-800 border-indigo-300',
  'Pricing Codes':  'bg-indigo-100 text-indigo-800 border-indigo-300',
  'CSV Upload':     'bg-pink-100   text-pink-800   border-pink-300',
  'Sync':           'bg-orange-100 text-orange-800 border-orange-300',
  'Users':          'bg-teal-100   text-teal-800   border-teal-300',
};

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  const cls = map[value] ?? 'bg-gray-100 text-gray-700 border-gray-300';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${cls}`}>
      {value}
    </span>
  );
}

function toIST(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true,
  });
}

// ── Diff viewer ───────────────────────────────────────────────────────────────

function DiffViewer({ oldData, newData }: {
  oldData: Record<string, any> | null;
  newData: Record<string, any> | null;
}) {
  const allKeys = Array.from(new Set([
    ...(oldData ? Object.keys(oldData) : []),
    ...(newData ? Object.keys(newData) : []),
  ]));

  if (!oldData && !newData) return <p className="text-sm text-muted-foreground italic">No data recorded.</p>;

  const fmt = (v: any) =>
    v === null || v === undefined ? <span className="italic text-muted-foreground">—</span>
    : typeof v === 'object' ? <pre className="whitespace-pre-wrap">{JSON.stringify(v, null, 2)}</pre>
    : String(v);

  // For add/upload actions there's only new_data — show it as a simple list
  if (!oldData && newData) {
    return (
      <div className="text-sm bg-green-50 border border-green-200 rounded-md p-3 space-y-1">
        <p className="font-semibold text-green-700 mb-2">Created / Added</p>
        {allKeys.map(k => (
          <div key={k} className="grid grid-cols-[160px_1fr] gap-2 py-0.5 border-b border-green-100 last:border-0">
            <span className="font-medium text-muted-foreground truncate">{k}</span>
            <span className="break-all">{fmt(newData[k])}</span>
          </div>
        ))}
      </div>
    );
  }

  // For delete — show old_data only
  if (oldData && !newData) {
    return (
      <div className="text-sm bg-red-50 border border-red-200 rounded-md p-3 space-y-1">
        <p className="font-semibold text-red-700 mb-2">Deleted record</p>
        {allKeys.map(k => (
          <div key={k} className="grid grid-cols-[160px_1fr] gap-2 py-0.5 border-b border-red-100 last:border-0">
            <span className="font-medium text-muted-foreground truncate">{k}</span>
            <span className="break-all">{fmt((oldData as any)[k])}</span>
          </div>
        ))}
      </div>
    );
  }

  // Edit — side-by-side with changed rows highlighted
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div>
        <p className="font-semibold text-red-600 mb-2">Before</p>
        <div className="border border-red-200 rounded-md overflow-hidden">
          {allKeys.map(k => {
            const changed = JSON.stringify(oldData?.[k]) !== JSON.stringify(newData?.[k]);
            return (
              <div key={k} className={`grid grid-cols-[120px_1fr] gap-2 p-2 border-b last:border-0 ${changed ? 'bg-red-50' : ''}`}>
                <span className="font-medium text-muted-foreground text-xs truncate">{k}</span>
                <span className="break-all text-xs">{fmt(oldData?.[k])}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <p className="font-semibold text-green-600 mb-2">After</p>
        <div className="border border-green-200 rounded-md overflow-hidden">
          {allKeys.map(k => {
            const changed = JSON.stringify(oldData?.[k]) !== JSON.stringify(newData?.[k]);
            return (
              <div key={k} className={`grid grid-cols-[120px_1fr] gap-2 p-2 border-b last:border-0 ${changed ? 'bg-green-50' : ''}`}>
                <span className="font-medium text-muted-foreground text-xs truncate">{k}</span>
                <span className="break-all text-xs">{fmt(newData?.[k])}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Inline summary ────────────────────────────────────────────────────────────

function InlineSummary({ log }: { log: UserLog }) {
  const data = log.new_data ?? log.old_data;
  if (!data) return <span className="text-muted-foreground text-xs">—</span>;

  // CSV Upload
  if (log.module === 'CSV Upload') {
    return <span className="text-xs text-muted-foreground">{(data as any).filename} · {(data as any).variants_count} rows</span>;
  }
  // Sync trigger
  if (log.module === 'Sync') {
    return <span className="text-xs text-muted-foreground">Metal types: {((data as any).metal_types ?? []).join(', ')}</span>;
  }
  // Metal Prices edit
  if (log.module === 'Metal Prices' && log.new_data) {
    const keys = Object.keys(log.new_data);
    return <span className="text-xs text-muted-foreground">{keys.map(k => `${k}: ${(log.new_data as any)[k]}`).join(' · ')}</span>;
  }
  // Generic: show first 2 keys of new_data
  const keys = Object.keys(data).slice(0, 2);
  return <span className="text-xs text-muted-foreground">{keys.map(k => `${k}: ${(data as any)[k]}`).join(' · ')}</span>;
}

// ── Page ──────────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 20;

export default function UserActivityLogs() {
  const [logs,       setLogs]       = useState<UserLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: ITEMS_PER_PAGE, totalPages: 1 });
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // filters
  const [filterMeta,  setFilterMeta]  = useState<Filters>({ modules: [], actions: [], users: [] });
  const [search,      setSearch]      = useState('');
  const [selModule,   setSelModule]   = useState('');
  const [selAction,   setSelAction]   = useState('');
  const [selUser,     setSelUser]     = useState('');
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // fetch filter meta once
  useEffect(() => {
    fetch('/api/user-log/filters')
      .then(r => r.json())
      .then(d => setFilterMeta(d))
      .catch(() => {});
  }, []);

  const fetchLogs = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(ITEMS_PER_PAGE),
        ...(search    && { search }),
        ...(selModule && { module: selModule }),
        ...(selAction && { action: selAction }),
        ...(selUser   && { user:   selUser }),
        ...(dateFrom  && { from:   dateFrom }),
        ...(dateTo    && { to:     dateTo }),
      });
      const res  = await fetch(`/api/user-log?${params}`);
      const data = await res.json();
      setLogs(data.data ?? []);
      setPagination(data.pagination ?? { total: 0, page: 1, limit: ITEMS_PER_PAGE, totalPages: 1 });
    } catch {
      setError('Failed to fetch logs. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [search, selModule, selAction, selUser, dateFrom, dateTo]);

  // debounce search; immediate for dropdown changes
  useEffect(() => {
    const t = setTimeout(() => { setCurrentPage(1); fetchLogs(1); }, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search, selModule, selAction, selUser, dateFrom, dateTo]);

  useEffect(() => { fetchLogs(currentPage); }, [currentPage]);

  const hasFilters = selModule || selAction || selUser || dateFrom || dateTo || search;
  const clearAll   = () => {
    setSearch(''); setSelModule(''); setSelAction('');
    setSelUser(''); setDateFrom(''); setDateTo('');
    setCurrentPage(1);
  };

  const selectCls = "h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Activity Logs</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Everything every user has done, in one place.</p>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <X className="h-3.5 w-3.5 mr-1" /> Clear filters
          </Button>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Input
            placeholder="Search module, action, user…"
            className="w-56"
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
          />
          {search && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              onClick={() => { setSearch(''); setCurrentPage(1); }}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <select className={selectCls} value={selModule} onChange={e => { setSelModule(e.target.value); setCurrentPage(1); }}>
          <option value="">All Modules</option>
          {filterMeta.modules.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <select className={selectCls} value={selAction} onChange={e => { setSelAction(e.target.value); setCurrentPage(1); }}>
          <option value="">All Actions</option>
          {filterMeta.actions.map(a => <option key={a} value={a} className="capitalize">{a}</option>)}
        </select>

        <select className={selectCls} value={selUser} onChange={e => { setSelUser(e.target.value); setCurrentPage(1); }}>
          <option value="">All Users</option>
          {filterMeta.users.map(u => <option key={u} value={u}>{u}</option>)}
        </select>

        <input
          type="date"
          className={selectCls}
          value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }}
          title="From date"
        />
        <span className="text-muted-foreground text-sm">to</span>
        <input
          type="date"
          className={selectCls}
          value={dateTo}
          onChange={e => { setDateTo(e.target.value); setCurrentPage(1); }}
          title="To date"
        />
      </div>

      {/* ── Result count ── */}
      {!loading && (
        <p className="text-sm text-muted-foreground">
          {pagination.total} {pagination.total === 1 ? 'entry' : 'entries'}
          {hasFilters ? ' matching filters' : ' total'}
        </p>
      )}

      {/* ── Table ── */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}
        </div>
      ) : error ? (
        <div className="p-4 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
      ) : logs.length === 0 ? (
        <div className="p-10 text-center text-muted-foreground border rounded-md">No activity logs found.</div>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead className="w-48">Time (IST)</TableHead>
                <TableHead className="w-20 text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log, idx) => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground text-xs">
                    {(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}
                  </TableCell>
                  <TableCell>
                    <Badge value={log.module} map={MODULE_BADGE} />
                  </TableCell>
                  <TableCell>
                    <Badge value={log.action} map={ACTION_BADGE} />
                  </TableCell>
                  <TableCell className="text-sm">{log.created_by ?? '—'}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    <InlineSummary log={log} />
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-muted-foreground">
                    {log.created_at ? toIST(log.created_at) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">View</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[90vh]">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Badge value={log.module} map={MODULE_BADGE} />
                            <Badge value={log.action} map={ACTION_BADGE} />
                          </DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="max-h-[70vh] pr-2">
                          <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-1">Performed by</p>
                                <p>{log.created_by ?? '—'}</p>
                              </div>
                              <div>
                                <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-1">Time (IST)</p>
                                <p>{log.created_at ? toIST(log.created_at) : '—'}</p>
                              </div>
                            </div>
                            <div>
                              <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-2">Change Details</p>
                              <DiffViewer oldData={log.old_data} newData={log.new_data} />
                            </div>
                          </div>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Pagination ── */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">
            {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
              Previous
            </Button>
            <span className="text-sm tabular-nums">{currentPage} / {pagination.totalPages}</span>
            <Button variant="outline" size="sm"
              disabled={currentPage >= pagination.totalPages}
              onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
