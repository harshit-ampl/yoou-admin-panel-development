import { PricingCode } from "@/models";
import { MakingChargeAttributes } from "@/types/PricingCodes";
// import { MakingChargeChangesInputAttr } from "@/types/PricingCodeChange";
import { NextRequest, NextResponse } from "next/server";
import { Optional } from "sequelize";
import UserLog from "@/models/UserLog";
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';
interface PricingCodes extends Optional<MakingChargeAttributes, "id"> {}
// interface MakingChargeChangesInput extends Optional<MakingChargeChangesInputAttr, "name"> {}



export async function GET(req: NextRequest, res: NextResponse) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    if (type === "count") {
      const count = await PricingCode.count();
      return NextResponse.json({ count }, { status: 200 });
    }
    const codes = await PricingCode.findAll();
    return NextResponse.json(
      {
        codes,
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

export async function POST(req: NextRequest, res: NextResponse) {
  try {
    const session = await auth(req);

    if (!session || 'error' in session || !('user' in session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      name,
      wastage_rate_or_labour_charge,
      calculate_wastage_amount_on,
      status,
    } = (await req.json()) as PricingCodes;

    const newCode = await PricingCode.create({
      name,
      wastage_rate_or_labour_charge,
      calculate_wastage_amount_on,
      status,
    });
    const changesNewToLog: Partial<PricingCodes> = {};
    changesNewToLog.name = name;
    changesNewToLog.wastage_rate_or_labour_charge = wastage_rate_or_labour_charge;
    changesNewToLog.calculate_wastage_amount_on = calculate_wastage_amount_on;

    await UserLog.create({
      user_id: Number(session.user.id),           
      module: "Making Charges",    
      action: "add",
      // old_data  :changes,
      new_data  :changesNewToLog,
      created_by: session.user.email, 
    });

    return NextResponse.json(
      {
        newCode,
      },
      { status: 201 }
    );
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      {
        error: (error as Error).message,
      },
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
      name,
      wastage_rate_or_labour_charge,
      calculate_wastage_amount_on,
      status,
    } = (await req.json()) as PricingCodes;

    if (!id) {
      return NextResponse.json(
        { error: "Metal ID is required for updating" },
        { status: 400 }
      );
    }

    const metal = await PricingCode.findByPk(id);

    if (!metal) {
      return NextResponse.json({ error: "Metal not found" }, { status: 404 });
    }

     /* 3️⃣  Build a **diff** object: only the keys whose values changed */
    const changes: Partial<PricingCodes> = {};
    const changesNewToLog: Partial<PricingCodes> = {};

    if (name !== undefined && name !== metal.name) {
      changes.name = metal.name;
      changesNewToLog.name = name;
    }

    if (
      wastage_rate_or_labour_charge !== undefined &&
      wastage_rate_or_labour_charge !== metal.wastage_rate_or_labour_charge
    ) {
      changes.wastage_rate_or_labour_charge = metal.wastage_rate_or_labour_charge;
      changesNewToLog.wastage_rate_or_labour_charge = wastage_rate_or_labour_charge;
    }

    if (
      calculate_wastage_amount_on !== undefined &&
      calculate_wastage_amount_on !== metal.calculate_wastage_amount_on
    ) {
      changes.calculate_wastage_amount_on = metal.calculate_wastage_amount_on;
      changesNewToLog.calculate_wastage_amount_on = calculate_wastage_amount_on;
    }

    if (changesNewToLog && Object.keys(changesNewToLog)?.length > 0) {
      await UserLog.create({
        user_id: Number(session.user.id),           
        module: "Making Charges",    
        action: "edit",
        old_data  :changes,
        new_data  :changesNewToLog,
        created_by: session.user.email, 
      });
    }

    await metal.update({
      name,
      wastage_rate_or_labour_charge,
      calculate_wastage_amount_on,
      status,
    });

    return NextResponse.json({ updatedCode: metal }, { status: 200 });
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
        const rows = await PricingCode.findAll({ where: { id: { [Op.in]: body.ids } } });
        for (const row of rows) {
          await UserLog.create({
            user_id: Number(session.user.id),
            module: "Making Charges",
            action: "delete",
            old_data: row.toJSON(),
            created_by: session.user.email,
          });
        }
        const deleted = await PricingCode.destroy({ where: { id: { [Op.in]: body.ids } } });
        return NextResponse.json({ deleted }, { status: 200 });
      }
    }

    // Single delete: ?id=
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const metal = await PricingCode.findByPk(id);
    if (!metal) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await UserLog.create({
      user_id: Number(session.user.id),
      module: "Making Charges",
      action: "delete",
      old_data: metal,
      created_by: session.user.email,
    });
    await metal.destroy();
    return NextResponse.json({ message: "Deleted successfully" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

// ── PATCH: bulk update rows ────────────────────────────────────────────────

const MC_EDITABLE = new Set(["wastage_rate_or_labour_charge", "calculate_wastage_amount_on", "status"]);

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth(req);
    if (!session || 'error' in session || !('user' in session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { rows } = (await req.json()) as { rows: { id: number; changes: Record<string, string> }[] };
    if (!rows?.length) return NextResponse.json({ error: "rows required" }, { status: 400 });

    let updated = 0;
    for (const { id, changes } of rows) {
      const filtered: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(changes)) {
        if (MC_EDITABLE.has(k) && v !== undefined && v !== "") filtered[k] = v;
      }
      if (!Object.keys(filtered).length) continue;
      const row = await PricingCode.findByPk(id);
      if (!row) continue;

      const oldData: Record<string, unknown> = {};
      const newData: Record<string, unknown> = {};
      for (const k of Object.keys(filtered)) {
        oldData[k] = (row as any)[k];
        newData[k] = filtered[k];
      }
      await row.update(filtered);
      await UserLog.create({
        user_id: Number(session.user.id),
        module: "Making Charges",
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
