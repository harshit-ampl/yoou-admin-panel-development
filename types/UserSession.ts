export interface UserSessionAttributes {
  id: number;
  user_id: number;
  token: string;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: Date;
  created_at?: Date;
}

