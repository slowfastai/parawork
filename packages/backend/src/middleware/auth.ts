/**
 * Authentication middleware for API key validation
 */
import { Request, Response, NextFunction } from 'express';
import { getConfig } from '../config/settings.js';

/**
 * API Key authentication middleware
 * Validates the X-API-Key header or api_key query parameter
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const config = getConfig();

  // Skip auth for health check endpoint
  if (req.path === '/api/health') {
    return next();
  }

  // Get API key from header or query
  const apiKey = req.headers['x-api-key'] as string | undefined
    || req.query.api_key as string | undefined;

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'Missing API key. Provide X-API-Key header or api_key query parameter.',
    });
    return;
  }

  if (apiKey !== config.security.apiKey) {
    res.status(403).json({
      success: false,
      error: 'Invalid API key',
    });
    return;
  }

  next();
}

/**
 * Validate WebSocket connection with API key
 * Returns true if valid, false otherwise
 */
export function validateWebSocketAuth(url: string | undefined): boolean {
  if (!url) return false;

  const config = getConfig();

  try {
    // Parse query string from URL
    const urlObj = new URL(url, 'http://localhost');
    const apiKey = urlObj.searchParams.get('api_key');

    return apiKey === config.security.apiKey;
  } catch {
    return false;
  }
}
