import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth(req);
  if (!session || "error" in session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const user = session.user as any;
  return NextResponse.json({ username: user.username ?? user.email ?? "" });
}
