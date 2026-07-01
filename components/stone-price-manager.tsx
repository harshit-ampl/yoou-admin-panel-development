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

interface StonePrice {
  id: number;
  sr_no: number;
  item_name: string;
  d_color_code: string;
  size_id: string;
  new_selling_rates: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

// Editable columns for bulk modal
const EDIT_COLS: { key: keyof StonePrice; label: string; type: "text" | "number" }[] = [
  { key: "sr_no",             label: "Sr No",             type: "number" },
  { key: "item_name",         label: "Item Name",         type: "text"   },
  { key: "d_color_code",      label: "D Color Code",      type: "text"   },
  { key: "size_id",           label: "Size ID",           type: "text"   },
  { key: "new_selling_rates", label: "New Selling Rates", type: "number" },
];

// ── Component ──────────────────────────────────────────────────────────────

export function StonePriceManager() {
  const { ready, can } = usePermissions();
  const router = useRouter();
  const { clearUser } = useAuth();

  const [rows, setRows]         = useState<StonePrice[]>([]);
  const [loading, setLoading]   = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  // single add/edit dialog
  const [addOpen, setAddOpen]   = useState(false);
  const [current, setCurrent]   = useState<Partial<StonePrice> | null>(null);
  const [isEdit, setIsEdit]     = useState(false);

  // selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // bulk edit
  const [editOpen,   setEditOpen]   = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError,  setEditError]  = useState<string | null>(null);
  const [rowChanges, setRowChanges] = useState<Record<number, Record<string, string>>>({});
  const [headerFill, setHeaderFill] = useState<Record<string, string>>({});

