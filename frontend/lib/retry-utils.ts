/**
 * Retry utility with exponential backoff for API calls
 * Optimized for fast response with proper timeout handling
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableStatuses?: number[];
  timeout?: number; // Request timeout in ms
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 2, // Reduced from 3 for faster failure
  initialDelay: 500, // Reduced from 1000ms for faster retry
  maxDelay: 5000, // Reduced from 30000ms for faster failure
  backoffMultiplier: 1.5, // Reduced from 2 for faster retry
  retryableStatuses: [408, 429, 500, 502, 503, 504], // Timeout, rate limit, server errors
  timeout: 10000, // 10 second timeout per request
};

/**
 * Custom error class for fetch errors with proper message
 */
export class FetchError extends Error {
  status: number;
  statusText: string;
  
  constructor(message: string, status: number, statusText: string) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
    this.statusText = statusText;
  }
}

/**
 * Determines if an error is retryable
 */
function isRetryableError(error: unknown, retryableStatuses: number[]): boolean {
  // Abort errors (timeout) are retryable
  if (error instanceof Error && error.name === 'AbortError') {
    return true;
  }
  
  if (error instanceof TypeError && error.message.includes('fetch')) {
    // Network errors are always retryable
    return true;
  }
  
  // Check if it's a FetchError with a retryable status
  if (error instanceof FetchError) {
    return retryableStatuses.includes(error.status);
  }
  
  return false;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, initialDelay: number, maxDelay: number, multiplier: number): number {
  const delay = initialDelay * Math.pow(multiplier, attempt);
  // Add jitter (±20%) to prevent thundering herd
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  return Math.min(delay + jitter, maxDelay);
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Retry a fetch call with exponential backoff and timeout
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const opts = { ...DEFAULT_OPTIONS, ...retryOptions };
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, opts.timeout);
      
      // If response is not ok and status is retryable, create proper error
      if (!response.ok && opts.retryableStatuses.includes(response.status)) {
        throw new FetchError(
          `HTTP ${response.status}: ${response.statusText || 'Server error'}`,
          response.status,
          response.statusText
        );
      }
      
      // Success or non-retryable error - return response
      return response;
    } catch (error) {
      // Convert abort errors to proper Error with message
      if (error instanceof Error && error.name === 'AbortError') {
        lastError = new Error('Request timeout - server took too long to respond');
      } else if (error instanceof Error) {
        lastError = error;
      } else {
        lastError = new Error('Unknown fetch error');
      }
      
      // Check if error is retryable
      if (!isRetryableError(error, opts.retryableStatuses)) {
        throw lastError;
      }
      
      // If this was the last attempt, throw the error
      if (attempt === opts.maxRetries) {
        throw lastError;
      }
      
      // Calculate delay with exponential backoff
      const delay = calculateDelay(attempt, opts.initialDelay, opts.maxDelay, opts.backoffMultiplier);
      
      // Wait before retrying
      await sleep(delay);
    }
  }
  
  // Should never reach here, but TypeScript needs this
  throw lastError || new Error('Fetch failed after retries');
}

/**
 * Create an AbortController that can be used to cancel requests
 */
export function createAbortController(): AbortController {
  return new AbortController();
}

/**
 * Quick fetch without retry - for polling and non-critical requests
 */
export async function fetchQuick(
  url: string,
  options: RequestInit = {},
  timeout: number = 5000
): Promise<Response> {
  return fetchWithTimeout(url, options, timeout);
}

