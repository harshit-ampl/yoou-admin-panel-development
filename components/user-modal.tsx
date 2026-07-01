// components/UserModalComponent.tsx
"use client";

import { useState, useEffect } from "react";
import type { FC } from "react";
import { Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";

/* ---------- Types -------------------------------------------------- */
interface Role {
  id: string;
  name: string;
}
interface RoleData {
  role_code: string;
  role: string;
}
interface User {
  id: string;
  name: string;
  email: string;
  role_code: string;
}
interface UserData {
  name: string;
  email: string;
  password?: string;
  confirmPassword?: string;
  role_code: string;
}
interface UserModalProps {
  action: 'create' | 'edit';  // Add action prop
  editId?: string;   
  userData: UserData;
  setUserData: React.Dispatch<React.SetStateAction<UserData>>;
  roles: Role[];
  onSave: (payload: {
    name: string;
    email: string;
    password?: string;
    role_code: string;
  }) => void;
  onClose: () => void;
  setUserFlag: React.Dispatch<React.SetStateAction<boolean>>;
}

/* ---------- Component --------------------------------------------- */
const UserModalComponent: FC<UserModalProps> = ({
  action,
  editId,
  userData,
  setUserData,
  roles,
  onSave,
  setUserFlag,
  onClose,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [rolesData,setRoles] = useState<RoleData[]>([])

  /* ----- Handlers -------------------------------------------------- */
  const handlePasswordReset = () => {
    setShowResetPassword(true);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setUserData((prev) => ({ ...prev, password: "", confirmPassword: "" }));
  };

const NAME_REGEX      = /^[A-Za-z][A-Za-z ]{1,49}$/;               // 2–50 letters/spaces
const EMAIL_REGEX     = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;            // simple but solid


const handleSubmit = () => {
  /* -------- Name validation --------------------------------------- */
  if (!userData.name?.trim()) {
    toast.error("Please enter the name");
    return;
  }
  else if (!NAME_REGEX.test(userData.name.trim())) {
    toast.error("Name must be 2‑50 alphabetic characters (letters & spaces).");
    return;
  }

  /* -------- Email validation -------------------------------------- */
  else if (!userData.email?.trim()) {
    toast.error("Please enter the email");
    return;
  }
  else if (!EMAIL_REGEX.test(userData.email.trim())) {
    toast.error("Enter a valid e‑mail address.");
    return;
  }

  /* -------- Password validation ----------------------------------- */
  if (!userData.password?.trim()) {
    toast.error("Please enter the password");
    return;
  }
  else if (!userData.role_code?.trim()) {
    toast.error("Please choose the role");
    return;
  }
 

  /* -------- All good → save --------------------------------------- */
  onSave({
    name: userData.name.trim(),
    email: userData.email.trim(),
    password: userData.password,
    role_code: userData.role_code,
  });
};

const handleUpdate = ()=>{
    /* -------- Name validation --------------------------------------- */
  if (!userData.name?.trim()) {
    toast.error("Please enter the name");
    return;
  }
  if (!NAME_REGEX.test(userData.name.trim())) {
    toast.error("Name must be 2‑50 alphabetic characters (letters & spaces).");
    return;
  }

  /* -------- Email validation -------------------------------------- */
  if (!userData.email?.trim()) {
    toast.error("Please enter the email");
    return;
  }
  if (!EMAIL_REGEX.test(userData.email.trim())) {
    toast.error("Enter a valid e‑mail address.");
    return;
  }

  /* -------- Password validation ----------------------------------- */
   if (!userData.role_code?.trim()) {
    toast.error("Please choose the role");
    return;
  }

  if ((userData.password?.trim() || userData.confirmPassword?.trim())) {
    if(!userData.password?.trim()){
      toast.error("Please enter the new passwotd");
      return;
    }
    else if(!userData.confirmPassword?.trim()){
      toast.error("Please enter the confirm password");
      return;
    }else{
      if((userData.password?.trim() != userData.confirmPassword?.trim())){
        toast.error("password doesn't match");
        return;
      }else{
        updateUser()
      }
    }
  }else{
    updateUser()
  }
}

const updateUser = async()=>{
  try {
      const reqParams: {
      username: string;
      email: string;
      role_code: string;
      password?: string; // optional
    } = {
      username:  userData.name.trim(),
      email: userData.email.trim(),
      role_code: userData.role_code,
    };

    // Add password only if it’s non‑empty after trim
    if (userData.password?.trim()) {
      reqParams.password = userData.password;
    }

    const response = await fetch(`/api/users?id=${editId}`, { 
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reqParams),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create user');
    }
    setUserFlag(true)
    const result = await response.json();
    onClose()
    toast.success("User updated successfully")
  }catch (error) {
    console.error('Error saving user:', error);
    alert((error as Error).message || 'An error occurred while saving the user');
  }
}
 useEffect(() => {
    const controller = new AbortController();    // allows cancel on unmount

    (async () => {
      try {
        const res = await fetch('/api/role', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        });

        if (!res.ok) {
          const { error } = await res.json();
          throw new Error(error || 'Failed to fetch roles');
        }

        const data = await res.json();           // ← array of roles
        setRoles(data);                          // update state / parent
      } catch (err: any) {
        if (err.name === 'AbortError') return;   // ignore if unmounted
        console.error(err);
      }
    })();

    return () => controller.abort();             // cleanup
  }, []);  
  
    const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>)=>{
      console.log(e.target.value)
     setUserData((p) => ({ ...p, role_code: e.target.value }))
  }// // run once on mount

  return (
    <>
  
       <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            {action.toLowerCase() === "edit"  ? "Modify User" : "Add New User"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={userData.name}
              onChange={(e) =>
                setUserData((p) => ({ ...p, name: e.target.value }))
              }
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={userData.email}
              onChange={(e) =>
                setUserData((p) => ({ ...p, email: e.target.value }))
              }
              required
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
             <select
        id="role"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
        value={userData.role_code ?? ''}            
        onChange={
         handleRoleChange
        }
      >
        <option value="">Choose role…</option>

        {rolesData?.map((r) => (
          <option key={r.role_code} value={r.role_code}>
            {r.role}
          </option>
        ))}
      </select>
          </div>
            <>
              {action.toLowerCase() === "edit"  &&
                <div>
                  <div className="border-t" style={{marginTop:"5%",marginBottom:"3%"}}></div>
                  <span style={{fontWeight:"bold",fontSize:"15px"}}>Reset password</span>
                </div>
              }
            </>
            <>
              {/* New password */}
              <div>
                {action.toLowerCase() === "edit"  ?
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                    </label>
                    :
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                    </label>
                }

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={userData.password ?? ""}
                    onChange={(e) =>
                      setUserData((p) => ({ ...p, password: e.target.value }))
                    }
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

              </div>

              {action.toLowerCase() === "edit" && 
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={userData.confirmPassword ?? ""}
                    onChange={(e) =>
                      setUserData((p) => ({
                        ...p,
                        confirmPassword: e.target.value,
                      }))
                    }
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>
        }
            </>
          
          {/* Footer */}
          <div className="flex space-x-3 pt-4 ">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
             {action.toLowerCase() === "edit"  ? 
                <button
                onClick={handleUpdate}
                className="flex-1 px-4 py-2 bg-purple-800 text-white rounded-lg hover:bg-purple-700"
                >
                Update User
                </button>
             :
                <button
                onClick={handleSubmit}
                className="flex-1 px-4 py-2 bg-purple-800 text-white rounded-lg hover:bg-purple-700"
                >
                Create User
                </button>
            }
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default UserModalComponent;
