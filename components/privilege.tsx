/* app/(admin)/role-privilege-matrix/RolePrivilegeMatrix.tsx
   --------------------------------------------------------------------- */
"use client";
import React, { useEffect, useState } from "react";
import { Save, Plus } from "lucide-react";
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

type Action = "Add" | "Edit" | "View" | "Delete";

interface ModuleDef {
  id: number;
  name: string;
  code: string;
  actions: Action[];
}

interface Role {
  id: string;
  role: string;
  role_code: string;
}

type RolePermissionMatrix = {
  [moduleName: string]: { [action in Action]?: boolean };
};

export default function RolePrivilegeMatrix() {
  const [modules, setModules] = useState<ModuleDef[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("");

  const [matrix, setMatrix] = useState<Record<string, RolePermissionMatrix>>({});
  const [loadingMatrix, setLoadingMatrix] = useState(false);

  const [newRole, setNewRole] = useState({ role: "", role_code: "" });
  const [roleError, setRoleError] = useState("");

  /* 1) fetch modules + roles on mount */
  useEffect(() => {
    (async () => {
      const [modRes, roleRes] = await Promise.all([
        fetch("/api/modules"),
        fetch("/api/role"),
      ]);
      const modsJson = await modRes.json();
      const rolesJson = await roleRes.json();

      const m: ModuleDef[] = modsJson.map((x: any) => ({
        id: x.id,
        name: x.module,
        code: x.module_code,
        actions:
          x.module === "Dashboard" ||
          x.module === "Middleware Logs" ||
          x.module === "Payment Information" ||
          x.module === "File Upload"
            ? ["View"]
            : ["Add", "Edit", "View", "Delete"],
      }));

      setModules(m);
      const filteredRoles = rolesJson.filter(
        (item: Role) => item.role.toLowerCase() !== "super admin"
      );
      setRoles(filteredRoles);
      if (rolesJson.length) setSelectedRole(rolesJson[0].id.toString());
    })();
  }, []);

  /* 2) fetch permissions whenever selectedRole changes */
  useEffect(() => {
    if (!selectedRole) return;
    setLoadingMatrix(true);
    fetch(`/api/permissions?role_id=${selectedRole}`)
      .then((r) => r.json())
      .then((perms) =>
        setMatrix((prev) => ({ ...prev, [selectedRole]: perms }))
      )
      .finally(() => setLoadingMatrix(false));
  }, [selectedRole]);

  /* 3) checkbox toggle */
  const toggle = (module: string, action: Action) => {
    setMatrix((prev) => ({
      ...prev,
      [selectedRole]: {
        ...prev[selectedRole],
        [module]: {
          ...prev[selectedRole]?.[module],
          [action]: !prev[selectedRole]?.[module]?.[action],
        },
      },
    }));
  };

  /* 4) save to API */
  const save = async () => {
    await fetch(`/api/permissions?role_id=${selectedRole}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(matrix[selectedRole] || {}),
    });
    alert("Permissions saved!");
  };

  /* 5) create role — blocks duplicates */
  const createRole = async () => {
    const roleName = newRole.role.trim();
    if (!roleName) return;

    const isDuplicate = roles.some(
      (r) => r.role.toLowerCase() === roleName.toLowerCase()
    );
    if (isDuplicate) {
      setRoleError('Role "' + roleName + '" already exists.');
      return;
    }

    setRoleError("");
    const role_code = roleName.toLocaleLowerCase();
    const res = await fetch("/api/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: roleName, role_code }),
    });
    const created = await res.json();
    if (!res.ok) {
      setRoleError(created.error || "Failed to create role.");
      return;
    }
    setRoles((r) => [...r, created]);
    setNewRole({ role: "", role_code: "" });
    setSelectedRole(created.id.toString());
  };

  /* 6) helpers */
  const roleMatrix = matrix[selectedRole] || {};

  const { ready, can } = usePermissions();
  const router = useRouter();
  const { clearUser } = useAuth();
  if (!ready) return null;

  if (!can("User Information", "View")) {
    clearUser();
    router.replace("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Role - Privilege Matrix</h1>

      {/* role picker + creator */}
      <div className="flex flex-wrap gap-4 items-end">
        <div style={{ width: "20%" }}>
          <label className="block text-sm font-medium mb-1">Choose role</label>
          <select
            className="border rounded px-3 py-2"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
          >
            <option value="">Select...</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.role}
              </option>
            ))}
          </select>
        </div>

        {can("User Information", "Add") && (
          <div style={{ width: "78%" }}>
            <div className="flex gap-2" style={{ display: "flex", justifyContent: "end" }}>
              <div className="flex flex-col">
                <input
                  type="text"
                  placeholder="Enter new role name"
                  value={newRole.role}
                  onChange={(e) => {
                    setRoleError("");
                    setNewRole((p) => ({ ...p, role: e.target.value }));
                  }}
                  className={"border rounded px-3 py-2" + (roleError ? " border-red-500" : "")}
                />
                {roleError && (
                  <span className="text-red-500 text-xs mt-1">{roleError}</span>
                )}
              </div>
              <button
                onClick={createRole}
                className="flex items-center gap-1 bg-purple-800 text-white rounded px-4 py-2 hover:bg-purple-700"
              >
                <Plus size={16} /> Create
              </button>
            </div>
          </div>
        )}
      </div>

      {/* matrix */}
      {selectedRole && !loadingMatrix && (
        <div className="overflow-x-auto border rounded bg-white dark:bg-gray-800 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th className="p-3 text-left">Module</th>
                {["Add", "Edit", "View", "Delete"].map((act) => (
                  <th key={act} className="p-3 text-center">
                    {act}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map((mod) => (
                <tr key={mod.id} className="border-t dark:border-gray-600">
                  <td className="p-3 font-medium text-gray-900 dark:text-gray-100">
                    {mod.name}
                  </td>
                  {(["Add", "Edit", "View", "Delete"] as Action[]).map((act) => (
                    <td key={act} className="p-3 text-center">
                      {mod.actions.includes(act) ? (
                        <input
                          type="checkbox"
                          checked={roleMatrix[mod.name]?.[act] || false}
                          onChange={() => toggle(mod.name, act)}
                        />
                      ) : (
                        "-"
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* save */}
      {selectedRole && (
        <div className="self-end">
          {can("User Information", "Add") && (
            <button
              onClick={save}
              className="flex items-center gap-2 bg-purple-800 text-white rounded px-6 py-2 hover:bg-purple-700"
            >
              <Save size={16} /> Save
            </button>
          )}
        </div>
      )}
    </div>
  );
}
