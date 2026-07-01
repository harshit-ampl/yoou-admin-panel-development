import { Pool } from 'pg';

// Create a singleton pool instance
let pool: Pool | null = null;

export function getPool(): Pool {
   if (!pool) {
      pool = new Pool({
         connectionString: process.env.DATABASE_URL,
         max: 20,
         idleTimeoutMillis: 30000,
         connectionTimeoutMillis: 2000,
      });
   }
   return pool;
}

export default getPool;
