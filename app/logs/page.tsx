'use client';
import { useEffect, useState, useCallback } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { addDays, subDays } from "date-fns";
interface Log {
  id: number;
  created_at: string;
  sku: string;
  log_message: string;
  type?: string;
  details?: string;
}
interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
const ITEMS_PER_PAGE = 10;

export default function LogsClient() {
  const { ready, can } = usePermissions();
  const router = useRouter();
  const { clearUser } = useAuth();
  const [sampleLogs, setSampleLogs] = useState<Log[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState<Date>(subDays(new Date(), 6));
  const [toDate, setToDate] = useState<Date>(new Date()); // today
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: ITEMS_PER_PAGE,
    totalPages: 1
  });

  useEffect(() => {
    if (ready && !can("Middleware Logs", "View")) {
      clearUser();
      router.replace("/login");
    }
  }, [ready, can, router, clearUser]);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fromDateStr = fromDate.toLocaleDateString("en-CA"); // yyyy-MM-dd in local timezone
      const toDateStr   = toDate.toLocaleDateString("en-CA");
      const response = await fetch(`/api/error-log?page=${currentPage}&limit=${ITEMS_PER_PAGE}&search=${encodeURIComponent(searchTerm)}&fromDate=${fromDateStr}&toDate=${toDateStr}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const resp = await response.json();
      setSampleLogs(resp.data);
      // Update pagination based on response if available
      if (resp.pagination) {
        setPagination(resp.pagination);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, fromDate, toDate]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleSearch = (newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
    setCurrentPage(1);
  };
  const exportToCSV = async () => {
    try {
      // Build query parameters to maintain current filters
      const params = new URLSearchParams();
      if (statusFilter !== "All") {
        params.append("status", statusFilter);
      }
      if (searchTerm) {
        params.append("search", searchTerm);
      }

      if (fromDate) {
        params.append("fromDate", fromDate.toISOString().split("T")[0]); // format: yyyy-MM-dd
      }

      if (toDate) {
        params.append("toDate", toDate.toISOString().split("T")[0]); // format: yyyy-MM-dd
      }

      const response = await fetch(`/api/error-log-export?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to export logs.");
      }

      const blob = await response.blob();

      // Create and trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "error_logs.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting to CSV:", error);
      setError("Failed to export CSV. Please try again.");
    }
  };


  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h2 className="text-3xl font-bold tracking-tight">Activity Logs</h2>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between w-full">
          <div className="flex gap-2">
            <Button onClick={exportToCSV} disabled={sampleLogs.length === 0}>Export CSV</Button>
            <input
              type="text"
              placeholder="Search logs..."
              className="border rounded px-2 py-1 text-sm"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
            <div className="flex flex-col">
              <DatePicker
                selected={fromDate}
                onChange={(date: Date | null) => {
                  if (date) {
                    setFromDate(date);
                    if (toDate && date > toDate) {
                      setToDate(date); // Auto-adjust toDate if user selects a fromDate > toDate
                    }
                  }
                }}
                selectsStart
                startDate={fromDate}
                endDate={toDate}
                maxDate={new Date()}
                dateFormat="yyyy-MM-dd"
                className="border p-2 rounded w-40"
              />
            </div>

            <div className="flex flex-col">
              <DatePicker
                selected={toDate}
                onChange={(date: Date | null) => {
                  if (date) setToDate(date);
                }}
                selectsEnd
                startDate={fromDate}
                endDate={toDate}
                minDate={fromDate}
                maxDate={new Date()}
                dateFormat="yyyy-MM-dd"
                className="border p-2 rounded w-40"
              />
            </div>

          </div>
        </div>

        {loading && <p>Loading Logs...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && !error && (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sampleLogs.map((log, index) => (
                    <TableRow key={log.id}>
                      <TableCell>{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</TableCell>
                      <TableCell>{log.sku}</TableCell>
                      <TableCell className="max-w-[300px] truncate">{log.log_message}</TableCell>
                      <TableCell>{new Date(log.created_at).toLocaleString("en-US", {
                        timeZone: "UTC", // Show as UTC
                      })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-center gap-2 pt-4">
              <Button
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                Previous
              </Button>
              <span className="flex items-center px-2">
                Page {currentPage} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={currentPage === pagination.totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
