// Quick WebSocket diagnostic script
import { getDatabase } from './dist/db/index.js';

console.log('\n=== Parawork Diagnostic ===\n');

// Check database
const db = getDatabase();

// Check sessions
const sessions = db.prepare('SELECT * FROM sessions ORDER BY started_at DESC LIMIT 1').all();
console.log('Latest session:', sessions[0]);

// Check logs for that session
if (sessions[0]) {
  const logs = db.prepare('SELECT * FROM agent_logs WHERE session_id = ? ORDER BY timestamp DESC').all(sessions[0].id);
  console.log(`\nAgent logs (${logs.length} total):`);
  logs.forEach(log => {
    console.log(`  [${log.level}] ${log.message}`);
  });
}

// Check config
import { getConfig } from './dist/config/settings.js';
const config = getConfig();
console.log('\nAPI Key:', config.security.apiKey);
console.log('Server port:', config.server.port);
