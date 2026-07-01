// app/api/file-upload/route.ts (or wherever your route file lives)
import { NextRequest, NextResponse } from "next/server";
// import { Op } from "sequelize";
import sequelize from "@/lib/sequelize";

export const dynamic = 'force-dynamic';
// import FileUpload from "@/models/FileUpload";   

export async function GET(req: NextRequest) {
  try {
    /* ---------- 1. Parse query-string params ---------- */
    const { searchParams } = new URL(req.url);

    const page   = Number(searchParams.get("page")  ?? 1);   
    const limit  = Number(searchParams.get("limit") ?? 10);  
    const offset = (page - 1) * limit;

    const search = (searchParams.get("search") ?? "").trim();

    /* ---------- 2. Build WHERE clause if a search term is present ---------- */
    const queryParams: unknown[] = [];
    let whereClause = "";
    if (search) {
      queryParams.push(`%${search}%`);
      whereClause = `
        WHERE
          "FileUpload"."filename" ILIKE $1 OR
          "FileUpload"."uploaded_by" ILIKE $1
      `;
    }

    const limitParam = queryParams.length + 1;
    const offsetParam = queryParams.length + 2;
    queryParams.push(limit, offset);

    /* ---------- 3. Fetch rows + total count using raw queries ---------- */
    const dataQuery = `
      SELECT
        "FileUpload".*,
        (SELECT COUNT(*) FROM error_logs el WHERE el.job_id = "FileUpload"."id") AS error_count
      FROM
        "file_upload" AS "FileUpload"
      ${whereClause}
      ORDER BY
        "FileUpload"."uploaded_at" DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam};
    `;

    const countQueryParams = search ? [queryParams[0]] : [];
    const countQuery = `
      SELECT
        COUNT(*)
      FROM
        "file_upload" AS "FileUpload"
      ${whereClause};
    `;

    const [rows] = await sequelize.query(dataQuery, { bind: queryParams });
    const [countResult] = await sequelize.query(countQuery, { bind: countQueryParams });
    const count = Number((countResult as { count: string }[])[0].count);

    /* ---------- 4. Return paginated response ---------- */
    return NextResponse.json({
      success   : true,
      data      : rows,
      pagination: {
        total      : count,
        page,
        limit,
        totalPages : Math.ceil(count / limit),
      },
    });
  } catch (error) {
    // console.error("Error fetching file uploads:", error);
    return NextResponse.json(
      {
        success : false,
        error   : "Failed to fetch file uploads",
        message : error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
