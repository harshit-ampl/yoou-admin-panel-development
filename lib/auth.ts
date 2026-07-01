import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import User from '@/models/Users'; // Mongoose model

const JWT_SECRET = process.env.JWT_SECRET!;

// Matches the cookie-presence check previously done in middleware.ts for
// routes that don't do their own JWT verification via auth().
export function requireTokenCookie(req: NextRequest): NextResponse | null {
  const token = req.cookies.get('token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }
  return null;
}

type JwtPayload = {
  id: string;
  username: string;
  email: string;
  role_code: string;
  exp: number;
};

type AuthResult =
  | { user: { id: string; username: string; email: string; role_code: string } }
  | { error: string };

export async function auth(req: NextRequest): Promise<AuthResult> {
  const token = req.cookies.get('token')?.value;
  if (!token) return { error: 'Token not found' };

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return { error: 'Invalid or expired token' };
  }
  const id = payload.id
  const userDoc = await User.findOne({ where: { id } });
 

  if (!userDoc) return { error: 'User not found' };

  return {
    user: {
      id: payload.id,
      username: payload.username ?? userDoc.username ?? "",
      email: userDoc.email,
      role_code: userDoc.role_code,
    },
  };
}
