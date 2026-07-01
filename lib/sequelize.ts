import { Sequelize } from 'sequelize';
import pg from 'pg';

const sequelize = new Sequelize(process.env.DATABASE_URL as string, {
  dialect: 'postgres',
  logging: false, // Disable logging in production
  dialectModule: pg,
  timezone: '+05:30', // Set to IST (UTC+5:30)
});

export default sequelize;
