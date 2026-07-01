import { NextResponse } from "next/server";
import getPool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const pool = getPool();
    const [syncResult, uploadResult] = await Promise.all([
      pool.query(`SELECT id FROM sync_jobs WHERE status = 'processing' LIMIT 1`),
      pool.query(`SELECT id FROM file_upload WHERE job_status IN ('upload_initiated', 'processing') LIMIT 1`),
    ]);

    const isRunning = syncResult.rows.length > 0 || uploadResult.rows.length > 0;

    return NextResponse.json({ isRunning });
  } catch (error) {
    console.error("Error checking active job:", error);
    return NextResponse.json({ isRunning: false });
  }
}

export async function DELETE() {
  try {
    const pool = getPool();
    await Promise.all([
      pool.query(
        `UPDATE file_upload SET job_status = 'failed' WHERE job_status IN ('upload_initiated', 'processing')`
      ),
      pool.query(
        `UPDATE sync_jobs SET status = 'failed' WHERE status = 'processing'`
      ),
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling active job:", error);
    return NextResponse.json({ error: "Failed to cancel job" }, { status: 500 });
  }
}
