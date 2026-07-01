import {PaymentInformationManager} from "@/components/payment-information-manager";
import {Metadata} from "next";

export const metadata: Metadata = {
    title: "Payment Information",
    description: "Manage payment information and details",
};

export default function PaymentInformationPage() {
    return (
        <div className="flex-col">
            <div className="border-b">
                <div className="flex h-16 items-center px-4">
                    <h1 className="text-2xl font-bold">Payment Information</h1>
                </div>
            </div>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <PaymentInformationManager />
            </div>
        </div>
    );
}
