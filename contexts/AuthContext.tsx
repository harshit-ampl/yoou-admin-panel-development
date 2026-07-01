"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface User {
  username: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  setUser: (user: User) => void;
  logout: () => void;
  clearUser: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Restore session from the httpOnly cookie via /api/me
    fetch("/api/me")
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.username) setUser({ username: data.username });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await fetch("/api/sign-out", { method: "POST" });
    setUser(null);
    router.push("/login");
  };

  // Clears client-side user state without signing out — used when a permission
  // check fails so the login page doesn't bounce back to the dashboard.
  const clearUser = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, loading, setUser, logout, clearUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
