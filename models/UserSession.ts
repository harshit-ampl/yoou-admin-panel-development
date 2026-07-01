interface UserSessionCreationAttributes extends Optional<UserSessionAttributes, 'id' | 'ip_address' | 'user_agent'> {}

// models/UserSession.ts
import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/lib/sequelize';
import { UserSessionAttributes } from '@/types/UserSession';

class UserSession extends Model<UserSessionAttributes, UserSessionCreationAttributes> implements UserSessionAttributes {
  public id!: number;
  public user_id!: number;
  public token!: string;
  public ip_address!: string | null;
  public user_agent!: string | null;
  public expires_at!: Date;
  public readonly created_at!: Date;
}

UserSession.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    token: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'user_sessions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
  }
);

export default UserSession;