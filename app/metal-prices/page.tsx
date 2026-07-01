import { Metadata } from "next"
import { MetalPriceManager } from "@/components/metal-price-manager"

export const metadata: Metadata = {
  title: "Metal Prices",
  description: "Manage metal prices and configurations",
}

export default function MetalPricesPage() {
  return (
    <div className="flex-col">
      <div className="border-b">
        <div className="flex h-16 items-center px-4">
          <h1 className="text-2xl font-bold">Metal Price Management</h1>
        </div>
      </div>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <MetalPriceManager />
      </div>
    </div>
  )
}