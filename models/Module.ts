/* models/Module.ts ---------------------------------------------------- */
import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '@/lib/sequelize';

export interface ModuleAttributes {
  id: number;
  module: string;
  module_code: string;
}
export interface ModuleCreation
  extends Optional<ModuleAttributes, 'id'> {}

class Module extends Model<ModuleAttributes, ModuleCreation>
  implements ModuleAttributes {
  public id!: number;
  public module!: string;
  public module_code!: string;
}

Module.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    module: { type: DataTypes.STRING(150), allowNull: false },
    module_code: { type: DataTypes.STRING(150), allowNull: false, unique: true },
  },
  { sequelize, tableName: 'master_modules', timestamps: false }
);

export default Module;
