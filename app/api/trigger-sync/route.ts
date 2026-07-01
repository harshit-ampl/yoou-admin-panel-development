import { MetalPrice } from "@/models";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import getPool from "@/lib/db";
import UserLog from "@/models/UserLog";

export async function POST(req: NextRequest) {
  try {
    const session = await auth(req);

    if (!session || "error" in session || !("user" in session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if any job (sync or upload) is already running
    const pool = getPool();
    const [runningSyncResult, runningUploadResult] = await Promise.all([
      pool.query(`SELECT id FROM sync_jobs WHERE status = 'processing' LIMIT 1`),
      pool.query(`SELECT id FROM file_upload WHERE job_status IN ('upload_initiated', 'processing') LIMIT 1`),
    ]);
    if (runningSyncResult.rows.length > 0 || runningUploadResult.rows.length > 0) {
      return NextResponse.json(
        { error: "A process is already running. Please wait until it completes." },
        { status: 409 }
      );
    }

    // Fetch all metal prices from DB
    const metals = await MetalPrice.findAll();

    // Group by metal_type and map to camelCase payload
    const grouped: Record<string, any[]> = {};

    for (const metal of metals) {
      const type = metal.metal_type.toLowerCase();
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push({
        purity: (metal.purity == 96 && metal.metal_type == "silver") ? 2 : parseFloat(String(metal.purity)),
        urdRate: parseFloat(String(metal.urd_rate)) || 0,
        datetime: "",
        openDate: "",
        saleRate: parseFloat(String(metal.sale_rate)) || 0,
        exchangeRate: parseFloat(String(metal.exchange_rate)) || 0,
        purityPercentage: parseFloat(String(metal.purity_percentage)) || 0,
        purityDescription: String(metal.purity_description),
        ecommerceDescription: metal.ecommerce_description || null,
      });
    }

    // Build payload with current datetime
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const datetime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const openDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const payload: Record<string, any> = {
      ...grouped,
      datetime,
      openDate,
    };

    // Fire and forget — middleware saves rates and kicks off background sync goroutine
    const MW_URL = process.env.MIDDLEWARE_URL || "https://pngmiddleware.amplicommacp.com";
    fetch(`${MW_URL}/webhook/metal-rates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (response) => {
      if (!response.ok) {
        const detail = await response.text();
        console.error("Middleware metal-rates webhook failed:", detail);
      }
    }).catch((err) => {
      console.error("Middleware metal-rates webhook error:", err);
    });

    UserLog.create({
      user_id: Number((session as any).user?.id),
      module: "Sync",
      action: "trigger",
      new_data: { triggered_at: new Date().toISOString(), metal_types: Object.keys(grouped) },
      created_by: (session as any).user?.email ?? "",
    }).catch((e: unknown) => console.error("[trigger-sync] UserLog error:", e));

    return NextResponse.json(
      { message: "Price sync triggered successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error triggering sync:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
