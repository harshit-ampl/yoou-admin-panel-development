import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { auth } from '@/lib/auth';
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import UserLog from "@/models/UserLog";
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

type CSVRow = {
  SKU: string;
  ParentDesignCode: string;
  VariantID: string;
  Barcode?: string;
  NetWeight: number;
  Purity: number;
  MakingChargesCode: string;
  OtherStoneCharges: number;
  DColorID: string;
  DiaWeight1?: number;
  DiaPieces1?: number;
  DiaSizeID1?: string;
  DiaWeight2?: number;
  DiaPieces2?: number;
  DiaSizeID2?: string;
  DiaWeight3?: number;
  DiaPieces3?: number;
  DiaSizeID3?: string;
  DiscountPercentageOnMakingCharge?: string;
  DiscountPercentageOnStone?: string;
  Markup?: string;
  StoneCount?: number;
  SilverWeight?: number;
  SilverPurity?: number;
  PlatinumWeight?: number;
  PlatinumPurity?: number;
  GrossWeight?: number;
};

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }
  const session = await auth(req);
  if (!session || 'error' in session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if any job (sync or upload) is already running
  const [runningUploadResult, runningSyncResult] = await Promise.all([
    pool.query(`SELECT id FROM file_upload WHERE job_status IN ('upload_initiated', 'processing') LIMIT 1`),
    pool.query(`SELECT id FROM sync_jobs WHERE status = 'processing' LIMIT 1`),
  ]);
  if (runningUploadResult.rows.length > 0 || runningSyncResult.rows.length > 0) {
    return NextResponse.json(
      { error: "A process is already running. Please wait until it completes." },
      { status: 409 }
    );
  }

  const userEmail = 'user' in session ? session.user.email : '';
  const text = await file.text();
  const records: string[][] = parse(text, { skip_empty_lines: true });
  const header = records.shift();
  if (!header)
    return NextResponse.json({ error: "No CSV header found" }, { status: 400 });

  const parsedData: CSVRow[] = records.map((row) => {
    const get = (i: number) => row[i]?.trim() || "";
    const toFloat = (s: string) => (s ? parseFloat(s) : undefined);
    const toInt = (s: string) => { const n = parseInt(s); return isNaN(n) ? undefined : n; };
    return {
      SKU: get(0),
      ParentDesignCode: get(1),
      VariantID: get(0),
      Barcode: get(1) || undefined,
      NetWeight: parseFloat(get(2)),
      Purity: parseFloat(get(3)),
      MakingChargesCode: get(4),
      OtherStoneCharges: (!get(5) || isNaN(Number(get(5)))) ? 0.00 : parseFloat(get(5)),
      DColorID: get(6),
      DiaWeight1: toFloat(get(7)),
      DiaPieces1: toInt(get(8)),
      DiaSizeID1: get(9) || undefined,
      DiaWeight2: toFloat(get(10)),
      DiaPieces2: toInt(get(11)),
      DiaSizeID2: get(12) || undefined,
      DiaWeight3: toFloat(get(13)),
      DiaPieces3: toInt(get(14)),
      DiaSizeID3: get(15) || undefined,
      DiscountPercentageOnMakingCharge: get(16) || undefined,
      DiscountPercentageOnStone: get(17) || undefined,
      Markup: get(18) || undefined,
      StoneCount: toInt(get(19)) ?? 0,
      SilverWeight: toFloat(get(20)) ?? 0,
      SilverPurity: toFloat(get(21)) ?? undefined,
      PlatinumWeight: toFloat(get(22)) ?? 0,
      PlatinumPurity: toFloat(get(23)) ?? undefined,
      GrossWeight: toFloat(get(24)) ?? undefined,
    };
  });

  // Reject any CSV row that contains negative numeric values
  const NUMERIC_FIELDS_CSV: Array<{ key: keyof CSVRow; label: string }> = [
    { key: "NetWeight",         label: "Net Weight" },
    { key: "Purity",            label: "Purity" },
    { key: "OtherStoneCharges", label: "Other Stone Charges" },
    { key: "DiaWeight1",        label: "Dia Weight 1" },
    { key: "DiaPieces1",        label: "Dia Pieces 1" },
    { key: "DiaWeight2",        label: "Dia Weight 2" },
    { key: "DiaPieces2",        label: "Dia Pieces 2" },
    { key: "DiaWeight3",        label: "Dia Weight 3" },
    { key: "DiaPieces3",        label: "Dia Pieces 3" },
    { key: "StoneCount",        label: "Stone Count" },
    { key: "SilverWeight",      label: "Silver Weight" },
    { key: "SilverPurity",      label: "Silver Purity" },
    { key: "PlatinumWeight",    label: "Platinum Weight" },
    { key: "PlatinumPurity",    label: "Platinum Purity" },
    { key: "GrossWeight",       label: "Gross Weight" },
  ];

  const negativeErrors: string[] = [];
  parsedData.forEach((row, idx) => {
    for (const { key, label } of NUMERIC_FIELDS_CSV) {
      const val = row[key];
      if (typeof val === "number" && !isNaN(val) && val < 0) {
        negativeErrors.push(`Row ${idx + 2} (SKU: ${row.SKU || "—"}): ${label} = ${val}`);
      }
    }
  });

  if (negativeErrors.length > 0) {
    const preview = negativeErrors.slice(0, 5).join("\n");
    const more = negativeErrors.length > 5 ? `\n...and ${negativeErrors.length - 5} more` : "";
    return NextResponse.json(
      { error: `CSV contains negative values — please fix and re-upload:\n${preview}${more}` },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  let jobId: number | null = null;

  async function logStep(step: string, status: "running" | "done" | "failed", message?: string) {
    if (!jobId) return;
    try {
      await pool.query(
        `INSERT INTO file_upload_steps (job_id, step_name, status, message) VALUES ($1, $2, $3, $4)`,
        [jobId, step, status, message ?? null]
      );
    } catch (e) {
      console.error(`[csv-upload] logStep(${step}) error:`, e);
    }
  }

  try {
    const uploadLog = await client.query(
      `INSERT INTO file_upload (filename, uploaded_by, job_status, variants_count) VALUES ($1, $2, $3, $4) RETURNING id`,
      [file.name, userEmail, "upload_initiated", parsedData.length]
    );
    jobId = uploadLog?.rows?.[0]?.id;

    if (!jobId) {
      return NextResponse.json({ error: "Failed to create log and retrieve job id" }, { status: 400 });
    }

    // Step 1: CSV parsed
    await logStep("csv_parsed", "done", `Parsed ${parsedData.length} rows from ${file.name}`);

    // Step 2: S3 upload
    const s3FileName = `job_${jobId}.csv`;
    const BUCKET = process.env.S3_BUCKET || "";
    const bodyBuffer = Buffer.from(text);
    const isDev = process.env.NODE_ENV === "development";

    if (isDev && (!process.env.AWS_ACCESS_KEY_ID || !BUCKET)) {
      await logStep("s3_upload", "done", `[dev] S3 upload skipped — no credentials configured`);
    } else {
      const s3 = new S3Client({ region: process.env.AWS_REGION || "" });
      await logStep("s3_upload", "running", `Uploading ${file.name} to S3 (${bodyBuffer.byteLength} bytes)`);
      try {
        await s3.send(new PutObjectCommand({
          Bucket: BUCKET,
          Key: s3FileName,
          Body: bodyBuffer,
          ContentType: "text/csv",
          CacheControl: "no-store",
        }));
        // Verify upload with HEAD
        const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: s3FileName }));
        const remoteSize = head.ContentLength ?? 0;
        const localSize = bodyBuffer.byteLength;
        if (remoteSize !== localSize) {
          await logStep("s3_upload", "failed", `Size mismatch: local=${localSize} remote=${remoteSize}`);
          await client.query(`UPDATE file_upload SET job_status = 'failed' WHERE id = $1`, [jobId]);
          return NextResponse.json({ error: "S3 upload failed" }, { status: 400 });
        }
        await logStep("s3_upload", "done", `Verified ${s3FileName} (${remoteSize} bytes)`);
      } catch (s3Err) {
        await logStep("s3_upload", "failed", String(s3Err));
        await client.query(`UPDATE file_upload SET job_status = 'failed' WHERE id = $1`, [jobId]);
        return NextResponse.json({ error: `S3 upload failed: ${s3Err}` }, { status: 500 });
      }
    }

    // Step 3: DB upsert
    const batchSize = 20;
    const totalBatches = Math.ceil(parsedData.length / batchSize);
    await logStep("db_upsert", "running", `Upserting ${parsedData.length} rows in ${totalBatches} batches`);
    try {
      for (let i = 0; i < parsedData.length; i += batchSize) {
        const batch = parsedData.slice(i, i + batchSize);
        await insertBatch(client, batch);
        console.log(`Inserted/Updated batch of ${batch.length} rows`);
      }
      await logStep("db_upsert", "done", `Upserted ${parsedData.length} rows into jewelry_variants`);
    } catch (dbErr) {
      await logStep("db_upsert", "failed", String(dbErr));
      await client.query(`UPDATE file_upload SET job_status = 'failed' WHERE id = $1`, [jobId]);
      return NextResponse.json({ error: `DB upsert failed: ${dbErr}` }, { status: 500 });
    }

    // Mark as processing before firing so the next upload check sees a running job immediately.
    await client.query(
      `UPDATE file_upload SET job_status = 'processing' WHERE id = $1`,
      [jobId]
    );

    UserLog.create({
      user_id: Number((session as any).user?.id),
      module: "CSV Upload",
      action: "upload",
      new_data: { filename: file.name, job_id: jobId, variants_count: parsedData.length },
      created_by: userEmail,
    }).catch((e: unknown) => console.error("[csv-upload] UserLog error:", e));

    // Step 4: Middleware call (fire and forget)
    const MW_URL = process.env.MIDDLEWARE_URL || "https://pngmiddleware.amplicommacp.com";
    await logStep("middleware_called", "running", `Dispatched to ${MW_URL}/dynamic-pricing?jobid=${jobId}`);

    fetch(`${MW_URL}/dynamic-pricing?jobid=${jobId}`, {
      method: "POST",
    }).then(async (response) => {
      if (!response.ok) {
        const detail = await response.text();
        console.error("Middleware call failed:", detail);
        await pool.query(`UPDATE file_upload SET job_status = 'failed' WHERE id = $1`, [jobId]);
        await pool.query(
          `INSERT INTO file_upload_steps (job_id, step_name, status, message) VALUES ($1, $2, $3, $4)`,
          [jobId, "middleware_called", "failed", `HTTP ${response.status}: ${detail.slice(0, 300)}`]
        ).catch(() => {});
      }
    }).catch(async (err) => {
      console.error("Middleware call error:", err);
      await pool.query(
        `INSERT INTO file_upload_steps (job_id, step_name, status, message) VALUES ($1, $2, $3, $4)`,
        [jobId, "middleware_called", "failed", String(err).slice(0, 300)]
      ).catch(() => {});
    });

    return NextResponse.json({ message: "Upload complete, started to update products in shopify" });
  } catch (err) {
    console.error("Upload failed:", err);
    if (jobId) {
      try {
        await logStep("upload", "failed", String(err));
        await pool.query(`UPDATE file_upload SET job_status = 'failed' WHERE id = $1`, [jobId]);
      } catch (cleanupErr) {
        console.error("Failed to mark job as failed:", cleanupErr);
      }
    }
    return NextResponse.json({ error: `Upload failed: ${err}` }, { status: 500 });
  } finally {
    client.release();
  }
}

