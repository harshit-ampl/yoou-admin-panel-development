import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from "@/lib/sequelize";

interface MasterPrivilegeAttributes {
  id: number;
  section: string | null;
  section_code: string | null;
  screen: string | null;
  screen_code: string | null;
  module: string | null;
  module_code: string | null;
  action_code: string | null;
  action_name: string | null;
  description: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

interface MasterPrivilegeCreationAttributes extends Optional<MasterPrivilegeAttributes, 'id' | 'created_at' | 'updated_at'> {}

class MasterPrivilege extends Model<MasterPrivilegeAttributes, MasterPrivilegeCreationAttributes> implements MasterPrivilegeAttributes {
  public id!: number;
  public section!: string | null;
  public section_code!: string | null;
  public screen!: string | null;
  public screen_code!: string | null;
  public module!: string | null;
  public module_code!: string | null;
  public action_code!: string | null;
  public action_name!: string | null;
  public description!: string | null;
  public created_by!: string | null;
  public updated_by!: string | null;
  public created_at!: Date;
  public updated_at!: Date;
}

MasterPrivilege.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  section: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  section_code: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  screen: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  screen_code: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  module: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  module_code: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  action_code: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  action_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  updated_by: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  sequelize,
  tableName: 'master_privileges',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['screen_code', 'module_code', 'action_code'],
      name: 'unique_ind',
    },
  ],
});

export default MasterPrivilege;