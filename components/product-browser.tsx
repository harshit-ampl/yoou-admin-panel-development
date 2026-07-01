"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Download,
  Edit2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { PriceBreakdownModal } from "./price-breakdown-modal";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Variant {
  id: number;
  sku: string;
  variant_id: string;
  net_wt: number;
  purity: number;
  making_charges_code: string;
  discount_percentage_on_making_charge: string;
  discount_percentage_on_stone: string;
  markup: string;
  stone_count: number;
  other_stone_charges: number;
  silver_weight: number;
  silver_purity: number;
  platinum_weight: number;
  platinum_purity: number;
  current_price: number;
  last_price: number;
  shopify_variant_id: string;
  collections: string;
  metal_type: "gold" | "silver" | "platinum" | "dual" | "unknown";
}

type MetalFilter = "all" | "gold" | "silver" | "platinum" | "dual" | "no_price";
type EditChanges = Partial<Record<keyof Variant, string | number>>;

// ─── Constants ───────────────────────────────────────────────────────────────

const GOLD_PURITIES = [
  { label: "All Gold", value: "all" },
  { label: "24K (99.5%)", value: "99.50" },
  { label: "22K (92%)", value: "92.00" },
  { label: "18K (75%)", value: "75.00" },
  { label: "14K (58.3%)", value: "58.30" },
];

const METAL_BADGE: Record<string, string> = {
  gold:     "bg-yellow-100 text-yellow-800 border-yellow-300",
  silver:   "bg-gray-100   text-gray-700   border-gray-300",
  platinum: "bg-blue-100   text-blue-800   border-blue-300",
  dual:     "bg-purple-100 text-purple-800 border-purple-300",
  unknown:  "bg-red-100    text-red-700    border-red-300",
};

