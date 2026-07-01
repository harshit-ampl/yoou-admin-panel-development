import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "@/lib/sequelize";
import { MakingChargeAttributes } from "@/types/PricingCodes";

interface MakingChargeCreationAttributes
  extends Optional<MakingChargeAttributes, "id"> {}

class MakingCharge
  extends Model<MakingChargeAttributes, MakingChargeCreationAttributes>
  implements MakingChargeAttributes
{
  public id!: number;
  public name!: string;
  public wastage_rate_or_labour_charge!: number;
  public calculate_wastage_amount_on!: "Per Pc" | "Per Gram" | "% Of NetWt";
  public status!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

MakingCharge.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    wastage_rate_or_labour_charge: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    calculate_wastage_amount_on: {
      type: DataTypes.ENUM("Per Pc", "Per Gram", "% Of NetWt"),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Active",
    },
  },
  {
    sequelize,
    tableName: "making_charge",
    timestamps: true,
  }
);

export default MakingCharge;
