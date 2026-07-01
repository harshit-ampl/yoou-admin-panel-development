import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "@/lib/sequelize";
import { StonePriceAttributes } from "@/types/StonePrices";

interface StonePriceCreationAttributes extends Optional<StonePriceAttributes, "id"> {}

class StonePrice extends Model<StonePriceAttributes, StonePriceCreationAttributes> implements StonePriceAttributes {
  public id!: number;
  public sr_no!: number;
  public item_name!: string;
  public d_color_code!: string;
  public size_id!: string;
  public new_selling_rates!: number;
}

StonePrice.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    sr_no: { type: DataTypes.INTEGER, allowNull: false },
    item_name: { type: DataTypes.STRING, allowNull: false },
    d_color_code: { type: DataTypes.STRING, allowNull: false },
    size_id: { type: DataTypes.STRING, allowNull: false },
    new_selling_rates: { type: DataTypes.FLOAT, allowNull: false },
  },
  {
    sequelize,
    tableName: "stone_rates",
    timestamps: true, // enables createdAt & updatedAt
    indexes: [
      {
        unique: true,
        fields: ["item_name", "d_color_code", "size_id"], // for upsert/ON CONFLICT
      },
    ],
  }
);

export default StonePrice;
