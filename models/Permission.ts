import { DataTypes, Model } from 'sequelize';
import sequelize from '@/lib/sequelize'; // your configured sequelize instance

export class PrivilegeMapping extends Model {}

PrivilegeMapping.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  role_code: {
    type: DataTypes.STRING(100),
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
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  action_name: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  status: {
    type: DataTypes.ENUM('0', '1'),
    defaultValue: '1',
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
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  sequelize,
  modelName: 'PrivilegeMapping',
  tableName: 'privilege_mapping',
  timestamps: false,
});
