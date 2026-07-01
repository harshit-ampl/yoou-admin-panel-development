import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId || isNaN(Number(jobId))) {
    return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });
  }
  try {
    const result = await pool.query(
      `SELECT id, job_id, step_name, status, message, created_at
       FROM file_upload_steps
       WHERE job_id = $1
       ORDER BY created_at ASC, id ASC`,
      [Number(jobId)]
    );
    return NextResponse.json({ steps: result.rows });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
