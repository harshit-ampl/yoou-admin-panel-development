import { NextRequest, NextResponse } from "next/server";
import getPool from "@/lib/db";
import { requireTokenCookie } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = requireTokenCookie(req);
  if (authError) return authError;
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId || isNaN(Number(jobId))) {
    return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });
  }
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, sync_job_id AS job_id, step_name, status, message, "createdAt" AS created_at
       FROM sync_job_steps
       WHERE sync_job_id = $1
       ORDER BY "createdAt" ASC, id ASC`,
      [Number(jobId)]
    );
    return NextResponse.json({ steps: result.rows });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
