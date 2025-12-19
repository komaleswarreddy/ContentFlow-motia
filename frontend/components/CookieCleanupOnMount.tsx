'use client';

/**
 * Component removed - was checking for old cookies proactively which interfered with valid sessions
 * We now only clear cookies when actual errors are detected via error handlers
 * This prevents the "session expired" message appearing after successful login
 */
export function CookieCleanupOnMount() {
  // Component disabled - only error handlers clear cookies now
  return null;
}

