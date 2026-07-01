// app/api/roles/route.ts
import { NextRequest, NextResponse } from "next/server";
import  MasterRole  from "@/models/MasterRole";
import { Op } from "sequelize";
import { requireTokenCookie } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authError = requireTokenCookie(req);
  if (authError) return authError;
  const { role, role_code } = await req.json();
  if (!role || !role_code)
    return NextResponse.json({ error: 'role & role_code required' }, { status: 400 });

  const existing = await MasterRole.findOne({
    where: { [Op.or]: [{ role: role.trim() }, { role_code: role_code.trim() }] },
  });
  if (existing)
    return NextResponse.json({ error: `Role "${role}" already exists.` }, { status: 409 });

  const created = await MasterRole.create({ role, role_code });
  return NextResponse.json(created, { status: 201 });
}

// GET handler async func
export async function GET(req: NextRequest) {
  const authError = requireTokenCookie(req);
  if (authError) return authError;
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const roles = await MasterRole.findAll({ where });

    return NextResponse.json(roles, { status: 200 });
  } catch (err: any) {
    console.error('GET /api/roles →', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}