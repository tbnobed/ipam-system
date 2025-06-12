import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';
import { Pool as PgPool } from 'pg';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const databaseUrl = process.env.DATABASE_URL;

// Check if we're using Neon (contains neon.tech) or local PostgreSQL
const isNeonDatabase = databaseUrl.includes('neon.tech');

let pool: NeonPool | PgPool;
let db: ReturnType<typeof neonDrizzle> | ReturnType<typeof pgDrizzle>;

if (isNeonDatabase) {
  // Use Neon serverless for cloud deployment
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({ connectionString: databaseUrl });
  db = neonDrizzle({ client: pool as NeonPool, schema });
} else {
  // Use regular PostgreSQL for Docker/local deployment
  pool = new PgPool({ connectionString: databaseUrl });
  db = pgDrizzle({ client: pool as PgPool, schema });
}

export { pool, db };