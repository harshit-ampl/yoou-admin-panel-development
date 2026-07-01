import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import sequelize from "@/lib/sequelize";

export const dynamic = 'force-dynamic';

// --- helpers ---

function metalWhereClause(metal: string): string {
  switch (metal) {
    case "gold":
      return `COALESCE(purity,0) > 0 AND COALESCE(silver_weight,0) = 0 AND COALESCE(platinum_weight,0) = 0`;
    case "silver":
      return `COALESCE(silver_weight,0) > 0 AND COALESCE(purity,0) = 0 AND COALESCE(platinum_weight,0) = 0`;
    case "platinum":
      return `COALESCE(platinum_weight,0) > 0 AND COALESCE(purity,0) = 0 AND COALESCE(silver_weight,0) = 0`;
    case "dual":
      return `(
        CASE WHEN COALESCE(purity,0)>0 THEN 1 ELSE 0 END +
        CASE WHEN COALESCE(silver_weight,0)>0 THEN 1 ELSE 0 END +
        CASE WHEN COALESCE(platinum_weight,0)>0 THEN 1 ELSE 0 END
      ) > 1`;
    case "no_price":
      return `COALESCE(last_calculated_price, 0) = 0`;
    default:
      return "1=1";
  }
}

const SORT_MAP: Record<string, string> = {
  sku: "sku",
  price: "COALESCE(last_calculated_price, 0)",
  purity: "COALESCE(purity, 0)",
  net_wt: "COALESCE(net_wt, 0)",
};

const METAL_TYPE_SQL = `
  CASE
    WHEN COALESCE(purity,0)>0 AND COALESCE(silver_weight,0)=0 AND COALESCE(platinum_weight,0)=0 THEN 'gold'
    WHEN COALESCE(silver_weight,0)>0 AND COALESCE(purity,0)=0 AND COALESCE(platinum_weight,0)=0 THEN 'silver'
    WHEN COALESCE(platinum_weight,0)>0 AND COALESCE(purity,0)=0 AND COALESCE(silver_weight,0)=0 THEN 'platinum'
    WHEN (CASE WHEN COALESCE(purity,0)>0 THEN 1 ELSE 0 END
        + CASE WHEN COALESCE(silver_weight,0)>0 THEN 1 ELSE 0 END
        + CASE WHEN COALESCE(platinum_weight,0)>0 THEN 1 ELSE 0 END) > 1 THEN 'dual'
    ELSE 'unknown'
  END
`;

// --- GET /api/product-variants ---

