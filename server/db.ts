import { createRequire } from "module";
import * as schema from "@shared/schema";

const require = createRequire(import.meta.url);

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const DATABASE_URL = process.env.DATABASE_URL;

// Every GOE cloud instance runs standard Postgres on the person's own server.
// The same driver also works when Postgres is on the person's own computer.
const pg = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});
const db = drizzle(pool, { schema });

console.log("[db] driver: node-postgres");

pool.on("error", (err: any) => {
  console.error("Database connection error:", err);
});

export { pool, db };

// Add a database health check function
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch (error) {
    console.error("Database health check failed:", error);
    return false;
  }
}

// Graceful shutdown helper
export async function closeDatabaseConnection(): Promise<void> {
  try {
    await pool.end();
    console.log("Database connection pool closed");
  } catch (error) {
    console.error("Error closing database connection pool:", error);
  }
}
