'use client';

import { useEffect } from 'react';

/**
 * Global error boundary for Next.js app router
 * Catches all unhandled errors including Clerk JWT errors
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const errorMessage = error.message || error.toString() || '';
    
    // Check if it's a Clerk JWT kid mismatch error
    if (
      errorMessage.includes('Handshake token verification failed') ||
      errorMessage.includes('Unable to find a signing key in JWKS') ||
      errorMessage.includes('jwk-kid-mismatch') ||
      errorMessage.includes('kid') ||
      errorMessage.includes('JWKS')
    ) {
      // Clear all Clerk cookies
      const cookiesToClear = [
        '__session',
        '__client_uat',
        '__clerk_db_jwt',
        '__clerk_db_jwt_1',
        '__clerk_db_jwt_2',
        '__clerk_db_jwt_3',
        '__clerk_db_jwt_4',
      ];

      document.cookie.split(';').forEach((c) => {
        const cookieName = c.trim().split('=')[0];
        if (
          cookieName.startsWith('__') ||
          cookieName.toLowerCase().includes('clerk') ||
          cookiesToClear.includes(cookieName)
        ) {
          document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
          document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=${window.location.hostname};`;
        }
      });

      // Redirect to sign-in
      window.location.href = '/sign-in?session=expired';
      return;
    }
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '100vh',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h2>Something went wrong!</h2>
          <p>{error.message}</p>
          <button 
            onClick={() => {
              // Clear cookies before reset
              document.cookie.split(';').forEach((c) => {
                const cookieName = c.trim().split('=')[0];
                if (cookieName.startsWith('__') || cookieName.includes('clerk')) {
                  document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
                }
              });
              reset();
            }}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

