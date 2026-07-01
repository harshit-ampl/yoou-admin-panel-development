'use client';
import { useEffect, useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useSearchParams, useRouter } from "next/navigation";

interface SyncStatus {
   status: string;
   total: string;
   processed: string;
   success: string;
   fail: string;
   total_variants: string;
   processed_variants: string;
   success_count: string;
   fail_count: string;
}

interface SyncLog {
   sku: string;
   variant_id: number;
   old_price: number;
   new_price: number;
   status: string;
   message: string;
   created_at: string;
}

interface Pagination {
   total: number;
   page: number;
   limit: number;
   totalPages: number;
}

const ITEMS_PER_PAGE = 100;

export default function SyncDashboardPage() {
   return (
      <Suspense fallback={<div>Loading Dashboard...</div>}>
         <SyncDashboard />
      </Suspense>
   );
}

function SyncDashboard() {
   const searchParams = useSearchParams();
   const router = useRouter();
   const initialJobId = searchParams.get("id");
   const [jobId, setJobId] = useState<string | null>(initialJobId);

   useEffect(() => {
      if (!jobId) {
         router.replace("/sync-process-logs");
      }
   }, [jobId, router]);
   const [status, setStatus] = useState<SyncStatus | null>(null);
   const [logs, setLogs] = useState<SyncLog[]>([]);
   const [loading, setLoading] = useState(false);
   const [currentPage, setCurrentPage] = useState(1);
   const [pagination, setPagination] = useState<Pagination>({
      total: 0,
      page: 1,
      limit: ITEMS_PER_PAGE,
      totalPages: 1,
   });

   const fetchStatus = async () => {
      if (!jobId) return;
      try {
         const res = await fetch(`/api/sync-status?id=${jobId}`);
         const data = await res.json();
         setStatus(data);
      } catch (e) {
         console.error("Failed to fetch status", e);
      }
   };

   const fetchLogs = async (page = currentPage) => {
      if (!jobId) return;
      try {
         const res = await fetch(`/api/sync-logs?id=${jobId}&page=${page}&limit=${ITEMS_PER_PAGE}`);
         const data = await res.json();
         setLogs(data.data || []);
         setPagination(data.pagination || pagination);
      } catch (e) {
         console.error("Failed to fetch logs", e);
      }
   };

   // const startSync = async () => {
   //    setLoading(true);
   //    try {
   //       const res = await fetch("https://pngmiddleware.amplicomm.com/dynamic-pricing", { method: "POST" });
   //       const text = await res.text();
   //       // Assume the middleware returns the started Job ID or we have to query the latest job
   //       // For now, let's fetch the latest job from the DB via a new API if needed
   //       alert("Sync started! Check the status below.");
   //    } catch (e) {
   //       alert("Failed to start sync");
   //    } finally {
   //       setLoading(false);
   //    }
   // };

   const total = parseInt(status?.total_variants ?? "0") || 0;
   const processed = parseInt(status?.processed_variants ?? "0") || 0;
   const progress = total > 0 ? (processed / total) * 100 : 0;

   useEffect(() => {
      if (status?.status === 'completed' || status?.status === 'failed') return;
      const interval = setInterval(() => {
         fetchStatus();
         fetchLogs();
      }, 5000);
      return () => clearInterval(interval);
   }, [jobId, status]);

   useEffect(() => {
      fetchLogs();
   }, [currentPage]);

   const handlePageChange = (newPage: number) => {
      setCurrentPage(Math.max(1, Math.min(newPage, pagination.totalPages)));
   };

   return (
      <div className="p-8 space-y-6">
         <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Sync Dashboard</h1>
            <div className="flex gap-2">
               <Button variant="outline" onClick={() => router.push("/sync-process-logs")}>
                  Back to Logs
               </Button>
               {/* <Button onClick={startSync} disabled={loading}>
                  {loading ? "Starting..." : "Trigger Full Price Sync"}
               </Button> */}
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
               <CardHeader><CardTitle>Status</CardTitle></CardHeader>
               <CardContent>
                  <Badge variant={status?.status === 'completed' ? 'default' : 'secondary'}>
                     {status?.status || 'Idle'}
                  </Badge>
               </CardContent>
            </Card>
            <Card>
               <CardHeader><CardTitle>Total</CardTitle></CardHeader>
               <CardContent><div className="text-2xl font-bold">{status?.total || status?.total_variants || 0}</div></CardContent>
            </Card>
            <Card>
               <CardHeader><CardTitle>Success</CardTitle></CardHeader>
               <CardContent><div className="text-2xl font-bold text-green-600">{status?.success || status?.success_count || 0}</div></CardContent>
            </Card>
            <Card>
               <CardHeader><CardTitle>Failed</CardTitle></CardHeader>
               <CardContent><div className="text-2xl font-bold text-red-600">{status?.fail || status?.fail_count || 0}</div></CardContent>
            </Card>
         </div>

         <Card>
            <CardHeader><CardTitle>Progress: {Math.round(progress)}%</CardTitle></CardHeader>
            <CardContent>
               <Progress value={progress} className="h-4" />
            </CardContent>
         </Card>

         <Card>
            <CardHeader><CardTitle>Variant Logs</CardTitle></CardHeader>
            <CardContent>
               <Table>
                  <TableHeader>
                     <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Old Price</TableHead>
                        <TableHead>New Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Message</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {logs.map((log, i) => (
                        <TableRow key={i}>
                           <TableCell className="font-medium">{log.sku}</TableCell>
                           <TableCell>₹{log.old_price}</TableCell>
                           <TableCell>₹{log.new_price}</TableCell>
                           <TableCell>
                              <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                                 {log.status}
                              </Badge>
                           </TableCell>
                           <TableCell>{log.message}</TableCell>
                        </TableRow>
                     ))}
                  </TableBody>
               </Table>

               <div className="flex items-center justify-between px-2 mt-4">
                  <div className="text-sm text-muted-foreground">
                     Showing {pagination.total === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                     {Math.min(currentPage * ITEMS_PER_PAGE, pagination.total)} of{' '}
                     {pagination.total} entries
                  </div>
                  <div className="flex items-center space-x-2">
                     <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                     >
                        Previous
                     </Button>
                     <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === pagination.totalPages || pagination.totalPages === 0}
                     >
                        Next
                     </Button>
                  </div>
               </div>
            </CardContent>
         </Card>
      </div>
   );
}
