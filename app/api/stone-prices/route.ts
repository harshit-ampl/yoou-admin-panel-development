import { StonePrice } from "@/models";
import { StonePriceAttributes } from "@/types/StonePrices";
import { NextRequest, NextResponse } from "next/server";
import { Optional } from "sequelize";
import UserLog from "@/models/UserLog";
import { auth } from '@/lib/auth';

interface StonePrices extends Optional<StonePriceAttributes, "id"> {}

export async function GET(req: NextRequest, res: NextResponse) {
  try {
    const stones = await StonePrice.findAll({
      order: [["sr_no", "ASC"],["size_id", "ASC"]],

    });
    return NextResponse.json(
      {
        stones,
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

    const { sr_no, item_name, d_color_code, size_id, new_selling_rates } =
      (await req.json()) as StonePrices;

    const newStone = await StonePrice.create({
      sr_no,
      item_name,
      d_color_code,
      size_id,
      new_selling_rates,
    });

    const changesNewToLog: Partial<StonePrice> = {};
    changesNewToLog.sr_no = sr_no;
    changesNewToLog.item_name = item_name;
    changesNewToLog.d_color_code = d_color_code;
    changesNewToLog.size_id = size_id;
    changesNewToLog.new_selling_rates = new_selling_rates;
    
    await UserLog.create({
      user_id: Number(session.user.id),           
      module: "Stone Prices",    
      action: "add",
      // old_data  :changes,
      new_data  :changesNewToLog,
      created_by: session.user.email, 
    });

    return NextResponse.json({ newStone }, { status: 201 });
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

    const { id, sr_no, item_name, d_color_code, size_id, new_selling_rates } =
      (await req.json()) as StonePrices;


    if (!id) {
      return NextResponse.json(
        { error: "Stone ID is required for updating" },
        { status: 400 }
      );
    }

    const stone = await StonePrice.findByPk(id);
    

    if (!stone) {
      return NextResponse.json({ error: "Stone not found" }, { status: 404 });
    }

     // 3. Build `changes` object with only modified, defined props
    const changes: Partial<StonePrice> = {};
    const changesNewToLog: Partial<StonePrice> = {};
    if (sr_no !== undefined && sr_no !== stone.sr_no) {
      changes.sr_no = stone.sr_no;
      changesNewToLog.sr_no = sr_no;
    }
    if (item_name !== undefined && item_name !== stone.item_name) {
      changes.item_name = stone.item_name;
      changesNewToLog.item_name = item_name;
    }
    if (d_color_code !== undefined && d_color_code !== stone.d_color_code) {
      changes.d_color_code = stone.d_color_code;
      changesNewToLog.d_color_code = d_color_code;
    }
    if (size_id !== undefined && size_id !== stone.size_id) {
      changes.size_id = stone.size_id;
      changesNewToLog.size_id = size_id;
    }

    if (new_selling_rates !== undefined && new_selling_rates !== stone.new_selling_rates) {
      changes.new_selling_rates = stone.new_selling_rates;
      changesNewToLog.new_selling_rates = new_selling_rates;
    }
    

    if (changesNewToLog && Object.keys(changesNewToLog)?.length > 0) {
      await UserLog.create({
        user_id: Number(session.user.id),           
        module: "Stone Prices",    
        action: "edit",
        old_data  :changes,
        new_data  :changesNewToLog,
        created_by: session.user.email, 
      });
    }

    await stone.update({
      sr_no,
      item_name,
      d_color_code,
      size_id,
      new_selling_rates,
    });

    return NextResponse.json({ updatedStone: stone }, { status: 200 });
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
        const rows = await StonePrice.findAll({ where: { id: { [Op.in]: body.ids } } });
        for (const row of rows) {
          await UserLog.create({
            user_id: Number(session.user.id),
            module: "Stone Prices",
            action: "delete",
            old_data: row.toJSON(),
            created_by: session.user.email,
          });
        }
        const deleted = await StonePrice.destroy({ where: { id: { [Op.in]: body.ids } } });
        return NextResponse.json({ deleted }, { status: 200 });
      }
    }

    // Single delete: ?id=
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const stone = await StonePrice.findByPk(id);
    if (!stone) return NextResponse.json({ error: "Stone not found" }, { status: 404 });

    await UserLog.create({
      user_id: Number(session.user.id),
      module: "Stone Prices",
      action: "delete",
      old_data: stone,
      created_by: session.user.email,
    });
    await stone.destroy();
    return NextResponse.json({ message: "Deleted successfully" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

// ── PATCH: bulk update rows ────────────────────────────────────────────────

const SP_EDITABLE = new Set(["sr_no", "item_name", "d_color_code", "size_id", "new_selling_rates"]);

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
        if (SP_EDITABLE.has(k) && v !== undefined && v !== "") filtered[k] = v;
      }
      if (!Object.keys(filtered).length) continue;
      const row = await StonePrice.findByPk(id);
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
        module: "Stone Prices",
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
