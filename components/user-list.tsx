// components/UserTableClient.tsx
"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Edit2, Trash2 } from 'lucide-react';
import toast from "react-hot-toast";
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/* ---------- Types -------------------------------------------------- */
interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  roleId: string;
  role_code?: string;
  status: "Active" | "Inactive" | "Pending";
  createdAt: string;
  lastLogin: string;
}

interface ApiResponse {
  data: User[];
  total: number;
  limit: number;
  page: number;
  offset: number;
}

interface UserTableClientProps {
  setUserFlag: (flag: boolean) => void;
  userFlag: boolean;
  editUserModal: (user: User) => void;
}
const MAX_LIMIT = 100;

export default function UserTableClient(props: UserTableClientProps) {
  /* ---------- UI State --------------------------------------------- */
  const [page, setPage]       = useState(1);
  const [limit, setLimit]     = useState(10);
  const [users, setUsers]     = useState<User[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(false);
  const totalPages            = Math.max(Math.ceil(total / limit), 1);

  /* ---------- Fetch whenever page / limit change ------------------- */
  useEffect(() => {
    async function fetchUsers() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page:  page.toString(),
          limit: limit.toString(),
        });
        const res = await fetch(`/api/users?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load users");
        const { data, total: t }: ApiResponse = await res.json();
        setUsers(data);
        setTotal(t);
        props.setUserFlag(false)
      } catch (err) {
        console.error(err);
        setUsers([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, [page, limit,props.userFlag]);

  // const handleUserDelete = async (row: { id: number; name: string }) => {
  const handleUserDelete = async (row: User) => {
  // 1) simple native confirm (swap with your own modal if desired)
  const ok = window.confirm(
    `Are you sure you want to delete`,
  );
  if (!ok) return;

  try {
    const res = await fetch(`/api/users?id=${row.id}`, { method: 'DELETE' });

    if (!res.ok) throw new Error('Failed to delete user');

    toast.success('User deleted successfully');
    // refresh the list (toggle a flag, re‑fetch, or remove item locally)
    props.setUserFlag(true);
  } catch (err) {
    console.error(err);
    toast.error('Something went wrong while deleting the user');
  }
};

   const { ready, can } = usePermissions();
    const router = useRouter();
    const { clearUser } = useAuth();
    if (!ready) return null;

    if (!can('User Information', 'View')) {
      // optional: redirect or show 403
      clearUser();
      router.replace('/login');
      return null;
    }
  return (
    <>
      {/* Page‑size selector */}
      <div className="mb-4 flex items-center gap-2">
        <label htmlFor="pageSize" className="text-sm">
          Rows per page:
        </label>
        <select
          id="pageSize"
          value={limit}
          onChange={(e) => {
            setPage(1);                    // reset to first page
            setLimit(Math.min(+e.target.value, MAX_LIMIT));
          }}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
 {/* {(can('User Information', 'Edit') ||  can('User Information', 'Delete'))&& */}
      {/* Table */}
      <div className="bg-card rounded-lg shadow-sm overflow-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
              <tr>
  {/* fixed headers */}
  {["User Name", "Email", "Role Name", "Created At"].map((h) => (
    <th
      key={h}
      className="px-6 py-3 text-left text-xs font-medium text-muted-foreground tracking-wider"
    >
      {h}
    </th>
  ))}

  {/* conditional “Action” header */}
  {(can("User Information", "Edit") ||
    can("User Information", "Delete")) && (
    <th
      key="Action"
      className="px-6 py-3 text-right text-xs font-medium text-muted-foreground tracking-wider"
    >
      Action
    </th>
  )}
</tr>


          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {loading ? (
              <tr>
                <td colSpan={4} className="py-8 text-center">
                  <Loader2 className="animate-spin inline-block" />
                </td>
              </tr>
            ) : users.length ? (
              users.map((u) => (
                <tr key={u.id}>
                  {/* User cell */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                    
                      <div>
                        <p className="text-sm font-medium">{u.username}</p>
                       
                      </div>
                    </div>
                  </td>
                  {/* Dates */}
                   <td className="px-6 py-4 text-sm">{u.email}</td>
                  <td className="px-6 py-4 text-sm">{u.role_code}</td>
                  <td className="px-6 py-4 text-sm">{u.createdAt
                            ? new Date(u.createdAt).toLocaleString('en-US', {
                                timeZone: "UTC", // Show as UTC (converting auto to IST)
                              })
                            : '-'}</td>
                  {(can('User Information', 'Edit') ||  can('User Information', 'Delete'))&&
                  <td className="px-6 py-4">
                    {/* <button
                        type="button"
                        style={{
                        textDecoration: "underline",
                        color: "blue",
                        fontSize: "13px",
                        }}
                        onClick={() => props.editUserModal(u)} // ✅ call the function with the user
                    >
                        Edit
                        </button> */}
                        <div className="flex space-x-2">
                            {(can('User Information', 'Edit'))&&
                        <button
                        onClick={() => props.editUserModal(u)}
                        className="text-purple-800 hover:text-purple-900 p-2 rounded hover:bg-purple-50 transition-colors"
                        >
                        <Edit2 size={18} />
                        </button>
                          }
                      {(can('User Information', 'Delete'))&&
                        <button
                        onClick={() => handleUserDelete(u)}
                        className="text-red-600 hover:text-red-900 p-2 rounded hover:bg-red-50 transition-colors"
                        >
                        <Trash2 size={18} />
                        </button>
                          }
                        </div>
                    </td>
                    }

                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="flex justify-center items-center gap-4 mt-6">
          <button
            disabled={page === 1 || loading}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            className={`flex items-center gap-1 px-3 py-1 rounded border text-sm ${
              page === 1 || loading
                ? "border-gray-300 text-gray-400 cursor-not-allowed"
                : "border-gray-400 hover:bg-gray-100"
            }`}
          >
            <ChevronLeft size={14} /> Prev
          </button>

          <span className="text-sm">
            Page {page} of {totalPages}
          </span>

          <button
            disabled={page === totalPages || loading}
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            className={`flex items-center gap-1 px-3 py-1 rounded border text-sm ${
              page === totalPages || loading
                ? "border-gray-300 text-gray-400 cursor-not-allowed"
                : "border-gray-400 hover:bg-gray-100"
            }`}
          >
            Next <ChevronRight size={14} />
          </button>
        </nav>
      )}
    </>
  );
}
