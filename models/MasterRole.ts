import { DataTypes, Model , Optional } from 'sequelize';
import sequelize from '@/lib/sequelize'; // Your Sequelize instance

interface MasterRoleAttributes {
  id: number;
  role?: string | null;
  role_code?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: Date;
  updated_at?: Date;
}
type MasterRoleCreationAttributes = Optional<MasterRoleAttributes, 'id'>;

class MasterRole extends Model<MasterRoleAttributes, MasterRoleCreationAttributes> 
  implements MasterRoleAttributes {
  public id!: number;
  public role?: string | null;
  public role_code?: string | null;
  public created_by?: string | null;
  public updated_by?: string | null;
  public created_at?: Date;
  public updated_at?: Date;
}

MasterRole.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  role: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  role_code: {
    type: DataTypes.STRING(150),
    allowNull: true,
    unique: true,
  },
  created_by: {
    type: DataTypes.STRING(150),
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
  modelName: 'MasterRole',
  tableName: 'master_roles',
  timestamps: false,
});
export default MasterRole;