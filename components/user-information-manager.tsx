"use client";

import { use, useEffect, useState } from 'react';
import { Users, Shield, Plus, Edit2, Trash2, Settings,  FileText, BarChart3, Database } from 'lucide-react';
import {LucideProps} from 'lucide-react';
import { Button } from './ui/button';
import RolePermissionsDashboard from './privilege';
import UserTableClient from './user-list';
import UserModalComponent from './user-modal';
import toast from "react-hot-toast";
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface TabButtonProps {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string}>;
  isActive: boolean;
  onClick: (id: string) => void;
}

interface User {
  id: string;
  name: string;
  username?: string;
  email: string;
  roleId: string;
  role_code?: string; 
  status?: string;
  lastLogin?: string;
  createdAt?: string;
  password?: string; // Optional for existing users
}
interface UserData {
  name: string;
  email: string;
  password?: string;
  confirmPassword?: string;
  role_code: string;
}
interface Role {
  id: string;
  name: string;
  description: string;
  userCount: number;
  createdAt: string;
  modulePermissions: Record<string, string[]>;
}

interface Permission {
  [key: string]: string[];
}

interface Module {
  name: string;
  icon: React.ComponentType<LucideProps>;
  permissions: string[];
}

interface UserManagementProps {
  users: User[];
  roles: Role[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterRole: string;
  setFilterRole: (role: string) => void;
  getRoleName: (roleId: string) => string;
  getRoleBadgeColor: (roleName: string) => string;
  getStatusBadgeColor: (status: string) => string;
  openUserModal: (user: User | null) => void; // Replace 'any' with your User type
  deleteUser: (userId: string) => void;
}

interface RoleManagementProps {
  roles: Role[];
  modules: Record<string, Module>;
  openRoleModal: (role: Role | null) => void;
  deleteRole: (roleId: string) => void;
}

interface UserModalProps {
  user: User | null;  // Change from undefined to null
  action: 'create' | 'edit';
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
interface RoleModalProps {
  role: Role | null;
  modules: Record<string, Module>;
  onSave: (roleData: {
    name: string;
    description: string;
    modulePermissions: Record<string, string[]>;
  }) => void; // You can make this more specific
  onClose: () => void;
}

const TabButton = ({ id, label, icon: Icon, isActive, onClick }: TabButtonProps) => (
  <Button
    onClick={() => onClick(id)}
    className={`px-6 py-3 rounded-lg flex items-center space-x-2 transition-all duration-200 
        border-2 font-medium
      ${
      isActive
         ? 'bg-primary text-white border-primary shadow-md'
          : 'bg-white text-primary border-primary/40 hover:bg-primary/10 hover:border-primary hover:text-primary'
    }`}
  >
    <Icon size={20} />
    <span>{label}</span>
  </Button>
);



// const RoleManagement = ({ roles, modules, openRoleModal, deleteRole }: RoleManagementProps) => (
//   <div className="space-y-6">
//     {roles.map((role) => (
//       <div key={role.id} className="bg-white rounded-lg shadow-sm p-6">
//         <div className="flex justify-between items-start mb-4">
//           <div>
//             <div className="flex items-center space-x-3">
//               <h3 className="text-xl font-semibold text-gray-900">{role.name}</h3>
//               <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
//                 {role.userCount} users
//               </span>
//             </div>
//             <p className="text-gray-600 mt-1">{role.description}</p>
//             <p className="text-sm text-gray-500 mt-1">Created: {role.createdAt}</p>
//           </div>
//           <div className="flex space-x-2">
//             <button
//               onClick={() => openRoleModal(role)}
//               className="text-purple-800 hover:text-purple-900 p-2 rounded hover:bg-purple-50 transition-colors"
//             >
//               <Edit2 size={18} />
//             </button>
//             <button
//               onClick={() => deleteRole(role.id)}
//               className="text-red-600 hover:text-red-900 p-2 rounded hover:bg-red-50 transition-colors"
//             >
//               <Trash2 size={18} />
//             </button>
//           </div>
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//           {Object.entries(modules).map(([moduleKey, module]) => {
//             const ModuleIcon = module.icon;
//             const hasPermissions = role.modulePermissions[moduleKey]?.length > 0;
            
//             return (
//               <div key={moduleKey} className={`border rounded-lg p-4 ${hasPermissions ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
//                 <div className="flex items-center space-x-2 mb-3">
//                   <ModuleIcon className={`${hasPermissions ? 'text-green-600' : 'text-gray-400'}`} size={20} />
//                   <h4 className={`font-medium ${hasPermissions ? 'text-green-900' : 'text-gray-500'}`}>
//                     {module.name}
//                   </h4>
//                 </div>
//                 <div className="space-y-1">
//                   {module.permissions.map((permission) => {
//                     const hasPermission = role.modulePermissions[moduleKey]?.includes(permission);
//                     return (
//                       <div key={permission} className="flex items-center space-x-2">
//                         <div className={`w-2 h-2 rounded-full ${hasPermission ? 'bg-green-500' : 'bg-gray-300'}`} />
//                         <span className={`text-sm ${hasPermission ? 'text-green-700' : 'text-gray-500'}`}>
//                           {permission.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
//                         </span>
//                       </div>
//                     );
//                   })}
//                 </div>
//               </div>
//             );
//           })}
//         </div>
//       </div>
//     ))}
//   </div>
// );


const RoleModal = ({ role, modules, onSave, onClose }: RoleModalProps) => {
  const [formData, setFormData] = useState({
    name: role?.name || '',
    description: role?.description || '',
    modulePermissions: role?.modulePermissions || Object.keys(modules).reduce((acc , key) => {
      acc[key] = [];
      return acc;
    }, {} as Record<string, string[]>)
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const togglePermission = (moduleKey: string, permission:string) => {
    setFormData(prev => ({
      ...prev,
      modulePermissions: {
        ...prev.modulePermissions,
        [moduleKey]: prev.modulePermissions[moduleKey].includes(permission)
          ? prev.modulePermissions[moduleKey].filter(p => p !== permission)
          : [...prev.modulePermissions[moduleKey], permission]
      }
    }));
  };

  const toggleAllModulePermissions = (moduleKey: string) => {
    const allPermissions = modules[moduleKey].permissions;
    const currentPermissions = formData.modulePermissions[moduleKey];
    const hasAllPermissions = allPermissions.every(p => currentPermissions.includes(p));
    
    setFormData(prev => ({
      ...prev,
      modulePermissions: {
        ...prev.modulePermissions,
        [moduleKey]: hasAllPermissions ? [] : allPermissions
      }
    }));
  };

  const handleSubmit = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Role name is required';
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    onSave(formData);
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
   {can('User Information', 'View') &&

     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6 max-h-screen overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            {role ? 'Edit Role' : 'Create New Role'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        {/* <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role Name</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
              {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Module Permissions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(modules).map(([moduleKey, module]) => {
                const ModuleIcon = module.icon;
                const currentPermissions = formData.modulePermissions[moduleKey];
                const allPermissions = module.permissions;
                const hasAllPermissions = allPermissions.every(p => currentPermissions.includes(p));
                
                return (
                  <div key={moduleKey} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <ModuleIcon className="text-purple-800" size={20} />
                        <h4 className="font-medium text-gray-900">{module.name}</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleAllModulePermissions(moduleKey)}
                        className={`text-xs px-2 py-1 rounded ${
                          hasAllPermissions 
                            ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                            : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                        }`}
                      >
                        {hasAllPermissions ? 'Unselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {module.permissions.map((permission) => (
                        <label key={permission} className="flex items-center">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-purple-800 focus:ring-purple-500"
                            checked={currentPermissions.includes(permission)}
                            onChange={() => togglePermission(moduleKey, permission)}
                          />
                          <span className="ml-2 text-sm text-gray-700 capitalize">
                            {permission.replace('_', ' ')}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              {role ? 'Update' : 'Create'} Role
            </button>
          </div>
        </div> */}
      </div>
    </div>
   }
   </>
  );
};

export function UserInformationManager() {
  const [activeTab, setActiveTab] = useState('users');
  const [showUserModal, setShowUserModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('All');
  const [loading, setLoading] = useState(false);
  const [userFlag, setUserFlag]       = useState(false);
  const [userData, setUserData] = useState<UserData>({
      name: "",
      email :"",
      password: "",
      confirmPassword:"",
      role_code: ""
  })
  const [editId, setEditId] = useState("")
  const[action, setAction] =useState("")

const [error, setError] = useState<string | null>(null);
  // Module definitions with their permissions
  const modules = {
    dashboard: {
      name: 'Dashboard',
      icon: BarChart3,
      permissions: ['view_dashboard', 'export_reports', 'manage_widgets']
    },
    users: {
      name: 'User Management',
      icon: Users,
      permissions: ['view_users', 'create_users', 'edit_users', 'delete_users', 'manage_roles']
    },
    content: {
      name: 'Content Management',
      icon: FileText,
      permissions: ['view_content', 'create_content', 'edit_content', 'delete_content', 'publish_content']
    },
    reports: {
      name: 'Reports',
      icon: BarChart3,
      permissions: ['view_reports', 'create_reports', 'export_reports', 'schedule_reports']
    },
    settings: {
      name: 'System Settings',
      icon: Settings,
      permissions: ['view_settings', 'edit_settings', 'manage_integrations', 'system_backup']
    },
    database: {
      name: 'Database',
      icon: Database,
      permissions: ['view_database', 'backup_database', 'restore_database', 'manage_schemas']
    }
  };

  const [roles, setRoles] = useState<Role[]>([
    {
      id: "1",
      name: 'Super Admin',
      description: 'Full system access with all privileges',
      modulePermissions: {
        dashboard: ['view_dashboard', 'export_reports', 'manage_widgets'],
        users: ['view_users', 'create_users', 'edit_users', 'delete_users', 'manage_roles'],
        content: ['view_content', 'create_content', 'edit_content', 'delete_content', 'publish_content'],
        reports: ['view_reports', 'create_reports', 'export_reports', 'schedule_reports'],
        settings: ['view_settings', 'edit_settings', 'manage_integrations', 'system_backup'],
        database: ['view_database', 'backup_database', 'restore_database', 'manage_schemas']
      },
      userCount: 1,
      createdAt: '2024-01-15'
    },
    {
      id: "2",
      name: 'Manager',
      description: 'Management level access to most features',
      modulePermissions: {
        dashboard: ['view_dashboard', 'export_reports'],
        users: ['view_users', 'create_users', 'edit_users'],
        content: ['view_content', 'create_content', 'edit_content', 'publish_content'],
        reports: ['view_reports', 'create_reports', 'export_reports'],
        settings: ['view_settings'],
        database: []
      },
      userCount: 2,
      createdAt: '2024-01-16'
    },
    {
      id: "3",
      name: 'Editor',
      description: 'Content creation and editing privileges',
      modulePermissions: {
        dashboard: ['view_dashboard'],
        users: ['view_users'],
        content: ['view_content', 'create_content', 'edit_content'],
        reports: ['view_reports'],
        settings: [],
        database: []
      },
      userCount: 3,
      createdAt: '2024-01-17'
    },
    {
      id: "4",
      name: 'Viewer',
      description: 'Read-only access to basic features',
      modulePermissions: {
        dashboard: ['view_dashboard'],
        users: [],
        content: ['view_content'],
        reports: ['view_reports'],
        settings: [],
        database: []
      },
      userCount: 2,
      createdAt: '2024-01-18'
    }
  ]);

  const [users, setUsers] = useState([]);

  
const formatLastLogin = (dateString: string) => {
  // Implement your date formatting logic
  return new Date(dateString).toLocaleString();
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toISOString().split('T')[0];
};

  const getRoleById = (roleId: string): Role | undefined => roles.find(role => role.id === roleId);
  const getRoleName = (roleId: string) => getRoleById(roleId)?.name || 'Unknown';

  // const filteredUsers = users.filter(user => {
  //   const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //                        user.email.toLowerCase().includes(searchTerm.toLowerCase());
  //   const matchesFilter = filterRole === 'All' || getRoleName(user.roleId) === filterRole;
  //   return matchesSearch && matchesFilter;
  // });

  const getRoleBadgeColor = (roleName: string):string => {
    const colors: Record<string, string> = {
      'Super Admin': 'bg-red-100 text-red-800',
      'Manager': 'bg-purple-100 text-purple-800',
      'Editor': 'bg-green-100 text-green-800',
      'Viewer': 'bg-gray-100 text-gray-800'
    };
    return colors[roleName] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadgeColor = (status: string): string => {
    return status === 'Active' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
  };

  const openUserModal = (user: User | null = null) => {
    setSelectedUser(user);
    setShowUserModal(true);
    setAction("add")
  };

  const openRoleModal = (role: Role | null = null) => {
    setSelectedRole(role);
    setShowRoleModal(true);

  };

  const closeModals = () => {
    setShowUserModal(false);
    setShowRoleModal(false);
    setSelectedUser(null);
    setSelectedRole(null);
   setUserData({
      name: "",
      email :"",
      password: "",
      confirmPassword:"",
      role_code: ""
    })
  };

  const editUserModal = (user:User) => {
      setUserData({
      name: user.username || "",
      email:user.email,
      password: "",
      confirmPassword:"",
      role_code: user.role_code || ""
      })
      setShowUserModal(true);
      setAction("edit")
      setEditId(user.id)
  };

  const handleSaveUser = async (userData:{ 
    name: string;
    email: string;
    password?: string;
    role_code: string;
    resetToken?: string;
  }) => {
    try {
    
     const apiData = {
      username: userData.name,
      email: userData.email,  
      password: userData.password,
      role_code: userData.role_code 
    };

    const response = await fetch('/api/users', { 
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiData),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create user');
    }
    setUserFlag(true)
    const result = await response.json();
    closeModals();
    toast.success("User created successfully")
  }catch (error) {
    console.error('Error saving user:', error);
    alert((error as Error).message || 'An error occurred while saving the user');
  }
};

  const handleSaveRole = (roleData: {
  name: string;
  description: string;
  modulePermissions: Record<string, string[]>;
}) => {
    if (selectedRole) {
      setRoles(roles.map(role => 
        role.id === selectedRole.id ? { ...role, ...roleData } : role
      ));
    } else {
      const newRole = {
        id: (roles.length + 1).toString(),
        ...roleData,
        userCount: 0,
        createdAt: new Date().toISOString().split('T')[0]
      };
      setRoles([...roles, newRole]);
    }
    closeModals();
  };

  const deleteUser = (userId: string) => {
    setUsers(users.filter((user:User) => user.id !== userId));
  };

  const deleteRole = (roleId: string) => {
    // Check if role is being used by any user
    const usersWithRole = users.filter((user:User) => user.roleId === roleId);
    if (usersWithRole.length > 0) {
      alert(`Cannot delete role. ${usersWithRole.length} user(s) are assigned to this role.`);
      return;
    }
    setRoles(roles.filter(role => role.id !== roleId));
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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between w-full">
        <h2 className="text-xl font-semibold">Manage users, roles, and module-based permissions</h2>
         {can('User Information', 'Add') &&
        <div className="flex space-x-3">
          {activeTab === 'users' &&
             <button
            onClick={() => activeTab === 'users' ? openUserModal() : ""}
            className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <Plus size={20} />
            <span>{activeTab === 'users' ? 'Add User' : ''}</span>
          </button>
          }
         
        </div>
        }
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
         {can('User Information', 'View') &&
        <div className="flex space-x-4">
          <TabButton
            id="users"
            label="User Management"
            icon={Users}
            isActive={activeTab === 'users'}
            onClick={setActiveTab}
          />
          <TabButton
            id="roles"
            label="Role & Permissions"
            icon={Shield}
            isActive={activeTab === 'roles'}
            onClick={setActiveTab}
          />
        </div>

        
        }
      </div>

      {/* Tab Content */}
      {activeTab === 'users' ? (
        <UserTableClient userFlag={userFlag} setUserFlag={setUserFlag} editUserModal={editUserModal}/>
      ) : (
        <RolePermissionsDashboard/>
      )}
      
      {/* Modals */}
      {showUserModal && (
        <UserModalComponent
          setUserFlag={setUserFlag}
          roles={roles}
          onSave={handleSaveUser}
          onClose={closeModals}
          userData={userData}
          setUserData={setUserData}
          action={action as "create" | "edit"}
          editId={editId}
        />
      )}
      
      {showRoleModal && (
        <RoleModal
          role={selectedRole}
          modules={modules}
          onSave={handleSaveRole}
          onClose={closeModals}
        />
      )}
    </div>
  );
}