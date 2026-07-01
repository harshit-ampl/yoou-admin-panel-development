// app/api/send-otp/route.ts
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import https from "https";
import Otp from "@/models/Otp";
import moment from 'moment-timezone';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    
    if (!phone) {
      return NextResponse.json(
        { message: "Phone number is required", statusCode: 0 },
        { status: 400 }
      );
    }

    const formattedPhone = `+91${phone}`;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
    // Step 1: Get current IST time as a Date object
    const istNow = moment().tz("Asia/Kolkata");
    const expiresAt = istNow.clone().add(10, 'minutes');
    const createdAtIST = istNow.format("YYYY-MM-DD HH:mm:ss");
    const expiresAtIST = expiresAt.format("YYYY-MM-DD HH:mm:ss");

    // Save OTP to DB using Sequelize
    await Otp.create({
      phone: formattedPhone,
      otp_code: otp,
      expires_at: expiresAtIST,
      created_at: createdAtIST,
    });

    const payload = {
      ttl: 10,
      overrideData: {
        context: {
          token: { otp },
        },
        phone: formattedPhone,
      },
      userId: "pngpromo",
    };

    const endpoint = `${process.env.OTP_HOST}/v2/accounts/${process.env.OTP_LICENSE_CODE}/experiments/${process.env.OTP_EXPRIMENT_ID}/transaction`;
    
    const response = await axios.post(endpoint, payload, {
      httpsAgent,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OTP_API_KEY}`,
      },
    });

    return NextResponse.json(
      {
        message: "OTP sent successfully",
        otp, // ⚠️ Remove this in production
        statusCode: 1,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Failed to send OTP:", err?.response?.data || err.message);
    
    return NextResponse.json(
      {
        message: "Failed to send OTP",
        detail: err?.response?.data || err.message,
        statusCode: 0,
      },
      { status: 500 }
    );
  }
}