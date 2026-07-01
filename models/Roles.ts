interface RoleCreationAttributes extends Optional<RoleAttributes, 'id' | 'code'> {}

// models/Role.ts
import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '@/lib/sequelize';
import { RoleAttributes } from '@/types/Roles';


class Role extends Model<RoleAttributes, RoleCreationAttributes> implements RoleAttributes {
  public id!: number;
  public name!: string;
  public code!: string | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Role.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    code: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('0', '1'),
    defaultValue: '1'
  },
  created_by: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  updated_by: {
    type: DataTypes.STRING(50),
    allowNull: true
  }
  },
  {
    sequelize,
    tableName: 'roles',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export default Role;