// models/UserLog.ts
import {
	DataTypes,
	Model,
	Optional,
	CreationOptional,   // helper types (Sequelize ≥ 6.32)
  } from 'sequelize';
  import sequelize from '@/lib/sequelize';
  
  /* ---------- 1. Table-shape interface ---------- */
  export interface UserLogAttributes {
	id:          number;
	user_id:     number;
	module:      string | null;
	action:      string | null;
	old_data:    object | null;   // JSONB → plain JS object
	new_data:    object | null;
	created_at:  Date;
	updated_at:  Date;
	updated_by:  string | null;
	created_by:  string | null;
  }
  
  /* ---------- 2. Attributes allowed on INSERT ---------- */
  export interface UserLogCreationAttributes
	extends Optional<
	  UserLogAttributes,
	  | 'id'
	  | 'old_data'
	  | 'new_data'
	  | 'updated_by'
	  | 'created_by'
	  | 'created_at'
	  | 'updated_at'
	> {}
  
  /* ---------- 3. Sequelize model class ---------- */
  class UserLog
	extends Model<UserLogAttributes, UserLogCreationAttributes>
	implements UserLogAttributes
  {
	// ——— recommended style (no TS strict-property-init warnings) ———
	declare id:          CreationOptional<number>;
	declare user_id:     number;
	declare module:      string | null;
	declare action:      string | null;
	declare old_data:    object | null;
	declare new_data:    object | null;
	declare readonly created_at: Date;
	declare readonly updated_at: Date;
	declare updated_by:  string | null;
	declare created_by:  string | null;
  }
  
  /* ---------- 4. Column definitions & options ---------- */
  UserLog.init(
	{
	  id: {
		type: DataTypes.INTEGER,
		autoIncrement: true,
		primaryKey: true,
	  },
	  user_id: {
		type: DataTypes.INTEGER,
		allowNull: false,
	  },
	  module: {
		type: DataTypes.STRING(30),
		allowNull: true,
	  },
	  action: {
		type: DataTypes.STRING(20),
		allowNull: true,
	  },
	  old_data: {
		type: DataTypes.JSONB,
		allowNull: true,
	  },
	  new_data: {
		type: DataTypes.JSONB,
		allowNull: true,
	  },
	  updated_by: {
		type: DataTypes.STRING(100),
		allowNull: true,
	  },
	  created_by: {
		type: DataTypes.STRING(100),
		allowNull: true,
	  },
	  created_at: {
		type: DataTypes.DATE,
		allowNull: false,
		defaultValue: DataTypes.NOW,  // matches DEFAULT CURRENT_TIMESTAMP
	  },
	  updated_at: {
		type: DataTypes.DATE,
		allowNull: false,
		defaultValue: DataTypes.NOW,
	  },
	},
	{
	  sequelize,
	  tableName: 'user_logs',
	  timestamps: true,          // adds createdAt / updatedAt
	  createdAt: 'created_at',   // map to your snake-case columns
	  updatedAt: 'updated_at',
	  underscored: true,         // keeps any future FK columns snake-cased
	}
  );
  
  export default UserLog;