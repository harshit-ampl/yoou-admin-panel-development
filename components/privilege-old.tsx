"use client";
import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Users, Settings, Plus, Save, X } from 'lucide-react';

// Type definitions
interface Permission {
  action: string;
  description: string;
  granted: boolean;
}

interface Module {
  name: string;
  permissions: Permission[];
  expanded: boolean;
}

interface Screen {
  name: string;
  modules: Module[];
  expanded: boolean;
}

interface Role {
  id: string;
  name: string;
  code: string;
}

interface RolePermissions {
  [roleId: string]: {
    [screenName: string]: {
      [moduleName: string]: {
        [action: string]: boolean;
      };
    };
  };
}

// Toggle Switch Component
interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange }) => {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        checked 
          ? 'bg-blue-600 hover:bg-blue-700' 
          : 'bg-gray-200 hover:bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
};

const ScreenBasedRoleMappings: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>({});
  const [isCreateRoleModalOpen, setIsCreateRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleCode, setNewRoleCode] = useState('');

  // Mock data initialization
  useEffect(() => {
    setRoles([
      { id: '1', name: 'Inventory Admin', code: 'inventory_admin' },
      { id: '2', name: 'Finance Manager', code: 'finance_manager' },
      { id: '3', name: 'HR Manager', code: 'hr_manager' },
      { id: '4', name: 'Sales Manager', code: 'sales_manager' }
    ]);

    setScreens([
      {
        name: 'Screens for Finance',
        expanded: true,
        modules: [
          {
            name: 'Invoice',
            expanded: true,
            permissions: [
              { action: 'Invoice Credit Note', description: 'Can manage invoice credit notes', granted: true },
              { action: 'Invoice Details', description: 'Can view and manage invoice details', granted: true }
            ]
          },
          {
            name: 'Report',
            expanded: false,
            permissions: [
              { action: 'Generate', description: 'Can generate financial reports', granted: false },
              { action: 'Export', description: 'Can export reports', granted: false }
            ]
          },
          {
            name: 'Masters',
            expanded: false,
            permissions: [
              { action: 'View', description: 'Can view master data', granted: false },
              { action: 'Edit', description: 'Can edit master data', granted: false }
            ]
          }
        ]
      },
      {
        name: 'Client Management',
        expanded: true,
        modules: [
          {
            name: 'Client',
            expanded: true,
            permissions: [
              { action: 'Add', description: 'Can Add the Client Details', granted: true },
              { action: 'Edit', description: 'Can Edit the Client Details', granted: true },
              { action: 'View', description: 'Can View the Client Details', granted: true }
            ]
          },
          {
            name: 'Finance Settings',
            expanded: true,
            permissions: [
              { action: 'Edit', description: 'Can Edit the Finance Settings Details', granted: false },
              { action: 'View', description: 'Can View the Finance Settings Details', granted: false }
            ]
          }
        ]
      },
      {
        name: 'Operations',
        expanded: true,
        modules: [
          {
            name: 'NDA',
            expanded: true,
            permissions: [
              { action: 'Add', description: 'Can Add the NDA Details', granted: true },
              { action: 'Delete', description: 'Can Delete the NDA Details', granted: true },
              { action: 'Edit', description: 'Can Edit the NDA Details', granted: true },
              { action: 'View', description: 'Can View the NDA Details', granted: true }
            ]
          },
          {
            name: 'Purchase Order',
            expanded: true,
            permissions: [
              { action: 'Add', description: 'Can Add the Purchase Order Details', granted: true },
              { action: 'Delete', description: 'Can Delete the Purchase Order Details', granted: true },
              { action: 'Edit', description: 'Can Edit the Purchase Order Details', granted: true },
              { action: 'View', description: 'Can View the Purchase Order Details', granted: true }
            ]
          },
          {
            name: 'Quotation',
            expanded: true,
            permissions: [
              { action: 'Add', description: 'Can Add the Quotation Details', granted: true },
              { action: 'Delete', description: 'Can Delete the Quotation Details', granted: true },
              { action: 'Edit', description: 'Can Edit the Quotation Details', granted: true },
              { action: 'Move', description: 'Can Move the Quotation Detail to SOW', granted: true },
              { action: 'View', description: 'Can View the Quotation Details', granted: true }
            ]
          }
        ]
      }
    ]);

    // Initialize role permissions
    const initialPermissions: RolePermissions = {};
    // Set default permissions for Inventory Admin role
    initialPermissions['1'] = {
      'Screens for Finance': {
        'Invoice': {
          'Invoice Credit Note': true,
          'Invoice Details': true
        }
      },
      'Client Management': {
        'Client': {
          'Add': true,
          'Edit': true,
          'View': true
        }
      },
      'Operations': {
        'NDA': {
          'Add': true,
          'Delete': true,
          'Edit': true,
          'View': true
        },
        'Purchase Order': {
          'Add': true,
          'Delete': true,
          'Edit': true,
          'View': true
        },
        'Quotation': {
          'Add': true,
          'Delete': true,
          'Edit': true,
          'Move': true,
          'View': true
        }
      }
    };
    setRolePermissions(initialPermissions);
    setSelectedRole('1');
  }, []);

  const toggleScreenExpansion = (screenIndex: number) => {
    setScreens(prev => prev.map((screen, index) => 
      index === screenIndex ? { ...screen, expanded: !screen.expanded } : screen
    ));
  };

  const toggleModuleExpansion = (screenIndex: number, moduleIndex: number) => {
    setScreens(prev => prev.map((screen, sIndex) => 
      sIndex === screenIndex 
        ? {
            ...screen,
            modules: screen.modules.map((module, mIndex) => 
              mIndex === moduleIndex ? { ...module, expanded: !module.expanded } : module
            )
          }
        : screen
    ));
  };

  const togglePermission = (screenName: string, moduleName: string, action: string) => {
    if (!selectedRole) return;

    setRolePermissions(prev => ({
      ...prev,
      [selectedRole]: {
        ...prev[selectedRole],
        [screenName]: {
          ...prev[selectedRole]?.[screenName],
          [moduleName]: {
            ...prev[selectedRole]?.[screenName]?.[moduleName],
            [action]: !prev[selectedRole]?.[screenName]?.[moduleName]?.[action]
          }
        }
      }
    }));
  };

  const isPermissionGranted = (screenName: string, moduleName: string, action: string): boolean => {
    return rolePermissions[selectedRole]?.[screenName]?.[moduleName]?.[action] || false;
  };

  const handleCreateRole = () => {
    if (newRoleName && newRoleCode) {
      const newRole: Role = {
        id: Date.now().toString(),
        name: newRoleName,
        code: newRoleCode
      };
      setRoles(prev => [...prev, newRole]);
      setNewRoleName('');
      setNewRoleCode('');
      setIsCreateRoleModalOpen(false);
    }
  };

  const savePermissions = () => {
    // Here you would typically send the permissions to your backend
    console.log('Saving permissions:', rolePermissions[selectedRole]);
    alert('Permissions saved successfully!');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border">
          {/* Header */}
          <div className="border-b border-gray-200 p-6">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              Role Permission Management
            </h1>
            <p className="text-gray-600 mt-1">Configure permissions for different roles</p>
          </div>

          {/* Role Selection */}
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Choose Role
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a role</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setIsCreateRoleModalOpen(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                Create Role
              </button>
            </div>
          </div>

          {/* Permissions Table */}
          {selectedRole && (
            <div className="p-6">
              <div className="bg-white border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-4 font-medium text-gray-900 w-1/4">Module</th>
                      <th className="text-left p-4 font-medium text-gray-900 w-1/4">Actions</th>
                      <th className="text-left p-4 font-medium text-gray-900 w-1/3">Descriptions</th>
                      <th className="text-left p-4 font-medium text-gray-900 w-1/6">Permissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {screens.map((screen, screenIndex) => (
                      <React.Fragment key={screenIndex}>
                        {/* Screen Header */}
                        <tr className="bg-slate-700 text-white">
                          <td 
                            className="p-4 font-semibold cursor-pointer hover:bg-slate-600"
                            colSpan={4}
                            onClick={() => toggleScreenExpansion(screenIndex)}
                          >
                            <div className="flex items-center gap-2">
                              {screen.expanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                              {screen.name}
                            </div>
                          </td>
                        </tr>

                        {/* Screen Modules */}
                        {screen.expanded && screen.modules.map((module, moduleIndex) => (
                          <React.Fragment key={moduleIndex}>
                            {/* Module Header */}
                            <tr className="bg-gray-100 border-t">
                              <td 
                                className="p-4 font-medium cursor-pointer hover:bg-gray-200"
                                colSpan={4}
                                onClick={() => toggleModuleExpansion(screenIndex, moduleIndex)}
                              >
                                <div className="flex items-center gap-2 pl-4">
                                  {module.expanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                  {module.name}
                                </div>
                              </td>
                            </tr>

                            {/* Module Permissions */}
                            {module.expanded && module.permissions.map((permission, permIndex) => (
                              <tr key={permIndex} className="border-t hover:bg-gray-50">
                                <td className="p-4 pl-12 text-gray-600">{module.name}</td>
                                <td className="p-4">
                                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                                    {permission.action}
                                  </span>
                                </td>
                                <td className="p-4 text-gray-600">{permission.description}</td>
                                <td className="p-4">
                                  <ToggleSwitch
                                    checked={isPermissionGranted(screen.name, module.name, permission.action)}
                                    onChange={() => togglePermission(screen.name, module.name, permission.action)}
                                  />
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Save Button */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={savePermissions}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Permissions
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Role Modal */}
      {isCreateRoleModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Create New Role</h3>
              <button 
                onClick={() => setIsCreateRoleModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role Name
                </label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter role name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role Code
                </label>
                <input
                  type="text"
                  value={newRoleCode}
                  onChange={(e) => setNewRoleCode(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter role code"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsCreateRoleModalOpen(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRole}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScreenBasedRoleMappings;