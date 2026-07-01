export interface RoleAttributes {
  id: number;
  name: string;
  code: string | null;
  description?: string;
  status?: '0' | '1';
  created_by?: string;
  updated_by?: string;
}