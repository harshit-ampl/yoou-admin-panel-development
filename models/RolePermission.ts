/* models/RolePermission.ts ------------------------------------------- */
import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '@/lib/sequelize';

import Module from './Module';
import  MasterRole  from './MasterRole';


export interface RPAttributes {
  id: number;
  role_id: number;
  module_id: number;
  action: 'Add' | 'Edit' | 'View' | 'Delete';
  granted: boolean;
}
export interface RPCreation extends Optional<RPAttributes, 'id'> {}

class RolePermission
  extends Model<RPAttributes, RPCreation>
  implements RPAttributes {
  public id!: number;
  public role_id!: number;
  public module_id!: number;
  public action!: RPAttributes['action'];
  public granted!: boolean;
}
RolePermission.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    role_id: { type: DataTypes.INTEGER, allowNull: false },
    module_id: { type: DataTypes.INTEGER, allowNull: false },
    action: {
      type: DataTypes.ENUM('Add', 'Edit', 'View', 'Delete'),
      allowNull: false,
    },
    granted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    tableName: 'role_permissions',
    timestamps: false,
    indexes: [{ unique: true, fields: ['role_id', 'module_id', 'action'] }],
  }
);

RolePermission.belongsTo(MasterRole, { foreignKey: 'role_id' });
// RolePermission.belongsTo(Module, { foreignKey: 'module_id' });
RolePermission.belongsTo(Module, {
  foreignKey: 'module_id',
  as: 'module',                 // 👈 alias
});

export default RolePermission;
