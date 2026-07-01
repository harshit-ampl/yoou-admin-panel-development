export interface PaymentAttributes {
    id: number;
    txnid: string; 
    amount: number;
    customer_id: number; 
    firstname?: string | null; 
    email?: string | null; 
    phone?: string | null; 
    status?: string | null; 
    request?: string | null; 
    response?: string | null; 
    error_msg?: string | null;
    created_at: Date; 
}
