"use client";
import axios from "axios";
import toast from "react-hot-toast";
import {useEffect, useState} from "react";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger} from "@/components/ui/dialog";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {Eye} from "lucide-react";
import {Card} from "@/components/ui/card";
import { stringify } from 'csv-stringify/sync';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { addDays, subDays } from "date-fns";

interface Payment {
    id: number;
    txnid: string;
    amount: number;
    firstname: string;
    email: string;
    phone: string;
    status: string;
    response: string;
    errorMsg: string;
    request: string;
    created_at: string;
    installment_no: string;
    scheme_code: string;
    requestData: Record<string, any>;
    responseData: Record<string, any>;
    errorMessage: string;
    req?: {
        productinfo?: string;
    };
}

interface Pagination {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

const ITEMS_PER_PAGE = 10;

const MERCHANT_KEY = process.env.MERCHANT_KEY!;

export function PaymentInformationManager() {
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>("All");
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [pagination, setPagination] = useState<Pagination>({
        total: 0,
        page: 1,
        limit: ITEMS_PER_PAGE,
        totalPages: 1
    });
    const [fromDate, setFromDate] = useState<Date | undefined>();
    const [toDate, setToDate] = useState<Date | undefined>();
    const fetchPayments = async (page: number, status: string, search: string,fromDate:Date,toDate:Date) => {
        setLoading(true);
        try {
            // const params = new URLSearchParams({
            //     page: page.toString(),
            //     limit: ITEMS_PER_PAGE.toString(),
            //     ...(status !== "All" && { status }),
            //     ...(search && { search }),
            //     fromDate:fromDate,
            //     toDate:toDate
            // });

            const params = new URLSearchParams({
                page: page.toString(),
                limit: ITEMS_PER_PAGE.toString(),
                ...(status !== "All" ? { status: status.toString() } : {}),
                ...(search ? { search: search.toString() } : {}),
                ...(fromDate ? { fromDate: fromDate.toString() } : {}),
                ...(toDate ? { toDate: toDate.toString() } : {})
            });


            const response = await fetch(`/api/payment?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setPayments(data.data);
            setPagination(data.pagination);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
          const today = new Date();
    setToDate(today);
    setFromDate(subDays(today, 6));
    },[])

    useEffect(() => {
      const today = new Date();
        fetchPayments(currentPage, statusFilter, searchTerm, fromDate ?? new Date(subDays(today, 6)),
  toDate ?? new Date());
    }, [currentPage, statusFilter, searchTerm,fromDate,toDate]);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            setCurrentPage(newPage);
        }
    };

    const handleStatusChange = (newStatus: string) => {
        setStatusFilter(newStatus);
        setCurrentPage(1); // Reset to first page when filter changes
    };

    const handleSearch = (newSearchTerm: string) => {
        setSearchTerm(newSearchTerm);
        setCurrentPage(1); // Reset to first page when search changes
    };

    const exportToCSV = async() => {
    try {
        // Build query parameters to maintain current filters
        const params = new URLSearchParams({
        ...(statusFilter !== "All" && { status: statusFilter }),
        ...(searchTerm && { search: searchTerm }),
        ...(fromDate ? { fromDate: fromDate.toString() } : {}),
        ...(toDate ? { toDate: toDate.toString() } : {})
        });

        const response = await fetch(`/api/csv-export?${params.toString()}`);
        
        if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
        }

        // Get the CSV data as a blob
        const blob = await response.blob();
        
        // Create a download link and trigger it
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'payments_export.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('Error exporting to CSV:', error);
        toast.error('Failed to export CSV. Please try again.');
    }
    }

const handleCheckAPI = async (payment: Payment) => {
  try {
    const response = await axios.post(
    //   `http://localhost:5001/api/check_api`,
    `${process.env.NEXT_PUBLIC_API_BASE_URL}/check_api`,
      {
        txnid: payment.txnid,
        productinfo: payment.request ? JSON.parse(payment.request).productinfo : "", 
        amount : payment.amount || "",
        firstname : payment.firstname || "",
        email : payment.email || "",
        phone : payment.phone || "",
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 seconds timeout to prevent hanging
      }
    );

    const resData = response.data;

    if (resData.status === 1) {
      const paymentStatus = resData.data.status;
      toast.success(`Transaction ${payment.txnid} is ${paymentStatus}`);
    } else {
      toast.error(`API error: ${resData.message}`);
    }

  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      toast.error('Request timed out. Please check your internet connection and try again.');
    } else if (!error.response) {
      toast.error('Network error. Unable to reach Easebuzz. Please check your connection.');
    } else {
      const errMsg = error.response.data?.message || error.message || 'Something went wrong';
      toast.error(`Failed to check transaction: ${errMsg}`);
    }
    console.error('Error calling Easebuzz API:', error);
  }
};
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const month = date.getMonth() + 1; // Months are 0-based
  const day = date.getDate();
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  });
  
  return `${month}-${day}-${year}, ${time}`;
};

