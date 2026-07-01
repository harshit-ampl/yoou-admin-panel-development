import { NextResponse } from 'next/server';
import Module from '@/models/Module';

export const dynamic = 'force-dynamic';

export async function GET() {
  const modules = await Module.findAll({ order: [['id', 'asc']] });
  return NextResponse.json(modules);
}
