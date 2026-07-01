import { NextRequest, NextResponse } from "next/server";
import getPool from "@/lib/db";
import { requireTokenCookie } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = requireTokenCookie(req);
  if (authError) return authError;
  try {
    const pool = getPool();

    const [latestRes, recentRes, sevenDayRes] = await Promise.all([
      // Latest single sync job with full details
      pool.query(`
        SELECT id, status, total_variants, processed_variants, success_count, fail_count,
               started_at, completed_at, error_message,
               EXTRACT(EPOCH FROM (completed_at - started_at))::int AS duration_seconds
        FROM sync_jobs
        ORDER BY started_at DESC
        LIMIT 1
      `),

      // Last 10 jobs for trend
      pool.query(`
        SELECT id, status, total_variants, success_count, fail_count,
               started_at, completed_at,
               EXTRACT(EPOCH FROM (completed_at - started_at))::int AS duration_seconds
        FROM sync_jobs
        ORDER BY started_at DESC
        LIMIT 10
      `),

      // 7-day error stats from per-variant logs
      pool.query(`
        SELECT
          COUNT(*)                                           AS total_log_rows,
          COUNT(*) FILTER (WHERE status = 'failed')         AS failed_rows,
          COUNT(*) FILTER (WHERE status = 'success')        AS success_rows,
          COUNT(DISTINCT job_id)                            AS jobs_with_logs
        FROM sync_job_logs
        WHERE created_at > NOW() - INTERVAL '7 days'
      `),
    ]);

    const latest   = latestRes.rows[0] ?? null;
    const recent   = recentRes.rows;
    const sevenDay = sevenDayRes.rows[0];

    return NextResponse.json({
      latest,
      recent,
      sevenDay: {
        totalRows:   Number(sevenDay.total_log_rows),
        failedRows:  Number(sevenDay.failed_rows),
        successRows: Number(sevenDay.success_rows),
        jobsCount:   Number(sevenDay.jobs_with_logs),
      },
    });
  } catch (error) {
    console.error("[sync-health]", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
