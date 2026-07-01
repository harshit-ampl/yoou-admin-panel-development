import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import sequelize from "@/lib/sequelize";

export const dynamic = 'force-dynamic';

// ── helpers ────────────────────────────────────────────────────────────────

function parseAmount(s: string | null | undefined): number {
  if (!s || s === "0") return 0;
  return parseFloat(s.replace("%", "")) || 0;
}

function isPercent(s: string | null | undefined): boolean {
  return !!s && s.includes("%");
}

function round(n: number): number {
  return Math.round(n);
}

function calcMaking(
  type: string,
  value: number,
  grossWeight: number,
  metalPricePerGram: number
): number {
  switch (type) {
    case "Per Pc":
      return value;
    case "Per Gram":
      return value * grossWeight;
    case "% Of NetWt":
      return (value / 100) * grossWeight * metalPricePerGram;
    default:
      return 0;
  }
}

function isWithinSizeRange(stoneSize: string, sizeRange: string): boolean {
  if (!stoneSize || !sizeRange) return false;
  if (stoneSize === sizeRange) return true;
  const parts = sizeRange.split("-");
  if (parts.length !== 2) return false;
  const size = parseFloat(stoneSize);
  const low = parseFloat(parts[0].trim());
  const high = parseFloat(parts[1].trim());
  return !isNaN(size) && !isNaN(low) && !isNaN(high) && size >= low && size <= high;
}

interface StoneRate {
  item_name: string;
  d_color_code: string;
  size_id: string;
  new_selling_rates: string;
}

