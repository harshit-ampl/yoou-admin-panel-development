import { Metadata } from "next"
import { StonePriceManager } from "@/components/stone-price-manager"

export const metadata: Metadata = {
  title: "Stone Prices",
  description: "Manage stone prices and configurations",
}

export default function StonePricesPage() {
  return (
    <div className="flex-col">
      <div className="border-b">
        <div className="flex h-16 items-center px-4">
          <h1 className="text-2xl font-bold">Stone Price Management</h1>
        </div>
      </div>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <StonePriceManager />
      </div>
    </div>
  )
}