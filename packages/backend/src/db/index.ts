/**
 * Database connection and initialization
 */
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db: Database.Database | null = null;

/**
 * Initialize database connection and create tables
 */
export function initDatabase(dbPath: string): Database.Database {
  if (db) {
    return db;
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL'); // Better concurrency
  db.pragma('foreign_keys = ON'); // Enforce foreign key constraints

  // Read and execute schema
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  console.log(`Database initialized at ${dbPath}`);
  return db;
}

/**
 * Get database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
