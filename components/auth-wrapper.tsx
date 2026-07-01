"use client";
import { Sidebar } from "./sidebar";
import { ModeToggle } from "./mode-toggle";
import { UserNav } from "./user-nav";
import LoginPage from "@/app/login/page";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  // Don't render anything until localStorage is checked — prevents the login
  // page from flashing for already-authenticated users on every page load.
  if (loading) {
    return null;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="h-full relative">
      <div className="hidden h-full md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 z-[40] bg-gray-100 dark:bg-gray-900">
        <Sidebar />
      </div>
      <main className="md:pl-72">
        <div className="flex h-16 items-center px-4 border-b">
          <div className="ml-auto flex items-center space-x-4">
            <ModeToggle />
            <UserNav />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
