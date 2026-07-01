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

      const pool = getPool();

      const result = await pool.query(
         `SELECT id, status, total_variants, processed_variants, success_count, fail_count, 
              started_at as created_at, completed_at, error_message
       FROM sync_jobs 
       WHERE id = $1`,
         [jobId]
      );

      if (result.rows.length === 0) {
         return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }

      return NextResponse.json(result.rows[0]);
   } catch (error) {
      console.error('Error fetching sync status:', error);
      return NextResponse.json({ error: 'Failed to fetch sync status' }, { status: 500 });
   }
}
