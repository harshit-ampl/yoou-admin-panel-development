// app/api/send-otp/route.ts
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import https from "https";
import Otp from "@/models/Otp";
import moment from 'moment-timezone';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // In production, replace with specific Shopify domain
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

// Handle preflight OPTIONS request
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    
    if (!phone) {
      return NextResponse.json(
        { message: "Phone number is required", statusCode: 0 },
        { status: 400, headers: corsHeaders }
      );
    }
     const formattedPhone = `+91${phone}`;

    // Check if customer exists in Shopify
    const custReq = await fetch('https://png-jewellers.myshopify.com/admin/api/2025-04/graphql.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': process.env.SHOPIFY_APP_TOKEN || ''
      },
      body: JSON.stringify({
        "query": "query($identifier: CustomerIdentifierInput!) { customer: customerByIdentifier(identifier: $identifier) { id firstName defaultEmailAddress { emailAddress } } }",
        "variables": {
          "identifier": {
            "phoneNumber": formattedPhone
          }
        }
      }),
    }); 

    const custRes = await custReq?.json();
    // console.log(custRes?.data, "custResponse");

    // Check if customer exists
    if (!custRes?.data?.customer?.id || !custRes?.data?.customer?.defaultEmailAddress?.emailAddress) {
      return NextResponse.json(
        { 
          message: "Customer not found with this phone number", 
          statusCode: 0 
        },
        { status: 400, headers: corsHeaders}
      );
    }

   
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
        // otp, // ⚠️ Remove this in production
        statusCode: 1,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("Failed to send OTP:", err?.response?.data || err.message);
    
    return NextResponse.json(
      {
        message: "Failed to send OTP",
        detail: err?.response?.data || err.message,
        statusCode: 0,
      },
      { status: 500, headers: corsHeaders }
    );
  }
}