import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { transporter } from "@/lib/mailer";
import store, { MAX_ATTEMPTS, pruneExpired } from "@/lib/metalOtpStore";
import User from "@/models/Users";

export const dynamic = 'force-dynamic';

const OTP_TO   = process.env.METAL_OTP_TO ?? "rimadevi.prasad@amplicomm.com";
const OTP_FROM = process.env.EMAIL_USER   ?? "alertspng@amplicomm.com";

// ── Helpers ────────────────────────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  // Proxy headers (nginx/Apache must be configured to forward these)
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0].trim();
  if (forwarded) return forwarded;

  const realIp = req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip");
  if (realIp) return realIp;

  // Next.js populates req.ip from the TCP socket when no proxy is in front
  const nextIp = (req as NextRequest & { ip?: string }).ip;
  if (nextIp) return nextIp;

  return "127.0.0.1"; // fallback — same host as server
}

function isPrivateIp(ip: string): boolean {
  return (
    ip === "::1" ||
    ip.startsWith("127.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

interface GeoResult {
  city: string;
  regionName: string;
  country: string;
  isp: string;
}

async function geoLookup(ip: string): Promise<GeoResult | null> {
  if (!ip || isPrivateIp(ip)) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=city,regionName,country,isp`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json() as GeoResult & { status?: string };
    if (data.status === "fail") return null;
    return data;
  } catch {
    return null;
  }
}

function row(label: string, value: string, shade = false) {
  const bg = shade ? "background:#fef2f2;" : "";
  return `
    <tr>
      <td style="padding:8px 14px;${bg}border:1px solid #fecaca;font-size:13px;color:#555;white-space:nowrap">${label}</td>
      <td style="padding:8px 14px;${bg}border:1px solid #fecaca;font-size:13px"><strong>${value}</strong></td>
    </tr>`;
}

// ── Route ──────────────────────────────────────────────────────────────────

/** POST /api/metal-prices/otp/verify */
export async function POST(req: NextRequest) {
  try {
    const session = await auth(req);
    if (!session || "error" in session || !("user" in session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    pruneExpired();

    const { sessionId, otp } = (await req.json()) as { sessionId: string; otp: string };
    if (!sessionId || !otp) {
      return NextResponse.json({ error: "sessionId and otp required" }, { status: 400 });
    }

    const entry = store.get(sessionId);

    if (!entry) {
      return NextResponse.json(
        { error: "OTP expired or not found. Please request a new one." },
        { status: 410 }
      );
    }

    if (Date.now() > entry.expires) {
      store.delete(sessionId);
      return NextResponse.json(
        { error: "OTP has expired. Please request a new one." },
        { status: 410 }
      );
    }

    entry.attempts += 1;

    if (otp !== entry.otp) {
      const remaining = MAX_ATTEMPTS - entry.attempts;

      if (entry.attempts >= MAX_ATTEMPTS) {
        store.delete(sessionId);

        // Gather attacker context in parallel — never block the response on these
        const userId    = Number((session as any).user?.id);
        const userEmail = (session as any).user?.email ?? "Unknown";
        const ip        = getClientIp(req);
        const userAgent = req.headers.get("user-agent") ?? "Unknown";
        const timeIST   = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

        const [userRecord, geo] = await Promise.all([
          User.findByPk(userId).catch(() => null),
          geoLookup(ip),
        ]);

        const username = userRecord?.username ?? "Unknown";
        const location = geo
          ? [geo.city, geo.regionName, geo.country].filter(Boolean).join(", ")
          : isPrivateIp(ip)
          ? "Internal / Local network (no geolocation available)"
          : "Could not resolve (geo API unreachable)";
        const isp = geo?.isp ?? (isPrivateIp(ip) ? "Local network" : "—");

        transporter.sendMail({
          from: `"PNG Admin Security" <${OTP_FROM}>`,
          to: OTP_TO,
          subject: "🚨 SECURITY ALERT: 3 Failed Metal Price OTP Attempts — PNG Admin",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto">
              <div style="background:#dc2626;padding:16px 24px;border-radius:6px 6px 0 0">
                <h2 style="color:#fff;margin:0;font-size:18px">🚨 Security Alert — PNG Admin</h2>
                <p style="color:#fecaca;margin:4px 0 0;font-size:13px">Metal Price Edit — OTP Lockout</p>
              </div>

              <div style="border:1px solid #fecaca;border-top:none;padding:20px 24px;border-radius:0 0 6px 6px">
                <p style="margin:0 0 16px;font-size:14px;color:#1a1a1a">
                  <strong>3 consecutive incorrect OTP attempts</strong> were made while trying to edit metal prices.
                  The session has been locked.
                </p>

                <table style="border-collapse:collapse;width:100%;margin:16px 0">
                  ${row("Username",  username,  true)}
                  ${row("Email",     userEmail, true)}
                  ${row("IP Address",ip)}
                  ${row("Location",  location)}
                  ${row("ISP / Network", isp, true)}
                  ${row("Browser / UA", userAgent.slice(0, 120))}
                  ${row("Time (IST)", timeIST, true)}
                </table>

                <p style="font-size:13px;color:#666;margin:16px 0 0">
                  If this was not you or an authorised admin, please revoke the account immediately and review
                  access logs.
                </p>
              </div>

              <p style="font-size:11px;color:#aaa;margin:12px 0 0;text-align:center">
                YOOU Admin Panel — automated security notification
              </p>
            </div>
          `,
        }).catch((e: unknown) => console.error("[metal-otp] alert email error:", e));

        return NextResponse.json(
          { error: "Too many incorrect attempts. OTP invalidated. A security alert has been sent." },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: `Incorrect OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.` },
        { status: 401 }
      );
    }

    // Correct — remove from store (single use)
    store.delete(sessionId);

    return NextResponse.json({ verified: true }, { status: 200 });
  } catch (error) {
    console.error("[metal-otp] verify error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
