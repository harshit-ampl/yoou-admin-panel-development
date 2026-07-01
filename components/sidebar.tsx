"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CircleDollarSign, Gem, History, LayoutDashboard, Users, Files, CloudUpload, UserCheck, HeartPulse } from "lucide-react";
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
interface PermissionHookReturn {
    ready: boolean;
    can: (module: string, action: string) => boolean;
    role?: string;
}
const routes = [
    {
        label: "Dashboard",
        icon: LayoutDashboard,
        href: "/",
        module: "Dashboard",
    },
    {
        label: "Metal Prices",
        icon: CircleDollarSign,
        href: "/metal-prices",
        module: "Metal Prices",
    },
    {
        label: "Making Charges",
        icon: Gem,
        href: "/making-charges",
        module: "Making Charges",
    },
    {
        label: "Stone Prices",
        icon: CircleDollarSign,
        href: "/stone-prices",
        module: "Stone Prices",
    },
    {
        label: "Product Upload",
        icon: CloudUpload,
        href: "/product-information",
        module: "Product Information",
    },
    {
        label: "Payment Information",
        icon: CircleDollarSign,
        href: "/payment-information",
        module: "Payment Information",
    },
    {
        label: "User Information",
        icon: Users,
        href: "/user-information",
        module: "User Information",
    },
    {
        label: "File Upload Logs",
        icon: Files,
        href: "/file-upload",
        module: "File Upload",
    },
    {
        label: "User Activity Log",
        icon: UserCheck,
        href: "/user-log",
        module: "User Activity Log",
    },
    {
        label: "Middleware Logs",
        icon: History,
        href: "/logs",
        module: "Middleware Logs",
    },
    {
        label: "Sync Monitor",
        icon: HeartPulse,
        href: "/sync-process-logs",
        module: "Dashboard",
    },
];

export function Sidebar() {
    const pathname = usePathname();

    const { ready, can } = usePermissions() as PermissionHookReturn;

    const filteredRoutes = routes.filter(route => can(route.module, 'View'));

    return (
        <div className="space-y-4 py-4 flex flex-col h-full bg-gray-100 dark:bg-gray-900">
            <div className="px-3 py-2">
                <div className="flex justify-center mb-6">
                    <img
                        src="https://www.pngjewellers.com/cdn/shop/files/Asset_5_4x_13aa9aef-f2a1-4c88-917f-df9a71318794_200x.png?v=1781592589"
                        alt="PNG Jewellers Logo"
                        className="h-12 w-auto"
                    />
                </div>
                {/* <h2 className="mb-2 px-4 text-lg font-semibold">PNG Jewellers</h2> */}
                <div className="space-y-1">
                    {!ready ? (
                        // Skeleton rows while permissions are loading
                        Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-10 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse mx-1"
                            />
                        ))
                    ) : (
                        filteredRoutes.map((route) => (
                            <Link key={route.href} href={route.href}>
                                <Button
                                    variant={pathname === route.href ? "secondary" : "ghost"}
                                    className="w-full justify-start"
                                >
                                    <route.icon className="mr-2 h-4 w-4" />
                                    {route.label}
                                </Button>
                            </Link>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
