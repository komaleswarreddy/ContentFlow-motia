import { NextRequest, NextResponse } from 'next/server';

// Route segment config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MOTIA_BACKEND_URL = process.env.MOTIA_BACKEND_URL || 'http://localhost:3000';

// Timeout for backend requests (15 seconds)
const BACKEND_TIMEOUT = 15000;

// Helper to fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
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

// Helper to check if error is a connection error
function isConnectionError(error: unknown): boolean {
  if (error instanceof TypeError) {
    const message = error.message.toLowerCase();
    return message.includes('fetch') || 
           message.includes('network') || 
           message.includes('econnrefused') ||
           message.includes('connection');
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('econnrefused') || 
           message.includes('network') ||
           message.includes('connection refused');
  }
  return false;
}

// GET endpoint to list all content (proxies to Motia backend)
export async function GET(request: NextRequest) {
  try {
    // Extract userId from query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    // Build URL with userId query parameter if provided
    let url = `${MOTIA_BACKEND_URL}/content`;
    if (userId) {
      url += `?userId=${encodeURIComponent(userId)}`;
    }
    
    console.log(`[API] Fetching content from: ${url}`);
    
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }, BACKEND_TIMEOUT);

    const contentType = response.headers.get('content-type');
    const data = contentType?.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      console.error(`[API] Backend returned error: ${response.status}`, data);
      return NextResponse.json(
        { error: typeof data === 'string' ? data : data.error || 'Failed to fetch content list' },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[API] Route error:', error);
    
    // Check if it's an abort error (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { 
          error: 'Request timeout', 
          message: 'Backend took too long to respond. Please try again.' 
        },
        { status: 504 }
      );
    }
    
    // Check if it's a connection error
    if (isConnectionError(error)) {
      return NextResponse.json(
        { 
          error: 'Backend connection failed', 
          message: `Unable to connect to Motia backend at ${MOTIA_BACKEND_URL}. Please ensure the backend is running.` 
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch content list', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('[API] Creating content...');
    
    const response = await fetchWithTimeout(`${MOTIA_BACKEND_URL}/content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }, BACKEND_TIMEOUT);

    const contentType = response.headers.get('content-type');
    const data = contentType?.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      console.error(`[API] Backend returned error: ${response.status}`, data);
      return NextResponse.json(
        { error: typeof data === 'string' ? data : data.error || 'Request failed' },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[API] Route error:', error);
    
    // Check if it's an abort error (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { 
          error: 'Request timeout', 
          message: 'Backend took too long to respond. Please try again.' 
        },
        { status: 504 }
      );
    }
    
    // Check if it's a connection error
    if (isConnectionError(error)) {
      return NextResponse.json(
        { 
          error: 'Backend connection failed', 
          message: `Unable to connect to Motia backend at ${MOTIA_BACKEND_URL}. Please ensure the backend is running.` 
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to submit content', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