  // delete confirm
  const [deleteIds,   setDeleteIds]   = useState<number[] | null>(null);
  const [deleting,    setDeleting]    = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // search / filter
  const [search, setSearch]           = useState("");
  const [filterItem, setFilterItem]   = useState("");
  const [filterColor, setFilterColor] = useState("");

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchRows = async () => {
    setLoading(true);
    setFetchErr(null);
    try {
      const res = await axios.get("/api/stone-prices");
      setRows(res.data.stones ?? []);
    } catch (e: any) {
      setFetchErr(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRows(); }, []);

  // ── Derived filter lists ──────────────────────────────────────────────────

  const itemNames   = Array.from(new Set(rows.map(r => r.item_name))).sort();
  const colorCodes  = Array.from(new Set(rows.map(r => r.d_color_code))).sort();

  const filtered = rows.filter(r => {
    if (filterItem  && r.item_name    !== filterItem)   return false;
    if (filterColor && r.d_color_code !== filterColor)  return false;
    if (search && !r.d_color_code.toLowerCase().includes(search.toLowerCase())
               && !r.size_id.toLowerCase().includes(search.toLowerCase())
               && !r.item_name.toLowerCase().includes(search.toLowerCase())) return false;
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
        const res = await axios.put("/api/stone-prices", { ...current });
        setRows(prev => prev.map(r => (r.id === res.data.updatedStone.id ? res.data.updatedStone : r)));
        toast.success("Stone price updated successfully");
      } else {
        const res = await axios.post("/api/stone-prices", { ...current });
        setRows(prev => [...prev, res.data.newStone]);
        toast.success("Stone price added successfully");
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
    setCurrent(prev => ({ ...prev, [id]: value ?? "" } as Partial<StonePrice>));
  };

  const handleSingleDelete = async (id: number) => {
    try {
      await axios.delete(`/api/stone-prices?id=${id}`);
      setRows(prev => prev.filter(r => r.id !== id));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      toast.success("Stone price deleted");
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
      const rowCache: Record<number, StonePrice> = {};
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

      await axios.patch("/api/stone-prices", { rows: payload });
      setEditOpen(false);
      setSelectedIds(new Set());
      fetchRows();
      toast.success(`${payload.length} stone price${payload.length !== 1 ? "s" : ""} updated`);
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
      await axios.delete("/api/stone-prices", {
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
      toast.success(`${count} stone price${count !== 1 ? "s" : ""} deleted`);
    } catch (e: any) {
      setDeleteError(e.response?.data?.error || e.message || "Delete failed");
      toast.error(e.response?.data?.error || e.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  // ── Permission guard ──────────────────────────────────────────────────────

  if (!ready) return null;
  if (!can("Stone Prices", "View")) {
    clearUser();
    router.replace("/login");
    return null;
  }

  const deleteLabels = deleteIds
    ? rows.filter(r => deleteIds.includes(r.id)).map(r => `${r.item_name} · ${r.d_color_code} · ${r.size_id}`)
    : [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Stone Prices</h2>
          {selectedIds.size > 0 && (
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} selected
              <button className="ml-2 text-xs underline" onClick={() => setSelectedIds(new Set())}>clear</button>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* filters */}
          <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-44" />
          {search && (
            <button onClick={() => setSearch("")} className="text-muted-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={filterItem}
            onChange={e => setFilterItem(e.target.value)}
          >
            <option value="">All Items</option>
            {itemNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>

          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={filterColor}
            onChange={e => setFilterColor(e.target.value)}
          >
            <option value="">All Colors</option>
            {colorCodes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* bulk actions */}
          {selectedIds.size > 0 && (
            <>
              {can("Stone Prices", "Edit") && (
                <Button size="sm" onClick={openBulkEdit}>
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit {selectedIds.size === 1 ? "1 Row" : `${selectedIds.size} Rows`}
                </Button>
              )}
              {can("Stone Prices", "Delete") && (
                <Button size="sm" variant="destructive"
                  onClick={() => { setDeleteIds(Array.from(selectedIds)); setDeleteError(null); }}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete {selectedIds.size === 1 ? "1 Row" : `${selectedIds.size} Rows`}
                </Button>
              )}
            </>
          )}

          {/* add */}
          {can("Stone Prices", "Add") && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setCurrent(null); setIsEdit(false); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Stone Price
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{isEdit ? "Edit" : "Add"} Stone Price</DialogTitle>
                  <DialogDescription>Enter the details for the stone price configuration.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sr_no">Sr No</Label>
                      <Input id="sr_no" type="number" value={current?.sr_no ?? ""} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="item_name">Item Name</Label>
                      <Input id="item_name" value={current?.item_name ?? ""} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="d_color_code">D Color Code</Label>
                      <Input id="d_color_code" value={current?.d_color_code ?? ""} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="size_id">Size ID</Label>
                      <Input id="size_id" value={current?.size_id ?? ""} onChange={handleInputChange} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new_selling_rates">New Selling Rates</Label>
                    <Input id="new_selling_rates" type="number" value={current?.new_selling_rates ?? ""} onChange={handleInputChange} />
                  </div>
                  <DialogFooter>
                    <Button type="submit">{isEdit ? "Update" : "Add"} Stone Price</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* count */}
      <p className="text-sm text-muted-foreground">
        {filtered.length} of {rows.length} rows
        {(filterItem || filterColor || search) && (
          <button className="ml-2 text-xs underline" onClick={() => { setFilterItem(""); setFilterColor(""); setSearch(""); }}>
            clear filters
          </button>
        )}
      </p>

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
              <TableHead>Sr No</TableHead>
              <TableHead>Item Name</TableHead>
              <TableHead>D Color Code</TableHead>
              <TableHead>Size ID</TableHead>
              <TableHead>New Selling Rate</TableHead>
              {(can("Stone Prices", "Edit") || can("Stone Prices", "Delete")) && (
                <TableHead className="text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  No stone prices found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(r => (
                <TableRow key={r.id} className={selectedIds.has(r.id) ? "bg-blue-50 dark:bg-blue-950" : ""}>
                  <TableCell>
                    <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleOne(r.id)} />
                  </TableCell>
                  <TableCell className="font-medium">{r.sr_no}</TableCell>
                  <TableCell>{r.item_name}</TableCell>
                  <TableCell>{r.d_color_code}</TableCell>
                  <TableCell>{r.size_id}</TableCell>
                  <TableCell>{fmt(r.new_selling_rates)}</TableCell>
                  {(can("Stone Prices", "Edit") || can("Stone Prices", "Delete")) && (
                    <TableCell className="text-right space-x-1">
                      {can("Stone Prices", "Edit") && (
                        <Button variant="ghost" size="icon"
                          onClick={() => { setCurrent(r); setIsEdit(true); setAddOpen(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {can("Stone Prices", "Delete") && (
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
              This will permanently delete the following stone price{deleteLabels.length !== 1 ? "s" : ""}. This cannot be undone.
            </p>
            {deleteLabels.length <= 10 ? (
              <ul className="text-sm font-mono bg-muted rounded-md p-3 space-y-1 max-h-48 overflow-y-auto">
                {deleteLabels.map((l, i) => <li key={i}>• {l}</li>)}
              </ul>
            ) : (
              <p className="text-sm font-medium">{deleteLabels.length} rows selected</p>
            )}
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
            <DialogTitle>Edit {Object.keys(rowChanges).length} Stone Price{Object.keys(rowChanges).length !== 1 ? "s" : ""}</DialogTitle>
            <p className="text-sm text-muted-foreground">Only changed cells are saved.</p>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            <table className="text-sm border-collapse" style={{ minWidth: "max-content", width: "100%" }}>
              <thead className="sticky top-0 z-10 bg-background shadow-[0_1px_0_0_hsl(var(--border))]">
                <tr>
                  <th className="sticky left-0 z-20 bg-background text-left px-4 py-2 font-semibold text-xs uppercase tracking-wide text-muted-foreground border-r min-w-[120px]">
                    ID
                  </th>
                  {EDIT_COLS.map(c => (
                    <th key={c.key} className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide text-muted-foreground min-w-[160px]">
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
                    <th key={c.key} className="px-1.5 py-1 min-w-[160px]">
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
                        <div className="truncate max-w-[115px]" title={`${r.item_name} ${r.d_color_code} ${r.size_id}`}>
                          {r.item_name} · {r.d_color_code} · {r.size_id}
                        </div>
                      </td>
                      {EDIT_COLS.map(c => (
                        <td key={c.key} className="px-1.5 py-1 min-w-[160px]">
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