async function insertBatch(client: any, rows: CSVRow[]) {
  if (rows.length === 0) return;

  // Remove duplicate SKUs within this batch
  const uniqueRowsMap = new Map<string, CSVRow>();
  for (const row of rows) {
    uniqueRowsMap.set(row.SKU, row); // This keeps the LAST occurrence
  }
  const uniqueRows = Array.from(uniqueRowsMap.values());

  const columns = [
    "sku",
    "parent_design_code",
    "variant_id",
    "barcode",
    "net_wt",
    "purity",
    "making_charges_code",
    "other_stone_charges",
    "dcolor_id",
    "dia_wt_1",
    "dia_pc_1",
    "dsizeid_1",
    "dia_wt_2",
    "dia_pc_2",
    "dsizeid_2",
    "dia_wt_3",
    "dia_pc_3",
    "dsizeid_3",
    "discount_percentage_on_making_charge",
    "discount_percentage_on_stone",
    "markup",
    "stone_count",
    "silver_weight",
    "silver_purity",
    "platinum_weight",
    "platinum_purity",
    "gross_weight",
  ];

  const values: any[] = [];
  const placeholders = uniqueRows
    .map((row, i) => {
      const base = i * columns.length;
      values.push(
        row.SKU,
        row.ParentDesignCode,
        row.VariantID,
        row.Barcode,
        row.NetWeight,
        row.Purity,
        row.MakingChargesCode,
        row.OtherStoneCharges,
        row.DColorID,
        row.DiaWeight1,
        row.DiaPieces1,
        row.DiaSizeID1,
        row.DiaWeight2,
        row.DiaPieces2,
        row.DiaSizeID2,
        row.DiaWeight3,
        row.DiaPieces3,
        row.DiaSizeID3,
        row.DiscountPercentageOnMakingCharge,
        row.DiscountPercentageOnStone,
        row.Markup,
        row.StoneCount,
        row.SilverWeight ?? 0,
        row.SilverPurity ?? null,
        row.PlatinumWeight ?? 0,
        row.PlatinumPurity ?? null,
        row.GrossWeight ?? null
      );
      const group = columns.map((_, j) => `$${base + j + 1}`);
      return `(${group.join(",")})`;
    })
    .join(",");

  const updateSet = columns
    .slice(1)
    .map((col) => `${col} = EXCLUDED.${col}`)
    .join(", ");

  const query = `
    INSERT INTO jewelry_variants (${columns.join(",")})
    VALUES ${placeholders}
    ON CONFLICT (sku) DO UPDATE SET ${updateSet}
  `;

  await client.query(query, values);
}
