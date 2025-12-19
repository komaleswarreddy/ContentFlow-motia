import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MOTIA_BACKEND_URL = process.env.MOTIA_BACKEND_URL || 'http://localhost:3000';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Content ID is required' }, { status: 400 });
    }

    const response = await fetch(`${MOTIA_BACKEND_URL}/content/${id}/apply-improvement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to apply improvement' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Apply improvement error:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Backend unavailable', message: `Cannot connect to ${MOTIA_BACKEND_URL}` },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to apply improvement' },
      { status: 500 }
    );
  }
}

