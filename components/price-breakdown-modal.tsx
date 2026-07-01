"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface DiamondLine {
  size: string;
  weight: number;
  rate: number;
  cost: number;
  itemName: string;
}

interface Breakdown {
  sku: string;
  storedPrice: number;
  calculatedPrice: number;
  compareAtPrice: number;
  metal: {
    gold:     { weight: number; purity: number; rate: number; cost: number };
    silver:   { weight: number; purity: number; rate: number; cost: number };
    platinum: { weight: number; purity: number; rate: number; cost: number };
    total: number;
  };
  making: {
    code: string;
    type: string;
    rate: number;
    grossWeight: number;
    base: number;
    markup: string | null;
    markupAmount: number;
    afterMarkup: number;
    discount: string | null;
    discountAmount: number;
    net: number;
  };
  stone: {
    dcolorId: string | null;
    diamonds: DiamondLine[];
    diamondCost: number;
    otherCharges: number;
    total: number;
    discount: string | null;
    discountAmount: number;
    net: number;
  };
  summary: {
    subtotal: number;
    totalDiscount: number;
    subtotalAfterDiscount: number;
    gst: number;
    gstRate: string;
    finalPrice: number;
    gstOnCompare: number;
    compareAtPrice: number;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

function mainMetalLabel(purity: number): string {
  if (purity === 999) return "Silver (999)";
  if (purity === 95)  return "Platinum (95%)";
  if (purity > 0)     return `Gold (${purity}K)`;
  return "Metal";
}

const fmtNum = (n: number, decimals = 3) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

function Row({
  label,
  value,
  sub,
  bold,
  indent,
  red,
  green,
}: {
  label: string;
  value: string;
  sub?: string;
  bold?: boolean;
  indent?: boolean;
  red?: boolean;
  green?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-start py-1 ${
        indent ? "pl-4" : ""
      } ${bold ? "font-semibold" : ""} ${
        red ? "text-red-600 dark:text-red-400" : ""
      } ${green ? "text-green-600 dark:text-green-500" : ""}`}
    >
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      <span className="text-sm text-right ml-4">
        {value}
        {sub && (
          <span className="block text-xs text-gray-500 dark:text-gray-400 text-right">
            {sub}
          </span>
        )}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 border-b border-gray-200 dark:border-gray-700 pb-1">
        {title}
      </div>
      {children}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  variantId: number | null;
  onClose: () => void;
}

export function PriceBreakdownModal({ variantId, onClose }: Props) {
  const [data, setData] = useState<Breakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!variantId) return;
    setData(null);
    setError(null);
    setLoading(true);

    fetch(`/api/product-variants/breakdown?id=${variantId}`)
      .then(r => r.json())
      .then(j => {
        if (j.error) setError(j.error);
        else setData(j as Breakdown);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [variantId]);

  const open = variantId !== null;

  return (
    <Dialog open={open} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg w-full max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Price Breakdown
            {data && (
              <span className="ml-2 text-xs font-normal text-gray-500">
                {data.sku}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 py-4">{error}</div>
        )}

        {data && !loading && (
          <div className="mt-2 space-y-1">

            {/* ── Metal ── */}
            <Section title="Metal Cost">
              {data.metal.gold.weight > 0 && (
                <Row
                  label={mainMetalLabel(data.metal.gold.purity)}
                  value={fmt(data.metal.gold.cost)}
                  sub={`${fmtNum(data.metal.gold.weight)} g × ${fmt(data.metal.gold.rate)}/g`}
                  indent
                />
              )}
              {data.metal.silver.weight > 0 && (
                <Row
                  label={`Silver (${data.metal.silver.purity})`}
                  value={fmt(data.metal.silver.cost)}
                  sub={`${fmtNum(data.metal.silver.weight)} g × ${fmt(data.metal.silver.rate)}/g`}
                  indent
                />
              )}
              {data.metal.platinum.weight > 0 && (
                <Row
                  label={`Platinum (${data.metal.platinum.purity})`}
                  value={fmt(data.metal.platinum.cost)}
                  sub={`${fmtNum(data.metal.platinum.weight)} g × ${fmt(data.metal.platinum.rate)}/g`}
                  indent
                />
              )}
              <Row label="Total Metal" value={fmt(data.metal.total)} bold />
            </Section>

            {/* ── Making ── */}
            <Section title="Making Charges">
              {data.making.code && (
                <Row
                  label={`Code: ${data.making.code}`}
                  value={fmt(data.making.base)}
                  sub={
                    data.making.type === "Per Pc"
                      ? "Per Pc"
                      : data.making.type === "Per Gram"
                      ? `${fmtNum(data.making.grossWeight)} g × ${fmt(data.making.rate)}/g`
                      : `${data.making.rate}% of ${fmtNum(data.making.grossWeight)} g × rate`
                  }
                  indent
                />
              )}
              {data.making.markup && (
                <Row
                  label={`Markup (${data.making.markup})`}
                  value={`+ ${fmt(data.making.markupAmount)}`}
                  indent
                />
              )}
              {data.making.markup && (
                <Row label="After Markup" value={fmt(data.making.afterMarkup)} indent />
              )}
              {data.making.discount && (
                <Row
                  label={`Discount (${data.making.discount})`}
                  value={`- ${fmt(data.making.discountAmount)}`}
                  indent
                  red
                />
              )}
              <Row label="Net Making" value={fmt(data.making.net)} bold />
            </Section>

            {/* ── Stone ── */}
            {(data.stone.total > 0 || data.stone.dcolorId) && (
              <Section title="Stone / Diamond Cost">
                {data.stone.dcolorId && data.stone.diamonds.length > 0 && (
                  <>
                    <Row
                      label={`Diamond Grade: ${data.stone.dcolorId}`}
                      value=""
                      indent
                    />
                    {data.stone.diamonds.map((d, i) => (
                      <Row
                        key={i}
                        label={`  Lot ${i + 1} (${d.itemName}, size ${d.size})`}
                        value={fmt(Math.round(d.cost))}
                        sub={`${fmtNum(d.weight)} ct × ${fmt(d.rate)}/ct`}
                        indent
                      />
                    ))}
                    <Row label="Diamond Subtotal" value={fmt(data.stone.diamondCost)} indent />
                  </>
                )}
                {data.stone.otherCharges > 0 && (
                  <Row label="Other Stone Charges" value={fmt(data.stone.otherCharges)} indent />
                )}
                {data.stone.discount && (
                  <Row
                    label={`Stone Discount (${data.stone.discount})`}
                    value={`- ${fmt(data.stone.discountAmount)}`}
                    indent
                    red
                  />
                )}
                <Row label="Net Stone" value={fmt(data.stone.net)} bold />
              </Section>
            )}

            {/* ── Summary ── */}
            <Section title="Price Summary">
              <Row label="Subtotal" value={fmt(data.summary.subtotal)} />
              {data.summary.totalDiscount > 0 && (
                <Row
                  label="Total Discount"
                  value={`- ${fmt(data.summary.totalDiscount)}`}
                  red
                />
              )}
              {data.summary.totalDiscount > 0 && (
                <Row
                  label="After Discount"
                  value={fmt(data.summary.subtotalAfterDiscount)}
                />
              )}
              <Row
                label={`GST (${data.summary.gstRate})`}
                value={`+ ${fmt(data.summary.gst)}`}
              />
              <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-2">
                <Row
                  label="Final Price"
                  value={fmt(data.summary.finalPrice)}
                  bold
                  green
                />
                <Row
                  label={`Compare At (no discount + ${data.summary.gstRate} GST)`}
                  value={fmt(data.summary.compareAtPrice)}
                />
              </div>
            </Section>

            {/* Stored vs calculated indicator */}
            {data.storedPrice !== data.calculatedPrice && (
              <div className="mt-2 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-300">
                <strong>Note:</strong> Stored price is{" "}
                <strong>{fmt(data.storedPrice)}</strong> — recalculated with
                current rates gives <strong>{fmt(data.calculatedPrice)}</strong>.
                Run a sync to update.
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
