/**
 * Parawork Backend Entry Point
 */
import { config as loadEnv } from 'dotenv';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';
import { loadConfig } from './config/settings.js';
import { initDatabase } from './db/index.js';
import { startServer } from './server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
loadEnv();

// Load configuration
const config = loadConfig();

// Ensure data directory exists
const dataDir = resolve(dirname(config.database.path));
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
  console.log(`Created data directory: ${dataDir}`);
}

// Initialize database
const dbPath = resolve(config.database.path);
initDatabase(dbPath);

// Start server
startServer();
