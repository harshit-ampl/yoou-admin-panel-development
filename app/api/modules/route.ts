import { NextRequest, NextResponse } from 'next/server';
import Module from '@/models/Module';
import { requireTokenCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = requireTokenCookie(req);
  if (authError) return authError;
  const modules = await Module.findAll({ order: [['id', 'asc']] });
  return NextResponse.json(modules);
}
