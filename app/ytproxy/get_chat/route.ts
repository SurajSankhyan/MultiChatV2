export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';

const DEFAULT_INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Cache-Control': 'no-store, max-age=0'
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders
  });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key') || DEFAULT_INNERTUBE_KEY;
  const targetUrl = `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${encodeURIComponent(key)}`;
  
  try {
    const incomingBody = await request.json().catch(() => ({}));
    const body = {
      ...incomingBody,
      context: {
        ...(incomingBody.context || {}),
        client: {
          clientName: 'WEB',
          clientVersion: '2.20240404.01.00',
          hl: 'en',
          gl: 'US',
          ...(incomingBody.context?.client || {})
        }
      }
    };

    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36');
    headers.set('Accept-Language', 'en-US,en;q=0.9');
    headers.set('Referer', 'https://www.youtube.com/');
    headers.set('Origin', 'https://www.youtube.com');
    headers.set('X-YouTube-Client-Name', '1');
    headers.set('X-YouTube-Client-Version', '2.20240404.01.00');
    headers.set('X-Origin', 'https://www.youtube.com');
    headers.set('Sec-Fetch-Mode', 'cors');
    headers.set('Sec-Fetch-Site', 'same-origin');
    headers.set('Cookie', 'SOCS=CAESEwgDEgk2OTM5NjU2OTIaAmVuIAEaBgiA_LyaBg; PREF=tz=UTC&f6=40000000&hl=en');

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    let data = await res.json();
    
    // --- DELTA FILTERING OPTIMIZATION ---
    if (targetUrl.includes('get_live_chat')) {
      if (data.frameworkUpdates) delete data.frameworkUpdates;
      if (data.responseContext) delete data.responseContext;
      if (data.trackingParams) delete data.trackingParams;
      if (data.mutations) delete data.mutations;
      
      const actions = data.continuationContents?.liveChatContinuation?.actions;
      if (actions) {
        // Recursively strip unneeded YouTube telemetry, accessibility data, and extra thumbnails
        const stripUnneededData = (obj: any) => {
          if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
              stripUnneededData(obj[i]);
            }
          } else if (obj !== null && typeof obj === 'object') {
            delete obj.trackingParams;
            delete obj.accessibility;
            delete obj.accessibilityData;
            delete obj.contextMenuEndpoint;
            delete obj.contextMenuAccessibility;
            
            // Keep only the largest thumbnail (which the client uses) to save massive bandwidth
            if (Array.isArray(obj.thumbnails) && obj.thumbnails.length > 1) {
              obj.thumbnails = [obj.thumbnails[obj.thumbnails.length - 1]];
            }
            
            for (const key in obj) {
              if (Object.prototype.hasOwnProperty.call(obj, key)) {
                stripUnneededData(obj[key]);
              }
            }
          }
        };
        
        stripUnneededData(data.continuationContents.liveChatContinuation.actions);
      }
    }
    // ------------------------------------

    return NextResponse.json(data, { 
      status: res.status,
      headers: corsHeaders
    });
  } catch (err: any) {
    return new NextResponse(err.message, { 
      status: 500,
      headers: corsHeaders
    });
  }
}
