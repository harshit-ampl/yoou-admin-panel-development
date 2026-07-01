"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, Edit, Edit2, Plus, Trash2, X } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ──────────────────────────────────────────────────────────────────

interface MakingCharge {
  id: number;
  name: string;
  wastage_rate_or_labour_charge: number;
  calculate_wastage_amount_on: "Per Pc" | "Per Gram" | "% Of NetWt";
  status: string;
}

// Editable columns for bulk modal
const EDIT_COLS: { key: keyof MakingCharge; label: string; type: "text" | "number" }[] = [
  { key: "wastage_rate_or_labour_charge", label: "Wastage Rate / Labour Charge", type: "number" },
  { key: "calculate_wastage_amount_on",   label: "Calculate On",                 type: "text"   },
  { key: "status",                        label: "Status",                        type: "text"   },
];

// ── Component ──────────────────────────────────────────────────────────────

export function MakingChargeManager() {
  const { ready, can } = usePermissions();
  const router = useRouter();
  const { clearUser } = useAuth();

  const [rows, setRows]       = useState<MakingCharge[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  // single add/edit dialog (existing behaviour)
  const [addOpen, setAddOpen]     = useState(false);
  const [current, setCurrent]     = useState<Partial<MakingCharge> | null>(null);
  const [isEdit, setIsEdit]       = useState(false);

  // selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // bulk edit modal
  const [editOpen,    setEditOpen]    = useState(false);
  const [editSaving,  setEditSaving]  = useState(false);
  const [editError,   setEditError]   = useState<string | null>(null);
  const [rowChanges,  setRowChanges]  = useState<Record<number, Record<string, string>>>({});
  const [headerFill,  setHeaderFill]  = useState<Record<string, string>>({});

  // delete confirm modal
  const [deleteIds,   setDeleteIds]   = useState<number[] | null>(null);
  const [deleting,    setDeleting]    = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // search / filter
  const [search, setSearch]         = useState("");
  const [filterType, setFilterType] = useState("");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchRows = async () => {
    setLoading(true);
    setFetchErr(null);
    try {
      const res = await axios.get("/api/pricing-codes");
      setRows(res.data.codes ?? []);
    } catch (e: any) {
      setFetchErr(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRows(); }, []);

  // ── Filtered display list ─────────────────────────────────────────────

  const filtered = rows.filter(r => {
    if (filterType && r.calculate_wastage_amount_on !== filterType) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── Selection ────────────────────────────────────────────────────────────

  const allSelected  = filtered.length > 0 && filtered.every(r => selectedIds.has(r.id));
  const someSelected = filtered.some(r => selectedIds.has(r.id));

  const toggleAll = () =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      allSelected ? filtered.forEach(r => next.delete(r.id)) : filtered.forEach(r => next.add(r.id));
      return next;
    });

  const toggleOne = (id: number) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ── Single add/edit ──────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEdit) {
        const res = await axios.put("/api/pricing-codes", { ...current, status: "Active" });
        setRows(prev => prev.map(r => (r.id === res.data.updatedCode.id ? res.data.updatedCode : r)));
        toast.success("Making charge updated successfully");
      } else {
        const res = await axios.post("/api/pricing-codes", { ...current, status: "Active" });
        setRows(prev => [...prev, res.data.newCode]);
        toast.success("Making charge added successfully");
      }
      setIsEdit(false);
      setCurrent(null);
      setAddOpen(false);
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || "Operation failed");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setCurrent(prev => ({ ...prev, [id]: value ?? "" } as Partial<MakingCharge>));
  };

  const handleSingleDelete = async (id: number) => {
    try {
      await axios.delete(`/api/pricing-codes?id=${id}`);
      setRows(prev => prev.filter(r => r.id !== id));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      toast.success("Making charge deleted");
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || "Delete failed");
    }
  };

  // ── Bulk edit ────────────────────────────────────────────────────────────

  const openBulkEdit = () => {
    const targets = rows.filter(r => selectedIds.has(r.id));
    const initial: Record<number, Record<string, string>> = {};
    targets.forEach(r => {
      initial[r.id] = {};
      EDIT_COLS.forEach(c => { initial[r.id][c.key] = String((r as any)[c.key] ?? ""); });
    });
    setRowChanges(initial);
    setHeaderFill({});
    setEditError(null);
    setEditOpen(true);
  };

  const saveBulkEdit = async () => {
    setEditSaving(true);
    setEditError(null);
    try {
      const rowCache: Record<number, MakingCharge> = {};
      rows.forEach(r => { rowCache[r.id] = r; });

      const payload = Object.entries(rowChanges).map(([idStr, cur]) => {
        const id = Number(idStr);
        const orig = rowCache[id];
        const changes: Record<string, string> = {};
        for (const [k, v] of Object.entries(cur)) {
          if (v !== String((orig as any)?.[k] ?? "") && v !== "") changes[k] = v;
        }
        return { id, changes };
      }).filter(r => Object.keys(r.changes).length > 0);

      if (!payload.length) { setEditError("No changes to save."); setEditSaving(false); return; }

      await axios.patch("/api/pricing-codes", { rows: payload });
      setEditOpen(false);
      setSelectedIds(new Set());
      fetchRows();
      toast.success(`${payload.length} making charge${payload.length !== 1 ? "s" : ""} updated`);
    } catch (e: any) {
      setEditError(e.response?.data?.error || e.message || "Save failed");
      toast.error(e.response?.data?.error || e.message || "Save failed");
    } finally {
      setEditSaving(false);
    }
  };

  // ── Bulk delete ──────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteIds?.length) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await axios.delete("/api/pricing-codes", {
        data: { ids: deleteIds },
        headers: { "Content-Type": "application/json" },
      });
      const count = deleteIds.length;
      setRows(prev => prev.filter(r => !deleteIds.includes(r.id)));
      setSelectedIds(prev => {
        const n = new Set(prev);
        deleteIds.forEach(id => n.delete(id));
        return n;
      });
      setDeleteIds(null);
      toast.success(`${count} making charge${count !== 1 ? "s" : ""} deleted`);
    } catch (e: any) {
      setDeleteError(e.response?.data?.error || e.message || "Delete failed");
      toast.error(e.response?.data?.error || e.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  // ── Permission guard ──────────────────────────────────────────────────────

  if (!ready) return null;
  if (!can("Making Charges", "View")) {
    clearUser();
    router.replace("/login");
    return null;
  }

  const deleteNames = deleteIds
    ? rows.filter(r => deleteIds.includes(r.id)).map(r => r.name)
    : [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Making Charges</h2>
          {selectedIds.size > 0 && (
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} selected
              <button className="ml-2 text-xs underline" onClick={() => setSelectedIds(new Set())}>
                clear
              </button>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* search */}
          <div className="relative">
            <Input
              placeholder="Search by code…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-52"
            />
            {search && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setSearch("")}>
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* type filter */}
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="Per Pc">Per Pc</option>
            <option value="Per Gram">Per Gram</option>
            <option value="% Of NetWt">% Of NetWt</option>
          </select>

          {/* bulk actions */}
          {selectedIds.size > 0 && (
            <>
              {can("Making Charges", "Edit") && (
                <Button size="sm" onClick={openBulkEdit}>
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit {selectedIds.size === 1 ? "1 Row" : `${selectedIds.size} Rows`}
                </Button>
              )}
              {can("Making Charges", "Delete") && (
                <Button size="sm" variant="destructive"
                  onClick={() => { setDeleteIds(Array.from(selectedIds)); setDeleteError(null); }}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete {selectedIds.size === 1 ? "1 Row" : `${selectedIds.size} Rows`}
                </Button>
              )}
            </>
          )}

          {/* add */}
          {can("Making Charges", "Add") && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setCurrent(null); setIsEdit(false); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Making Charge
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{isEdit ? "Edit" : "Add"} Making Charge</DialogTitle>
                  <DialogDescription>Enter the details for the making charge configuration.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Code</Label>
                      <Input id="name" placeholder="e.g., SilCert50gm" value={current?.name ?? ""} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wastage_rate_or_labour_charge">Wastage Rate / Labour Charge</Label>
                      <Input id="wastage_rate_or_labour_charge" type="number" step="0.01"
                        value={current?.wastage_rate_or_labour_charge ?? ""} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={current?.calculate_wastage_amount_on}
                        onValueChange={v => setCurrent(p => ({ ...p, calculate_wastage_amount_on: v as any }))}>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Per Pc">Per Pc</SelectItem>
                          <SelectItem value="Per Gram">Per Gram</SelectItem>
                          <SelectItem value="% Of NetWt">% Of NetWt</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">{isEdit ? "Update" : "Add"} Making Charge</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Fetch error */}
      {fetchErr && (
        <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-md">
          <AlertCircle className="h-4 w-4" /> {fetchErr}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  ref={(el: any) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                />
              </TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Wastage Rate / Labour Charge</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              {(can("Making Charges", "Edit") || can("Making Charges", "Delete")) && (
                <TableHead className="text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  No making charges found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(r => (
                <TableRow key={r.id} className={selectedIds.has(r.id) ? "bg-blue-50 dark:bg-blue-950" : ""}>
                  <TableCell>
                    <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleOne(r.id)} />
                  </TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.wastage_rate_or_labour_charge}</TableCell>
                  <TableCell>{r.calculate_wastage_amount_on}</TableCell>
                  <TableCell>{r.status}</TableCell>
                  {(can("Making Charges", "Edit") || can("Making Charges", "Delete")) && (
                    <TableCell className="text-right space-x-1">
                      {can("Making Charges", "Edit") && (
                        <Button variant="ghost" size="icon"
                          onClick={() => { setCurrent(r); setIsEdit(true); setAddOpen(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {can("Making Charges", "Delete") && (
                        <Button variant="ghost" size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => { setDeleteIds([r.id]); setDeleteError(null); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Delete confirm modal ── */}
      <Dialog open={deleteIds !== null} onOpenChange={open => { if (!open) setDeleteIds(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Delete {deleteIds?.length === 1 ? "1 Row" : `${deleteIds?.length} Rows`}?
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              This will permanently delete the following making charge{deleteNames.length !== 1 ? "s" : ""}. This cannot be undone.
            </p>
            <ul className="text-sm font-mono bg-muted rounded-md p-3 space-y-1 max-h-48 overflow-y-auto">
              {deleteNames.map((n, i) => <li key={i}>• {n}</li>)}
            </ul>
            {deleteError && (
              <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-md">
                <AlertCircle className="h-4 w-4" /> {deleteError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteIds(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : `Delete ${deleteIds?.length === 1 ? "Row" : `${deleteIds?.length} Rows`}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk edit modal ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-[92vw] w-full h-[82vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle>Edit {Object.keys(rowChanges).length} Making Charge{Object.keys(rowChanges).length !== 1 ? "s" : ""}</DialogTitle>
            <p className="text-sm text-muted-foreground">Only changed cells are saved.</p>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            <table className="text-sm border-collapse" style={{ minWidth: "max-content", width: "100%" }}>
              <thead className="sticky top-0 z-10 bg-background shadow-[0_1px_0_0_hsl(var(--border))]">
                <tr>
                  <th className="sticky left-0 z-20 bg-background text-left px-4 py-2 font-semibold text-xs uppercase tracking-wide text-muted-foreground border-r min-w-[180px]">
                    Code
                  </th>
                  {EDIT_COLS.map(c => (
                    <th key={c.key} className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide text-muted-foreground min-w-[200px]">
                      {c.label}
                    </th>
                  ))}
                </tr>
                {/* Fill-all row */}
                <tr className="bg-yellow-50 dark:bg-yellow-950/30 border-b border-yellow-200 dark:border-yellow-800">
                  <th className="sticky left-0 z-20 bg-yellow-50 dark:bg-yellow-950/30 px-4 py-1 text-xs text-yellow-700 dark:text-yellow-400 font-medium border-r whitespace-nowrap">
                    Fill all ↓
                  </th>
                  {EDIT_COLS.map(c => (
                    <th key={c.key} className="px-1.5 py-1 min-w-[200px]">
                      <Input
                        type={c.type}
                        placeholder="—"
                        className="h-6 text-xs px-2 w-full bg-white dark:bg-yellow-950/50 border-yellow-300 dark:border-yellow-700"
                        value={headerFill[c.key] ?? ""}
                        onChange={e => {
                          const val = e.target.value;
                          setHeaderFill(prev => ({ ...prev, [c.key]: val }));
                          setRowChanges(prev => {
                            const next: typeof prev = {};
                            for (const [id, row] of Object.entries(prev)) {
                              next[Number(id)] = { ...row, [c.key]: val };
                            }
                            return next;
                          });
                        }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.keys(rowChanges).map(Number).map((id, i) => {
                  const r = rows.find(x => x.id === id);
                  if (!r) return null;
                  return (
                    <tr key={id} className={`border-b ${i % 2 === 0 ? "bg-background" : "bg-muted/20"} hover:bg-muted/40`}>
                      <td className="sticky left-0 z-10 bg-inherit px-4 py-1.5 font-mono text-xs border-r">
                        <div className="truncate max-w-[175px]" title={r.name}>{r.name}</div>
                      </td>
                      {EDIT_COLS.map(c => (
                        <td key={c.key} className="px-1.5 py-1 min-w-[200px]">
                          <Input
                            type={c.type}
                            className="h-7 text-xs px-2 w-full"
                            value={rowChanges[id]?.[c.key] ?? ""}
                            onChange={e =>
                              setRowChanges(prev => ({
                                ...prev,
                                [id]: { ...prev[id], [c.key]: e.target.value },
                              }))
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {editError && (
            <div className="px-6 py-2 border-t shrink-0">
              <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-md">
                <AlertCircle className="h-4 w-4" /> {editError}
              </div>
            </div>
          )}

          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>Cancel</Button>
            <Button onClick={saveBulkEdit} disabled={editSaving}>
              {editSaving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
