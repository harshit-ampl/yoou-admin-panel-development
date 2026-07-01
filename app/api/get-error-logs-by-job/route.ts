import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Pool } from "pg";
import { S3Client, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import * as dotenv from "dotenv";
import { parse } from "csv-parse/sync";
dotenv.config();

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
});

const BATCH_SIZE = 500;

export async function GET(req: NextRequest) {
	/* 1) authenticate ---------------------------------------------------- */
	const session = await auth(req);
	if (!session || 'error' in session) {
		return NextResponse.json({ status: 'unauthenticated' }, { status: 401 });
	}
	
	const { searchParams } = new URL(req.url);
	const jobId = searchParams.get("id");
	if (!jobId) {
		return NextResponse.json({ status: 'Unable to find job id' }, { status: 300 });
	}
	const allSKUsWithErrs: any[] = [];
	let offset = 0;
	let hasMore = true;
	try {
		while (hasMore) {
			const result = await pool.query(
			  `SELECT sku, log_message FROM error_logs where job_id = ${jobId} LIMIT $1 OFFSET $2`,
			  [BATCH_SIZE, offset]
			);	// Don't modify any column. If modified, need to handle it on csv download option available on "Product Upload" page
		
			allSKUsWithErrs.push(...result?.rows);
			hasMore = result?.rowCount === BATCH_SIZE;
			offset += BATCH_SIZE;
		}

		// Build error map for quick lookup
		const errorMap = new Map<string, string>();
		for (const row of allSKUsWithErrs) {
			errorMap.set(String(row.sku), row.log_message || '');
		}

		// Get CSV from S3
		const s3FileName = `job_${jobId}.csv`;
		// const s3FileName = `test/job_${jobId}.csv`;  // for testting
		const BUCKET = process.env.S3_BUCKET || "";
		const s3 = new S3Client({ region: process.env.AWS_REGION || "" });
		const { Body } = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: s3FileName }));
		const csvContent = await new Response(Body as any).text();
		// console.log(csvContent, "csvContent");
		// Parse CSV
		const rows: string[][] = parse(csvContent, { skip_empty_lines: true });
		const header = rows.shift();
		if (!header) {
			return NextResponse.json({ status: 'Invalid CSV format' }, { status: 400 });
		}

		// Process rows and add err_msg column
		const processedData = rows.reduce((acc, row) => {
			const sku = row[0]?.trim();
			const errMsg = errorMap.get(sku) || '';
			
			// Skip if there is no err for the sku from csv and return previously created obj
			if (!errMsg) return acc;
			
			// Convert row to object with original columns + err_msg
			const rowObj: Record<string, any> = {};
			header.forEach((col, index) => {
			  rowObj[col] = row[index] || '';
			});
			rowObj['err_msg'] = errMsg;
			
			acc.push(rowObj);
			return acc;
		}, [] as Record<string, any>[]);
		// console.log(processedData, "processedData");
		return NextResponse.json({ status: 'success', data: processedData }, { status: 200 });
	} catch (error) {
		return NextResponse.json({ status: (error as Error)?.message }, { status: 500 });
	}
}