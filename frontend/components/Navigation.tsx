'use client';

import { useUser, UserButton, SignInButton, SignUpButton } from '@clerk/nextjs';
import { Sparkles, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface NavigationProps {
  showAuth?: boolean;
}

export default function Navigation({ showAuth = true }: NavigationProps) {
  const { user, isLoaded } = useUser();

  return (
    <nav className="border-b border-gray-200/50 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-900 hover:text-gray-700 transition-colors"
          >
            <Sparkles className="h-6 w-6 text-blue-600" />
            <span className="text-xl font-semibold">ContentFlow</span>
          </Link>

          <div className="flex items-center gap-4">
            {showAuth && (
              <>
                {!isLoaded ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                ) : user ? (
                  <div className="flex items-center gap-4">
                    <Link
                      href="/dashboard"
                      className="hidden sm:inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Dashboard
                    </Link>
                    <UserButton
                      afterSignOutUrl="/"
                      appearance={{
                        elements: {
                          avatarBox: 'h-9 w-9',
                        },
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <SignInButton mode="modal">
                      <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                        Sign In
                      </button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                      <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
                        Sign Up
                      </button>
                    </SignUpButton>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

