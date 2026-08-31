import { NextRequest, NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
};

// Global in-memory highlight state for cross-window / cross-session / OBS syncing
let globalHighlightState: {
  eventId: string;
  command: 'show' | 'hide';
  data?: any;
  updatedAt: number;
} = {
  eventId: 'initial',
  command: 'hide',
  updatedAt: Date.now()
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders
  });
}

export async function GET(req: NextRequest) {
  return NextResponse.json(
    {
      success: true,
      ...globalHighlightState
    },
    { headers: corsHeaders }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const command = body?.command === 'hide' ? 'hide' : 'show';
    const data = body?.data || null;

    globalHighlightState = {
      eventId: `hl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      command,
      data,
      updatedAt: Date.now()
    };

    return NextResponse.json(
      {
        success: true,
        ...globalHighlightState
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 400, headers: corsHeaders }
    );
  }
}
