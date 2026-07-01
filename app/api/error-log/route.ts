import ErrorLog from "@/models/ErrorLog";
import { NextRequest, NextResponse } from "next/server";

import { Op } from "sequelize";
import { requireTokenCookie } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = requireTokenCookie(req);
  if (authError) return authError;
  console.log("Received GET request for /api/error-log");

  try {
    const { searchParams } = new URL(req.url);

    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const offset = (page - 1) * limit;
    const search = searchParams.get("search") || "";

    const fromDateStr = searchParams.get("fromDate");
    const toDateStr = searchParams.get("toDate");

    const whereCondition: any = {};

    // Search filter (sku)
    if (search) {
      whereCondition.sku = {
        [Op.iLike]: `%${search}%`,
      };
    }

    // Date range filter — dates arrive as "yyyy-MM-dd" in IST (local time).
    // Parse with explicit +05:30 offset so day boundaries are correct regardless of server timezone.
    if (fromDateStr || toDateStr) {
      const dateFilter: any = {};
      if (fromDateStr) {
        dateFilter[Op.gte] = new Date(`${fromDateStr}T00:00:00+05:30`);
      }
      if (toDateStr) {
        dateFilter[Op.lte] = new Date(`${toDateStr}T23:59:59.999+05:30`);
      }
      whereCondition.created_at = dateFilter;
    }

    // Query DB
    const { count, rows } = await ErrorLog.findAndCountAll({
      where: whereCondition,
      order: [["created_at", "DESC"]],
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    });

  } catch (error) {
    console.error("Error fetching error log:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch error log",
      message: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}