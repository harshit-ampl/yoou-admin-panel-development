import { NextResponse ,NextRequest} from "next/server";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { stringify } from "csv-stringify/sync";
import { formatToSQLDateTime } from "@/lib/utils";
import { requireTokenCookie } from "@/lib/auth";

export const dynamic = 'force-dynamic';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(req: NextRequest) {
  const authError = requireTokenCookie(req);
  if (authError) return authError;
  try {
    const { searchParams } = new URL(req.url);
   const status = searchParams.get("status")?.trim();
const search = searchParams.get("search")?.trim();
const fromDate = searchParams.get("fromDate")?.trim();
const toDate = searchParams.get("toDate")?.trim();

const conditions: string[] = [];
const values: any[] = [];

if (status && status !== "All") {
  conditions.push(`a.status = $${values.length + 1}`);
  values.push(status);
}

if (search) {
  const placeholder = `$${values.length + 1}`;
  conditions.push(`(
    a.firstname ILIKE ${placeholder} OR 
    a.txnid ILIKE ${placeholder} OR 
    a.email ILIKE ${placeholder} OR 
    a.phone ILIKE ${placeholder}
  )`);
  values.push(`%${search}%`);
}

if (fromDate) {
  const startOfDay = new Date(fromDate);
  startOfDay.setHours(0, 0, 0, 0);
  const sqlFrom = formatToSQLDateTime(startOfDay);
  console.log("📆 fromDate:", sqlFrom);
  conditions.push(`a.created_at >= $${values.length + 1}`);
  values.push(sqlFrom);
}

if (toDate) {
  const endOfDay = new Date(toDate);
  endOfDay.setHours(23, 59, 59, 999);
  const sqlTo = formatToSQLDateTime(endOfDay);
  console.log("📆 toDate:", sqlTo);
  conditions.push(`a.created_at <= $${values.length + 1}`);
  values.push(sqlTo);
}

const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

const dataQuery = `
  SELECT DISTINCT ON (a.id) a.*, b.installment_no, b.scheme_code
  FROM payments AS a
  LEFT JOIN acme_payments AS b ON a.txnid = b.txnid
  ${whereClause}
  ORDER BY a.id, a.created_at DESC
`;

const { rows: payments } = await pool.query(dataQuery, values);
    const columns = [
      { key: "id", header: "ID" },
      { key: "txnid", header: "Transaction ID" },
      { key: "firstname", header: "Name" },
      { key: "email", header: "Email" },
      { key: "phone", header: "Phone" },
      { key: "amount", header: "Amount" },
      { key: "udf1", header: "Scheme No"},
      { key: "status", header: "Payment Status" },
      { key: "installment_no", header: "ACME No." },
      { key: "scheme_code", header: "Scheme Code" },
      { key: "created_at", header: "Created At" },
    ];

    const csvData = payments.map((payment) => ({
      id: payment.id,
      txnid: payment.txnid,
      firstname: payment.firstname,
      email: payment.email,
      phone: payment.phone,
      amount: `Rs.${payment.amount}`,
      udf1: JSON.parse(payment.request).udf1 ?? "",
      status: payment.status,
      installment_no: payment.installment_no || "-",
      scheme_code: payment.scheme_code || "-",
      created_at: new Date(payment.created_at).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      }),      
    }));

    const csv = stringify(csvData, {
      header: true,
      columns,
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=payments_export.csv",
      },
    });
  } catch (error) {
    console.error("Error fetching payments:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}