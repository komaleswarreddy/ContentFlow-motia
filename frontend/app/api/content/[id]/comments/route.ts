import { NextRequest, NextResponse } from 'next/server';

// Route segment config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MOTIA_BACKEND_URL = process.env.MOTIA_BACKEND_URL || 'http://localhost:3000';
const BACKEND_TIMEOUT = 8000; // 8 second timeout

async function fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Content ID is required' },
        { status: 400 }
      );
    }

    const response = await fetchWithTimeout(`${MOTIA_BACKEND_URL}/content/${id}/comments`, {
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
      return NextResponse.json(
        { error: typeof data === 'string' ? data : data.error || 'Failed to fetch comments' },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('API route error:', error);
    
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout', message: 'Backend took too long to respond.' },
        { status: 504 }
      );
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { 
          error: 'Backend connection failed', 
          message: `Unable to connect to Motia backend at ${MOTIA_BACKEND_URL}. Please ensure the backend is running.` 
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch comments', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Content ID is required' },
        { status: 400 }
      );
    }

    const response = await fetchWithTimeout(`${MOTIA_BACKEND_URL}/content/${id}/comments`, {
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
      return NextResponse.json(
        { error: typeof data === 'string' ? data : data.error || 'Failed to add comment' },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('API route error:', error);
    
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout', message: 'Backend took too long to respond.' },
        { status: 504 }
      );
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { 
          error: 'Backend connection failed', 
          message: `Unable to connect to Motia backend at ${MOTIA_BACKEND_URL}. Please ensure the backend is running.` 
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to add comment', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

