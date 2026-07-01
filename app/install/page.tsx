import { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const metadata: Metadata = {
  title: "Install App",
  description: "Install the Jewelry Management App",
}

export default function InstallPage() {
  return (
    <div className="container relative min-h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-1 lg:px-0">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <Card>
          <CardHeader>
            <CardTitle>Install App</CardTitle>
            <CardDescription>
              Enter your Shopify store URL to install the PNG Jewelry Management app
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/api/auth" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="shop">Store URL</Label>
                <Input
                  id="shop"
                  name="shop"
                  placeholder="your-store.myshopify.com"
                  required
                  pattern="[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com"
                />
              </div>
              <Button type="submit" className="w-full">
                Install App
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}