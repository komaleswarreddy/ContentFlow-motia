'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Loader2, CheckCircle2, XCircle, Clock, TrendingUp, FileText, MessageSquare, ThumbsUp, ThumbsDown, Send, Users, Sparkles, RefreshCw, Check, X } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import PageErrorBoundary from '../../../components/PageErrorBoundary';
import { useMotiaStream } from '../../../lib/stream-client';
import Navigation from '../../../components/Navigation';
import { ContentSkeleton } from '../../../components/SkeletonLoader';
import { fetchWithRetry } from '../../../lib/retry-utils';

// Use Next.js API routes which proxy to Motia backend
const API_BASE_URL = '/api';

interface ImprovedContent {
  originalBody: string;
  improvedBody: string;
  generatedAt: string;
  status: 'generating' | 'completed' | 'failed';
  appliedAt?: string;
}

interface ContentStatus {
  contentId: string;
  title: string;
  body?: string;
  author: string;
  language: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } | null;
  analysis: {
    sentiment: string;
    topics: string[];
    readabilityScore: number;
    wordCount: number;
    qualityScore: number;
    summary: string;
    strengths: string[];
    weaknesses: string[];
  } | null;
  recommendations: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    priority: string;
    actionableSteps: string[];
    votes?: {
      upvotes: number;
      downvotes: number;
      userVotes?: Record<string, 'up' | 'down'>;
    };
  }>;
  improvedContent?: ImprovedContent;
}

interface Comment {
  id: string;
  contentId: string;
  userId: string;
  userName: string;
  text: string;
  type: 'analysis' | 'recommendation' | 'general';
  targetId?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ContentStatusPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.id as string;
  const { user, isLoaded } = useUser();
  
