// models/Otp.ts
import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import sequelize from '@/lib/sequelize';

interface OtpAttributes {
  id: number;
  phone: string;
  otp_code: string;
  expires_at: string;
  created_at: string;
}

interface OtpCreationAttributes extends Optional<OtpAttributes, 'id'> {}

class Otp extends Model<OtpAttributes, OtpCreationAttributes> implements OtpAttributes {
  public id!: number;
  public phone!: string;
  public otp_code!: string;
  public expires_at!: string;
  public created_at!: string;
}

Otp.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    otp_code: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
  },
  {
    sequelize,
    modelName: 'Otp',
    tableName: 'otp',
    timestamps: false, // Disable automatic timestamps
    underscored: true,
  }
);

export default Otp;