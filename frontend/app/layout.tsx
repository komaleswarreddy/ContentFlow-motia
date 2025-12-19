import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs';
import "./globals.css";
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ClerkErrorHandler } from '../components/ClerkErrorHandler';
import { CookieCleanupOnMount } from '../components/CookieCleanupOnMount';
import { PostAuthCleanup } from '../components/PostAuthCleanup';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ContentFlow - AI-Powered Content Workflow",
  description: "Submit, analyze, and get intelligent recommendations for your content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Clerk publishable key from environment variable (required)
  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!clerkPublishableKey) {
    throw new Error('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY environment variable is required');
  }

  return (
    <ClerkProvider 
      publishableKey={clerkPublishableKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/dashboard"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      appearance={{
        elements: {
          rootBox: 'w-full',
        },
      }}
    >
      <html lang="en">
        <body className={`${inter.variable} font-sans antialiased`}>
          <CookieCleanupOnMount />
          <PostAuthCleanup />
          <ClerkErrorHandler />
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </body>
      </html>
    </ClerkProvider>
  );
}
