"use client";

import { Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductInformationManager } from "@/components/product-information-manager";
import { ProductBrowser } from "@/components/product-browser";
import { Upload, List } from "lucide-react";

export default function ProductInformationPage() {
  return (
    <div className="flex-col">
      <div className="border-b">
        <div className="flex h-16 items-center px-4">
          <h1 className="text-2xl font-bold">Product Management</h1>
        </div>
      </div>

      <div className="flex-1 space-y-4 p-8 pt-6">
        <Tabs defaultValue="browse">
          <TabsList>
            <TabsTrigger value="browse" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Browse &amp; Edit
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload CSV
            </TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="mt-6">
            <Suspense>
              <ProductBrowser />
            </Suspense>
          </TabsContent>

          <TabsContent value="upload" className="mt-6">
            <ProductInformationManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
