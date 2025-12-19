'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Loader2, Trash2, Search, Filter, Download, X, Eye, Calendar, User, FileText, ArrowRight } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navigation from '../../components/Navigation';
import { DashboardSkeleton } from '../../components/SkeletonLoader';
import { fetchWithRetry } from '../../lib/retry-utils';
import Pagination from '../../components/Pagination';
import { exportToJSON, exportToCSV, exportToPDF } from '../../lib/export-utils';
import { cache, CACHE_KEYS, CACHE_TTL } from '../../lib/cache-utils';

// Use Next.js API routes which proxy to Motia backend
const API_BASE_URL = '/api';

interface ContentItem {
  id: string;
  contentId: string;
  title: string;
  author: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [allContentItems, setAllContentItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Redirect if not authenticated
  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/sign-in');
    }
  }, [isLoaded, user, router]);

  useEffect(() => {
    let isMounted = true;
    
    const fetchContent = async () => {
      try {
        // Build cache key and URL
        const cacheKey = showAll ? `${CACHE_KEYS.CONTENT_LIST}_all` : `${CACHE_KEYS.CONTENT_LIST}_${user?.id || 'anon'}`;
        
        // Check cache first for instant display
        const cachedData = cache.get<ContentItem[]>(cacheKey);
        if (cachedData && isMounted) {
          setAllContentItems(cachedData);
          setLoading(false);
          // Continue to fetch fresh data in background
        }
        
        // Build URL with userId query parameter if user is authenticated and not showing all
        let url = `${API_BASE_URL}/content`;
        if (isLoaded && user && !showAll) {
          url += `?userId=${encodeURIComponent(user.id)}`;
        }
        
        // Use retry logic with exponential backoff (reduced retries for faster response)
        const response = await fetchWithRetry(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }, { maxRetries: 2, timeout: 15000 }); // Increased timeout
        
        if (!isMounted) return;
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
          throw new Error(errorData.error || errorData.message || 'Failed to fetch content');
        }
        
        const data = await response.json();
        const items = Array.isArray(data) ? data : [];
        
        if (!isMounted) return;
        
        // Update cache and state
        cache.set(cacheKey, items, CACHE_TTL.CONTENT_LIST);
        setAllContentItems(items);
        setError(null);
      } catch (err) {
        if (!isMounted) return;
        
        // Extract meaningful error message
        let errorMessage = 'Failed to fetch content';
        if (err instanceof Error) {
          errorMessage = err.message;
        } else if (typeof err === 'object' && err !== null) {
          errorMessage = JSON.stringify(err) || 'Unknown error occurred';
        }
        
        console.error('Error fetching content list:', errorMessage);
        
        // Only show error if we don't have cached data
        if (allContentItems.length === 0) {
          setError(errorMessage);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (isLoaded) {
      fetchContent();
    }
    
    return () => {
      isMounted = false;
    };
  }, [isLoaded, user, showAll]);

  // Filter and search content
  const filteredContent = useMemo(() => {
    let filtered = allContentItems;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.author.toLowerCase().includes(query) ||
        item.status.toLowerCase().includes(query) ||
        item.contentId.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    return filtered;
  }, [allContentItems, searchQuery, statusFilter]);

  // Paginate filtered content
  const paginatedContent = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredContent.slice(startIndex, endIndex);
  }, [filteredContent, currentPage, itemsPerPage]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Update contentItems with paginated data
  useEffect(() => {
    setContentItems(paginatedContent);
  }, [paginatedContent]);

  // Get unique statuses for filter dropdown
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set(allContentItems.map(item => item.status));
    return Array.from(statuses).sort();
  }, [allContentItems]);

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

  const handleDelete = async (contentId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this content? This action cannot be undone.')) {
      return;
    }

    setDeletingId(contentId);
    try {
      const response = await fetchWithRetry(`${API_BASE_URL}/content/${contentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || errorData.message || 'Failed to delete content');
      }

      // Remove the deleted item from state and invalidate cache
      setAllContentItems(prev => prev.filter(item => item.contentId !== contentId && item.id !== contentId));
      cache.invalidatePrefix(CACHE_KEYS.CONTENT_LIST); // Invalidate all content list caches
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete content';
      console.error('Error deleting content:', err);
      setError(errorMessage);
    } finally {
      setDeletingId(null);
    }
  };

  const handleExport = (format: 'json' | 'csv' | 'pdf') => {
    if (filteredContent.length === 0) {
      alert('No content to export');
      return;
    }

    switch (format) {
      case 'json':
        exportToJSON(filteredContent, 'content-export');
        break;
      case 'csv':
        exportToCSV(filteredContent, 'content-export');
        break;
      case 'pdf':
        exportToPDF(filteredContent, 'content-export');
        break;
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
  };

  const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'all';

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/30 to-white">
        <Navigation />
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/30 to-white">
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Header */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Dashboard</h1>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShowAll(!showAll)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap shadow-sm"
              >
                {showAll ? 'My Content' : 'All Content'}
              </button>
              <Link
                href="/submit"
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap shadow-sm shadow-blue-500/30"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">Submit Content</span>
                <span className="sm:hidden">Submit</span>
              </Link>
            </div>
          </div>

          {/* Search and Filter Bar */}
          <div className="mb-8 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by title, author, status, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-11 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Filter Toggle Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium transition-all whitespace-nowrap shadow-sm ${
                  showFilters || hasActiveFilters
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter className="h-4 w-4" />
                Filters
                {hasActiveFilters && (
                  <span className="ml-1.5 rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white font-semibold">
                    {[searchQuery && '1', statusFilter !== 'all' && '1'].filter(Boolean).length}
                  </span>
                )}
              </button>

              {/* Export Dropdown */}
              <div className="relative group">
                <button className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all whitespace-nowrap w-full sm:w-auto shadow-sm">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export</span>
                </button>
                <div className="absolute right-0 mt-2 w-52 rounded-xl border border-gray-200 bg-white shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 overflow-hidden">
                  <div className="py-1.5">
                    <button
                      onClick={() => handleExport('json')}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Export as JSON
                    </button>
                    <button
                      onClick={() => handleExport('csv')}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Export as CSV
                    </button>
                    <button
                      onClick={() => handleExport('pdf')}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Export as PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-xl border border-gray-200 bg-gray-50/80 p-5 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-end">
                  <div className="flex-1 w-full sm:w-auto">
                    <label className="block text-sm font-semibold text-gray-700 mb-2.5">
                      Status Filter
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all"
                    >
                      <option value="all">All Statuses</option>
                      {uniqueStatuses.map(status => (
                        <option key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all whitespace-nowrap shadow-sm"
                    >
                      <X className="h-4 w-4" />
                      Clear Filters
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Results Summary */}
            {!loading && (
              <div className="text-sm font-medium text-gray-600 px-1">
                {filteredContent.length === allContentItems.length ? (
                  <span>Showing {filteredContent.length} {filteredContent.length === 1 ? 'item' : 'items'}</span>
                ) : (
                  <span>
                    Showing {filteredContent.length} of {allContentItems.length} {allContentItems.length === 1 ? 'item' : 'items'}
                    {hasActiveFilters && ' (filtered)'}
                  </span>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <DashboardSkeleton />
          ) : error ? (
            <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-800">
              {error}
            </div>
          ) : filteredContent.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
              {hasActiveFilters ? (
                <>
                  <p className="mb-4 text-lg text-gray-600">No content matches your filters.</p>
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-lg font-semibold text-white transition-colors hover:bg-blue-700"
                  >
                    Clear Filters
                  </button>
                </>
              ) : (
                <>
                  <p className="mb-4 text-lg text-gray-600">No content submissions yet.</p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View - Perfect Grid Alignment */}
              <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-xl shadow-gray-200/50">
                <div className="overflow-x-auto">
                  <div className="min-w-[1000px]">
                    {/* Header Row - Fixed Grid */}
                    <div 
                      className="grid gap-0 bg-gradient-to-r from-gray-50 via-gray-50/50 to-gray-50 border-b border-gray-200/60"
                      style={{
                        gridTemplateColumns: 'minmax(300px, 2fr) minmax(200px, 1.5fr) minmax(120px, 1fr) minmax(140px, 1fr) minmax(180px, 1.5fr)'
                      }}
                    >
                      <div className="pl-8 pr-8 py-5" style={{ paddingLeft: '2rem', paddingRight: '2rem', paddingTop: '1.25rem', paddingBottom: '1.25rem' }}>
                        <div className="flex items-center gap-2.5">
                          <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Title</span>
                        </div>
                      </div>
                      <div className="pl-8 pr-8 py-5" style={{ paddingLeft: '2rem', paddingRight: '2rem', paddingTop: '1.25rem', paddingBottom: '1.25rem' }}>
                        <div className="flex items-center gap-2.5">
                          <User className="h-4 w-4 text-gray-500 flex-shrink-0" />
                          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Author</span>
                        </div>
                      </div>
                      <div className="pl-8 pr-8 py-5" style={{ paddingLeft: '2rem', paddingRight: '2rem', paddingTop: '1.25rem', paddingBottom: '1.25rem' }}>
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Status</span>
                      </div>
                      <div className="pl-8 pr-8 py-5" style={{ paddingLeft: '2rem', paddingRight: '2rem', paddingTop: '1.25rem', paddingBottom: '1.25rem' }}>
                        <div className="flex items-center gap-2.5">
                          <Calendar className="h-4 w-4 text-gray-500 flex-shrink-0" />
                          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Created</span>
                        </div>
                      </div>
                      <div className="pl-8 pr-8 py-5" style={{ paddingLeft: '2rem', paddingRight: '2rem', paddingTop: '1.25rem', paddingBottom: '1.25rem' }}>
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</span>
                      </div>
                    </div>

                    {/* Content Rows - Same Grid Template */}
                    <div className="divide-y divide-gray-100/80">
                      {contentItems.map((item, index) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          className="group relative transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-white hover:to-white hover:shadow-sm"
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(300px, 2fr) minmax(200px, 1.5fr) minmax(120px, 1fr) minmax(140px, 1fr) minmax(180px, 1.5fr)',
                            gap: 0
                          }}
                        >
                          {/* Subtle left border on hover */}
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10"></div>
                          
                          {/* Title Column */}
                          <div className="pl-8 pr-8 py-6" style={{ paddingLeft: '2rem', paddingRight: '2rem', paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-200 shadow-sm">
                                <FileText className="h-5 w-5 text-blue-600" />
                              </div>
                              <div className="min-w-0 flex-1 pt-0.5">
                                <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-200 truncate mb-1">
                                  {item.title}
                                </p>
                                <p className="text-xs text-gray-500 truncate font-mono">
                                  ID: {item.contentId.slice(0, 16)}...
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Author Column */}
                          <div className="pl-8 pr-8 py-6" style={{ paddingLeft: '2rem', paddingRight: '2rem', paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-sm">
                                <User className="h-4 w-4 text-gray-600" />
                              </div>
                              <span className="text-sm font-medium text-gray-700 truncate">
                                {item.author}
                              </span>
                            </div>
                          </div>
                          
                          {/* Status Column */}
                          <div className="pl-8 pr-8 py-6" style={{ paddingLeft: '2rem', paddingRight: '2rem', paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
                            <motion.span
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold shadow-sm transition-all duration-200 ${getStatusColor(item.status)}`}
                            >
                              <div className={`w-2 h-2 rounded-full ${
                                item.status === 'completed' ? 'bg-green-600' :
                                item.status === 'failed' || item.status === 'rejected' ? 'bg-red-600' :
                                item.status === 'pending' ? 'bg-yellow-600' :
                                'bg-blue-600'
                              }`}></div>
                              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                            </motion.span>
                          </div>
                          
                          {/* Created Column */}
                          <div className="pl-8 pr-8 py-6" style={{ paddingLeft: '2rem', paddingRight: '2rem', paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
                            <div className="flex items-center gap-2.5 text-sm text-gray-600">
                              <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              <span className="font-medium whitespace-nowrap">
                                {new Date(item.createdAt).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric' 
                                })}
                              </span>
                            </div>
                          </div>
                          
                          {/* Actions Column */}
                          <div className="pl-8 pr-8 py-6" style={{ paddingLeft: '2rem', paddingRight: '2rem', paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
                            <div className="flex items-center gap-3">
                              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                <Link
                                  href={`/content/${item.contentId || item.id}`}
                                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium shadow-sm shadow-blue-500/30 hover:shadow-md hover:shadow-blue-500/40 transition-all duration-200 group"
                                >
                                  <Eye className="h-4 w-4" />
                                  <span>View</span>
                                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                                </Link>
                              </motion.div>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => handleDelete(item.contentId || item.id, e)}
                                disabled={deletingId === (item.contentId || item.id)}
                                className="p-2.5 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                title="Delete content"
                              >
                                {deletingId === (item.contentId || item.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </motion.button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile Card View - Enhanced */}
              <div className="md:hidden space-y-4">
                {contentItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="group relative rounded-xl border border-gray-200/60 bg-white/90 backdrop-blur-sm p-5 shadow-lg shadow-gray-200/30 hover:shadow-xl hover:shadow-gray-300/40 transition-all duration-300 overflow-hidden"
                  >
                    {/* Gradient accent bar */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
                    
                    {/* Header with icon */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                          <FileText className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/content/${item.contentId || item.id}`}
                            className="block"
                          >
                            <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors duration-200 line-clamp-2 mb-1">
                              {item.title}
                            </h3>
                          </Link>
                          <p className="text-xs text-gray-500 font-mono">
                            {item.contentId.slice(0, 20)}...
                          </p>
                        </div>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => handleDelete(item.contentId || item.id, e)}
                        disabled={deletingId === (item.contentId || item.id)}
                        className="flex-shrink-0 p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        title="Delete content"
                      >
                        {deletingId === (item.contentId || item.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </motion.button>
                    </div>
                    
                    {/* Info grid */}
                    <div className="grid grid-cols-1 gap-3 mb-4">
                      <div className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50/50 hover:bg-gray-100/50 transition-colors">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                          <User className="h-4 w-4 text-gray-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500 mb-0.5">Author</p>
                          <p className="text-sm font-semibold text-gray-900 truncate">{item.author}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50/50 hover:bg-gray-100/50 transition-colors">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                          <Calendar className="h-4 w-4 text-gray-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500 mb-0.5">Created</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {new Date(item.createdAt).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric' 
                            })}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50/50">
                        <div className="flex-shrink-0">
                          <motion.span
                            whileHover={{ scale: 1.05 }}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm ${getStatusColor(item.status)}`}
                          >
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              item.status === 'completed' ? 'bg-green-600' :
                              item.status === 'failed' || item.status === 'rejected' ? 'bg-red-600' :
                              item.status === 'pending' ? 'bg-yellow-600' :
                              'bg-blue-600'
                            }`}></div>
                            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                          </motion.span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action button */}
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Link
                        href={`/content/${item.contentId || item.id}`}
                        className="flex items-center justify-center gap-2 w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-200 group"
                      >
                        <Eye className="h-4 w-4" />
                        <span>View Details</span>
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </motion.div>
                  </motion.div>
                ))}
              </div>

              {/* Pagination */}
              {filteredContent.length > itemsPerPage && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(filteredContent.length / itemsPerPage)}
                  onPageChange={setCurrentPage}
                  itemsPerPage={itemsPerPage}
                  totalItems={filteredContent.length}
                  onItemsPerPageChange={setItemsPerPage}
                />
              )}
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}