  const [content, setContent] = useState<ContentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentType, setCommentType] = useState<'analysis' | 'recommendation' | 'general'>('general');
  const [targetId, setTargetId] = useState<string>('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [voting, setVoting] = useState<Record<string, boolean>>({});
  const [requestingImprovement, setRequestingImprovement] = useState(false);
  const [applyingImprovement, setApplyingImprovement] = useState(false);
  const [improvementError, setImprovementError] = useState<string | null>(null);
  
  // Get current user from Clerk
  const currentUser = user ? {
    id: user.id,
    name: user.fullName || user.firstName || user.emailAddresses[0]?.emailAddress || 'User'
  } : null;

  const fetchContent = async () => {
    try {
      const response = await fetchWithRetry(`${API_BASE_URL}/content/${contentId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }, { maxRetries: 2, timeout: 15000 });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || errorData.message || 'Content not found');
      }
      
      const data = await response.json();
      
      // Validate that we got the expected data structure
      if (!data || !data.contentId) {
        throw new Error('Invalid content data received');
      }
      
      setContent(data);
      setError(null);
    } catch (err) {
      let errorMessage = 'Failed to fetch content';
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      console.error('Error fetching content:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await fetchWithRetry(`${API_BASE_URL}/content/${contentId}/comments`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }, { maxRetries: 1, timeout: 8000 });
      if (response.ok) {
        const data = await response.json();
        setComments(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      // Silently fail for comments - not critical
      console.warn('Failed to fetch comments:', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !currentUser) return;

    setSubmittingComment(true);
    try {
      const response = await fetchWithRetry(`${API_BASE_URL}/content/${contentId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.id,
          userName: currentUser.name,
          text: commentText,
          type: commentType,
          targetId: targetId || undefined,
        }),
      });

      if (response.ok) {
        setCommentText('');
        setTargetId('');
        await fetchComments();
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleVote = async (recommendationId: string, vote: 'up' | 'down') => {
    if (!currentUser) return;
    
    setVoting({ ...voting, [recommendationId]: true });
    try {
      const response = await fetchWithRetry(`${API_BASE_URL}/content/${contentId}/recommendations/${recommendationId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.id,
          vote,
        }),
      });

      if (response.ok) {
        // Refresh content to get updated votes
        await fetchContent();
      }
    } catch (err) {
      console.error('Failed to vote:', err);
    } finally {
      setVoting({ ...voting, [recommendationId]: false });
    }
  };

  const handleRequestImprovement = async () => {
    setRequestingImprovement(true);
    setImprovementError(null);
    try {
      const response = await fetchWithRetry(`${API_BASE_URL}/content/${contentId}/improve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to request improvement' }));
        throw new Error(data.error || 'Failed to request improvement');
      }

      // Start polling for improvement completion
      await fetchContent();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request improvement';
      setImprovementError(errorMessage);
      console.error('Failed to request improvement:', err);
    } finally {
      setRequestingImprovement(false);
    }
  };

  const handleApplyImprovement = async () => {
    setApplyingImprovement(true);
    setImprovementError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/content/${contentId}/apply-improvement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to apply improvement');
      }

      await fetchContent();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply improvement';
      setImprovementError(errorMessage);
      console.error('Failed to apply improvement:', err);
    } finally {
      setApplyingImprovement(false);
    }
  };

  // Note: Real-time streams disabled - using polling instead
  // WebSocket streams require Motia backend configuration
  // const contentStream = useMotiaStream('contentUpdates', contentId, !!contentId);
  // const commentsStream = useMotiaStream('comments', contentId, !!contentId);

  // Smart polling-based updates with adaptive intervals
  useEffect(() => {
    if (!contentId) return;

    let isMounted = true;
    let pollCount = 0;
    const maxPollCount = 60; // Stop polling after ~5 minutes

    // Initial fetch
    fetchContent();
    fetchComments();
    
    // Smart polling with adaptive interval
    const poll = () => {
      if (!isMounted) return;
      
      // Only poll if content exists and is not in a final state
      const isProcessing = content && !['completed', 'failed', 'rejected'].includes(content.status);
      
      if (isProcessing && pollCount < maxPollCount) {
        pollCount++;
        fetchContent();
      }
      
      // Refresh comments less frequently (every 10 seconds)
      if (pollCount % 2 === 0) {
        fetchComments();
      }
    };
    
    // Use adaptive polling: faster when processing, slower when idle
    const getInterval = () => {
      if (content && !['completed', 'failed', 'rejected'].includes(content.status)) {
        return 5000; // 5 seconds when processing
      }
      return 15000; // 15 seconds when idle (just for comments)
    };
    
    const interval = setInterval(poll, getInterval());

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId, content?.status]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      validating: 'bg-blue-100 text-blue-800',
      validated: 'bg-green-100 text-green-800',
      analyzing: 'bg-purple-100 text-purple-800',
      analyzed: 'bg-indigo-100 text-indigo-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle2 className="h-5 w-5" />;
    if (status === 'failed' || status === 'rejected') return <XCircle className="h-5 w-5" />;
    if (status.includes('ing')) return <Loader2 className="h-5 w-5 animate-spin" />;
    return <Clock className="h-5 w-5" />;
  };

  const getProgress = (status: string) => {
    const progressMap: Record<string, number> = {
      pending: 10,
      validating: 25,
      validated: 40,
      analyzing: 60,
      analyzed: 80,
      completed: 100,
      failed: 0,
      rejected: 0,
    };
    return progressMap[status] || 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/30 to-white">
        <Navigation />
        <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <ContentSkeleton />
        </main>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/30 to-white">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-800">
            {error || 'Content not found'}
          </div>
          <Link href="/" className="mt-4 inline-block text-blue-600 hover:text-blue-700">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const progress = getProgress(content.status);

  return (
    <PageErrorBoundary pageName="Content">
    <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/30 to-white">
      <Navigation />

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="mb-2 text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 break-words">{content.title}</h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
              <span>By {content.author}</span>
              <span className="hidden sm:inline">•</span>
              <span>{content.language.toUpperCase()}</span>
              <span className="hidden sm:inline">•</span>
              <span className={`rounded-full px-2 sm:px-3 py-1 text-xs font-medium ${getStatusColor(content.status)} flex items-center gap-1`}>
                {getStatusIcon(content.status)}
                {content.status}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">Processing Progress</span>
              <span className="text-gray-600">{progress}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-gray-200">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-blue-600 to-purple-600"
              />
            </div>
          </div>

          {/* Validation Results */}
          {content.validation && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <h2 className="mb-4 text-2xl font-semibold text-gray-900">Validation</h2>
              {content.validation.isValid ? (
                <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                  <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Content validated successfully
                  </div>
                  {content.validation.warnings.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-green-700 mb-1">Warnings:</p>
                      <ul className="list-disc list-inside text-sm text-green-600 space-y-1">
                        {content.validation.warnings.map((warning, idx) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                  <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
                    <XCircle className="h-5 w-5" />
                    Validation failed
                  </div>
                  <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                    {content.validation.errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}

          {/* AI Analysis */}
          {content.analysis && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center gap-2">
                <FileText className="h-6 w-6 text-blue-600" />
                <h2 className="text-2xl font-semibold text-gray-900">AI Analysis</h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6">
                <div className="rounded-lg bg-blue-50 p-3 sm:p-4">
                  <div className="text-xs sm:text-sm text-blue-600 font-medium mb-1">Sentiment</div>
                  <div className="text-xl sm:text-2xl font-bold text-blue-900 capitalize">{content.analysis.sentiment}</div>
                </div>
                <div className="rounded-lg bg-purple-50 p-3 sm:p-4">
                  <div className="text-xs sm:text-sm text-purple-600 font-medium mb-1">Quality Score</div>
                  <div className="text-xl sm:text-2xl font-bold text-purple-900">{content.analysis.qualityScore}/100</div>
                </div>
                <div className="rounded-lg bg-green-50 p-3 sm:p-4">
                  <div className="text-xs sm:text-sm text-green-600 font-medium mb-1">Readability</div>
                  <div className="text-xl sm:text-2xl font-bold text-green-900">{content.analysis.readabilityScore}/100</div>
                </div>
                <div className="rounded-lg bg-orange-50 p-3 sm:p-4">
                  <div className="text-xs sm:text-sm text-orange-600 font-medium mb-1">Word Count</div>
                  <div className="text-xl sm:text-2xl font-bold text-orange-900">{content.analysis.wordCount}</div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="mb-2 font-semibold text-gray-900">Summary</h3>
                <p className="text-gray-700">{content.analysis.summary}</p>
              </div>

              {content.analysis.topics.length > 0 && (
                <div className="mb-6">
                  <h3 className="mb-2 font-semibold text-gray-900">Topics</h3>
                  <div className="flex flex-wrap gap-2">
                    {content.analysis.topics.map((topic, idx) => (
                      <span key={idx} className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {content.analysis.strengths.length > 0 && (
                <div className="mb-6">
                  <h3 className="mb-2 font-semibold text-green-700">Strengths</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    {content.analysis.strengths.map((strength, idx) => (
                      <li key={idx}>{strength}</li>
                    ))}
                  </ul>
                </div>
              )}

              {content.analysis.weaknesses.length > 0 && (
                <div>
                  <h3 className="mb-2 font-semibold text-red-700">Areas for Improvement</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    {content.analysis.weaknesses.map((weakness, idx) => (
                      <li key={idx}>{weakness}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Generate Improvement Button */}
              {!content.improvedContent && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={handleRequestImprovement}
                    disabled={requestingImprovement}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:from-purple-700 hover:to-indigo-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {requestingImprovement ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Requesting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate Improved Version
                      </>
                    )}
                  </button>
                  <p className="mt-2 text-xs text-gray-500">
                    AI will generate an improved version based on the analysis above
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* AI Content Improvement Section */}
          {content.analysis && content.improvedContent && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-6 w-6 text-purple-600" />
                  <h2 className="text-2xl font-semibold text-gray-900">AI Content Improvement</h2>
                </div>
                {content.improvedContent.status === 'generating' && (
                  <span className="flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </span>
                )}
                {content.improvedContent.status === 'completed' && !content.improvedContent.appliedAt && (
                  <span className="flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                    <CheckCircle2 className="h-4 w-4" />
                    Ready to Review
                  </span>
                )}
                {content.improvedContent.appliedAt && (
                  <span className="flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                    <Check className="h-4 w-4" />
                    Applied
                  </span>
                )}
                {content.improvedContent.status === 'failed' && (
                  <span className="flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">
                    <XCircle className="h-4 w-4" />
                    Failed
                  </span>
                )}
              </div>

              {improvementError && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {improvementError}
                </div>
              )}

              {content.improvedContent.status === 'generating' && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="relative">
                    <div className="h-16 w-16 rounded-full border-4 border-purple-200"></div>
                    <div className="absolute top-0 left-0 h-16 w-16 rounded-full border-4 border-purple-600 border-t-transparent animate-spin"></div>
                  </div>
                  <p className="mt-4 text-gray-600 font-medium">AI is improving your content...</p>
                  <p className="mt-1 text-sm text-gray-500">This may take a moment</p>
                </div>
              )}

              {content.improvedContent.status === 'failed' && (
                <div className="text-center py-8">
                  <XCircle className="mx-auto h-12 w-12 text-red-400" />
                  <p className="mt-3 text-gray-600">Failed to generate improvement</p>
                  <button
                    onClick={handleRequestImprovement}
                    disabled={requestingImprovement}
                    className="mt-4 flex items-center gap-2 mx-auto rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try Again
                  </button>
                </div>
              )}

              {content.improvedContent.status === 'completed' && content.improvedContent.improvedBody && (
                <>
                  {/* Side-by-side comparison */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                    {/* Original Content */}
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <FileText className="h-5 w-5 text-gray-500" />
                        <h3 className="font-semibold text-gray-700">Original Content</h3>
                      </div>
                      <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-wrap max-h-80 overflow-y-auto">
                        {content.improvedContent.originalBody || 'Original content not available'}
                      </div>
                    </div>

                    {/* Improved Content */}
                    <div className="rounded-lg border-2 border-purple-200 bg-purple-50/50 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-600" />
                        <h3 className="font-semibold text-purple-700">Improved Version</h3>
                      </div>
                      <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap max-h-80 overflow-y-auto">
                        {content.improvedContent.improvedBody}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {!content.improvedContent.appliedAt && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4 border-t border-gray-200">
                      <button
                        onClick={handleApplyImprovement}
                        disabled={applyingImprovement}
                        className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:from-green-700 hover:to-emerald-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {applyingImprovement ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Applying...
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4" />
                            Apply Improved Version
                          </>
                        )}
                      </button>
                      <p className="sm:ml-auto text-xs text-gray-500">
                        Keep original by not clicking apply
                      </p>
                    </div>
                  )}

                  {content.improvedContent.appliedAt && (
                    <div className="flex items-center gap-2 pt-4 border-t border-gray-200 text-sm text-green-700">
                      <CheckCircle2 className="h-5 w-5" />
                      <span>
                        Improved version applied on{' '}
                        {new Date(content.improvedContent.appliedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* Recommendations */}
          {content.recommendations && content.recommendations.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-purple-600" />
                <h2 className="text-2xl font-semibold text-gray-900">Recommendations</h2>
              </div>

              <div className="space-y-4">
                {content.recommendations.map((rec, idx) => (
                  <motion.div
                    key={rec.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + idx * 0.1 }}
                    className={`rounded-lg border-l-4 p-4 ${
                      rec.priority === 'high'
                        ? 'border-red-500 bg-red-50'
                        : rec.priority === 'medium'
                        ? 'border-yellow-500 bg-yellow-50'
                        : 'border-blue-500 bg-blue-50'
                    }`}
                  >
                    <div className="mb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900">{rec.title}</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Voting buttons */}
                        <div className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white">
                          <button
                            onClick={() => handleVote(rec.id, 'up')}
                            disabled={voting[rec.id]}
                            className="flex items-center gap-1 px-2 py-1 text-xs sm:text-sm text-gray-600 hover:bg-green-50 hover:text-green-600 disabled:opacity-50"
                            title="Upvote"
                          >
                            <ThumbsUp className="h-3 w-3 sm:h-4 sm:w-4" />
                            {rec.votes?.upvotes || 0}
                          </button>
                          <div className="h-5 sm:h-6 w-px bg-gray-300" />
                          <button
                            onClick={() => handleVote(rec.id, 'down')}
                            disabled={voting[rec.id]}
                            className="flex items-center gap-1 px-2 py-1 text-xs sm:text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            title="Downvote"
                          >
                            <ThumbsDown className="h-3 w-3 sm:h-4 sm:w-4" />
                            {rec.votes?.downvotes || 0}
                          </button>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                          rec.priority === 'high'
                            ? 'bg-red-100 text-red-800'
                            : rec.priority === 'medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {rec.priority} priority
                        </span>
                      </div>
                    </div>
                    <p className="mb-3 text-gray-700">{rec.description}</p>
                    {rec.actionableSteps.length > 0 && (
                      <div>
                        <p className="mb-1 text-sm font-medium text-gray-900">Action Steps:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                          {rec.actionableSteps.map((step, stepIdx) => (
                            <li key={stepIdx}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Collaborative Comments Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-4 flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-blue-600" />
              <h2 className="text-2xl font-semibold text-gray-900">Collaborative Comments</h2>
              {comments.length > 0 && (
                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                  {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
                </span>
              )}
            </div>

            {/* Add Comment Form */}
            {!isLoaded ? (
              <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              </div>
            ) : !currentUser ? (
              <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                <p className="text-gray-600 mb-2">Please sign in to add comments</p>
                <Link
                  href="/sign-in"
                  className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Sign In
                </Link>
              </div>
            ) : (
              <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="mb-3">
                  <label className="mb-2 block text-sm font-medium text-gray-700">Add a comment</label>
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Share your thoughts on this analysis..."
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <select
                  value={commentType}
                  onChange={(e) => setCommentType(e.target.value as any)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="general">General Comment</option>
                  <option value="analysis">Comment on Analysis</option>
                  <option value="recommendation">Comment on Recommendation</option>
                </select>
                {commentType === 'recommendation' && content?.recommendations && (
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Select recommendation...</option>
                    {content.recommendations.map((rec) => (
                      <option key={rec.id} value={rec.id}>{rec.title}</option>
                    ))}
                  </select>
                )}
                <button
                  onClick={handleAddComment}
                  disabled={!commentText.trim() || submittingComment}
                  className="sm:ml-auto flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submittingComment ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span className="hidden sm:inline">Post Comment</span>
                      <span className="sm:hidden">Post</span>
                    </>
                  )}
                </button>
              </div>
              </div>
            )}

            {/* Comments List */}
            {comments.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <MessageSquare className="mx-auto mb-2 h-12 w-12 text-gray-300" />
                <p>No comments yet. Be the first to share your thoughts!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <motion.div
                    key={comment.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border border-gray-200 bg-white p-4"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{comment.userName}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(comment.createdAt).toLocaleString()}
                          {comment.type !== 'general' && (
                            <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-blue-700">
                              {comment.type}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-700">{comment.text}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      </main>
    </div>
    </PageErrorBoundary>
  );
}
