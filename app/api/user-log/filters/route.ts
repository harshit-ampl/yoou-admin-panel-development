import { NextRequest, NextResponse } from "next/server";
import UserLog from "@/models/UserLog";
import { QueryTypes } from "sequelize";
import sequelize from "@/lib/sequelize";
import { requireTokenCookie } from "@/lib/auth";

export const dynamic = 'force-dynamic';

/** GET /api/user-log/filters — returns distinct modules, actions, and users for filter dropdowns */
export async function GET(req: NextRequest) {
  const authError = requireTokenCookie(req);
  if (authError) return authError;
  try {
    const [modules, actions, users] = await Promise.all([
      sequelize.query<{ module: string }>(
        `SELECT DISTINCT module FROM user_logs WHERE module IS NOT NULL ORDER BY module`,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query<{ action: string }>(
        `SELECT DISTINCT action FROM user_logs WHERE action IS NOT NULL ORDER BY action`,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query<{ created_by: string }>(
        `SELECT DISTINCT created_by FROM user_logs WHERE created_by IS NOT NULL ORDER BY created_by`,
        { type: QueryTypes.SELECT }
      ),
    ]);

    return NextResponse.json({
      modules: modules.map((r) => r.module),
      actions: actions.map((r) => r.action),
      users:   users.map((r) => r.created_by),
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
