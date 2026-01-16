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
 * Run database migrations for existing databases
 * Must run BEFORE schema execution to add columns needed by schema indexes
 */
function runMigrations(database: Database.Database): void {
  // First, check if workspaces table exists at all
  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workspaces'").all() as Array<{ name: string }>;

  if (tables.length === 0) {
    // Table doesn't exist yet, schema will create it with all columns
    return;
  }

  // Create repositories table first if it doesn't exist (needed for foreign key)
  const repoTables = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='repositories'").all() as Array<{ name: string }>;
  if (repoTables.length === 0) {
    console.log('Creating repositories table for migration...');
    database.exec(`
      CREATE TABLE repositories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        default_branch TEXT NOT NULL DEFAULT 'main',
        remote_url TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    database.exec('CREATE INDEX IF NOT EXISTS idx_repositories_path ON repositories(path)');
  }

  // Check if repository_id column exists in workspaces table
  const columns = database.prepare("PRAGMA table_info(workspaces)").all() as Array<{ name: string }>;
  const hasRepositoryId = columns.some(col => col.name === 'repository_id');

  if (!hasRepositoryId) {
    console.log('Running migration: Adding repository_id column to workspaces table...');
    database.exec('ALTER TABLE workspaces ADD COLUMN repository_id TEXT REFERENCES repositories(id) ON DELETE SET NULL');
    console.log('Migration completed: repository_id column added');
  }
}

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

  // Run migrations for existing databases BEFORE schema (to add new columns)
  runMigrations(db);

  // Read and execute schema (uses IF NOT EXISTS for safety)
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
