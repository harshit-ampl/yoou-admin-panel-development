export interface MasterRoleAttributes {
  id:          number;
  role:        string | null;
  role_code:   string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: Date;
  updated_at?: Date;
}