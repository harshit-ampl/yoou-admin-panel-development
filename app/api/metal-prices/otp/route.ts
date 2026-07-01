import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { transporter } from "@/lib/mailer";
import store, { OTP_TTL_MS, pruneExpired } from "@/lib/metalOtpStore";
import { rateLimit } from "@/lib/rateLimiter";
import crypto from "crypto";

const OTP_TO   = process.env.METAL_OTP_TO   ?? "rimadevi.prasad@amplicomm.com";
const OTP_FROM = process.env.EMAIL_USER      ?? "alertspng@amplicomm.com";

/** POST /api/metal-prices/otp — generate a new OTP and email it */
export async function POST(req: NextRequest) {
  try {
    const session = await auth(req);
    if (!session || "error" in session || !("user" in session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: max 3 OTP requests per user per hour
    const userEmail = (session as any).user?.email ?? "unknown";
    const rl = rateLimit(`otp:${userEmail}`, 3, 60 * 60 * 1000);
    if (!rl.ok) {
      const resetInMin = Math.ceil((rl.resetAt - Date.now()) / 60_000);
      return NextResponse.json(
        { error: `Too many OTP requests. Try again in ${resetInMin} minute${resetInMin === 1 ? "" : "s"}.` },
        { status: 429 }
      );
    }

    pruneExpired();

    const otp       = String(Math.floor(100_000 + Math.random() * 900_000));
    const sessionId = crypto.randomUUID();
    const expires   = Date.now() + OTP_TTL_MS;

    store.set(sessionId, {
      otp,
      expires,
      attempts: 0,
      userId: Number((session as any).user?.id),
    });

    await transporter.sendMail({
      from: `"PNG Admin Security" <${OTP_FROM}>`,
      to: OTP_TO,
      subject: "Metal Price Edit OTP — PNG Admin",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#1a1a1a">Metal Price Edit — One-Time Password</h2>
          <p>A request to edit metal prices was initiated by <strong>${userEmail}</strong>.</p>
          <div style="background:#f4f4f4;border-left:4px solid #f59e0b;padding:16px 24px;margin:24px 0;border-radius:4px">
            <p style="margin:0;font-size:13px;color:#666">Your OTP</p>
            <p style="margin:4px 0 0;font-size:36px;font-weight:700;letter-spacing:8px;color:#1a1a1a">${otp}</p>
          </div>
          <p style="color:#666;font-size:13px">⏱ This OTP is valid for <strong>60 seconds</strong>. Do not share it with anyone.</p>
          <p style="color:#999;font-size:12px">If you did not request this, your account may be at risk. Please contact the admin immediately.</p>
        </div>
      `,
    });

    return NextResponse.json({ sessionId, expiresAt: expires, remaining: rl.remaining }, { status: 200 });
  } catch (error) {
    console.error("[metal-otp] send error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
