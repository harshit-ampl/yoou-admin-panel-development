import { NextRequest, NextResponse } from "next/server";
import sequelize from "@/lib/sequelize";
import { QueryTypes } from "sequelize";
import { formatToSQLDateTime } from "@/lib/utils"; 
interface CountResult {
  total: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    // Pagination params
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const requestedLimit = parseInt(searchParams.get("limit") || "10");
    const limit = Math.min(50, Math.max(1, requestedLimit)); // enforce 1 to 50 limit
    const offset = (page - 1) * limit;

    // Filters
    const status = searchParams.get("status")?.trim();
    const search = searchParams.get("search")?.trim();
    const fromDate = searchParams.get("fromDate")?.trim();
    const toDate = searchParams.get("toDate")?.trim();

    const conditions: string[] = [];
    const replacements: Record<string, any> = {};

    if (status && status !== "All") {
      conditions.push("a.status = :status");
      replacements.status = status;
    }

    if (search) {
      conditions.push(`(
        a.firstname LIKE :search OR 
        a.txnid LIKE :search OR 
        a.email LIKE :search OR 
        a.phone LIKE :search
      )`);
      replacements.search = `%${search}%`;
    }

    if (fromDate) {
      const startOfDay = new Date(fromDate);
      startOfDay.setHours(0, 0, 0, 0);
      const sqlFrom = formatToSQLDateTime(startOfDay);
      console.log("📆 fromDate:", sqlFrom);
      conditions.push("a.created_at >= :fromDate");
      replacements.fromDate = sqlFrom;
    }

    if (toDate) {
      const endOfDay = new Date(toDate);
      endOfDay.setHours(23, 59, 59, 999);
      const sqlTo = formatToSQLDateTime(endOfDay);
      console.log("📆 toDate:", sqlTo);
      conditions.push("a.created_at <= :toDate");
      replacements.toDate = sqlTo;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Use DISTINCT ON to avoid duplicate rows due to JOIN
    const dataQuery = `
      SELECT DISTINCT ON (a.id) a.*, b.installment_no, b.scheme_code
      FROM payments AS a
      LEFT JOIN acme_payments AS b ON a.txnid = b.txnid
      ${whereClause}
      ORDER BY a.id, a.created_at DESC
      LIMIT :limit OFFSET :offset
    `;

    const countQuery = `
      SELECT COUNT(DISTINCT a.id) AS total
      FROM payments AS a
      LEFT JOIN acme_payments AS b ON a.txnid = b.txnid
      ${whereClause}
    `;

    console.log(countQuery);

    const dataReplacements = { ...replacements, limit, offset };

    const [payments, countResult] = await Promise.all([
      sequelize.query(dataQuery, {
        type: QueryTypes.SELECT,
        replacements: dataReplacements,
      }),
      sequelize.query<CountResult>(countQuery, {
        type: QueryTypes.SELECT,
        replacements,
      }),
    ]);

    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    console.log(`Returned ${payments.length} payments for page ${page} of ${totalPages}`);

    return NextResponse.json(
      {
        success: true,
        data: payments,
        pagination: {
          currentPage: page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
          startRecord: offset + 1,
          endRecord: Math.min(offset + limit, total),
        },
        filters: {
          status: status || null,
          search: search || null,
          fromDate: fromDate || null,
          toDate: toDate || null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error fetching payments:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch payments",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
