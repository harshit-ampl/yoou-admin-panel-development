import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
  var Multipassify = require('multipassify');
  try {
    // 1️⃣ parse body once
    const { phone, otp } = await req.json();
    if (!phone || !otp) {
      return NextResponse.json(
        { message: "Phone and OTP are required", statusCode: 0 },
        { status: 400, headers: corsHeaders }
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
        { status: 404, headers: corsHeaders }
      );

    const record = rows[0];
       console.log("record")

     console.log(record)
     console.log(otp)

    // 3️⃣ business rules
    if (record.status == "verified")
      return NextResponse.json(
        { message: "OTP has already been verified", statusCode: 0 },
        { status: 401, headers: corsHeaders }
      );

    const now = new Date();
    if (new Date(record.expires_at) < now){
      await pool.query(
      `UPDATE otp SET status = 'expired' WHERE id = $1`,
      [record.id])
      return NextResponse.json(
        { message: "OTP has expired", statusCode: 0 },
        { status: 410, headers: corsHeaders }
      )
    }
   
    if (record.otp_code != otp)
      return NextResponse.json(
        { message: "Invalid OTP", statusCode: 0 },
        { status: 401, headers: corsHeaders }
      );

    // 4️⃣ mark verified
    await pool.query(
      `UPDATE otp SET status = 'verified' WHERE id = $1`,
      [record.id]
    );

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
            "phoneNumber": `+91${phone}`
          }
        }
      }),
    }); 

    const custRes = await custReq?.json();
    // console.log(custRes?.data?.customer, "custResponse");

    // Check if customer exists
    if (!custRes?.data?.customer?.id || !custRes?.data?.customer?.defaultEmailAddress?.emailAddress ) {
      return NextResponse.json(
        { 
          message: "Customer not found with this phone number", 
          statusCode: 0 
        },
        { status: 404, headers: corsHeaders}
      );
    }

    // Construct the Multipassify encoder
  var multipassify = new Multipassify(process.env.MULTIPASS_SECRET);
 
  // Create your customer data hash
  var customerData = { email: custRes?.data?.customer?.defaultEmailAddress?.emailAddress };
 
  // Encode a Multipass token
  var token = multipassify.encode(customerData);
 
  // Generate a Shopify multipass URL to your shop
  var url = multipassify.generateUrl(customerData, "pngjewellers.com");

    return NextResponse.json(
      { message: "OTP verified successfully", statusCode: 1, url:url },
      { status: 200, headers: corsHeaders }
    );

    
  } catch (e: any) {
    console.error("OTP verification failed:", e);
    return NextResponse.json(
      { error: "Internal server error", detail: e.message, statusCode: 0 },
      { status: 500, headers: corsHeaders }
    );
  } 
}