// Excel-table edit columns — labels match sample CSV column names exactly
const EDIT_COLS: { key: string; label: string; type: "text" | "number"; w: string }[] = [
  { key: "net_wt",                               label: "net_wt",                               type: "number", w: "min-w-[88px]"  },
  { key: "purity",                               label: "purity",                               type: "number", w: "min-w-[80px]"  },
  { key: "making_charges_code",                  label: "making_charges_code",                  type: "text",   w: "min-w-[140px]" },
  { key: "discount_percentage_on_making_charge", label: "discount_percentage_on_making_charge", type: "text",   w: "min-w-[200px]" },
  { key: "discount_percentage_on_stone",         label: "discount_percentage_on_stone",         type: "text",   w: "min-w-[180px]" },
  { key: "markup",                               label: "markup",                               type: "text",   w: "min-w-[80px]"  },
  { key: "stone_count",                          label: "stone_count",                          type: "number", w: "min-w-[96px]"  },
  { key: "other_stone_charges",                  label: "other_stone_charges",                  type: "number", w: "min-w-[140px]" },
  { key: "silver_weight",                        label: "silver_weight",                        type: "number", w: "min-w-[104px]" },
  { key: "silver_purity",                        label: "silver_purity",                        type: "number", w: "min-w-[104px]" },
  { key: "platinum_weight",                      label: "platinum_weight",                      type: "number", w: "min-w-[120px]" },
  { key: "platinum_purity",                      label: "platinum_purity",                      type: "number", w: "min-w-[116px]" },
  { key: "collections",                          label: "collections",                          type: "text",   w: "min-w-[140px]" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n > 0 ? `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—";
}

function purityLabel(v: Variant) {
  if (v.metal_type === "gold")
    return `${v.purity}%`;
  if (v.metal_type === "silver")
    return `${v.silver_purity || 999}`;
  if (v.metal_type === "platinum")
    return `${v.platinum_purity || 95}%`;
  const parts: string[] = [];
  if (v.purity > 0)        parts.push(`Au ${v.purity}%`);
  if (v.silver_weight > 0) parts.push(`Ag`);
  if (v.platinum_weight > 0) parts.push(`Pt`);
  return parts.join(" + ") || "—";
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ProductBrowser() {
  // filters
  const [metal,  setMetal]  = useState<MetalFilter>("all");
  const [purity, setPurity] = useState("");
  const [search, setSearch] = useState("");
  const [sort,   setSort]   = useState("sku");
  const [order,  setOrder]  = useState<"asc" | "desc">("asc");

  // data
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantCache, setVariantCache] = useState<Record<number, Variant>>({});
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 100, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // edit modal
  const [editOpen,   setEditOpen]   = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError,  setEditError]  = useState<string | null>(null);
  const [rowChanges, setRowChanges] = useState<Record<number, Record<string, string>>>({});
  const [headerFill, setHeaderFill] = useState<Record<string, string>>({});

  // breakdown modal
  const [breakdownId, setBreakdownId] = useState<number | null>(null);

  // delete modal
  const [deleteIds,    setDeleteIds]    = useState<number[] | null>(null);
  const [deleteSkus,   setDeleteSkus]   = useState<string[]>([]);
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState<string | null>(null);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchVariants = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page:   String(page),
        limit:  "100",
        metal,
        purity: metal === "gold" && purity !== "all" ? purity : "",
        search,
        sort,
        order,
      });
      const res  = await fetch(`/api/product-variants?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Error ${res.status}`);
        return;
      }
      const rows: Variant[] = data.data || [];
      setVariants(rows);
      setPagination(data.pagination || { total: 0, page: 1, limit: 100, totalPages: 1 });
      setVariantCache(prev => {
        const next = { ...prev };
        rows.forEach(v => { next[v.id] = v; });
        return next;
      });
    } catch (err) {
      setError(`Failed to load products: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [metal, purity, search, sort, order]);

  // Re-fetch whenever filters change (search with 300 ms debounce)
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => fetchVariants(1), 300);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [fetchVariants]);

  // Clear purity when switching away from gold
  useEffect(() => {
    if (metal !== "gold") setPurity("");
  }, [metal]);

  // ─── Selection ───────────────────────────────────────────────────────────

  const allPageSelected = variants.length > 0 && variants.every(v => selectedIds.has(v.id));
  const somePageSelected = variants.some(v => selectedIds.has(v.id));

  const toggleAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allPageSelected) {
        variants.forEach(v => next.delete(v.id));
      } else {
        variants.forEach(v => next.add(v.id));
      }
      return next;
    });
  };

  const toggleOne = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // ─── Sort ────────────────────────────────────────────────────────────────

  const handleSort = (col: string) => {
    if (sort === col) {
      setOrder(o => (o === "asc" ? "desc" : "asc"));
    } else {
      setSort(col);
      setOrder("asc");
    }
  };

  // ─── Edit ────────────────────────────────────────────────────────────────

  const selectedVariants = Array.from(selectedIds)
    .map(id => variantCache[id])
    .filter((v): v is Variant => Boolean(v));

  const openEdit = (targets?: Variant[]) => {
    const vars = targets ?? selectedVariants;
    const initial: Record<number, Record<string, string>> = {};
    vars.forEach(v => {
      initial[v.id] = {};
      EDIT_COLS.forEach(c => {
        initial[v.id][c.key] = String((v as any)[c.key] ?? "");
      });
    });
    setRowChanges(initial);
    setHeaderFill({});
    setEditError(null);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    setEditSaving(true);
    setEditError(null);
    try {
      const rows = Object.entries(rowChanges).map(([idStr, current]) => {
        const id = Number(idStr);
        const orig = variantCache[id];
        const changes: Record<string, string> = {};
        for (const [k, val] of Object.entries(current)) {
          const origVal = String((orig as any)?.[k] ?? "");
          if (val !== origVal && val !== "") changes[k] = val;
        }
        return { id, changes };
      }).filter(r => Object.keys(r.changes).length > 0);

      if (!rows.length) {
        setEditError("No changes to save.");
        setEditSaving(false);
        return;
      }

      const res = await fetch("/api/product-variants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      setEditOpen(false);
      fetchVariants(pagination.page);
      toast.success(`${rows.length} product${rows.length !== 1 ? "s" : ""} updated successfully`);
    } catch (e: any) {
      setEditError(e.message || "Failed to save changes.");
      toast.error(e.message || "Failed to save changes.");
    } finally {
      setEditSaving(false);
    }
  };

  // ─── Delete ──────────────────────────────────────────────────────────────

  const openDelete = (ids: number[]) => {
    const skus = variants.filter(v => ids.includes(v.id)).map(v => v.sku || `ID ${v.id}`);
    setDeleteIds(ids);
    setDeleteSkus(skus);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!deleteIds?.length) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const count = deleteIds.length;
      const res  = await fetch("/api/product-variants", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ids: deleteIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setDeleteIds(null);
      setSelectedIds(prev => {
        const next = new Set(prev);
        deleteIds.forEach(id => next.delete(id));
        return next;
      });
      fetchVariants(pagination.page);
      toast.success(`${count} product${count !== 1 ? "s" : ""} deleted successfully`);
    } catch (e: any) {
      setDeleteError(e.message || "Failed to delete.");
      toast.error(e.message || "Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  // ─── Export ──────────────────────────────────────────────────────────────

  const exportCSV = () => {
    const hasSelection = selectedIds.size > 0;
    const params = new URLSearchParams();
    if (hasSelection) {
      params.set("ids", Array.from(selectedIds).join(","));
    } else {
      params.set("metal", metal);
      if (metal === "gold" && purity) params.set("purity", purity);
      if (search) params.set("search", search);
    }
    window.open(`/api/product-variants/export?${params}`, "_blank");
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
        <Select value={metal} onValueChange={(v) => { setMetal(v as MetalFilter); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Metal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Metals</SelectItem>
            <SelectItem value="gold">🥇 Gold</SelectItem>
            <SelectItem value="silver">⚪ Silver</SelectItem>
            <SelectItem value="platinum">💎 Platinum</SelectItem>
            <SelectItem value="dual">🔗 Dual Metal</SelectItem>
            <SelectItem value="no_price">⚠️ No Price Set</SelectItem>
          </SelectContent>
        </Select>

        {metal === "gold" && (
          <Select value={purity || "all"} onValueChange={v => { setPurity(v); }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Gold" />
            </SelectTrigger>
            <SelectContent>
              {GOLD_PURITIES.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex items-center gap-2 flex-1 min-w-48">
          <Input
            placeholder="Search by SKU…"
            value={search}
            onChange={e => { setSearch(e.target.value); }}
            className="max-w-xs"
          />
          {search && (
            <Button variant="ghost" size="icon" onClick={() => setSearch("")}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Button variant="outline" size="icon" onClick={() => fetchVariants(pagination.page)} title="Refresh">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* ── Action bar ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {pagination.total.toLocaleString()} products
            {selectedIds.size > 0 && (
              <span className="ml-2 font-medium text-foreground">
                · {selectedIds.size} selected
              </span>
            )}
          </span>
          {selectedIds.size > 0 && (
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="h-3 w-3 mr-1" /> Clear selection
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <Button variant="default" size="sm" onClick={() => openEdit()}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit {selectedIds.size === 1 ? "Product" : `${selectedIds.size} Products`}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => openDelete(Array.from(selectedIds))}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete {selectedIds.size === 1 ? "Product" : `${selectedIds.size} Products`}
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            {selectedIds.size > 0 ? `Export ${selectedIds.size} Selected` : "Export CSV"}
          </Button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-md">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* ── Table ── */}
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allPageSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all on page"
                  ref={(el) => {
                    if (el) (el as any).indeterminate = somePageSelected && !allPageSelected;
                  }}
                />
              </TableHead>
              {[
                { key: "sku",   label: "SKU"      },
                { key: null,    label: "Metal"    },
                { key: null,    label: "Purity"   },
                { key: "net_wt",label: "Net Wt (g)"},
                { key: null,    label: "Making Code"},
                { key: null,    label: "Discount (Making)" },
                { key: null,    label: "Discount (Stone)"  },
                { key: "price", label: "Last Price"    },
                { key: "price", label: "Current Price" },
                { key: null,    label: ""              },
              ].map(({ key, label }) => (
                <TableHead
                  key={label}
                  className={key ? "cursor-pointer select-none hover:bg-muted/50" : ""}
                  onClick={key ? () => handleSort(key) : undefined}
                >
                  {label}
                  {sort === key && (order === "asc" ? " ↑" : " ↓")}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 10 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : variants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              variants.map(v => (
                <TableRow
                  key={v.id}
                  className={`${selectedIds.has(v.id) ? "bg-blue-50 dark:bg-blue-950" : ""} ${v.current_price === 0 ? "opacity-70" : ""}`}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(v.id)}
                      onCheckedChange={() => toggleOne(v.id)}
                    />
                  </TableCell>
                  <TableCell
                    className="font-mono text-sm font-medium cursor-pointer hover:underline text-primary"
                    onClick={() => openEdit([v])}
                    title="Click to edit"
                  >{v.sku || `ID ${v.id}`}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${METAL_BADGE[v.metal_type]}`}>
                      {v.metal_type}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{purityLabel(v)}</TableCell>
                  <TableCell className="text-sm">{v.net_wt > 0 ? v.net_wt : "—"}</TableCell>
                  <TableCell className="text-sm">{v.making_charges_code || "—"}</TableCell>
                  <TableCell className="text-sm">
                    {v.discount_percentage_on_making_charge && v.discount_percentage_on_making_charge !== "0" ? v.discount_percentage_on_making_charge : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {v.discount_percentage_on_stone && v.discount_percentage_on_stone !== "0" ? v.discount_percentage_on_stone : "—"}
                  </TableCell>
                  <TableCell
                    className="text-sm text-muted-foreground cursor-pointer hover:underline"
                    onClick={() => setBreakdownId(v.id)}
                    title="Click to see price breakdown"
                  >
                    {v.last_price > 0 ? fmt(v.last_price) : "—"}
                  </TableCell>
                  <TableCell
                    className={`text-sm font-medium cursor-pointer hover:underline ${v.current_price === 0 ? "text-red-500" : ""}`}
                    onClick={() => setBreakdownId(v.id)}
                    title="Click to see price breakdown"
                  >
                    {v.current_price === 0 ? (
                      <span className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> No price
                      </span>
                    ) : fmt(v.current_price)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => openDelete([v.id])}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Pagination ── */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {((pagination.page - 1) * pagination.limit) + 1}–
          {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            disabled={pagination.page <= 1 || loading}
            onClick={() => fetchVariants(pagination.page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <span className="px-2">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline" size="sm"
            disabled={pagination.page >= pagination.totalPages || loading}
            onClick={() => fetchVariants(pagination.page + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Delete Confirm Modal ── */}
      <Dialog open={deleteIds !== null} onOpenChange={open => { if (!open) setDeleteIds(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Delete {deleteIds?.length === 1 ? "Product" : `${deleteIds?.length} Products`}?
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              This will permanently delete the following from your database. This cannot be undone.
            </p>
            {deleteSkus.length <= 10 ? (
              <ul className="text-sm font-mono bg-muted rounded-md p-3 space-y-1 max-h-48 overflow-y-auto">
                {deleteSkus.map((sku, i) => <li key={i} className="truncate">• {sku}</li>)}
              </ul>
            ) : (
              <p className="text-sm font-medium">{deleteSkus.length} products selected</p>
            )}
            {deleteError && (
              <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-md">
                <AlertCircle className="h-4 w-4" /> {deleteError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteIds(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : `Delete ${deleteIds?.length === 1 ? "Product" : `${deleteIds?.length} Products`}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Price Breakdown Modal ── */}
      <PriceBreakdownModal
        variantId={breakdownId}
        onClose={() => setBreakdownId(null)}
      />

      {/* ── Edit Modal ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-[96vw] w-full h-[88vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle>Edit {Object.keys(rowChanges).length} Product{Object.keys(rowChanges).length !== 1 ? "s" : ""}</DialogTitle>
            <p className="text-sm text-muted-foreground">Edit fields per row. Only changed cells are saved.</p>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            <table className="text-sm border-collapse" style={{ minWidth: "max-content", width: "100%" }}>
              <thead className="sticky top-0 z-10 bg-background shadow-[0_1px_0_0_hsl(var(--border))]">
                {/* Column labels */}
                <tr>
                  <th className="sticky left-0 z-20 bg-background text-left px-4 py-2 font-semibold text-xs uppercase tracking-wide text-muted-foreground border-r min-w-[160px]">
                    SKU
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide text-muted-foreground min-w-[72px]">
                    Metal
                  </th>
                  {EDIT_COLS.map(c => (
                    <th key={c.key} className={`text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide text-muted-foreground ${c.w}`}>
                      {c.label}
                    </th>
                  ))}
                </tr>
                {/* Fill-all row — typing here fills every product's cell in that column */}
                <tr className="bg-yellow-50 dark:bg-yellow-950/30 border-b border-yellow-200 dark:border-yellow-800">
                  <th className="sticky left-0 z-20 bg-yellow-50 dark:bg-yellow-950/30 px-4 py-1 text-xs text-yellow-700 dark:text-yellow-400 font-medium border-r whitespace-nowrap">
                    Fill all ↓
                  </th>
                  <th className="px-3 py-1" />
                  {EDIT_COLS.map(c => (
                    <th key={c.key} className={`px-1.5 py-1 ${c.w}`}>
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
                  const v = variantCache[id];
                  if (!v) return null;
                  return (
                  <tr key={v.id} className={`border-b ${i % 2 === 0 ? "bg-background" : "bg-muted/20"} hover:bg-muted/40`}>
                    <td className="sticky left-0 z-10 bg-inherit px-4 py-1.5 font-mono text-xs border-r">
                      <div className="truncate max-w-[155px]" title={v.sku}>{v.sku || `ID ${v.id}`}</div>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border whitespace-nowrap ${METAL_BADGE[v.metal_type]}`}>
                        {v.metal_type}
                      </span>
                    </td>
                    {EDIT_COLS.map(c => (
                      <td key={c.key} className="px-1.5 py-1">
                        <Input
                          type={c.type}
                          className="h-7 text-xs px-2 w-full"
                          value={rowChanges[v.id]?.[c.key] ?? ""}
                          onChange={e =>
                            setRowChanges(prev => ({
                              ...prev,
                              [v.id]: { ...prev[v.id], [c.key]: e.target.value },
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
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={editSaving}>
              {editSaving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