function calcDiamondCost(
  dcolorId: string,
  diamonds: { weight: number; pieces: number; size: string }[],
  rates: StoneRate[]
): { cost: number; lines: { size: string; weight: number; rate: number; cost: number; itemName: string }[] } {
  const normalised = dcolorId.replace(/\//g, "-");
  let total = 0;
  const lines: { size: string; weight: number; rate: number; cost: number; itemName: string }[] = [];

  for (const d of diamonds) {
    const matches = rates.filter(
      r => r.d_color_code.replace(/\//g, "-") === normalised && isWithinSizeRange(d.size, r.size_id)
    );
    if (!matches.length) continue;

    const selected = matches.find(m => m.item_name === "LDM") ?? matches[0];
    const rate = parseFloat(selected.new_selling_rates) || 0;
    const cost = d.weight * rate;
    total += cost;
    lines.push({ size: d.size, weight: d.weight, rate, cost, itemName: selected.item_name });
  }

  return { cost: total, lines };
}

// ── GET /api/product-variants/breakdown?id=123 ─────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await auth(req);
    if (!session || "error" in session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = new URL(req.url).searchParams.get("id");
    if (!id || isNaN(Number(id)))
      return NextResponse.json({ error: "id required" }, { status: 400 });

    // Fetch variant
    const [variants] = await sequelize.query(
      `SELECT
         id, sku,
         COALESCE(net_wt, 0)              AS net_wt,
         COALESCE(purity, 0)              AS purity,
         COALESCE(making_charges_code,'') AS making_charges_code,
         COALESCE(markup, '0')            AS markup,
         COALESCE(discount_percentage_on_making_charge,'0') AS disc_making,
         COALESCE(discount_percentage_on_stone,'0')         AS disc_stone,
         COALESCE(stone_count, 0)         AS stone_count,
         COALESCE(other_stone_charges, 0) AS other_stone_charges,
         COALESCE(silver_weight, 0)       AS silver_weight,
         COALESCE(silver_purity, 0)       AS silver_purity,
         COALESCE(platinum_weight, 0)     AS platinum_weight,
         COALESCE(platinum_purity, 0)     AS platinum_purity,
         COALESCE(last_calculated_price, 0) AS stored_price,
         COALESCE(dcolor_id, '')          AS dcolor_id,
         dia_wt_1, dia_pc_1, dsizeid_1,
         dia_wt_2, dia_pc_2, dsizeid_2,
         dia_wt_3, dia_pc_3, dsizeid_3
       FROM jewelry_variants WHERE id = $1`,
      { bind: [Number(id)] }
    );
    if (!(variants as unknown[]).length)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const v = (variants as Record<string, unknown>[])[0];

    // Fetch metal rates — metal_rates.purity is in percentage (99.5, 92 …)
    // but jewelry_variants.purity is in karat (24, 22, 18, 14, 95, 999).
    // Map to karat keys so lookups use jewelry_variants.purity directly.
    const purityToKarat: Record<number, number> = {
      99.5: 24,
      92:   22,
      75:   18,
      58.3: 14,
      1:    95,   // platinum
      96:   999,  // silver
    };
    const [metalRateRows] = await sequelize.query(
      `SELECT purity::float AS purity, sale_rate::float AS sale_rate FROM metal_rates`
    );
    const metalRates: Record<number, number> = {};
    for (const r of metalRateRows as { purity: number; sale_rate: number }[]) {
      const karat = purityToKarat[r.purity];
      if (karat !== undefined) metalRates[karat] = r.sale_rate;
    }

    // Fetch making charge
    type MCRow = { calculate_wastage_amount_on: string; wastage_rate_or_labour_charge: number };
    const mcCode = v.making_charges_code as string;
    let makingChargeRow: MCRow | null = null;
    if (mcCode) {
      const [mcRows] = await sequelize.query(
        `SELECT calculate_wastage_amount_on, wastage_rate_or_labour_charge::float
         FROM making_charge WHERE name = $1 LIMIT 1`,
        { bind: [mcCode] }
      );
      if ((mcRows as unknown[]).length) {
        makingChargeRow = (mcRows as MCRow[])[0];
      }
    }

    // Fetch stone rates
    const [stoneRateRows] = await sequelize.query(
      `SELECT item_name, d_color_code, size_id, new_selling_rates::text FROM stone_rates`
    );
    const stoneRates = stoneRateRows as StoneRate[];

    // ── Calculate ──────────────────────────────────────────────────────────
    // Sequelize returns numeric columns as strings — parse all to numbers.

    const netWt         = Number(v.net_wt);
    const purity        = Number(v.purity);
    const silverWeight  = Number(v.silver_weight);
    const silverPurity  = Number(v.silver_purity);
    const platWeight    = Number(v.platinum_weight);
    const platPurity    = Number(v.platinum_purity);
    const otherStone    = Number(v.other_stone_charges);
    const storedPrice   = Number(v.stored_price);
    const dcolorId      = v.dcolor_id as string;

    // Metal rates
    const goldRate     = purity > 0 ? (metalRates[purity] ?? 0) : 0;
    const silverRate   = silverPurity > 0 ? (metalRates[silverPurity] ?? 0) : 0;
    const platRate     = platPurity > 0 ? (metalRates[platPurity] ?? 0) : 0;

    // Metal costs
    const goldCost     = round(netWt * goldRate);
    const silverCost   = silverWeight > 0 ? round(silverWeight * silverRate) : 0;
    const platCost     = platWeight > 0 ? round(platWeight * platRate) : 0;
    const totalMetal   = goldCost + silverCost + platCost;

    // Making charge
    const grossWeight = netWt + platWeight + silverWeight;
    let baseMaking = 0;
    let makingType = "";
    let makingRate = 0;

    if (makingChargeRow && mcCode) {
      makingType = makingChargeRow.calculate_wastage_amount_on;
      makingRate = makingChargeRow.wastage_rate_or_labour_charge;
      baseMaking = round(calcMaking(makingType, makingRate, grossWeight, goldRate));
    }

    // Markup on making
    const markupStr  = v.markup as string;
    let markupAmount = 0;
    let makingAfterMarkup = baseMaking;
    if (markupStr && markupStr !== "0") {
      const mv = parseAmount(markupStr);
      if (isPercent(markupStr)) {
        markupAmount = round(baseMaking * mv / 100);
      } else {
        markupAmount = round(mv);
      }
      makingAfterMarkup = round(baseMaking + markupAmount);
    }

    // Making discount
    const discMakingStr = v.disc_making as string;
    let makingDiscAmount = 0;
    if (discMakingStr && discMakingStr !== "0" && makingAfterMarkup > 0) {
      const dv = parseAmount(discMakingStr);
      makingDiscAmount = isPercent(discMakingStr)
        ? round(makingAfterMarkup * dv / 100)
        : round(dv);
    }

    // Diamond cost
    const diamonds: { weight: number; pieces: number; size: string }[] = [];
    if (v.dia_wt_1 && v.dia_pc_1 && v.dsizeid_1) diamonds.push({ weight: Number(v.dia_wt_1), pieces: Number(v.dia_pc_1), size: String(v.dsizeid_1) });
    if (v.dia_wt_2 && v.dia_pc_2 && v.dsizeid_2) diamonds.push({ weight: Number(v.dia_wt_2), pieces: Number(v.dia_pc_2), size: String(v.dsizeid_2) });
    if (v.dia_wt_3 && v.dia_pc_3 && v.dsizeid_3) diamonds.push({ weight: Number(v.dia_wt_3), pieces: Number(v.dia_pc_3), size: String(v.dsizeid_3) });

    let diamondCost = 0;
    let diamondLines: { size: string; weight: number; rate: number; cost: number; itemName: string }[] = [];
    if (dcolorId && diamonds.length) {
      const result = calcDiamondCost(dcolorId, diamonds, stoneRates);
      diamondCost = round(result.cost);
      diamondLines = result.lines;
    }

    const totalStone = diamondCost + round(otherStone);

    // Stone discount
    const discStoneStr = v.disc_stone as string;
    let stoneDiscAmount = 0;
    if (discStoneStr && discStoneStr !== "0" && totalStone > 0) {
      const sv = parseAmount(discStoneStr);
      stoneDiscAmount = isPercent(discStoneStr)
        ? round(totalStone * sv / 100)
        : round(sv);
    }

    // Final prices
    const subtotal             = totalMetal + makingAfterMarkup + totalStone;
    const compareAtPrice       = round(subtotal * 1.03);
    const subtotalWithDisc     = subtotal - makingDiscAmount - stoneDiscAmount;
    const finalPrice           = round(subtotalWithDisc * 1.03);
    const gstOnFinal           = round(subtotalWithDisc * 0.03);
    const gstOnCompare         = round(subtotal * 0.03);

    return NextResponse.json({
      sku: v.sku as string,
      storedPrice,
      calculatedPrice: finalPrice,
      compareAtPrice,

      metal: {
        gold:     { weight: netWt,        purity, rate: goldRate,   cost: goldCost   },
        silver:   { weight: silverWeight, purity: silverPurity, rate: silverRate, cost: silverCost },
        platinum: { weight: platWeight,   purity: platPurity,   rate: platRate,   cost: platCost  },
        total: totalMetal,
      },

      making: {
        code:          mcCode,
        type:          makingType,
        rate:          makingRate,
        grossWeight,
        base:          baseMaking,
        markup:        markupStr !== "0" ? markupStr : null,
        markupAmount,
        afterMarkup:   makingAfterMarkup,
        discount:      discMakingStr !== "0" ? discMakingStr : null,
        discountAmount: makingDiscAmount,
        net:           makingAfterMarkup - makingDiscAmount,
      },

      stone: {
        dcolorId: dcolorId || null,
        diamonds: diamondLines,
        diamondCost,
        otherCharges: round(otherStone),
        total: totalStone,
        discount:      discStoneStr !== "0" ? discStoneStr : null,
        discountAmount: stoneDiscAmount,
        net: totalStone - stoneDiscAmount,
      },

      summary: {
        subtotal,
        totalDiscount:  makingDiscAmount + stoneDiscAmount,
        subtotalAfterDiscount: subtotalWithDisc,
        gst:            gstOnFinal,
        gstRate:        "3%",
        finalPrice,
        gstOnCompare,
        compareAtPrice,
      },
    });
  } catch (err) {
    console.error("[breakdown GET]", err);
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}
