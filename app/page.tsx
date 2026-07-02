"use client";

import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CircleDollarSign, Gem, RefreshCw, Clock, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useRouter } from "next/navigation";
import axios from "axios";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MetalRate {
  id: number;
  metal_type: string;
  ecommerce_description: string;
  purity_description: string;
  purity: number;
  purity_percentage: number;
  sale_rate: number;
  urd_rate: number;
  open_date: string;
  datetime: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function toIST(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function daysAgo(d: string | null): number {
  if (!d) return 999;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
}

const METAL_BADGE: Record<string, string> = {
  gold:     "bg-yellow-100 text-yellow-800 border-yellow-300",
  silver:   "bg-gray-100   text-gray-700   border-gray-300",
  platinum: "bg-blue-100   text-blue-800   border-blue-300",
};

const METAL_ROW_BG: Record<string, string> = {
  gold:     "border-l-4 border-l-yellow-400",
  silver:   "border-l-4 border-l-gray-400",
  platinum: "border-l-4 border-l-blue-400",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const params = searchParams;
  const { user, clearUser } = useAuth();
  const { ready, can } = usePermissions();
  const router = useRouter();

  const [metalCount,       setMetalCount]       = useState<number>(0);
  const [makingChargeCount, setMakingChargeCount] = useState<number>(0);
  const [metalRates,       setMetalRates]       = useState<MetalRate[]>([]);
  const [ratesLoading,     setRatesLoading]     = useState(false);
  const [ratesUpdatedAt,   setRatesUpdatedAt]   = useState<Date | null>(null);

  useEffect(() => {
    if (!user) redirect("/login");
  }, [user]);

  useEffect(() => {
    if (!ready || !can("Dashboard", "View")) return;

    // Counts
    axios.get("/api/metal-prices?type=count")
      .then(r => setMetalCount(r.data?.count))
      .catch(() => {});
    axios.get("/api/pricing-codes?type=count")
      .then(r => setMakingChargeCount(r.data?.count))
      .catch(() => {});

    // Metal rates for last-7-days widget
    loadRates();
  }, [ready, can]);

  const loadRates = async () => {
    setRatesLoading(true);
    try {
      const res = await axios.get("/api/metal-prices");
      const rows: MetalRate[] = res.data?.metals ?? [];

      // Only show rates updated in last 7 days (open_date within 7 days)
      const cutoff = Date.now() - 7 * 86_400_000;
      const recent = rows.filter(r => r.open_date && new Date(r.open_date).getTime() >= cutoff);
      // If nothing in last 7 days, fall back to all (so dashboard is never empty)
      setMetalRates(recent.length ? recent : rows);
      setRatesUpdatedAt(new Date());
    } catch {
      // silently ignore — counts still show
    } finally {
      setRatesLoading(false);
    }
  };

  useEffect(() => {
    if (ready && !can("Dashboard", "View")) {
      clearUser();
      router.replace("/login");
    }
  }, [ready]);

  if (!ready) return null;
  if (ready && !can("Dashboard", "View")) return null;

  // Handle Shopify app entry point
  if (params.shop && params.hmac && params.host) {
    const shop      = params.shop as string;
    const hmac      = params.hmac as string;
    const host      = params.host as string;
    const timestamp = params.timestamp as string;
    const authUrl   = new URL("/api/auth", process.env.SHOPIFY_APP_URL);
    authUrl.searchParams.set("shop", shop);
    authUrl.searchParams.set("hmac", hmac);
    authUrl.searchParams.set("host", host);
    authUrl.searchParams.set("timestamp", timestamp);
    redirect(authUrl.toString());
  }

  // Group rates by metal_type for the widget
  const grouped = metalRates.reduce<Record<string, MetalRate[]>>((acc, r) => {
    const key = r.metal_type?.toLowerCase() ?? "other";
    (acc[key] ??= []).push(r);
    return acc;
  }, {});

  // Latest open_date across all rates
  const latestOpenDate = metalRates.length
    ? metalRates.reduce((max, r) => (r.open_date > max ? r.open_date : max), metalRates[0].open_date)
    : null;
  const ageInDays = daysAgo(latestOpenDate);
  const ageBadge  = ageInDays === 0 ? "text-green-600" : ageInDays <= 1 ? "text-green-500" : ageInDays <= 7 ? "text-amber-600" : "text-red-600";

  return (
    <>
      {can("Dashboard", "View") && (
        <div className="flex-1 space-y-6 p-8 pt-6">

          {/* ── Header ── */}
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          </div>

          {/* ── Count cards ── */}
          <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
            <Link href="/metal-prices">
              <Card className="hover:bg-muted/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-2xl font-bold">Metal Prices</CardTitle>
                  <CircleDollarSign className="h-8 w-8 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">{metalCount}</div>
                  <p className="text-xs text-muted-foreground">Active Metal Configurations</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/making-charges">
              <Card className="hover:bg-muted/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-2xl font-bold">Making Charges</CardTitle>
                  <Gem className="h-8 w-8 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">{makingChargeCount}</div>
                  <p className="text-xs text-muted-foreground">Active Charge Rules</p>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* ── Metal Rates (last 7 days from webhook) ── */}
          <div className="rounded-xl border bg-background shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-base">Metal Rates — Last 7 Days</h3>
                {latestOpenDate && (
                  <span className={`text-xs font-medium ${ageBadge}`}>
                    · Updated {ageInDays === 0 ? "today" : ageInDays === 1 ? "yesterday" : `${ageInDays}d ago`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {ratesUpdatedAt && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {ratesUpdatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                  </span>
                )}
                <button
                  onClick={loadRates}
                  disabled={ratesLoading}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${ratesLoading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
                <Link href="/metal-prices" className="text-xs text-primary hover:underline">
                  Manage →
                </Link>
              </div>
            </div>

            {ratesLoading && metalRates.length === 0 ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
                ))}
              </div>
            ) : metalRates.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No metal rates received in the last 7 days.
                <Link href="/metal-prices" className="ml-1 text-primary underline">Trigger a sync →</Link>
              </div>
            ) : (
              <div className="divide-y">
                {(["gold", "silver", "platinum"] as const).map(type => {
                  const rates = grouped[type];
                  if (!rates?.length) return null;
                  return (
                    <div key={type} className="px-5 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${METAL_BADGE[type] ?? ""}`}>
                          {type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Last set: {toIST(rates[0].open_date)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {rates.map(r => (
                          <div key={r.id} className={`rounded-lg border bg-card p-3 ${METAL_ROW_BG[type] ?? ""}`}>
                            <p className="text-xs text-muted-foreground truncate">
                              {r.ecommerce_description || r.purity_description || `Purity ${r.purity}`}
                            </p>
                            <p className="font-bold text-lg mt-0.5">{fmt(r.sale_rate)}</p>
                            {r.urd_rate && r.urd_rate !== r.sale_rate ? (
                              <p className="text-xs text-muted-foreground">URD: {fmt(r.urd_rate)}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {ageInDays > 7 && (
              <div className="mx-5 mb-4 mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                ⚠ Metal rates are <strong>{ageInDays} days old</strong>. Trigger a price sync to update them.
              </div>
            )}
          </div>

        </div>
      )}
    </>
  );
}
