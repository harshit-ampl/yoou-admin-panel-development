import { Metadata } from "next"
import { MakingChargeManager } from "@/components/making-charge-manager"

export const metadata: Metadata = {
  title: "Making Charges",
  description: "Manage making charges and rules",
}

export default function MakingChargesPage() {
  return (
    <div className="flex-col">
      <div className="border-b">
        <div className="flex h-16 items-center px-4">
          <h1 className="text-2xl font-bold">Making Charge Management</h1>
        </div>
      </div>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <MakingChargeManager />
      </div>
    </div>
  )
}