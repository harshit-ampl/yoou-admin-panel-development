interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'last_login' | 'reset_token' | 'reset_token_expires'> {}

// models/User.ts
import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/lib/sequelize';
import { UserAttributes } from '@/types/UserManagement';

class UserManagement extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public name!: string;
  public email!: string;
  public password_hash!: string;
  public role_id!: number | null;
  public status!: 'active' | 'inactive' | 'suspended';
  public last_login!: Date | null;
  public reset_token!: string | null;
  public reset_token_expires!: Date | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

UserManagement.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'roles',
        key: 'id',
      },
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'suspended'),
      allowNull: false,
      defaultValue: 'active',
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reset_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    reset_token_expires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'user',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export default UserManagement;