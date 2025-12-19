/**
 * Utility functions for managing Clerk cookies
 * Specifically handles clearing old/invalid session cookies
 */

export function clearAllClerkCookies() {
  if (typeof window === 'undefined') return;

  const cookiesToClear = [
    '__session',
    '__client_uat',
    '__clerk_db_jwt',
    '__clerk_db_jwt_1',
    '__clerk_db_jwt_2',
    '__clerk_db_jwt_3',
    '__clerk_db_jwt_4',
  ];

  const hostname = window.location.hostname;

  // Get all cookies
  document.cookie.split(';').forEach((c) => {
    const cookieName = c.trim().split('=')[0];
    
    // Clear any cookie that starts with __ or contains clerk
    if (
      cookieName.startsWith('__') || 
      cookieName.toLowerCase().includes('clerk') ||
      cookiesToClear.includes(cookieName)
    ) {
      // Clear with multiple path/domain variations to ensure deletion
      document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
      document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=${hostname};`;
      document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=.${hostname};`;
      // Also try with different SameSite attributes
      document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=None;Secure`;
      document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax`;
    }
  });
}

/**
 * Check if there's an old session cookie with the problematic kid
 * The old kid was: ins_36y7CB644zVsK4vS3YEwKyWoDie
 * We need to decode and check the JWT to see if it has the old kid
 */
export function hasOldSessionCookie(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const cookies = document.cookie.split(';');
    const sessionCookie = cookies.find(c => c.trim().startsWith('__session='));
    
    if (!sessionCookie) return false;

    // Extract the JWT token (format: __session=token)
    const tokenValue = sessionCookie.split('=').slice(1).join('='); // Handle tokens with = in them
    const token = tokenValue?.trim();
    if (!token) return false;

    // Decode JWT (just the header, which contains the kid)
    try {
      const parts = token.split('.');
      if (parts.length < 2) return false;

      // Decode the header with proper base64url decoding
      let base64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
      // Add padding if needed
      while (base64.length % 4) {
        base64 += '=';
      }
      
      const header = JSON.parse(atob(base64));
      
      // Check if it has the old kid
      const oldKid = 'ins_36y7CB644zVsK4vS3YEwKyWoDie';
      if (header.kid === oldKid) {
        return true;
      }
    } catch (e) {
      // If we can't decode, don't assume it's old - let Clerk handle it
      // Only clear if we're sure it has the old kid
      return false;
    }

    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Clear cookies if they contain the old kid
 */
export function clearOldSessionCookies() {
  if (hasOldSessionCookie()) {
    clearAllClerkCookies();
  }
}

