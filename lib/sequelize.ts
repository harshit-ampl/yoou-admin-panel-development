import { Sequelize } from 'sequelize';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL is not set; database queries will fail until it is configured.');
}

const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgres://invalid', {
  dialect: 'postgres',
  logging: false, // Disable logging in production
  dialectModule: pg,
  timezone: '+05:30', // Set to IST (UTC+5:30)
});

export default sequelize;
