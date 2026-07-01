// import { NextRequest, NextResponse } from 'next/server';
// import RolePermission from '@/models/RolePermission';
// import Module from '@/models/Module';
// import { MasterRole } from '@/models/MasterRole';
// import { auth } from '@/lib/auth';
//           // your own session helper

// export async function GET(req: NextRequest) {
//   /* —————————————————— 1) authenticate —————————————————— */

//   const session = await auth(req);
//   if (!session)
//     return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
 
//   const role_code  = session.user.role_code;       // e.g. 'finance_manager'

//      console.log("HHHHHHHHHHHHHHHHHHHHHHHHHHHH")
//      console.log()
//   console.log(role_code)
//   /* —————————————————— 2) resolve role ID —————————————————— */
//   const role = await MasterRole.findOne({ where: { role_code } });



//   if (!role)
//     return NextResponse.json({ error: 'role not found' }, { status: 404 });
 
//   /* —————————————————— 3) fetch granted permissions —————————————————— */
//   const rows = await RolePermission.findAll({
//     where: { role_id: role.id, granted: true },
//     include: [{ model: Module, as: 'module', attributes: ['module'] }],
//   });

//   /* —————————————————— 4) build { [module]: [actions…] } —————————————————— */
//   const perms: Record<string, string[]> = {};

//   rows.forEach((r: any) => {
//     const modName = r.module.module;        // e.g. 'Client'
//     (perms[modName] ??= []).push(r.action); // 'Add', 'Edit', etc.
//   });
//   console.log("perms")
//   console.log(perms)
//   return NextResponse.json(perms);          // => { Client: ['Add','View'], … }
// }


import { NextRequest, NextResponse } from 'next/server';
import RolePermission from '@/models/RolePermission';
import Module from '@/models/Module';
import  MasterRole  from '@/models/MasterRole';
import { auth } from '@/lib/auth';

const FULL_ACTIONS = ['Add', 'Edit', 'View', 'Delete'] as const;
type Action = (typeof FULL_ACTIONS)[number];

export async function GET(req: NextRequest) {
  /* 1) authenticate ---------------------------------------------------- */
  const session = await auth(req);
  if (!session || 'error' in session)
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const role_code  = session.user.role_code;          // e.g. 'super_admin'

  /* 2) resolve role ---------------------------------------------------- */
  const role = await MasterRole.findOne({ where: { role_code } });
  if (!role)
    return NextResponse.json({ error: 'role not found' }, { status: 404 });
console.log("role_code")
console.log(role_code)
  /* 3‑a) SPECIAL‑CASE • Super Admin  ----------------------------------- */
  if (role_code === 'super_admin') {
    const modules = await Module.findAll({ attributes: ['module'] });

    const perms: Record<string, Action[]> = {};
    modules.forEach((m: any) => {
      // Dashboard typically only needs View; adjust if you stored that rule:
      perms[m.module] =
        m.module === 'Dashboard' ? (['View'] as Action[]) : ([...FULL_ACTIONS] as Action[]);
    });

    console.log("perms")
    console.log(perms)

    return NextResponse.json(perms);            // every module → all actions
  }

  /* 3‑b) regular roles ------------------------------------------------- */
  const rows = await RolePermission.findAll({
    where: { role_id: role.id, granted: true },
    include: [{ model: Module, as: 'module', attributes: ['module'] }],
  });

  const perms: Record<string, Action[]> = {};
  rows.forEach((r: any) => {
    const mod = r.module.module;
    (perms[mod] ??= []).push(r.action);
  });

  return NextResponse.json(perms);
}
