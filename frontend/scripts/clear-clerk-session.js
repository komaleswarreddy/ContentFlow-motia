/**
 * Utility script to clear Clerk session cookies
 * Run this in your browser console if you're experiencing JWT kid mismatch errors
 * 
 * Usage: Copy and paste this entire script into your browser console
 */

(function clearClerkSession() {
  console.log('Clearing Clerk session cookies...');
  
  const cookiesToClear = [
    '__session',
    '__client_uat',
    '__clerk_db_jwt',
    '__clerk_db_jwt_1',
    '__clerk_db_jwt_2',
    '__clerk_db_jwt_3',
    '__clerk_db_jwt_4',
  ];

  let clearedCount = 0;
  
  // Get all cookies
  document.cookie.split(";").forEach((c) => {
    const cookieName = c.trim().split("=")[0];
    
    // Clear any cookie that starts with __ or contains clerk
    if (cookieName.startsWith('__') || cookieName.toLowerCase().includes('clerk')) {
      // Clear with current path
      document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
      // Clear with root domain
      document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=${window.location.hostname};`;
      clearedCount++;
    }
  });

  console.log(`Cleared ${clearedCount} cookies. Please refresh the page.`);
  
  // Redirect to sign-in
  window.location.href = '/sign-in?session=expired';
})();

