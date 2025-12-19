'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { clearAllClerkCookies } from '../lib/clerk-cookie-utils';

export function ClerkErrorHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoaded } = useUser();

  useEffect(() => {
    // DO NOT clear cookies proactively - only handle actual errors
    // Cookies are cleared by the sign-in page if needed

    // Listen for Clerk errors in the console - intercept BEFORE they're logged
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.error = (...args: any[]) => {
      const errorMessage = args.join(' ');
      const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
      const isAuthPage = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up');
      
      // Ignore WebSocket connection errors - they're expected when streams aren't configured
      const isWebSocketError = 
        errorMessage.includes('[StreamClient]') ||
        errorMessage.includes('WebSocket') ||
        errorMessage.includes('WebSocket connection error') ||
        errorMessage.includes('ws.onerror');
      
      if (isWebSocketError) {
        // Suppress WebSocket errors - streams are optional
        return;
      }
      
      // Check if it's a JWKS/kid mismatch error - be very specific to catch the exact error
      const isJwtKidError = 
        errorMessage.includes('Handshake token verification failed') ||
        errorMessage.includes('Unable to find a signing key in JWKS') ||
        errorMessage.includes('jwk-kid-mismatch') ||
        (errorMessage.includes('kid=') && errorMessage.includes('JWKS')) ||
        (errorMessage.includes('signing key') && errorMessage.includes('JWKS')) ||
        (errorMessage.includes('ins_36y7CB644zVsK4vS3YEwKyWoDie')); // Specific old kid
      
      if (isJwtKidError) {
        // Only handle on non-auth pages AND when user is not authenticated
        // If user is authenticated, the error might be transient - don't clear their session
        if (!isAuthPage && (!isLoaded || !user)) {
          // SUPPRESS the error message completely
          // Immediately clear ALL cookies aggressively
          clearAllClerkCookies();
          // Force redirect immediately
          if (typeof window !== 'undefined') {
            window.location.replace('/sign-in?session=expired');
          }
          return; // Don't call original console.error - suppress completely
        }
      }
      
      // Call original console.error for other errors
      originalError.apply(console, args);
    };

    console.warn = (...args: any[]) => {
      const warnMessage = args.join(' ');
      const pathname = window.location.pathname;
      const isAuthPage = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up');
      
      // Also catch warnings about JWT/kid issues, but only specific ones
      if (
        (warnMessage.includes('kid') && warnMessage.includes('JWKS')) ||
        (warnMessage.includes('JWKS') && warnMessage.includes('signing key')) ||
        warnMessage.includes('jwk-kid-mismatch')
      ) {
        // Only handle if NOT on auth pages AND user is not authenticated
        if (!isAuthPage && (!isLoaded || !user)) {
          clearAllClerkCookies();
          window.location.href = '/sign-in?session=expired';
          return;
        }
      }
      
      originalWarn.apply(console, args);
    };

    // Listen for unhandled errors and promise rejections
    const handleError = (event: ErrorEvent) => {
      const errorMessage = event.message || event.error?.message || '';
      const errorStack = event.error?.stack || '';
      const pathname = window.location.pathname;
      const isAuthPage = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up');
      
      // Only handle specific JWT errors, and only on non-auth pages
      const isJwtKidError = 
        errorMessage.includes('Handshake token verification failed') ||
        errorMessage.includes('Unable to find a signing key in JWKS') ||
        errorMessage.includes('jwk-kid-mismatch') ||
        (errorMessage.includes('kid') && errorMessage.includes('JWKS')) ||
        (errorStack.includes('kid') && errorStack.includes('JWKS')) ||
        errorMessage.includes('ins_36y7CB644zVsK4vS3YEwKyWoDie');
      
      if (isJwtKidError && !isAuthPage && (!isLoaded || !user)) {
        event.preventDefault();
        event.stopPropagation();
        
        clearAllClerkCookies();
        window.location.replace('/sign-in?session=expired');
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const errorMessage = event.reason?.message || event.reason?.toString() || '';
      const pathname = window.location.pathname;
      const isAuthPage = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up');
      
      // Only handle specific JWT errors, and only on non-auth pages
      const isJwtKidError = 
        errorMessage.includes('Handshake token verification failed') ||
        errorMessage.includes('Unable to find a signing key in JWKS') ||
        errorMessage.includes('jwk-kid-mismatch') ||
        (errorMessage.includes('kid') && errorMessage.includes('JWKS')) ||
        errorMessage.includes('ins_36y7CB644zVsK4vS3YEwKyWoDie');
      
      if (isJwtKidError && !isAuthPage && (!isLoaded || !user)) {
        event.preventDefault();
        clearAllClerkCookies();
        window.location.replace('/sign-in?session=expired');
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      console.error = originalError;
      console.warn = originalWarn;
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [router, pathname, user, isLoaded]);

  return null;
}

