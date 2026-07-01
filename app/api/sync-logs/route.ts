import { NextRequest, NextResponse } from 'next/server';
import getPool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
   try {
      const { searchParams } = new URL(request.url);
      const jobId = searchParams.get('id');

      if (!jobId) {
         return NextResponse.json({ error: 'Missing job id' }, { status: 400 });
      }

      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = parseInt(searchParams.get('limit') || '100', 10);
      const offset = (page - 1) * limit;

      const pool = getPool();

      const [countResult, dataResult] = await Promise.all([
         pool.query(
            `SELECT COUNT(*) FROM sync_job_logs WHERE job_id = $1`,
            [jobId]
         ),
         pool.query(
            `SELECT sku, shopify_variant_id as variant_id, old_price, new_price, status, message, created_at
          FROM sync_job_logs
          WHERE job_id = $1
          ORDER BY CASE status WHEN 'failed' THEN 0 ELSE 1 END, created_at DESC
          LIMIT $2 OFFSET $3`,
            [jobId, limit, offset]
         ),
      ]);

      const total = parseInt(countResult.rows[0].count, 10);

      return NextResponse.json({
         data: dataResult.rows,
         pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
         },
      });
   } catch (error) {
      console.error('Error fetching sync logs:', error);
      return NextResponse.json({ error: 'Failed to fetch sync logs' }, { status: 500 });
   }
}
