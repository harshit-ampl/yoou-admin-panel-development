"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import toast from "react-hot-toast";
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
import { AlertCircle, Edit, Edit2, KeyRound, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import axios from "axios";
import { usePermissions } from "@/hooks/usePermissions";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ──────────────────────────────────────────────────────────────────

interface MetalPrice {
  id: number;
  open_date: Date;
  datetime: Date;
  metal_type: string;
  sale_rate: number;
  purity: number;
  exchange_rate: number;
  purity_description: string;
  purity_percentage: number;
  urd_rate: number;
  ecommerce_description?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const METAL_TYPE_LABEL: Record<string, string> = {
  gold: "Gold",
  silver: "Silver",
  platinum: "Platinum",
};

const METAL_BADGE: Record<string, string> = {
  gold:     "bg-yellow-100 text-yellow-800 border-yellow-300",
  silver:   "bg-gray-100   text-gray-700   border-gray-300",
  platinum: "bg-blue-100   text-blue-800   border-blue-300",
};

// Editable columns for bulk modal
const EDIT_COLS: { key: keyof MetalPrice; label: string; type: "text" | "number" }[] = [
  { key: "ecommerce_description", label: "Name",               type: "text"   },
  { key: "metal_type",            label: "Metal Type",         type: "text"   },
  { key: "purity_description",    label: "Description",        type: "text"   },
  { key: "purity_percentage",     label: "Purity %",           type: "number" },
  { key: "purity",                label: "Purity Value",       type: "number" },
  { key: "sale_rate",             label: "Price",              type: "number" },
  { key: "urd_rate",              label: "URD Rate",           type: "number" },
];

// ── Component ──────────────────────────────────────────────────────────────

export function MetalPriceManager() {
  const { ready, can } = usePermissions();
  const router = useRouter();
  const { clearUser } = useAuth();

  const [rows, setRows]         = useState<MetalPrice[]>([]);
  const [loading, setLoading]   = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  // sync
  const [syncLoading, setSyncLoading] = useState(false);
  const [jobRunning,  setJobRunning]  = useState(false);

  // single add/edit dialog
  const [addOpen,   setAddOpen]   = useState(false);
  const [current,   setCurrent]   = useState<Partial<MetalPrice> | null>(null);
  const [isEdit,    setIsEdit]    = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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

  // OTP gate
  type OtpStep = "idle" | "sending" | "waiting" | "verifying";
  const [otpStep,      setOtpStep]      = useState<OtpStep>("idle");
  const [otpSessionId, setOtpSessionId] = useState("");
  const [otpValue,     setOtpValue]     = useState("");
  const [otpError,     setOtpError]     = useState<string | null>(null);
  const [otpCountdown, setOtpCountdown] = useState(240);
  const [otpLocked,    setOtpLocked]    = useState(false);
  const pendingAction  = useRef<(() => void) | null>(null);
  const countdownRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  // Timestamp (ms) until which a verified OTP session is still valid
  const otpValidUntil  = useRef<number>(0);

  const clearCountdown = () => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  };

  const startCountdown = () => {
    clearCountdown();
    setOtpCountdown(240);
    countdownRef.current = setInterval(() => {
      setOtpCountdown(prev => {
        if (prev <= 1) {
          clearCountdown();
          setOtpStep("idle");
          setOtpError("OTP expired. Please request a new one.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resetOtp = useCallback(() => {
    clearCountdown();
    setOtpStep("idle");
    setOtpSessionId("");
    setOtpValue("");
    setOtpError(null);
    setOtpCountdown(240);
    setOtpLocked(false);
    pendingAction.current = null;
  }, []);

  // Call this instead of directly opening any edit modal.
  // If OTP was verified within the last 10 minutes, skip the prompt.
  const withOtp = useCallback(async (action: () => void) => {
    if (Date.now() < otpValidUntil.current) {
      action();
      return;
    }
    pendingAction.current = action;
    setOtpValue("");
    setOtpError(null);
    setOtpLocked(false);
    // Show a loading indicator without opening the modal yet
    setOtpStep("sending");
    try {
      const res = await axios.post("/api/metal-prices/otp");
      setOtpSessionId(res.data.sessionId);
      setOtpStep("waiting");
      startCountdown();
    } catch (e: any) {
      const msg: string = e.response?.data?.error || e.message || "Failed to send OTP";
      setOtpStep("idle");
      toast.error(msg);
    }
  }, []);

  const verifyOtp = async () => {
    if (!otpValue || otpValue.length !== 6) {
      setOtpError("Enter the 6-digit OTP.");
      return;
    }
    setOtpStep("verifying");
    setOtpError(null);
    try {
      await axios.post("/api/metal-prices/otp/verify", { sessionId: otpSessionId, otp: otpValue });
      clearCountdown();
      // Grant a 10-minute window for subsequent edits without re-verifying
      otpValidUntil.current = Date.now() + 10 * 60 * 1000;
      const action = pendingAction.current;
      resetOtp();
      action?.();
    } catch (e: any) {
      const msg: string = e.response?.data?.error || e.message || "Verification failed";
      setOtpError(msg);
      setOtpStep("waiting");
      if (msg.includes("Too many") || msg.includes("invalidated") || msg.includes("security alert")) {
        setOtpLocked(true);
        clearCountdown();
      }
    }
  };

  // filters
  const [search,      setSearch]      = useState("");
  const [filterType,  setFilterType]  = useState("");

  // ── Fetch / sync ──────────────────────────────────────────────────────────

  const checkActiveJob = async () => {
    try {
      const res = await axios.get("/api/active-job");
      setJobRunning(res.data.isRunning);
    } catch {
      setJobRunning(false);
    }
  };

  const fetchRows = async () => {
    setLoading(true);
    setFetchErr(null);
    try {
      const res = await axios.get("/api/metal-prices");
      setRows(res.data.metals ?? []);
    } catch (e: any) {
      setFetchErr(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRows(); checkActiveJob(); }, []);

  useEffect(() => {
    if (!jobRunning) return;
    const id = setInterval(checkActiveJob, 10000);
    return () => clearInterval(id);
  }, [jobRunning]);

  const handleTriggerSync = async () => {
    setSyncLoading(true);
    try {
      await axios.post("/api/trigger-sync");
      alert("Price sync triggered successfully!");
    } catch {
      alert("Failed to trigger sync. Please try after some time.");
    } finally {
      setSyncLoading(false);
      checkActiveJob();
    }
  };

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filtered = rows.filter(r => {
    if (filterType && r.metal_type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.ecommerce_description?.toLowerCase().includes(q) &&
          !r.purity_description?.toLowerCase().includes(q))
        return false;
    }
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

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!current?.ecommerce_description?.trim()) errors.ecommerce_description = "Name is required.";
    if (Number(current?.sale_rate) < 0)        errors.sale_rate        = "Price cannot be negative.";
    if (Number(current?.urd_rate) < 0)          errors.urd_rate          = "URD Rate cannot be negative.";
    if (Number(current?.purity) < 0)            errors.purity            = "Purity Value cannot be negative.";
    if (Number(current?.purity_percentage) < 0) errors.purity_percentage = "Purity % cannot be negative.";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    const payload = { ...current, exchange_rate: current?.sale_rate };
    try {
      if (isEdit) {
        const res = await axios.put("/api/metal-prices", payload);
        setRows(prev => prev.map(r => r.id === res.data.updatedMetal.id ? res.data.updatedMetal : r));
        toast.success("Metal price updated successfully");
      } else {
        const res = await axios.post("/api/metal-prices", payload);
        setRows(prev => [...prev, res.data.newMetal]);
        toast.success("Metal price added successfully");
      }
      setIsEdit(false);
      setCurrent(null);
      setAddOpen(false);
      setFormErrors({});
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || "Operation failed");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setCurrent(prev => ({ ...prev, [id]: value ?? "" } as Partial<MetalPrice>));
  };

  const handleSingleDelete = async (id: number) => {
    try {
      await axios.delete(`/api/metal-prices?id=${id}`);
      setRows(prev => prev.filter(r => r.id !== id));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      toast.success("Metal price deleted");
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
      const cache: Record<number, MetalPrice> = {};
      rows.forEach(r => { cache[r.id] = r; });

      const payload = Object.entries(rowChanges).map(([idStr, cur]) => {
        const id = Number(idStr);
        const orig = cache[id];
        const changes: Record<string, string> = {};
        for (const [k, v] of Object.entries(cur)) {
          if (v !== String((orig as any)?.[k] ?? "") && v !== "") changes[k] = v;
        }
        return { id, changes };
      }).filter(r => Object.keys(r.changes).length > 0);

      if (!payload.length) { setEditError("No changes to save."); setEditSaving(false); return; }

      const NUMERIC_BULK = ["sale_rate", "purity", "purity_percentage", "urd_rate"];
      const negativeItems: string[] = [];
      for (const { id, changes } of payload) {
        for (const key of NUMERIC_BULK) {
          if (changes[key] !== undefined && parseFloat(changes[key]) < 0) {
            const label = cache[id]?.ecommerce_description || `ID ${id}`;
            negativeItems.push(`${label}: ${key.replace(/_/g, " ")} = ${changes[key]}`);
          }
        }
      }
      if (negativeItems.length > 0) {
        setEditError(`Negative values are not allowed:\n${negativeItems.join("\n")}`);
        setEditSaving(false);
        return;
      }

      await axios.patch("/api/metal-prices", { rows: payload });
      setEditOpen(false);
      setSelectedIds(new Set());
      fetchRows();
      toast.success(`${payload.length} metal price${payload.length !== 1 ? "s" : ""} updated`);
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
      await axios.delete("/api/metal-prices", {
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
      toast.success(`${count} metal price${count !== 1 ? "s" : ""} deleted`);
    } catch (e: any) {
      setDeleteError(e.response?.data?.error || e.message || "Delete failed");
      toast.error(e.response?.data?.error || e.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  // ── Permission guard ──────────────────────────────────────────────────────

  if (!ready) return null;
  if (!can("Metal Prices", "View")) {
    clearUser();
    router.replace("/login");
    return null;
  }

  const deleteLabels = deleteIds
    ? rows.filter(r => deleteIds.includes(r.id))
         .map(r => r.ecommerce_description || r.purity_description || `ID ${r.id}`)
    : [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Metal Prices</h2>
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
              placeholder="Search by name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-48"
            />
            {search && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setSearch("")}>
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
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
            <option value="platinum">Platinum</option>
          </select>

          {/* bulk actions */}
          {selectedIds.size > 0 && (
            <>
              {can("Metal Prices", "Edit") && (
                <Button size="sm" onClick={() => withOtp(openBulkEdit)}>
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit {selectedIds.size === 1 ? "1 Row" : `${selectedIds.size} Rows`}
                </Button>
              )}
              {can("Metal Prices", "Delete") && (
                <Button size="sm" variant="destructive"
                  onClick={() => { setDeleteIds(Array.from(selectedIds)); setDeleteError(null); }}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete {selectedIds.size === 1 ? "1 Row" : `${selectedIds.size} Rows`}
                </Button>
              )}
            </>
          )}

          {/* trigger sync */}
          <Button
            variant="outline"
            onClick={handleTriggerSync}
            disabled={syncLoading || jobRunning}
            className="border-primary text-primary hover:bg-primary hover:text-white"
          >
            {jobRunning ? "Job in progress…" : syncLoading ? "Triggering…" : "Trigger Price Sync"}
          </Button>

          {/* add */}
          {can("Metal Prices", "Add") && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setCurrent({ open_date: new Date(), datetime: new Date(), metal_type: "",
                    sale_rate: 0, purity: 0, exchange_rate: 0, purity_description: "",
                    purity_percentage: 0, urd_rate: 0, ecommerce_description: "" });
                  setIsEdit(false);
                  setFormErrors({});
                }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Metal Price
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{isEdit ? "Edit" : "Add"} Metal Price</DialogTitle>
                  <DialogDescription>Enter the details for the metal price configuration.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Metal Type</Label>
                      <Select value={current?.metal_type || ""}
                        onValueChange={v => setCurrent(p => ({ ...p, metal_type: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gold">Gold</SelectItem>
                          <SelectItem value="silver">Silver</SelectItem>
                          <SelectItem value="platinum">Platinum</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ecommerce_description">Name <span className="text-destructive">*</span></Label>
                      <Input id="ecommerce_description" placeholder="e.g., Silver, 14KT"
                        value={current?.ecommerce_description ?? ""}
                        onChange={e => { handleInputChange(e); setFormErrors(p => ({ ...p, ecommerce_description: "" })); }}
                        className={formErrors.ecommerce_description ? "border-destructive" : ""} />
                      {formErrors.ecommerce_description && <p className="text-xs text-destructive">{formErrors.ecommerce_description}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="purity_percentage">Purity %</Label>
                      <Input id="purity_percentage" type="number" step="0.01" min="0"
                        value={current?.purity_percentage ?? ""} onChange={e => { handleInputChange(e); setFormErrors(p => ({ ...p, purity_percentage: "" })); }}
                        className={formErrors.purity_percentage ? "border-destructive" : ""} />
                      {formErrors.purity_percentage && <p className="text-xs text-destructive">{formErrors.purity_percentage}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="purity">Purity Value</Label>
                      <Input id="purity" type="number" step="0.01" min="0"
                        value={current?.purity ?? ""} onChange={e => { handleInputChange(e); setFormErrors(p => ({ ...p, purity: "" })); }}
                        className={formErrors.purity ? "border-destructive" : ""} />
                      {formErrors.purity && <p className="text-xs text-destructive">{formErrors.purity}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sale_rate">Price</Label>
                      <Input id="sale_rate" type="number" step="0.01" min="0"
                        value={current?.sale_rate ?? ""} onChange={e => { handleInputChange(e); setFormErrors(p => ({ ...p, sale_rate: "" })); }}
                        className={formErrors.sale_rate ? "border-destructive" : ""} />
                      {formErrors.sale_rate && <p className="text-xs text-destructive">{formErrors.sale_rate}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="urd_rate">URD Rate</Label>
                      <Input id="urd_rate" type="number" step="0.01" min="0"
                        value={current?.urd_rate ?? ""} onChange={e => { handleInputChange(e); setFormErrors(p => ({ ...p, urd_rate: "" })); }}
                        className={formErrors.urd_rate ? "border-destructive" : ""} />
                      {formErrors.urd_rate && <p className="text-xs text-destructive">{formErrors.urd_rate}</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="purity_description">Comments</Label>
                    <Input id="purity_description" value={current?.purity_description ?? ""}
                      onChange={handleInputChange} />
                  </div>
                  <DialogFooter>
                    <Button type="submit">{isEdit ? "Update" : "Add"} Metal Price</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* row count */}
      <p className="text-sm text-muted-foreground">
        {filtered.length} of {rows.length} rows
        {(filterType || search) && (
          <button className="ml-2 text-xs underline"
            onClick={() => { setFilterType(""); setSearch(""); }}>
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
              <TableHead>Type</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Purity %</TableHead>
              <TableHead>Purity Value</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>URD Rate</TableHead>
              {(can("Metal Prices", "Edit") || can("Metal Prices", "Delete")) && (
                <TableHead className="text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                  No metal prices found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(r => (
                <TableRow key={r.id} className={selectedIds.has(r.id) ? "bg-blue-50 dark:bg-blue-950" : ""}>
                  <TableCell>
                    <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleOne(r.id)} />
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${METAL_BADGE[r.metal_type] ?? "bg-muted text-muted-foreground border-muted"}`}>
                      {METAL_TYPE_LABEL[r.metal_type] ?? r.metal_type}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{r.ecommerce_description}</TableCell>
                  <TableCell>{r.purity_description}</TableCell>
                  <TableCell>{r.purity_percentage}</TableCell>
                  <TableCell>{r.purity}</TableCell>
                  <TableCell>{fmt(r.sale_rate)}</TableCell>
                  <TableCell>{r.urd_rate}</TableCell>
                  {(can("Metal Prices", "Edit") || can("Metal Prices", "Delete")) && (
                    <TableCell className="text-right space-x-1">
                      {can("Metal Prices", "Edit") && (
                        <Button variant="ghost" size="icon"
                          onClick={() => withOtp(() => { setCurrent(r); setIsEdit(true); setAddOpen(true); setFormErrors({}); })}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {can("Metal Prices", "Delete") && (
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

      {/* ── OTP gate modal ── */}
      <Dialog
        open={otpStep === "waiting" || otpStep === "verifying"}
        onOpenChange={open => { if (!open) resetOtp(); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-500" />
              Verify Your Identity
            </DialogTitle>
            <DialogDescription>
              A one-time password has been sent to{" "}
              <strong>{process.env.NEXT_PUBLIC_METAL_OTP_TO ?? "rimadevi.prasad@amplicomm.com"}</strong>.
              Enter it below to proceed.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4">
            {otpStep === "sending" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Sending OTP…
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="otp-input">OTP</Label>
                  <Input
                    id="otp-input"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="_ _ _ _ _ _"
                    className="text-center tracking-[0.5em] text-xl font-mono"
                    value={otpValue}
                    onChange={e => setOtpValue(e.target.value.replace(/\D/g, ""))}
                    disabled={otpLocked || otpStep === "verifying"}
                    autoFocus
                    onKeyDown={e => { if (e.key === "Enter") verifyOtp(); }}
                  />
                </div>

                {!otpLocked && (
                  <div className={`text-sm font-mono text-center ${otpCountdown <= 30 ? "text-destructive" : "text-muted-foreground"}`}>
                    {otpCountdown > 0
                      ? `Expires in ${Math.floor(otpCountdown / 60)}:${String(otpCountdown % 60).padStart(2, "0")}`
                      : "Expired"}
                  </div>
                )}

                {otpError && (
                  <div className="flex items-start gap-2 text-sm p-3 rounded-md bg-destructive/10 text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{otpError}</span>
                  </div>
                )}

                {otpLocked && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-md border border-amber-200">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    A security alert has been sent to the administrator.
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetOtp} disabled={otpStep === "verifying"}>
              Cancel
            </Button>
            {!otpLocked && otpStep !== "sending" && (
              <Button
                onClick={verifyOtp}
                disabled={otpStep === "verifying" || otpValue.length !== 6 || otpCountdown === 0}
              >
                {otpStep === "verifying" ? "Verifying…" : "Verify"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              This will permanently delete the following metal price{deleteLabels.length !== 1 ? "s" : ""}. This cannot be undone.
            </p>
            <ul className="text-sm font-mono bg-muted rounded-md p-3 space-y-1 max-h-48 overflow-y-auto">
              {deleteLabels.map((l, i) => <li key={i}>• {l}</li>)}
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
        <DialogContent className="max-w-[96vw] w-full h-[84vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle>Edit {Object.keys(rowChanges).length} Metal Price{Object.keys(rowChanges).length !== 1 ? "s" : ""}</DialogTitle>
            <p className="text-sm text-muted-foreground">Only changed cells are saved.</p>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            <table className="text-sm border-collapse" style={{ minWidth: "max-content", width: "100%" }}>
              <thead className="sticky top-0 z-10 bg-background shadow-[0_1px_0_0_hsl(var(--border))]">
                <tr>
                  <th className="sticky left-0 z-20 bg-background text-left px-4 py-2 font-semibold text-xs uppercase tracking-wide text-muted-foreground border-r min-w-[140px]">
                    ID
                  </th>
                  {EDIT_COLS.map(c => (
                    <th key={String(c.key)} className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wide text-muted-foreground min-w-[160px]">
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
                    <th key={String(c.key)} className="px-1.5 py-1 min-w-[160px]">
                      <Input
                        type={c.type}
                        placeholder="—"
                        className="h-6 text-xs px-2 w-full bg-white dark:bg-yellow-950/50 border-yellow-300 dark:border-yellow-700"
                        value={headerFill[String(c.key)] ?? ""}
                        onChange={e => {
                          const val = e.target.value;
                          const key = String(c.key);
                          setHeaderFill(prev => ({ ...prev, [key]: val }));
                          setRowChanges(prev => {
                            const next: typeof prev = {};
                            for (const [id, row] of Object.entries(prev)) {
                              next[Number(id)] = { ...row, [key]: val };
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
                      <td className="sticky left-0 z-10 bg-inherit px-4 py-1.5 border-r">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border whitespace-nowrap ${METAL_BADGE[r.metal_type] ?? "bg-muted"}`}>
                            {METAL_TYPE_LABEL[r.metal_type] ?? r.metal_type}
                          </span>
                          <span className="font-mono text-xs truncate max-w-[80px]" title={r.ecommerce_description}>
                            {r.ecommerce_description || r.purity_description}
                          </span>
                        </div>
                      </td>
                      {EDIT_COLS.map(c => (
                        <td key={String(c.key)} className="px-1.5 py-1 min-w-[160px]">
                          <Input
                            type={c.type}
                            className="h-7 text-xs px-2 w-full"
                            value={rowChanges[id]?.[String(c.key)] ?? ""}
                            onChange={e =>
                              setRowChanges(prev => ({
                                ...prev,
                                [id]: { ...prev[id], [String(c.key)]: e.target.value },
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
