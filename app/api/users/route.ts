import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import User from "@/models/Users";
import { auth } from '@/lib/auth';
import UserLog from "@/models/UserLog";
import { UserAttributes } from "@/types/Users";

export async function POST(req: NextRequest) {
  try {
    const session = await auth(req);

    if (!session || 'error' in session || !('user' in session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { username, password, role_code,email } = await req.json();

    if (!username || !password || !role_code || !email) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 409 }
      );
    }

    const password_hash = await bcrypt.hash(password, 10);

    const user = await User.create({ username, password_hash, role_code,email});

    const changesNewToLog: Partial<UserAttributes> = {};
    changesNewToLog.username = username;
    changesNewToLog.email = email;
    changesNewToLog.password_hash = password_hash;
    changesNewToLog.role_code = role_code;

    await UserLog.create({
      user_id: Number(session.user.id),           
      module: "User",    
      action: "add",
      // old_data  :changes,
      new_data  :changesNewToLog,
      created_by: session.user.email, 
    });

    return NextResponse.json({ message: "User has been created successfully.", user });
  } catch (error) {
    console.error("Create User Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

//GET handler to fetch users
const MAX_LIMIT = 10;
export async function GET(req: NextRequest) {
  try {
    // First authenticate the request
    const authResult = await auth(req);
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const { user } = authResult;
    const role_code = user.role_code;
    const ids = user.id;

    const { searchParams } = new URL(req.url);
    /* ---------- Filters ------------------------------------------------ */
    const id = searchParams.get("id");
    const username = searchParams.get("username");

    /* ---------- Pagination --------------------------------------------- */
    const limitParam = Number(searchParams.get("limit") ?? "10");
    const pageParam = Number(searchParams.get("page") ?? "1");
    const offsetParam = searchParams.get("offset"); // string or null

    const limit = Math.min(Math.max(limitParam, 1), MAX_LIMIT); // 1‑100
    const offset = offsetParam !== null
      ? Math.max(Number(offsetParam), 0)
      : Math.max((pageParam - 1) * limit, 0);

    /* ---- Build dynamic WHERE --------------------------------------- */
    const where: Record<string, unknown> = {};
    if (id) where.id = ids;
    if (username) where.username = username;
    // 🛑 If not superadmin, restrict to current user's own data only
    if (role_code !== 'super_admin') {
      where.id = ids;
    }

    /* ---- Fetch single user if id / username present ---------------- */
    if (id || username) {
      const user = await User.findOne({
        where,
        attributes: { exclude: ["password_hash"] },
      });

      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 },
        );
      }
      return NextResponse.json({ user });
    }

    /* ---- Paginated list -------------------------------------------- */
    const { rows: users, count: total } = await User.findAndCountAll({
      where,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
      attributes: { exclude: ["password_hash"] },
    });

    return NextResponse.json({
      page: offsetParam ? undefined : pageParam,
      offset,
      limit,
      total,
      data: users,
    });
  } catch (err) {
    console.error("Fetch Users Error ⇒", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PUT handler async func
export async function PUT(req: NextRequest) {
  try {
    const session = await auth(req);

    if (!session || 'error' in session || !('user' in session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    /* ───────────────────────── 1) Parse URL and get user ID ──────────────── */
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("id");
    
    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    /* ───────────────────────── 2) Parse and validate request body ────────── */
    const { username, password, role_code, email } = await req.json();

    if (!username && !password && !role_code && !email) {
      return NextResponse.json(
        { error: "At least one field to update is required" },
        { status: 400 }
      );
    }

    /* ───────────────────────── 3) Find existing user ─────────────────────── */
    const user = await User.findByPk(userId);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    /* ───────────────────────── 4) Check for uniqueness conflicts ──────────── */
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ where: { username } });
      if (existingUser) {
        return NextResponse.json(
          { error: "Username already exists" },
          { status: 409 }
        );
      }
    }

    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail) {
        return NextResponse.json(
          { error: "Email already exists" },
          { status: 409 }
        );
      }
    }

    /* ───────────────────────── 5) Prepare updates ────────────────────────── */
    const updates: {
      username?: string;
      password_hash?: string;
      role_code?: string;
      email?: string;
    } = {};

    if (username) updates.username = username;
    if (role_code) updates.role_code = role_code;
    if (email) updates.email = email;
    if (password) {
      updates.password_hash = await bcrypt.hash(password, 10);
    }

    /* ───────────────────────── Before applying updates log if did any changes ─────────────────────────── */
    const changes: Partial<UserAttributes> = {};
    const changesNewToLog: Partial<UserAttributes> = {};

    if (username !== undefined && username !== user.username) {
      changes.username = user.username;
      changesNewToLog.username = username;
    }

    if (role_code !== undefined && role_code !== user.role_code) {
      changes.role_code = user.role_code;
      changesNewToLog.role_code = role_code;
    }

    if (email !== undefined && email !== user.email) {
      changes.email = user.email;
      changesNewToLog.email = email;
    }

    if (password && updates.password_hash !== undefined && updates.password_hash !== user.password_hash) {
      changes.password_hash = user.password_hash;
      changesNewToLog.password_hash = updates.password_hash;
    }

    if (changesNewToLog && Object.keys(changesNewToLog)?.length > 0) {
      await UserLog.create({
        user_id: Number(session.user.id),           
        module: "User",    
        action: "edit",
        old_data  :changes,
        new_data  :changesNewToLog,
        created_by: session.user.email, 
      });
    }

    /* ───────────────────────── 6) Apply updates ─────────────────────────── */
    await user.update(updates);

    /* ───────────────────────── 7) Return updated user (without password) ── */
    const updatedUser = await User.findByPk(userId, {
      attributes: { exclude: ["password_hash"] },
    });

    return NextResponse.json(
      { 
        message: "User updated successfully", 
        user: updatedUser 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Update User Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE handler async func
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth(req);

    if (!session || 'error' in session || !('user' in session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    /* ──────── 1) Pull userId from the URL (/api/users?id=123) ─────────── */
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("id");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    /* ──────── 2) Locate the user ───────────────────────────────────────── */
    const user = await User.findByPk(userId);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 },
      );
    }

    await UserLog.create({
      user_id: Number(session.user.id),           
      module: "User",    
      action: "delete",
      old_data  :user,
      // new_data  :metal,
      created_by: session.user.email, 
    });

    /* ──────── 3) Delete and respond ────────────────────────────────────── */
    await user.destroy();          // ← removes the row

    return NextResponse.json(
      { message: "User deleted successfully" },
      { status: 200 },
    );
  } catch (err) {
    console.error("Delete User Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}