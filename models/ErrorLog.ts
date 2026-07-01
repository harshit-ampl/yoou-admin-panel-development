// models/ErrorLog.ts
import { DataTypes, Model } from 'sequelize';
import sequelize from '@/lib/sequelize';
import { ErrorLogAttributes, ErrorLogCreationAttributes } from '@/types/ErrorLog';

class ErrorLog extends Model<ErrorLogAttributes, ErrorLogCreationAttributes> implements ErrorLogAttributes {
  public id!: number;
  public sku!: string;
  public log_message!: string | null;
  public readonly created_at!: Date;
}

ErrorLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    sku: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    log_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'error_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
  }
);

export default ErrorLog;