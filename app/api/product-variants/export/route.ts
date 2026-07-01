import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import sequelize from "@/lib/sequelize";

function metalWhereClause(metal: string): string {
  switch (metal) {
    case "gold":
      return `COALESCE(purity,0) > 0 AND COALESCE(silver_weight,0) = 0 AND COALESCE(platinum_weight,0) = 0`;
    case "silver":
      return `COALESCE(silver_weight,0) > 0 AND COALESCE(purity,0) = 0 AND COALESCE(platinum_weight,0) = 0`;
    case "platinum":
      return `COALESCE(platinum_weight,0) > 0 AND COALESCE(purity,0) = 0 AND COALESCE(silver_weight,0) = 0`;
    case "dual":
      return `(CASE WHEN COALESCE(purity,0)>0 THEN 1 ELSE 0 END + CASE WHEN COALESCE(silver_weight,0)>0 THEN 1 ELSE 0 END + CASE WHEN COALESCE(platinum_weight,0)>0 THEN 1 ELSE 0 END) > 1`;
    case "no_price":
      return `COALESCE(last_calculated_price, 0) = 0`;
    default:
      return "1=1";
  }
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ];
  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  const session = await auth(req);
  if (!session || "error" in session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp    = new URL(req.url).searchParams;
  const ids   = sp.get("ids");    // comma-separated IDs
  const metal  = sp.get("metal")  || "all";
  const purity = sp.get("purity") || "";
  const search = (sp.get("search") || "").trim();

  const conditions: string[] = [];
  const binds: unknown[] = [];

  if (ids) {
    // Export by explicit ID list
    const idList = ids.split(",").map(Number).filter(Boolean);
    if (!idList.length)
      return NextResponse.json({ error: "No valid ids" }, { status: 400 });
    const placeholders = idList.map((_, i) => `$${i + 1}`).join(",");
    binds.push(...idList);
    conditions.push(`id IN (${placeholders})`);
  } else {
    // Export by filters (same as browse)
    conditions.push(`(${metalWhereClause(metal)})`);
    if (purity && metal === "gold") {
      binds.push(parseFloat(purity));
      conditions.push(`purity = $${binds.length}`);
    }
    if (search) {
      binds.push(`%${search}%`);
      conditions.push(`sku ILIKE $${binds.length}`);
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows] = await sequelize.query(
    `SELECT
       sku, variant_id, net_wt, purity,
       making_charges_code, discount_percentage_on_making_charge,
       discount_percentage_on_stone, markup, stone_count, other_stone_charges,
       silver_weight, silver_purity, platinum_weight, platinum_purity,
       collections, last_calculated_price, shopify_variant_id
     FROM jewelry_variants ${where}
     ORDER BY sku ASC`,
    { bind: binds }
  );

  const csv = toCSV(rows as Record<string, unknown>[]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="products_export.csv"`,
    },
  });
}
