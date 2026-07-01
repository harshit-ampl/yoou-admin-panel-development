// types/ErrorLog.ts
export interface ErrorLogAttributes {
  id: number;
  sku: string;
  log_message: string | null;
  created_at?: Date;  // make optional
}

import { Optional } from 'sequelize';
export interface ErrorLogCreationAttributes extends Optional<ErrorLogAttributes, 'id' | 'created_at'> {}