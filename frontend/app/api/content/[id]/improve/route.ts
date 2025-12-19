import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MOTIA_BACKEND_URL = process.env.MOTIA_BACKEND_URL || 'http://localhost:3000';
const BACKEND_TIMEOUT = 30000; // 30 second timeout for AI operations

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

export async function POST(request: NextRequest) {
  try {
    const pathname = new URL(request.url).pathname;
    // Expected pattern: /api/content/:id/improve
    const segments = pathname.split('/').filter(Boolean);
    const id = segments[segments.length - 2]; // id is second to last

    if (!id || id === 'content') {
      return NextResponse.json(
        { error: 'Content ID is required' },
        { status: 400 }
      );
    }

    const response = await fetchWithTimeout(`${MOTIA_BACKEND_URL}/content/${id}/improve`, {
      method: 'POST',
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
        { error: typeof data === 'string' ? data : data.error || 'Failed to request improvement' },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('API route error:', error);

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout', message: 'AI improvement took too long. Please try again.' },
        { status: 504 }
      );
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        {
          error: 'Backend connection failed',
          message: `Unable to connect to Motia backend at ${MOTIA_BACKEND_URL}`
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to request improvement', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

