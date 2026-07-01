export interface PermissionAttributes {
  id: number;
  action: string;
  module_id: number;
  name: string;
  description: string | null;
  created_at?: Date;
  updated_at?: Date;
}