'use client';

/**
 * Component that cleans up old cookies after successful authentication
 * REMOVED: This was causing issues by clearing valid session cookies
 * We now only clear cookies when errors are detected, not proactively
 */
export function PostAuthCleanup() {
  // Component removed - was interfering with valid sessions
  // Cookies are only cleared when errors are detected
  return null;
}

