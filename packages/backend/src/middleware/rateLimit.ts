/**
 * Rate limiting middleware
 * Simple in-memory rate limiter
 */
import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 100; // 100 requests per minute
const CLEANUP_INTERVAL = 5 * 60 * 1000; // Clean up every 5 minutes

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Get client identifier (IP address)
 */
function getClientId(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const clientId = getClientId(req);
  const now = Date.now();

  let entry = rateLimitStore.get(clientId);

  if (!entry || entry.resetAt < now) {
    // Create new entry or reset expired one
    entry = {
      count: 1,
      resetAt: now + WINDOW_MS,
    };
    rateLimitStore.set(clientId, entry);
  } else {
    entry.count++;
  }

  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - entry.count));
  res.setHeader('X-RateLimit-Reset', entry.resetAt);

  if (entry.count > MAX_REQUESTS) {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    });
    return;
  }

  next();
}
