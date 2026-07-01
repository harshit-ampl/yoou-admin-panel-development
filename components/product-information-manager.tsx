"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// import { Progress } from "@/components/ui/progress";
import axios from "axios";
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { parse } from "csv-parse/sync";
export function ProductInformationManager() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [catalogueDownloading, setCatalogueDownloading] = useState(false);
  const [message, setMessage] = useState("");
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [jobRunning, setJobRunning] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const cancelActiveJob = async () => {
    setCancelling(true);
    try {
      await axios.delete("/api/active-job");
      await checkActiveJob();
      setMessage("✅ Stuck job has been cancelled. You can now upload a new file.");
    } catch {
      setMessage("❌ Failed to cancel the stuck job. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  const checkActiveJob = async () => {
    try {
      const res = await axios.get("/api/active-job");
      setJobRunning(res.data.isRunning);
    } catch {
      setJobRunning(false);
    }
  };

  useEffect(() => {
    checkActiveJob();
  }, []);

  // Poll every 10 s while a job is running so the button re-enables once it finishes
  useEffect(() => {
    if (!jobRunning) return;
    const interval = setInterval(checkActiveJob, 10000);
    return () => clearInterval(interval);
  }, [jobRunning]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    if (selectedFile) {
      const isCSV =
        selectedFile.name.toLowerCase().endsWith(".csv") ||
        selectedFile.type === "text/csv" ||
        selectedFile.type === "application/vnd.ms-excel";
      if (!isCSV) {
        setMessage("❌ Invalid file type. Please upload a CSV file.");
        setFile(null);
        e.target.value = "";
        return;
      }
    }
    setMessage("");
    setCsvErrors([]);
    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setMessage("");
    setCsvErrors([]);

    const formData = new FormData();
    formData.append("file", file);
    const text = await file.text();
    const records: string[][] = parse(text, { skip_empty_lines: true });

    // Validate header row against expected column positions
    const headerRow = records[0]?.map((h: string) => h.trim().toLowerCase()) ?? [];
    const REQUIRED_COLS: Array<[number, string]> = [
      [0, "sku"],
      [2, "net_wt"],
      [3, "purity"],
      [4, "making_charges_code"],
    ];
    const hasValidHeaders = REQUIRED_COLS.every(([pos, name]) => headerRow[pos] === name);
    if (!hasValidHeaders) {
      setMessage("❌ Wrong CSV format. Please download and use the sample CSV template.");
      setUploading(false);
      return;
    }

    // col index → { label, required, allowNegative }
    const NUM_COLS: Array<{ col: number; label: string; required?: boolean; allowNegative?: boolean }> = [
      { col: 2,  label: "Net Weight",              required: true  },
      { col: 3,  label: "Purity",                  required: true  },
      { col: 5,  label: "Other Stone Charges"                       },
      { col: 7,  label: "Dia Weight 1"                              },
      { col: 8,  label: "Dia Pieces 1"                              },
      { col: 10, label: "Dia Weight 2"                              },
      { col: 11, label: "Dia Pieces 2"                              },
      { col: 13, label: "Dia Weight 3"                              },
      { col: 14, label: "Dia Pieces 3"                              },
      { col: 19, label: "Stone Count"                               },
      { col: 20, label: "Silver Weight"                             },
      { col: 21, label: "Silver Purity"                             },
      { col: 22, label: "Platinum Weight"                           },
      { col: 23, label: "Platinum Purity"                           },
      { col: 24, label: "Gross Weight"                              },
    ];

    const csvErrors: string[] = [];
    for (let index = 1; index < records.length; index++) {
      const row = records[index];
      const rowNum = index + 1;
      const sku = row[0]?.trim() || "";

      if (row.every(cell => !cell || !cell.trim())) continue;

      // SKU required
      if (!sku) {
        csvErrors.push(`Row ${rowNum}: SKU is missing.`);
        continue;
      }

      // Making charges code required
      if (!row[4]?.trim()) {
        csvErrors.push(`Row ${rowNum} (SKU: ${sku}): "Making Charges Code" is missing.`);
      }

      // Numeric columns — check format then negative
      for (const { col, label, required } of NUM_COLS) {
        const raw = row[col]?.trim() ?? "";

        if (!raw && required) {
          csvErrors.push(`Row ${rowNum} (SKU: ${sku}): "${label}" is required but missing.`);
          continue;
        }

        if (raw) {
          const num = Number(raw);
          if (isNaN(num)) {
            csvErrors.push(`Row ${rowNum} (SKU: ${sku}): "${label}" has an invalid format — expected a number but got "${raw}".`);
          } else if (num < 0) {
            csvErrors.push(`Row ${rowNum} (SKU: ${sku}): "${label}" cannot be a negative value — got ${raw}.`);
          }
        }
      }
    }

    const errOnCsv = csvErrors.length > 0;
    if (errOnCsv) {
      setCsvErrors(csvErrors);
      setMessage("");
      setUploading(false);
    }

    if (errOnCsv) { // don't allow to upload csv on err
      return false;
    }
    try {
      const response = await axios.post("/api/csv-upload", formData);

      const data = response.data;

      if (response.status === 200) {
        setMessage(`✅ ${data.message}`);
      } else {
        setMessage(`❌ Error: ${data.error || "Upload failed"}`);
      }
    } catch (err: any) {
      console.error(err);
      const serverMsg = err?.response?.data?.error;
      setMessage(`❌ ${serverMsg || "An unexpected error occurred. Please try again."}`);
    } finally {
      setUploading(false);
      checkActiveJob();
      // setProgress(100);
    }
  };

  const handleCatalogueDownload = async () => {
    setCatalogueDownloading(true);
    const getProdReq = await fetch(`/api/get-all-uploaded-products`);
    const getProdRes = await getProdReq.json();
    if (getProdRes?.status == "success") {
      if (getProdRes?.data?.length > 0) {
        // Handled creating csv directly from response key values, if any changes did on api need to handle here too
        downloadCSV(getProdRes.data, 'products.csv');
      } else {
        setMessage("❌ No product data found to download");
      }
    } else {
      const errMsg = getProdRes?.status || "Unknown error occurred while downloading product data";
      setMessage(`❌ ${errMsg}`);
    }
    setCatalogueDownloading(false);
  };

  const { ready, can } = usePermissions();
  const router = useRouter();
  const { clearUser } = useAuth();
  if (!ready) return null;

  if (!can('Product Information', 'View')) {
    // optional: redirect or show 403
    clearUser();
    router.replace('/login');
    return null;
  }
  return (
    <>
      {catalogueDownloading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-white/20 cursor-not-allowed">
          <Loader2 className="animate-spin text-gray-600 w-8 h-8" />
        </div>
      )}
      {can('Product Information', 'View') &&
        //         <div className="max-w-xl mx-auto mt-10 p-4 border rounded shadow">
        //         <h1 className="text-xl font-bold mb-4">Upload Product Information CSV </h1>
        //          {can('Product Information', 'Add') &&
        //         <>
        //           <Input
        //         type="file"
        //         accept=".csv"
        //         onChange={(e) => setFile(e.target.files?.[0] || null)}
        //         />

        //         <Button
        //         onClick={handleUpload}
        //         disabled={!file || uploading}
        //         className="mt-4"
        //         >
        //         {uploading ? "Uploading..." : "Upload CSV"}
        //         </Button>

        //         </>
        // }


        //         {message && <div className="mt-4 text-sm">{message}</div>}
        //         </div>
        <div className="max-w-xl mx-auto mt-10 p-6 border rounded shadow">
          <h1 className="text-xl font-bold mb-4">
            {can('Product Information', 'Add')
              ? "Upload Product Information CSV"
              : "View Product Information"}
          </h1>

          {can('Product Information', 'Add') ? (
            <>
              {jobRunning && (
                <div className="flex items-center justify-between mb-2 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                  <p className="text-yellow-700 text-sm font-medium">Job already in progress. Please wait until it completes.</p>
                  <button
                    type="button"
                    onClick={cancelActiveJob}
                    disabled={cancelling}
                    className="ml-3 text-xs text-red-600 hover:text-red-800 underline whitespace-nowrap disabled:opacity-50"
                  >
                    {cancelling ? "Cancelling..." : "Cancel job"}
                  </button>
                </div>
              )}
              <Input
                type="file"
                accept=".csv"
                disabled={jobRunning}
                onChange={handleFileChange}
              />
              <div className="flex justify-end mt-2 items-center">
                <a href="/sample.csv" download className="dark:text-gray-200 text-gray-800 text-xs">
                  Download Sample CSV
                </a>
                <p className="mx-2">|</p>
                <a href="#" className="dark:text-gray-200 text-gray-800 text-xs" onClick={handleCatalogueDownload}>
                  Download Catalog
                </a>
              </div>
              <Button
                onClick={handleUpload}
                disabled={!file || uploading || jobRunning}
              >
                {jobRunning ? "Job already in progress" : uploading ? "Uploading..." : "Upload CSV"}
              </Button>
            </>
          ) : (
            <>
              <Input type="file" disabled />
              <Button disabled className="mt-4">
                Upload CSV
              </Button>
              <p className="text-gray-500 text-sm mt-2">
                You don't have permission to upload product information.
              </p>
              {/* Optional Illustration */}
              {/* <img src="/no-permission.svg" alt="No permission" className="w-40 mx-auto mt-6 opacity-50" /> */}
            </>
          )}

          {csvErrors.length > 0 && (
            <div className="mt-4 border border-red-300 rounded-md bg-red-50 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-red-100 border-b border-red-300">
                <span className="text-sm font-semibold text-red-700">
                  ❌ {csvErrors.length} error{csvErrors.length !== 1 ? "s" : ""} found — please fix and re-upload
                </span>
                <button
                  type="button"
                  onClick={() => setCsvErrors([])}
                  className="text-red-500 hover:text-red-700 text-xs underline"
                >
                  Dismiss
                </button>
              </div>
              <ul className="max-h-48 overflow-y-auto divide-y divide-red-200">
                {csvErrors.map((err, i) => (
                  <li key={i} className="px-3 py-1.5 text-xs text-red-700 font-mono">
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {message && (
            <div className={`mt-4 text-sm font-medium whitespace-pre-wrap break-words ${message.startsWith("❌") ? "text-red-600" : "text-green-600"}`}>
              {message}
            </div>
          )}
        </div>

      }
    </>

  );
}

function downloadCSV(data: Record<string, any>[], filename = 'data.csv') {
  const csv = arrayToCSV(data);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

function arrayToCSV(data: Record<string, any>[]): string {
  if (!data.length) return '';
  const keys = Object.keys(data[0]);
  const csvRows = [
    keys.join(','), // header row
    ...data.map(row => keys.map(k => JSON.stringify(row[k] ?? '')).join(','))
  ];
  return csvRows.join('\n');
}