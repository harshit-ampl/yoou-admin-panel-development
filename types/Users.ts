export interface UserAttributes {
  id: number;
  username: string;
  email:string;
  password_hash: string;
  role_code: string;
  createdAt?: Date;
  updatedAt?: Date;
}
export interface User {
  id: string;  // Note: string here to match your component expectations
  name: string;
  username?: string;
  email: string;
  roleId?: string;
  role_code?: string;
  status?: string;
  lastLogin?: string;
  createdAt?: string;
  password?: string;
}