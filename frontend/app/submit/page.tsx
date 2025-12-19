'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navigation from '../../components/Navigation';
import { FormSkeleton } from '../../components/SkeletonLoader';
import { fetchWithRetry } from '../../lib/retry-utils';

// Use Next.js API routes which proxy to Motia backend
const API_BASE_URL = '/api';

export default function SubmitPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    author: '',
    language: 'en',
  });

  // Auto-fill author from Clerk user
  useEffect(() => {
    if (isLoaded && user && !formData.author) {
      const userName = user.fullName || user.firstName || user.emailAddresses[0]?.emailAddress || '';
      setFormData(prev => ({ ...prev, author: userName }));
    }
  }, [user, isLoaded, formData.author]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Include userId if available and hardcode language to English
      const submitData = {
        ...formData,
        language: 'en', // Hardcoded to English
        userId: user?.id || undefined
      };

      const response = await fetchWithRetry(`${API_BASE_URL}/content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text.substring(0, 500));
        
        // If we get HTML, it means the API route wasn't found
        if (contentType?.includes('text/html') || response.status === 404) {
          throw new Error('API route not found. Please ensure the Next.js dev server has been restarted after adding the API routes.');
        }
        
        throw new Error(`Server returned ${response.status}: ${response.statusText}. Expected JSON but got ${contentType || 'unknown'}`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
        throw new Error(errorData.error || errorData.message || 'Failed to submit content');
      }

      const data = await response.json();
      setSuccess(true);

      // Redirect to status page after a short delay
      setTimeout(() => {
        router.push(`/content/${data.contentId}`);
      }, 1500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      console.error('Submit error:', err);
      setError(errorMessage);
      setLoading(false);
    }
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/sign-in');
    }
  }, [isLoaded, user, router]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/30 to-white">
        <Navigation />
        <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <FormSkeleton />
        </main>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/30 to-white">
      <Navigation />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="mb-2 text-4xl font-bold text-gray-900">Submit Content</h1>
          <p className="mb-8 text-lg text-gray-600">
            Submit your content for AI-powered analysis and recommendations.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="title" className="mb-2 block text-sm font-medium text-gray-700">
                Title
              </label>
              <input
                type="text"
                id="title"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Enter content title"
              />
            </div>

            <div>
              <label htmlFor="body" className="mb-2 block text-sm font-medium text-gray-700">
                Content Body
              </label>
              <textarea
                id="body"
                required
                rows={12}
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Enter your content here (minimum 100 characters)..."
              />
              <p className="mt-2 text-sm text-gray-500">
                {formData.body.length} characters (minimum 100 required)
              </p>
            </div>

            <div>
              <label htmlFor="author" className="mb-2 block text-sm font-medium text-gray-700">
                Author
              </label>
              <input
                type="text"
                id="author"
                required
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder={user ? (user.fullName || user.firstName || 'Your name') : 'Your name'}
                disabled={!isLoaded}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-800">
                {error}
              </div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-lg bg-green-50 border border-green-200 p-4 text-green-800 flex items-center gap-2"
              >
                <CheckCircle2 className="h-5 w-5" />
                Content submitted successfully! Redirecting...
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || success}
              className="w-full rounded-lg bg-blue-600 px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/30 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-12"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Submitting...
                </span>
              ) : (
                'Submit Content'
              )}
            </button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}

