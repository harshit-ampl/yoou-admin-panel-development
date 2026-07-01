import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = 'force-dynamic';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function POST(req: NextRequest) {
  try {
    // 1️⃣ parse body once
    const { phone, otp } = await req.json();
    if (!phone || !otp) {
      return NextResponse.json(
        { message: "Phone and OTP are required", statusCode: 0 },
        { status: 400 }
      );
    }

    const formattedPhone = `+91${phone}`;

    // 2️⃣ fetch latest OTP
    const { rows } = await pool.query(
      `SELECT id, otp_code, status, expires_at
         FROM otp
        WHERE phone = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [formattedPhone]
    );

    if (rows.length === 0)
      return NextResponse.json(
        { message: "No active OTP found for this phone number", statusCode: 0 },
        { status: 404 }
      );

    const record = rows[0];
       console.log("record")

     console.log(record)
     console.log(otp)

    // 3️⃣ business rules
    if (record.status == "verified")
      return NextResponse.json(
        { message: "OTP has already been verified", statusCode: 0 },
        { status: 401 }
      );

    const now = new Date();
    if (new Date(record.expires_at) < now){
      await pool.query(
      `UPDATE otp SET status = 'expired' WHERE id = $1`,
      [record.id])
      return NextResponse.json(
        { message: "OTP has expired", statusCode: 0 },
        { status: 410 }
      )
    }
   
    if (record.otp_code != otp)
      return NextResponse.json(
        { message: "Invalid OTP", statusCode: 0 },
        { status: 401 }
      );

    // 4️⃣ mark verified
    await pool.query(
      `UPDATE otp SET status = 'verified' WHERE id = $1`,
      [record.id]
    );

    return NextResponse.json(
      { message: "OTP verified successfully", statusCode: 1 },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("OTP verification failed:", e);
    return NextResponse.json(
      { error: "Internal server error", detail: e.message, statusCode: 0 },
      { status: 500 }
    );
  } 
}
