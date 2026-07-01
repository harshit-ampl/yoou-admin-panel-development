import { NextRequest, NextResponse } from "next/server";
import UserLog from "@/models/UserLog";
import { Op, WhereOptions } from "sequelize";
import { UserLogAttributes } from "@/models/UserLog";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const page   = Math.max(1, parseInt(searchParams.get("page")  || "1",  10));
    const limit  = Math.max(1, parseInt(searchParams.get("limit") || "20", 10));
    const offset = (page - 1) * limit;

    const search  = searchParams.get("search")  || "";
    const module  = searchParams.get("module")  || "";
    const action  = searchParams.get("action")  || "";
    const user    = searchParams.get("user")    || "";
    const from    = searchParams.get("from")    || "";
    const to      = searchParams.get("to")      || "";

    const where: WhereOptions<UserLogAttributes> = {};

    if (module) where.module = module;
    if (action) where.action = action;
    if (user)   where.created_by = user;

    if (from || to) {
      const dateRange: Record<symbol, Date> = {};
      if (from) dateRange[Op.gte] = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        dateRange[Op.lte] = toDate;
      }
      (where as any).created_at = dateRange;
    }

    if (search) {
      (where as any)[Op.or] = [
        { module:     { [Op.iLike]: `%${search}%` } },
        { action:     { [Op.iLike]: `%${search}%` } },
        { created_by: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await UserLog.findAndCountAll({
      where,
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
    console.error("Error fetching user logs:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
