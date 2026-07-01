export interface UserAttributes {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role_id: number | null;
  status: 'active' | 'inactive' | 'suspended';
  last_login: Date | null;
  reset_token: string | null;
  reset_token_expires: Date | null;
  created_at?: Date;
  updated_at?: Date;
}