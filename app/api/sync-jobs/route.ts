import { NextRequest, NextResponse } from 'next/server';
import getPool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
   try {
      const { searchParams } = new URL(request.url);
      const page   = parseInt(searchParams.get('page')  || '1',  10);
      const limit  = parseInt(searchParams.get('limit') || '20', 10);
      const offset = (page - 1) * limit;
      const from   = searchParams.get('from') ?? null; // YYYY-MM-DD
      const to     = searchParams.get('to')   ?? null; // YYYY-MM-DD

      const pool = getPool();

      const params: unknown[] = [];
      const conditions: string[] = [];

      if (from) {
         params.push(from);
         conditions.push(`started_at >= $${params.length}::date`);
      }
      if (to) {
         params.push(to);
         conditions.push(`started_at < ($${params.length}::date + INTERVAL '1 day')`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const countParams = [...params];
      params.push(limit, offset);

      const [countResult, dataResult] = await Promise.all([
         pool.query(`SELECT COUNT(*) FROM sync_jobs ${where}`, countParams),
         pool.query(
            `SELECT id, status, total_variants, processed_variants, success_count, fail_count,
                    started_at, completed_at, error_message,
                    EXTRACT(EPOCH FROM (completed_at - started_at))::int AS duration_seconds
             FROM sync_jobs
             ${where}
             ORDER BY started_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
         ),
      ]);

      const total = parseInt(countResult.rows[0].count, 10);

      return NextResponse.json({
         data: dataResult.rows,
         pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
   } catch (error) {
      console.error('Error fetching sync jobs:', error);
      return NextResponse.json({ error: 'Failed to fetch sync jobs' }, { status: 500 });
   }
}
