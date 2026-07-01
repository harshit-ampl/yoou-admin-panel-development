// app/api/create-customer/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import axios from "axios";
import https from "https";

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

// ✅ Handle preflight OPTIONS request
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: corsHeaders });
}

// ✅ Handle POST request from Shopify Webhook
export async function POST(req: NextRequest) {
  let logId: number | null = null;
  const startTime = new Date().toISOString();
  try {
    const body = await req.json();
    const { id: shopifyId, email, phone, first_name, last_name } = body;

    const logRes = await pool.query(
      `INSERT INTO customer_webhook_logs (module, webhook_payload, response_payload,  created_at)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      ["create-customer", JSON.stringify(body), null, startTime]
    );

    if (!shopifyId || !phone) {
      return NextResponse.json(
        { error: "Missing required fields" },
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    logId = logRes.rows[0].id;
    // 2️⃣ Call ACME to verify if customer exists
    const verifyResponse = await axios.post(
      `${process.env.ACME_BASE_URL}/acme-document-web/doc/v1/customer/5`,
      { mobileNo: phone },
      {
        headers: {
          sProgramKey: process.env.ACME_SPROGRAM_KEY,
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: process.env.ACME_AUTHORIZATION,
          "X-key": process.env.ACME_X_KEY,
          "User-Agent": req.headers.get("user-agent") || "Webhook",
        },
        httpsAgent,
      }
    );
    // If customer exists in ACME
    if (verifyResponse.data?.data?.errorCode == 0) {
      const verifyMsg = verifyResponse?.data?.data?.errorMsg || "";
      await logAndRespond(
        logId,
        verifyMsg,
        verifyResponse?.data?.data?.result,
        startTime,
        JSON.stringify({ mobileNo: phone }),
        "verify-customer"
      );
      return NextResponse.json(
        { message: verifyMsg },
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }
    const createPayload = {
      name: `${first_name} ${last_name}`,
      mobileNo: phone,
      emailId: email,
    };

    const createRes = await axios.post(
      `${process.env.ACME_BASE_URL}/acme-document-web/doc/v1/customer/1`,
      createPayload,
      {
        headers: {
          sProgramKey: process.env.ACME_SPROGRAM_KEY,
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: process.env.ACME_AUTHORIZATION,
          "X-key": process.env.ACME_X_KEY,
          "User-Agent": req.headers.get("user-agent") || "Webhook",
        },
        httpsAgent,
      }
    );

    const createMsg = createRes.data?.data?.errorMsg || "";

    await logAndRespond(
      logId,
      createMsg,
      createRes?.data?.data?.result,
      startTime,
      JSON.stringify(createPayload)
    );

    return NextResponse.json(
      { message: createMsg },
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    let body: any = {};
    await logAndRespond(
      logId,
      errorMessage,
      {},
      startTime,
      JSON.stringify(body)
    );
    return NextResponse.json(
      { error: "Unknown Error" },
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  }
}
// ✅ Utility: Log final response to DB and return API response
async function logAndRespond(
  logId: number | null,
  message: string,
  data: any,
  startTime: string,
  body: string,
  module: string = "create-customer"
) {
  if (logId) {
    const updateResponse = await pool.query(
      `UPDATE customer_webhook_logs 
       SET response_payload = $1, updated_at = $2, request_payload = $3, error_msg = $4 , module = $6
       WHERE id = $5`,
      [
        JSON.stringify(data),
        new Date().toISOString(),
        body || null,
        message || null,
        logId,
        module,
      ]
    );
  }
  return true;
}
