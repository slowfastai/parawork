/**
 * Configuration management for Parawork backend
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import type { Config } from '@parawork/shared';

const DEFAULT_CONFIG: Config = {
  server: {
    port: 3000,
    host: '0.0.0.0',
    cors: {
      enabled: true,
      origins: ['http://localhost:5173', 'http://localhost:3000'],
    },
  },
  database: {
    path: './data/parawork.db',
  },
  agents: {
    'claude-code': {
      enabled: true,
      command: 'claude',
      defaultArgs: ['code'],
    },
    'codex': {
      enabled: true,
      command: 'codex',
      defaultArgs: [],
    },
  },
  tunnel: {
    enabled: false,
    provider: 'cloudflare',
    domain: '',
  },
  security: {
    apiKey: randomBytes(32).toString('hex'),
  },
  features: {
    gitIntegration: true,
    autoCleanup: true,
  },
};

let config: Config | null = null;

/**
 * Load configuration from file or create default
 */
export function loadConfig(configPath?: string): Config {
  const path = configPath || join(process.cwd(), 'config.json');

  if (existsSync(path)) {
    try {
      const fileContent = readFileSync(path, 'utf-8');
      config = JSON.parse(fileContent) as Config;
      console.log(`Configuration loaded from ${path}`);
    } catch (error) {
      console.error(`Error reading config file: ${error}`);
      console.log('Using default configuration');
      config = DEFAULT_CONFIG;
    }
  } else {
    console.log('No config file found, creating default configuration');
    config = DEFAULT_CONFIG;
    saveConfig(path);
  }

  return config;
}

/**
 * Save configuration to file
 */
export function saveConfig(configPath?: string): void {
  const path = configPath || join(process.cwd(), 'config.json');

  if (!config) {
    throw new Error('No configuration to save');
  }

  try {
    writeFileSync(path, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`Configuration saved to ${path}`);
  } catch (error) {
    console.error(`Error saving config file: ${error}`);
  }
}

/**
 * Get current configuration
 */
export function getConfig(): Config {
  if (!config) {
    return loadConfig();
  }
  return config;
}

/**
 * Update configuration
 */
export function updateConfig(updates: Partial<Config>): Config {
  if (!config) {
    loadConfig();
  }

  config = { ...config!, ...updates };
  return config;
}
