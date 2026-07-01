import Link from "next/link"
import { cn } from "@/lib/utils"

export function MainNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <nav
      className={cn("flex items-center space-x-4 lg:space-x-6", className)}
      {...props}
    >
      <Link
        href="/"
        className="text-sm font-medium transition-colors hover:text-primary"
      >
        Dashboard
      </Link>
      <Link
        href="/metal-prices"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        Metal Prices
      </Link>
      <Link
        href="/making-charges"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        Making Charges
      </Link>
    </nav>
  )
}