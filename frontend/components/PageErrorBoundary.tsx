'use client';

import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { AlertCircle, Home } from 'lucide-react';
import Link from 'next/link';

interface PageErrorBoundaryProps {
  children: React.ReactNode;
  pageName?: string;
}

export default function PageErrorBoundary({ children, pageName = 'page' }: PageErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white via-blue-50/30 to-white px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                Error Loading {pageName}
              </h2>
            </div>
            <p className="text-gray-600 mb-6">
              Something went wrong while loading this {pageName}. Please try refreshing the page or return to the home page.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Refresh Page
              </button>
              <Link
                href="/"
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <Home className="h-4 w-4" />
                Home
              </Link>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

