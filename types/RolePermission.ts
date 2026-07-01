export interface RolePermissionAttributes {
  role_id: number;
  permission_id: number;
  granted: boolean;
  created_at?: Date;
  updatedAt?: Date;
}