import { NextRequest, NextResponse } from 'next/server';

import Module from '@/models/Module';
import RolePermission from '@/models/RolePermission';
import  MasterRole  from '@/models/MasterRole';

export const dynamic = 'force-dynamic';

/* ---------- GET ?role_id=1 ----------------------------------------- */
export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('role_id');
  if (!id) return NextResponse.json({ error: 'role_id required' }, { status: 400 });

  // join modules to return names + actions
  // const rows = await RolePermission.findAll({
  //   where: { role_id: id },
  //   include: [{ model: Module, attributes: ['module', 'module_code'] }],
  // });
  const rows = await RolePermission.findAll({
  where: { role_id: id },
  include: [{ model: Module, as: 'module', attributes: ['module'] }],
  });


  console.log("RRRRRRRRRRRRRR")
  console.log(rows)

  const matrix: Record<string, Record<string, boolean>> = {};
  rows.forEach((r: any) => {
    const mod = r.module.module;
    matrix[mod] ??= {};
    matrix[mod][r.action] = r.granted;
  });

  return NextResponse.json(matrix);
}

/* ---------- PUT ?role_id=1 ----------------------------------------- */
export async function PUT(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('role_id');
  if (!id) return NextResponse.json({ error: 'role_id required' }, { status: 400 });

  const body = await req.json(); // { [module]: { Add: true, ... } }
  const role = await MasterRole.findByPk(id);
  if (!role) return NextResponse.json({ error: 'role not found' }, { status: 404 });

  // fetch module IDs once
  const modules = await Module.findAll();
  const codeToId = Object.fromEntries(modules.map((m) => [m.module, m.id]));

  const bulk: any[] = [];
  Object.entries(body).forEach(([moduleName, actions]) => {
    const module_id = codeToId[moduleName];
    if (!module_id) return;
    Object.entries(actions as Record<string, boolean>).forEach(([action, granted]) => {
      bulk.push({ role_id: id, module_id, action, granted });
    });
  });

  // Upsert every row
  await Promise.all(
    bulk.map(({ role_id, module_id, action, granted }) =>
      RolePermission.upsert({ role_id, module_id, action, granted })
    )
  );

  return NextResponse.json({ message: 'saved' });
}
