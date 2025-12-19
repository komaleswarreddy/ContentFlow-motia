import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/auth/clear-session',
]);

// Helper function to clear all Clerk cookies
function clearClerkCookies(response: NextResponse) {
  const cookiesToDelete = [
    '__session',
    '__client_uat',
    '__clerk_db_jwt',
    '__clerk_db_jwt_1',
    '__clerk_db_jwt_2',
    '__clerk_db_jwt_3',
    '__clerk_db_jwt_4',
  ];

  cookiesToDelete.forEach(cookieName => {
    response.cookies.delete(cookieName);
    // Set with expired date to ensure deletion - multiple path/domain variations
    response.cookies.set(cookieName, '', {
      expires: new Date(0),
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    // Also clear without domain restriction
    response.cookies.set(cookieName, '', {
      expires: new Date(0),
      path: '/',
    });
  });
  
  return response;
}

export default clerkMiddleware(async (auth, req) => {
  // PROACTIVELY clear cookies if redirected from error
  if (req.nextUrl.searchParams.get('session') === 'expired') {
    const response = NextResponse.next();
    clearClerkCookies(response);
    return response;
  }

  // For protected routes, try to verify auth but catch ALL errors aggressively
  if (!isPublicRoute(req)) {
    try {
      await auth.protect();
    } catch (error: any) {
      // AGGRESSIVE error handling - catch ANY error that might be JWT-related
      const errorMessage = String(error?.message || error?.toString() || '').toLowerCase();
      const errorReason = String(error?.reason || '').toLowerCase();
      const errorStack = String(error?.stack || '').toLowerCase();
      
      // Check for ANY indication of JWT/JWKS/kid errors
      const isJwtError = 
        errorMessage.includes('kid') ||
        errorMessage.includes('jwks') ||
        errorMessage.includes('signing key') ||
        errorMessage.includes('handshake token') ||
        errorMessage.includes('unable to find') ||
        errorMessage.includes('jwt') ||
        errorMessage.includes('token verification') ||
        errorMessage.includes('verification failed') ||
        errorReason === 'jwk-kid-mismatch' ||
        errorStack.includes('kid') ||
        errorStack.includes('jwks') ||
        errorStack.includes('jwt');
      
      // If it's a JWT error, clear cookies and redirect
      if (isJwtError) {
        const response = NextResponse.redirect(new URL('/sign-in?session=expired', req.url));
        clearClerkCookies(response);
        return response;
      }
      
      // For non-JWT errors, re-throw to let Next.js handle it normally
      throw error;
    }
  }
  
  // For public routes, just continue
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};


