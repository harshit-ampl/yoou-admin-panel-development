import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "@/lib/sequelize";
import { MetalPriceAttributes } from "@/types/MetalPrices";

interface MetalRateCreationAttributes extends Optional<MetalPriceAttributes, "id"> {}

class MetalPrice extends Model<MetalPriceAttributes, MetalRateCreationAttributes> implements MetalPriceAttributes {
  public id!: number;
  public open_date!: Date;
  public datetime!: Date;
  public metal_type!: string;
  public sale_rate!: number;
  public purity!: number;
  public exchange_rate!: number;
  public purity_description!: string;
  public purity_percentage!: number;
  public urd_rate!: number;
  public ecommerce_description?: string;
}

MetalPrice.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    open_date: { type: DataTypes.DATEONLY, allowNull: false },
    datetime: { type: DataTypes.DATE, allowNull: false },
    metal_type: { type: DataTypes.STRING, allowNull: false },
    sale_rate: { type: DataTypes.FLOAT, allowNull: false },
    purity: { type: DataTypes.FLOAT, allowNull: false },
    exchange_rate: { type: DataTypes.FLOAT, allowNull: false },
    purity_description: { type: DataTypes.STRING, allowNull: false },
    purity_percentage: { type: DataTypes.FLOAT, allowNull: false },
    urd_rate: { type: DataTypes.FLOAT, allowNull: false },
    ecommerce_description: { type: DataTypes.STRING, allowNull: true },
  },
  { sequelize, tableName: "metal_rates", timestamps: true }
);

export default MetalPrice;
