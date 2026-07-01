export interface UserLogAttributes {
  id: number;
  user_id: number;
  module: string | null;
  action: string | null;
  old_data: object | null;
  new_data: object | null;
  readonly created_at: Date;
  readonly updated_at: Date;
  updated_by: string | null;
  created_by: string | null;
}