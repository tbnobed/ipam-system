import { db } from "./db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

interface Migration {
  version: string;
  name: string;
  sql: string;
}

class MigrationManager {
  private migrationsDir = path.join(process.cwd(), "migrations");

  async initializeMigrationTable() {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          version VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          applied_at TIMESTAMP DEFAULT NOW()
        )
      `);
    } catch (error) {
      console.error("Error creating migrations table:", error);
    }
  }

  async getAppliedMigrations(): Promise<string[]> {
    try {
      const result = await db.execute(sql`SELECT version FROM migrations ORDER BY version`);
      return result.rows.map((row: any) => row.version);
    } catch (error) {
      console.warn("Could not fetch applied migrations:", error);
      return [];
    }
  }

  async getMigrationFiles(): Promise<Migration[]> {
    try {
      if (!fs.existsSync(this.migrationsDir)) {
        return [];
      }

      const files = fs.readdirSync(this.migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();

      return files.map(file => {
        const version = file.replace('.sql', '');
        const filePath = path.join(this.migrationsDir, file);
        const sqlContent = fs.readFileSync(filePath, 'utf8');
        
        return {
          version,
          name: file,
          sql: sqlContent
        };
      });
    } catch (error) {
      console.error("Error reading migration files:", error);
      return [];
    }
  }

  async runMigration(migration: Migration): Promise<void> {
    try {
      console.log(`Applying migration: ${migration.name}`);
      await db.execute(sql.raw(migration.sql));
      
      // Record the migration as applied
      await db.execute(sql`
        INSERT INTO migrations (version, name) 
        VALUES (${migration.version}, ${migration.name})
      `);
      
      console.log(`✓ Migration ${migration.name} applied successfully`);
    } catch (error) {
      console.error(`✗ Migration ${migration.name} failed:`, error);
      throw error;
    }
  }

  async runPendingMigrations(): Promise<void> {
    await this.initializeMigrationTable();
    
    const appliedMigrations = await this.getAppliedMigrations();
    const allMigrations = await this.getMigrationFiles();
    
    const pendingMigrations = allMigrations.filter(
      migration => !appliedMigrations.includes(migration.version)
    );

    if (pendingMigrations.length === 0) {
      console.log("No pending migrations to apply");
      return;
    }

    console.log(`Found ${pendingMigrations.length} pending migrations`);
    
    for (const migration of pendingMigrations) {
      await this.runMigration(migration);
    }
  }

  async runSpecificMigration(version: string): Promise<void> {
    await this.initializeMigrationTable();
    
    const migrations = await this.getMigrationFiles();
    const migration = migrations.find(m => m.version === version);
    
    if (!migration) {
      throw new Error(`Migration ${version} not found`);
    }

    const appliedMigrations = await this.getAppliedMigrations();
    if (appliedMigrations.includes(version)) {
      console.log(`Migration ${version} already applied`);
      return;
    }

    await this.runMigration(migration);
  }
}

export const migrationManager = new MigrationManager();