import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "@/models/Users";
import { Op } from "sequelize";
import { rateLimit } from "@/lib/rateLimiter";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    (req as NextRequest & { ip?: string }).ip ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  try {
    const ip = getIp(req);

    // Broad IP flood guard — 20 sign-in attempts per 15 minutes per IP
    const ipRl = rateLimit(`signin_ip:${ip}`, 20, 15 * 60 * 1000);
    if (!ipRl.ok) {
      const resetInMin = Math.ceil((ipRl.resetAt - Date.now()) / 60_000);
      return NextResponse.json(
        { error: `Too many login attempts. Try again in ${resetInMin} minute${resetInMin === 1 ? "" : "s"}.` },
        { status: 429 }
      );
    }

    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username/email and password are required" },
        { status: 400 }
      );
    }

    // Per-account brute-force guard — 5 failed attempts per identifier per 15 minutes
    const failKey = `signin_fail:${username.toLowerCase()}`;
    const failRl  = rateLimit(failKey, 5, 15 * 60 * 1000);
    if (!failRl.ok) {
      const resetInMin = Math.ceil((failRl.resetAt - Date.now()) / 60_000);
      return NextResponse.json(
        { error: `Account temporarily locked due to too many failed attempts. Try again in ${resetInMin} minute${resetInMin === 1 ? "" : "s"}.` },
        { status: 429 }
      );
    }

    // Match against either username or email
    const user = await User.findOne({
      where: { [Op.or]: [{ username }, { email: username }] },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const res = NextResponse.json({ username: user.username });
    res.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return res;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