export async function GET(req: NextRequest) {
  try {
    const session = await auth(req);
    if (!session || "error" in session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sp = new URL(req.url).searchParams;
    const page   = Math.max(1, parseInt(sp.get("page")  || "1"));
    const limit  = Math.min(200, Math.max(1, parseInt(sp.get("limit") || "100")));
    const offset = (page - 1) * limit;
    const metal  = sp.get("metal")  || "all";
    const purity = sp.get("purity") || "";
    const search = (sp.get("search") || "").trim();
    const sort   = sp.get("sort")   || "sku";
    const order  = sp.get("order") === "desc" ? "DESC" : "ASC";

    const conditions: string[] = [`(${metalWhereClause(metal)})`];
    const binds: unknown[] = [];

    if (purity && metal === "gold") {
      binds.push(parseFloat(purity));
      conditions.push(`purity = $${binds.length}`);
    }

    if (search) {
      binds.push(`%${search}%`);
      conditions.push(`sku ILIKE $${binds.length}`);
    }

    const where    = `WHERE ${conditions.join(" AND ")}`;
    const sortCol  = SORT_MAP[sort] || "sku";
    const dataBinds  = [...binds, limit, offset];

    const [rows] = await sequelize.query(
      `SELECT
         jv.id, jv.sku, COALESCE(jv.variant_id,'') AS variant_id,
         COALESCE(jv.net_wt,0) AS net_wt,
         COALESCE(jv.purity,0) AS purity,
         COALESCE(jv.making_charges_code,'') AS making_charges_code,
         COALESCE(jv.discount_percentage_on_making_charge,'0') AS discount_percentage_on_making_charge,
         COALESCE(jv.discount_percentage_on_stone,'0') AS discount_percentage_on_stone,
         COALESCE(jv.markup,'0') AS markup,
         COALESCE(jv.stone_count,0) AS stone_count,
         COALESCE(jv.other_stone_charges,0) AS other_stone_charges,
         COALESCE(jv.silver_weight,0) AS silver_weight,
         COALESCE(jv.silver_purity,0) AS silver_purity,
         COALESCE(jv.platinum_weight,0) AS platinum_weight,
         COALESCE(jv.platinum_purity,0) AS platinum_purity,
         COALESCE(jv.last_calculated_price,0) AS current_price,
         COALESCE(jv.shopify_variant_id::text,'') AS shopify_variant_id,
         COALESCE(jv.collections,'') AS collections,
         (${METAL_TYPE_SQL}) AS metal_type,
         COALESCE(ls.old_price, 0) AS last_price
       FROM jewelry_variants jv
       LEFT JOIN LATERAL (
         SELECT old_price FROM sync_job_logs WHERE sku = jv.sku ORDER BY created_at DESC LIMIT 1
       ) ls ON true
       ${where}
       ORDER BY ${sortCol} ${order}
       LIMIT $${dataBinds.length - 1} OFFSET $${dataBinds.length}`,
      { bind: dataBinds }
    );

    const [countRes] = await sequelize.query(
      `SELECT COUNT(*) FROM jewelry_variants jv ${where}`,
      { bind: binds }
    );
    const total = parseInt((countRes as { count: string }[])[0].count);

    return NextResponse.json({
      data: rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[product-variants GET]", err);
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}

// --- PATCH /api/product-variants (bulk update) ---

const EDITABLE = new Set([
  "net_wt", "purity", "making_charges_code",
  "discount_percentage_on_making_charge", "discount_percentage_on_stone",
  "markup", "stone_count", "other_stone_charges",
  "silver_weight", "silver_purity", "platinum_weight", "platinum_purity",
  "collections",
]);

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth(req);
    if (!session || "error" in session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // Per-row format: { rows: [{ id, changes }] }
    if (body.rows) {
      const rows = body.rows as { id: number; changes: Record<string, string> }[];
      if (!rows?.length)
        return NextResponse.json({ error: "rows required" }, { status: 400 });

      let totalUpdated = 0;
      for (const { id, changes } of rows) {
        const setClauses: string[] = [];
        const binds: unknown[] = [];
        for (const [col, val] of Object.entries(changes)) {
          if (!EDITABLE.has(col) || val === undefined || val === null || val === "") continue;
          binds.push(val);
          setClauses.push(`${col} = $${binds.length}`);
        }
        if (!setClauses.length) continue;
        binds.push(id);
        await sequelize.query(
          `UPDATE jewelry_variants SET ${setClauses.join(", ")}, "updatedAt" = NOW() WHERE id = $${binds.length}`,
          { bind: binds }
        );
        totalUpdated++;
      }
      return NextResponse.json({ updated: totalUpdated });
    }

    // Same-value-to-all format: { ids, changes }
    const { ids, changes } = body as { ids: number[]; changes: Record<string, unknown> };
    if (!ids?.length || !changes || !Object.keys(changes).length)
      return NextResponse.json({ error: "ids and changes required" }, { status: 400 });

    const setClauses: string[] = [];
    const binds: unknown[] = [];
    for (const [col, val] of Object.entries(changes)) {
      if (!EDITABLE.has(col) || val === undefined || val === null || val === "") continue;
      binds.push(val);
      setClauses.push(`${col} = $${binds.length}`);
    }
    if (!setClauses.length)
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });

    const idPlaceholders = ids.map((_, i) => `$${binds.length + i + 1}`).join(",");
    binds.push(...ids);

    const [updated] = await sequelize.query(
      `UPDATE jewelry_variants SET ${setClauses.join(", ")}, "updatedAt" = NOW() WHERE id IN (${idPlaceholders}) RETURNING id, sku`,
      { bind: binds }
    );
    return NextResponse.json({ updated: (updated as unknown[]).length, rows: updated });
  } catch (err) {
    console.error("[product-variants PATCH]", err);
    return NextResponse.json({ error: (err as Error).message || "Internal server error" }, { status: 500 });
  }
}

// --- DELETE /api/product-variants ---

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth(req);
    if (!session || "error" in session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { ids } = await req.json() as { ids: number[] };
    if (!ids?.length)
      return NextResponse.json({ error: "ids required" }, { status: 400 });

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    const [deleted] = await sequelize.query(
      `DELETE FROM jewelry_variants WHERE id IN (${placeholders}) RETURNING id, sku`,
      { bind: ids }
    );

    return NextResponse.json({ deleted: (deleted as unknown[]).length, rows: deleted });
  } catch (err) {
    console.error("[product-variants DELETE]", err);
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}
