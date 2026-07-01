// models/FileUpload.ts
import {
  DataTypes,
  Model,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
} from "sequelize";
import sequelize from "@/lib/sequelize";

/* ---------- 1. Table-shape interface ---------- */
export interface FileUploadAttributes {
  id: number;
  filename: string;
  uploaded_by: string | null;
  uploaded_at: string | null;
  job_status?: string | null;
}

/* ---------- 2. Sequelize Model Class ---------- */
class FileUpload
  extends Model<
    InferAttributes<FileUpload>,
    InferCreationAttributes<FileUpload>
  >
  implements FileUploadAttributes
{
  declare id: CreationOptional<number>;
  declare filename: string;
  declare uploaded_by: string | null;
  declare uploaded_at: CreationOptional<string | null>;
  declare job_status: string | null;
}

/* ---------- 3. Model Initialization ---------- */
FileUpload.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    filename: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    uploaded_by: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    uploaded_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
    job_status: {
      type: DataTypes.STRING,
      allowNull: true
    },
  },
  {
    sequelize,
    tableName: "file_upload",
    timestamps: false, // You can change to true if you want Sequelize to handle createdAt/updatedAt
    underscored: true,
  }
);

export default FileUpload;