// Update handleView function
const handleView = (payment: Payment) => {
    console.log(payment);
    setSelectedPayment(payment);
    setIsDialogOpen(true); // Open the dialog
    setError(null);
};

 const { ready, can } = usePermissions();
    const router = useRouter();
    const { clearUser } = useAuth();
    if (!ready) return null;

    if (!can('Payment Information', 'View')) {
      // optional: redirect or show 403
      clearUser();
      router.replace('/login');
      return null;
    }

    return (
        <>
          {can('Payment Information', 'View') &&
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between w-full">
                <h2 className="text-xl font-semibold">Payment Details</h2>

                <div className="flex gap-2">
                    <Button onClick={exportToCSV} disabled={payments.length === 0}>Export CSV</Button>
                    <div className="flex gap-4 items-center">
                    <div className="flex flex-col">
                    <DatePicker
                        selected={fromDate}
                        onChange={(date: Date | null) => setFromDate(date ?? undefined)}
                        selectsStart
                        startDate={fromDate}
                        endDate={toDate}
                        dateFormat="yyyy-MM-dd"
                        className="border p-2 rounded w-40"
                    />
                    </div>
                    <div className="flex flex-col">
                    <DatePicker
                        selected={toDate}
                        onChange={(date: Date | null) => setToDate(date ?? undefined)}
                        selectsEnd
                        startDate={fromDate}
                        endDate={toDate}
                        minDate={fromDate}
                        dateFormat="yyyy-MM-dd"
                        className="border p-2 rounded w-40"
                    />
                    </div>
                    </div>
                    <input
                        type="text"
                        placeholder="Search by Txn ID, name, email, phone"
                        className="border rounded px-2 py-1 text-sm"
                        value={searchTerm}
                        onChange={(e) => handleSearch(e.target.value)}
                    />             
                    <select
                        className="border rounded px-2 py-1 text-sm"
                        value={statusFilter}
                        onChange={(e) => handleStatusChange(e.target.value)}
                    >
                        <option value="All">All Status</option>
                        <option value="success">Success</option>
                        <option value="failure">Failure</option>
                        <option value="pending">Pending</option>
                        <option value="userCancelled">User Cancelled</option>
                    </select>
                </div>
            </div>

            {loading && <p>Loading Payments...</p>}
            {error && <p className="text-red-600">{error}</p>}

            {!loading && !error && (
                <>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>#</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Number</TableHead>
                                    <TableHead>Transaction ID</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Scheme No</TableHead>
                                    <TableHead>ACME No.</TableHead>
                                    <TableHead>Scheme Code</TableHead>
                                    {/* <TableHead>Created At</TableHead> */}
                                    <TableHead>Payment Status</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payments.map((payment, index) => (
                                    <TableRow key={payment.id}>
                                        <TableCell>{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</TableCell>
                                        <TableCell>{payment.firstname}</TableCell>
                                        <TableCell>{payment.email}</TableCell>
                                        <TableCell>{payment.phone}</TableCell>
                                        <TableCell>{payment.txnid}</TableCell>
                                        <TableCell>Rs.{payment.amount}</TableCell>
                                        <TableCell>{JSON.parse(payment?.request)?.udf1 ?? "-"}</TableCell>
                                        <TableCell>{payment.installment_no ? payment.installment_no : "-"}</TableCell>
                                        <TableCell>{payment.scheme_code ? payment.scheme_code : "-"}</TableCell>
                                        {/* <TableCell>{formatDate(payment.created_at)}</TableCell> */}
                                         <TableCell>
                                            <span
                                                className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                                    payment.status === "success"
                                                        ? "bg-green-100 text-green-800"
                                                        : payment.status === "failure"
                                                        ? "bg-red-100 text-red-800"
                                                        : "bg-yellow-100 text-yellow-800"
                                                }`}
                                            >
                                                {payment.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                            <DialogTrigger asChild>
                                                <>
                                                <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => handleView(payment)}
                                                >
                                                <Eye className="h-4 w-4 mr-1" />
                                                </Button>
                                        {/* {payment.status.toLowerCase() !="success" && 
                                            <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={()=>handleCheckAPI(payment)}>
                                                    Check API
                                                </Button>
                                                } */}
                                                </>
                                            </DialogTrigger>
                                            <DialogContent className="max-h-[90vh] overflow-auto max-w-4xl w-[95vw] md:w-full">
                                                <DialogHeader>
                                                <DialogTitle className="text-lg md:text-xl">Payment Details</DialogTitle>
                                                </DialogHeader>
                                                {selectedPayment && (
                                                <div className="space-y-6">
                                                    {/* Grid Layout - Responsive */}
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                                                    
                                                    {/* Request Data Card */}
                                                    <Card className="p-4 md:p-6 bg-card">
                                                        <h3 className="font-semibold mb-3 text-base md:text-lg flex items-center">
                                                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                                                        Request Data
                                                        </h3>
                                                        {selectedPayment.request != null ? (
                                                        <div className="space-y-3">
                                                            {Object.entries(JSON.parse(selectedPayment.request)).map(([key, value]) => (
                                                            <div key={key} className="border-b border-border last:border-b-0 pb-3 last:pb-0">
                                                                {/* Mobile Layout - Stacked */}
                                                                <div className="block sm:hidden">
                                                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                                                                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                                                </div>
                                                                {/* <div className="text-sm text-gray-900 break-words bg-gray-50 p-2 rounded"> */}
                                                                <div className="text-sm text-foreground break-words bg-muted/30 p-2 rounded">
                                                                    {value ? String(value) : "-"}
                                                                </div>
                                                                </div>
                                                                
                                                                {/* Desktop Layout - Side by Side */}
                                                                <div className="hidden sm:flex sm:items-start sm:justify-between">
                                                                <div className="flex-shrink-0 w-[30%] pr-3">
                                                                    <div className="text-sm font-medium text-muted-foreground text-right">
                                                                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                                                                    </div>
                                                                </div>
                                                                <div className="flex-grow min-w-0 w-2/3">
                                                                    <div className="text-sm text-foreground break-words">
                                                                    {value ? String(value) : <span className="text-muted-foreground italic">Not provided</span>}
                                                                    </div>
                                                                </div>
                                                                </div>
                                                            </div>
                                                            ))}
                                                        </div>
                                                        ) : (
                                                        <div className="text-center py-8 text-muted-foreground">
                                                            <div className="w-12 h-12 mx-auto mb-2 bg-muted rounded-full flex items-center justify-center">
                                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                            </svg>
                                                            </div>
                                                            <p className="text-sm">No request data available</p>
                                                        </div>
                                                        )}
                                                    </Card>

                                                    {/* Response Data Card */}
                                                    <Card className="p-4 md:p-6 bg-card">
                                                        <h3 className="font-semibold mb-3 text-base md:text-lg flex items-center">
                                                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                                                        Response Data
                                                        </h3>
                                                        {selectedPayment.response != null ? (
                                                        <div className="space-y-3">
                                                            {Object.entries(JSON.parse(selectedPayment.response)).map(([key, value]) => (
                                                            <div key={key} className="border-b border-border last:border-b-0 pb-3 last:pb-0">
                                                                {/* Mobile Layout - Stacked */}
                                                                <div className="block sm:hidden">
                                                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                                                                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                                                </div>
                                                                <div className="text-sm text-foreground break-words bg-muted/30 p-2 rounded">
                                                                    {value ? String(value) : "-"}
                                                                </div>
                                                                </div>
                                                                
                                                                {/* Desktop Layout - Side by Side */}
                                                                <div className="hidden sm:flex sm:items-start sm:justify-between">
                                                                <div className="flex-shrink-0 w-[50%] pr-3">
                                                                    <div className="text-sm font-medium text-muted-foreground text-right">
                                                                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                                                                    </div>
                                                                </div>
                                                                <div className="flex-grow min-w-0 w-2/3">
                                                                    <div className="text-sm text-foreground break-words">
                                                                    {value ? String(value) : <span className="text-muted-foreground italic">Not provided</span>}
                                                                    </div>
                                                                </div>
                                                                </div>
                                                            </div>
                                                            ))}
                                                        </div>
                                                        ) : (
                                                        <div className="text-center py-8 text-muted-foreground">
                                                            <div className="w-12 h-12 mx-auto mb-2 bg-muted rounded-full flex items-center justify-center">
                                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                            </svg>
                                                            </div>
                                                            <p className="text-sm">No response data available</p>
                                                        </div>
                                                        )}
                                                    </Card>
                                                    </div>

                                                    {/* Error Message Card - Full Width */}
                                                    <Card className="p-4 md:p-6 border-destructive/30 bg-destructive/10">
                                                    <h3 className="font-semibold mb-3 text-base md:text-lg text-destructive flex items-center">
                                                        <div className="w-2 h-2 bg-destructive rounded-full mr-2"></div>
                                                        Error Message
                                                    </h3>
                                                    {selectedPayment?.errorMsg ? (
                                                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 md:p-4">
                                                        <p className="text-destructive text-sm md:text-base break-words whitespace-pre-wrap">
                                                            {selectedPayment.errorMsg}
                                                        </p>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center py-6 text-muted-foreground">
                                                        <div className="w-12 h-12 mx-auto mb-2 bg-success/10 rounded-full flex items-center justify-center">
                                                            <svg className="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        </div>
                                                        <p className="text-sm">No errors reported</p>
                                                        </div>
                                                    )}
                                                    </Card>

                                                    {/* Payment Summary - Mobile Optimized */}
                                                    <Card className="p-4 md:p-6 bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
                                                    <h3 className="font-semibold mb-3 text-base md:text-lg text-primary flex items-center">
                                                        <div className="w-2 h-2 bg-primary rounded-full mr-2"></div>
                                                        Payment Summary
                                                    </h3>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                                                        <div className="bg-background/60 rounded-lg p-3 border border-border">
                                                        <div className="text-xs md:text-sm text-muted-foreground font-medium">Transaction ID</div>
                                                        <div className="text-sm md:text-base font-semibold text-foreground truncate">
                                                            {selectedPayment.txnid || 'N/A'}
                                                        </div>
                                                        </div>
                                                        <div className="bg-background/60 rounded-lg p-3 border border-border">
                                                        <div className="text-xs md:text-sm text-muted-foreground font-medium">Status</div>
                                                        <div className="text-sm md:text-base font-semibold text-foreground">
                                                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                                            selectedPayment.status === 'success' ? 'bg-success/20 text-success' :
                                                            selectedPayment.status === 'failed' ? 'bg-destructive/20 text-destructive' :
                                                            'bg-warning/20 text-warning'
                                                            }`}>
                                                            {selectedPayment.status || 'Unknown'}
                                                            </span>
                                                        </div>
                                                        </div>
                                                        <div className="bg-background/60 rounded-lg p-3 border border-border">
                                                        <div className="text-xs md:text-sm text-muted-foreground font-medium">Amount</div>
                                                        <div className="text-sm md:text-base font-semibold text-foreground">
                                                            {selectedPayment.amount ? `₹${selectedPayment.amount}` : 'N/A'}
                                                        </div>
                                                        </div>
                                                        <div className="bg-background/60 rounded-lg p-3 border border-border">
                                                        <div className="text-xs md:text-sm text-muted-foreground font-medium">Customer</div>
                                                        <div className="text-sm md:text-base font-semibold text-foreground truncate">
                                                            {selectedPayment.firstname || 'N/A'}
                                                        </div>
                                                        </div>
                                                    </div>
                                                    </Card>
                                                </div>
                                                )}
                                            </DialogContent>
                                            </Dialog>
                                        </TableCell>  
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination Controls */}
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
       }
        </>
    );
}
