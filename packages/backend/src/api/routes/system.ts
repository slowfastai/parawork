/**
 * System API routes
 */
import { Router } from 'express';
import { getConfig } from '../../config/settings.js';
import type { ApiResponse } from '@parawork/shared';

const router = Router();

/**
 * GET /api/health
 * Health check
 */
router.get('/health', (req, res) => {
  const response: ApiResponse<{ status: string; timestamp: number }> = {
    success: true,
    data: {
      status: 'ok',
      timestamp: Date.now(),
    },
  };
  res.json(response);
});

/**
 * GET /api/agents
 * List available agents
 */
router.get('/agents', (req, res) => {
  try {
    const config = getConfig();
    const agents = Object.entries(config.agents)
      .filter(([_, agentConfig]) => agentConfig.enabled)
      .map(([name, agentConfig]) => ({
        name,
        command: agentConfig.command,
        defaultArgs: agentConfig.defaultArgs,
      }));

    const response: ApiResponse = {
      success: true,
      data: agents,
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching agents:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch agents',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/config
 * Get configuration (including API key for WebSocket auth)
 */
router.get('/config', (req, res) => {
  try {
    const config = getConfig();

    const safeConfig = {
      server: {
        port: config.server.port,
        cors: config.server.cors,
      },
      agents: config.agents,
      features: config.features,
      apiKey: config.security.apiKey, // Include API key for WebSocket authentication
    };

    const response: ApiResponse = {
      success: true,
      data: safeConfig,
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching config:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch config',
    };
    res.status(500).json(response);
  }
});

export default router;
