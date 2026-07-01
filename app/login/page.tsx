"use client";
import React, { useEffect, useState } from "react";
import { useRouter  } from "next/navigation";
import { Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";


export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { setUser, user } = useAuth();
  const router = useRouter();

  // If already logged in (e.g. back-navigation to /login), redirect to dashboard.
  // This also prevents the sidebar from rendering alongside the login form.
  useEffect(() => {
    if (user) {
      router.replace("/");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    await axios
      .post("/api/sign-in", {
        username,
        password,
      })
      .then((response: any) => {
        if (response.status === 200) {
          // httpOnly cookie is set by the server — just update client state
          setUser({ username: response.data.username });
          router.push('/');
        }
      })
      .catch((error: any) => {
        console.error("Login failed:", error.response?.data || error.message);
        return false;
      });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
            {/* <Lock className="w-6 h-6 text-white" /> */}
            <img
                        src="https://www.pngjewellers.com/cdn/shop/files/Asset_5_4x_13aa9aef-f2a1-4c88-917f-df9a71318794_200x.png?v=1781592589"
                        alt="PNG Jewellers Logo"
                        className="h-12 w-auto"
                    />
          
        </div>
        {/* <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          YOOU Admin Panel
        </h2> */}
        <p className="mt-2 text-center text-sm text-gray-600">
          Please sign in to access the dashboard
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700"
              >
                Username or Email
              </label>
              <div className="mt-1">
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="Enter username or email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Sign in
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
