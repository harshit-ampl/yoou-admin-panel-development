import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config();

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
});

const BATCH_SIZE = 500;

export async function GET(req: NextRequest) {
	/* 1) authenticate ---------------------------------------------------- */
	const session = await auth(req);
	if (!session || 'error' in session) {
		return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
	}
	const allRows: any[] = [];
	// let offset = 6300;	// test
	let offset = 0;	// live
	let hasMore = true;
	try {
		while (hasMore) {
			const result = await pool.query(
				`SELECT sku, barcode, net_wt, purity, making_charges_code, other_stone_charges, dcolor_id, dia_wt_1, dia_pc_1, dsizeid_1, dia_wt_2, dia_pc_2, dsizeid_2, dia_wt_3, dia_pc_3, dsizeid_3, discount_percentage_on_making_charge, discount_percentage_on_stone, markup, stone_count, COALESCE(silver_weight, 0) as silver_weight, silver_purity, COALESCE(platinum_weight, 0) as platinum_weight, platinum_purity, gross_weight FROM jewelry_variants ORDER BY id LIMIT $1 OFFSET $2`,
				[BATCH_SIZE, offset]
			);	// Don't modify any column. If modified, need to handle it on csv download option available on "Product Upload" page

			allRows.push(...result?.rows);
			hasMore = result?.rowCount === BATCH_SIZE;
			offset += BATCH_SIZE;
		}
		return NextResponse.json({ status: 'success', data: allRows }, { status: 200 });
	} catch (error) {
		return NextResponse.json({ status: (error as Error)?.message }, { status: 500 });
	}
	// console.log(result.rowCount, "result");
}