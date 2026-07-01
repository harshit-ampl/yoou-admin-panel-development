import { DataTypes, Model, Optional } from 'sequelize';
interface ScreenCreationAttributes extends Optional<ScreenAttributes, 'id'> {}

export const initScreenModel = (sequelize: any) => {
  class Screen extends Model<ScreenAttributes, ScreenCreationAttributes> implements ScreenAttributes {
    public id!: string;
    public name!: string;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
  }

  Screen.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    }
  }, {
    sequelize,
    modelName: 'Screen',
    tableName: 'screens',
    timestamps: true
  });

  return Screen;
};

export type ScreenModel = ReturnType<typeof initScreenModel>;