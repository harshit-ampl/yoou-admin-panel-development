// api/master-privileges.ts
import { MasterPrivilege } from "@/models";
import { NextRequest, NextResponse } from "next/server";
import { Op } from 'sequelize';
import { requireTokenCookie } from "@/lib/auth";

export const dynamic = 'force-dynamic';

// GET /api/master-privileges - Get all master privileges with optional filtering
// export const GET = async (req: NextRequest) => {
//   try {
//     const { searchParams } = new URL(req.url);
//     const section_code = searchParams.get('section_code');
//     const screen_code = searchParams.get('screen_code');
//     const module_code = searchParams.get('module_code');
//     const page = searchParams.get('page') ?? '1';
//     const limit = searchParams.get('limit') ?? '10';
//     const search = searchParams.get('search');

//     // Validate and parse pagination parameters
//     const pageNumber = Math.max(1, parseInt(page, 10) || 1;
//     const limitNumber = Math.max(1, parseInt(limit, 10)) || 10;
//     const offset = (pageNumber - 1) * limitNumber;
    
//     const whereClause: Record<string, any> = {};
    
//     // Add exact match filters if provided
//     if (section_code) whereClause.section_code = section_code;
//     if (screen_code) whereClause.screen_code = screen_code;
//     if (module_code) whereClause.module_code = module_code;
    
//     // Add search filter if provided
//     if (search?.trim()) {
//       whereClause[Op.or] = [
//         { section: { [Op.iLike]: `%${search.trim()}%` } },
//         { screen: { [Op.iLike]: `%${search.trim()}%` } },
//         { module: { [Op.iLike]: `%${search.trim()}%` } },
//         { action_name: { [Op.iLike]: `%${search.trim()}%` } },
//       ];
//     }

//     const { count, rows } = await MasterPrivilege.findAndCountAll({
//       where: whereClause,
//       limit: limitNumber,
//       offset,
//       order: [['created_at', 'DESC']],
//     });

//     return NextResponse.json({
//       success: true,
//       data: rows,
//       pagination: {
//         total: count,
//         page: pageNumber,
//         limit: limitNumber,
//         totalPages: Math.ceil(count / limitNumber),
//       },
//     });
//   } catch (error) {
//     console.error('Error fetching master privileges:', error);
//     return NextResponse.json({
//       success: false,
//       message: 'Error fetching master privileges',
//       error: error instanceof Error ? error.message : 'Unknown error',
//     }, { status: 500 });
//   }
// };


// GET /api/master-privileges/[id] - Get single master privilege
// export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
//   try {
//     const { id } = params;
    
//     const privilege = await MasterPrivilege.findByPk(id);
    
//     if (!privilege) {
//       return NextResponse.json({
//         success: false,
//         message: 'Master privilege not found',
//       }, { status: 404 });
//     }

//     return NextResponse.json({
//       success: true,
//       data: privilege,
//     });
//   } catch (error) {
//     return NextResponse.json({
//       success: false,
//       message: 'Error fetching master privilege',
//       error: error instanceof Error ? error.message : 'Unknown error',
//     }, { status: 500 });
//   }
// };
// POST /api/master-privileges - Create new master privilege
export const POST = async (req: NextRequest) => {
  const authError = requireTokenCookie(req);
  if (authError) return authError;
  try {
    const privilegeData = await req.json();
    
    const newPrivilege = await MasterPrivilege.create(privilegeData);
    
    return NextResponse.json({
      success: true,
      message: 'Master privilege created successfully',
      data: newPrivilege,
    }, { status: 201 });
  } catch (error: any) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return NextResponse.json({
        success: false,
        message: 'Duplicate entry: This screen, module, and action combination already exists',
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: false,
      message: 'Error creating master privilege',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
};

// PUT /api/master-privileges/[id] - Update master privilege
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireTokenCookie(req);
  if (authError) return authError;
  try {
    const { id } = params;
    const updateData = await req.json();
    
    const privilege = await MasterPrivilege.findByPk(id);
    
    if (!privilege) {
      return NextResponse.json({
        success: false,
        message: 'Master privilege not found',
      }, { status: 404 });
    }
    
    await privilege.update(updateData);
    
    return NextResponse.json({
      success: true,
      message: 'Master privilege updated successfully',
      data: privilege,
    });
  } catch (error: any) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return NextResponse.json({
        success: false,
        message: 'Duplicate entry: This screen, module, and action combination already exists',
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: false,
      message: 'Error updating master privilege',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
};



// DELETE /api/master-privileges/[id] - Delete master privilege
export async function DELETE(req: NextRequest, { params }: { params: { id: string } })  {
  const authError = requireTokenCookie(req);
  if (authError) return authError;
  try {
    const { id } = params;

    const privilege = await MasterPrivilege.findByPk(id);

    if (!privilege) {
      return NextResponse.json({
        success: false,
        message: 'Master privilege not found',
      }, { status: 404 });
    }

    await privilege.destroy();
    
    return NextResponse.json({
      success: true,
      message: 'Master privilege deleted successfully',
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Error deleting master privilege',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
};


// GET /api/master-privileges/sections - Get unique sections
export const GET = async (req: NextRequest) => {
  const authError = requireTokenCookie(req);
  if (authError) return authError;
  try {
    const sections = await MasterPrivilege.findAll({
      attributes: ['section', 'section_code'],
      group: ['section', 'section_code'],
      where: {
        section: { [Op.ne]: null },
        section_code: { [Op.ne]: null },
      },
    });
    
    return NextResponse.json({
      success: true,
      data: sections,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Error fetching sections',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
};


// GET /api/master-privileges/screens/:section_code - Get screens by section
// export const getScreensBySection = async (req: Request, res: Response) => {
//   try {
//     const { section_code } = req.params;
    
//     const screens = await MasterPrivilege.findAll({
//       attributes: ['screen', 'screen_code'],
//       where: { section_code },
//       group: ['screen', 'screen_code'],
//     });
    
//     res.status(200).json({
//       success: true,
//       data: screens,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: 'Error fetching screens',
//       error: error instanceof Error ? error.message : 'Unknown error',
//     });
//   }
// };

// GET /api/master-privileges/modules/:screen_code - Get modules by screen
// export const getModulesByScreen = async (req: Request, res: Response) => {
//   try {
//     const { screen_code } = req.params;
    
//     const modules = await MasterPrivilege.findAll({
//       attributes: ['module', 'module_code'],
//       where: { screen_code },
//       group: ['module', 'module_code'],
//     });
    
//     res.status(200).json({
//       success: true,
//       data: modules,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: 'Error fetching modules',
//       error: error instanceof Error ? error.message : 'Unknown error',
//     });
//   }
// };