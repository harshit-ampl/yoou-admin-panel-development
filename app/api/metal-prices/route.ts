import { MetalPrice } from "@/models";
import { MetalPriceAttributes } from "@/types/MetalPrices";
import { NextRequest, NextResponse } from "next/server";
import { Optional } from "sequelize";
import UserLog from "@/models/UserLog";
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface MetalPrices extends Optional<MetalPriceAttributes, "id"> {}

const RATE_FIELDS = ["sale_rate", "purity", "purity_percentage", "urd_rate", "exchange_rate"] as const;

function findNegativeRateField(data: Record<string, any>): string | null {
  for (const field of RATE_FIELDS) {
    const val = data[field];
    if (val !== undefined && val !== null && val !== "") {
      const num = parseFloat(String(val));
      if (!isNaN(num) && num < 0) return field.replace(/_/g, " ");
    }
  }
  return null;
}

export async function GET(req: NextRequest, res: NextResponse) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    if (type === "count") {
      const count = await MetalPrice.count();
      return NextResponse.json({ count }, { status: 200 });
    }
    const metals = await MetalPrice.findAll();

    const filteredMetals = metals.filter(
      (metal) => metal.purity_description !== "24K"
    );

    return NextResponse.json(
      {
        metals: filteredMetals,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth(req);

    if (!session || 'error' in session || !('user' in session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      metal_type,
      sale_rate,
      purity,
      exchange_rate,
      purity_description,
      purity_percentage,
      urd_rate,
      ecommerce_description,
    } = (await req.json()) as MetalPrices;

    const negField = findNegativeRateField({ sale_rate, purity, exchange_rate, purity_percentage, urd_rate });
    if (negField) {
      return NextResponse.json({ error: `${negField} cannot be negative` }, { status: 400 });
    }

    const newMetal = await MetalPrice.create({
      open_date: new Date(), // Current date
      datetime: new Date(), // Current timestamp
      metal_type,
      sale_rate: parseFloat(sale_rate.toString()),
      purity: parseFloat(purity.toString()),
      exchange_rate: parseFloat(exchange_rate.toString()),
      purity_description,
      purity_percentage: parseFloat(purity_percentage.toString()),
      urd_rate: parseFloat(urd_rate.toString()),
      ecommerce_description,
    });

    const changesNewToLog: Partial<MetalPrice> = {};
    changesNewToLog.sale_rate = sale_rate;
    changesNewToLog.purity = purity;
    changesNewToLog.purity_description = purity_description;
    changesNewToLog.purity_percentage = purity_percentage;
    changesNewToLog.ecommerce_description = ecommerce_description;

    await UserLog.create({
      user_id: Number(session?.user?.id),           
      module: "Metal Prices",    
      action: "add",
      // old_data  :changes,
      new_data  :changesNewToLog,
      created_by: session?.user?.email, 
    });

    return NextResponse.json({ newMetal }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth(req);

    if (!session || 'error' in session || !('user' in session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const {
      id,
      metal_type,
      sale_rate,
      purity,
      exchange_rate,
      purity_description,
      purity_percentage,
      urd_rate,
      ecommerce_description,
    } = (await req.json()) as MetalPrices;

    if (!id) {
      return NextResponse.json(
        { error: "Metal ID is required for updating" },
        { status: 400 }
      );
    }

    const negField = findNegativeRateField({ sale_rate, purity, exchange_rate, purity_percentage, urd_rate });
    if (negField) {
      return NextResponse.json({ error: `${negField} cannot be negative` }, { status: 400 });
    }

    const metal = await MetalPrice.findByPk(id);

    if (!metal) {
      return NextResponse.json({ error: "Metal not found" }, { status: 404 });
    }

    const changes: Partial<MetalPrice> = {};
    const changesNewToLog: Partial<MetalPrice> = {};
    if (sale_rate !== undefined && sale_rate != metal.sale_rate) {
      changes.sale_rate = metal.sale_rate;
      changesNewToLog.sale_rate = sale_rate;
    }
    if (purity !== undefined && purity != metal.purity) {
      changes.purity = metal.purity;
      changesNewToLog.purity = purity;
    }
    if (purity_description !== undefined && purity_description != metal.purity_description) {
      changes.purity_description = metal.purity_description;
      changesNewToLog.purity_description = purity_description;
    }
    if (purity_percentage !== undefined && purity_percentage != metal.purity_percentage) {
      changes.purity_percentage = metal.purity_percentage;
      changesNewToLog.purity_percentage = purity_percentage;
    }
    if (ecommerce_description !== undefined && ecommerce_description != metal.ecommerce_description) {
      changes.ecommerce_description = metal.ecommerce_description;
      changesNewToLog.ecommerce_description = ecommerce_description;
    }

    if (changesNewToLog && Object.keys(changesNewToLog)?.length > 0) {
      // const session = await auth(req);
      await UserLog.create({
        user_id: Number(session?.user?.id),           
        module: "Metal Prices",    
        action: "edit",
        old_data  :changes,
        new_data  :changesNewToLog,
        created_by: session?.user?.email, 
      });
    }

    await metal.update({
      open_date: new Date(), // Current date
      datetime: new Date(), // Current timestamp
      metal_type,
      sale_rate: parseFloat(sale_rate.toString()),
      purity: parseFloat(purity.toString()),
      exchange_rate: parseFloat(exchange_rate.toString()),
      purity_description,
      purity_percentage: parseFloat(purity_percentage.toString()),
      urd_rate: parseFloat(urd_rate.toString()),
      ecommerce_description,
    });

    return NextResponse.json({ updatedMetal: metal }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth(req);
    if (!session || 'error' in session || !('user' in session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Bulk delete: body { ids: number[] }
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      let body: { ids?: number[] } = {};
      try { body = await req.json(); } catch {}
      if (body.ids?.length) {
        const { Op } = await import("sequelize");
        const rows = await MetalPrice.findAll({ where: { id: { [Op.in]: body.ids } } });
        for (const row of rows) {
          await UserLog.create({
            user_id: Number(session.user.id),
            module: "Metal Prices",
            action: "delete",
            old_data: row.toJSON(),
            created_by: session.user.email,
          });
        }
        const deleted = await MetalPrice.destroy({ where: { id: { [Op.in]: body.ids } } });
        return NextResponse.json({ deleted }, { status: 200 });
      }
    }

    // Single delete: ?id=
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Metal ID is required" }, { status: 400 });

    const metal = await MetalPrice.findByPk(id);
    if (!metal) return NextResponse.json({ error: "Metal not found" }, { status: 404 });

    await UserLog.create({
      user_id: Number(session.user.id),
      module: "Metal Prices",
      action: "delete",
      old_data: metal,
      created_by: session.user.email,
    });
    await metal.destroy();
    return NextResponse.json({ message: "Metal deleted successfully" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

// ── PATCH: bulk update rows ────────────────────────────────────────────────

const MP_EDITABLE = new Set([
  "metal_type", "sale_rate", "purity", "purity_description",
  "purity_percentage", "urd_rate", "ecommerce_description",
]);

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth(req);
    if (!session || 'error' in session || !('user' in session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { rows } = (await req.json()) as { rows: { id: number; changes: Record<string, string> }[] };
    if (!rows?.length) return NextResponse.json({ error: "rows required" }, { status: 400 });

    for (const { id, changes } of rows) {
      const negField = findNegativeRateField(changes);
      if (negField) {
        return NextResponse.json({ error: `Row ${id}: ${negField} cannot be negative` }, { status: 400 });
      }
    }

    let updated = 0;
    for (const { id, changes } of rows) {
      const filtered: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(changes)) {
        if (MP_EDITABLE.has(k) && v !== undefined && v !== "") {
          filtered[k] = ["sale_rate","purity","purity_percentage","urd_rate"].includes(k)
            ? parseFloat(v)
            : v;
        }
      }
      if (!Object.keys(filtered).length) continue;
      const row = await MetalPrice.findByPk(id);
      if (!row) continue;

      const oldData: Record<string, unknown> = {};
      const newData: Record<string, unknown> = {};
      for (const k of Object.keys(filtered)) {
        oldData[k] = (row as any)[k];
        newData[k] = filtered[k];
      }
      await row.update({ ...filtered, open_date: new Date(), datetime: new Date() });
      await UserLog.create({
        user_id: Number(session.user.id),
        module: "Metal Prices",
        action: "edit",
        old_data: oldData,
        new_data: newData,
        created_by: session.user.email,
      });
      updated++;
    }
    return NextResponse.json({ updated }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
