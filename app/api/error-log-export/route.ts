import { NextResponse } from "next/server";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { stringify } from "csv-stringify/sync";

export const dynamic = 'force-dynamic';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim();
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    const queryParams: any[] = [];
    const conditions: string[] = [];

    if (search) {
      queryParams.push(`%${search}%`);
      conditions.push(`sku ILIKE $${queryParams.length}`);
    }

    if (fromDate) {
      queryParams.push(`${fromDate} 00:00:00`);
      conditions.push(`created_at >= $${queryParams.length}`);
    }

    if (toDate) {
      queryParams.push(`${toDate} 23:59:59`);
      conditions.push(`created_at <= $${queryParams.length}`);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const dataQuery = `
      SELECT id, sku, log_message, created_at
      FROM error_logs
      ${whereClause}
      ORDER BY created_at DESC
    `;

    const { rows } = await pool.query(dataQuery, queryParams);
    const formattedRows = rows.map((row) => ({
      ...row,
      created_at: new Date(row.created_at).toISOString().replace("T", " ").replace("Z", ""),
    }));

    const csv = stringify(formattedRows, {
      header: true,
      columns: [
        { key: "sku", header: "SKU" },
        { key: "log_message", header: "Message" },
        { key: "created_at", header: "Timestamp" },
      ],
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=error_logs.csv",
      },
    });
  } catch (error) {
    console.error("Error exporting error logs:", error);
    return NextResponse.json(
      { error: "Failed to export CSV" },
      { status: 500 }
    );
  }
}