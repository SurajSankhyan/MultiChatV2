export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest } from 'next/server';
import { execFile } from 'child_process';
import util from 'util';

const execFilePromise = util.promisify(execFile);
const curlBin = process.platform === 'win32' ? 'curl.exe' : 'curl';

async function fetchWithCurl(url: string, method = 'GET', body: any = null) {
  try {
    const args = [
      '-s', '-L',
      '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      '-H', 'Accept: application/json',
      '-H', 'Origin: https://kick.com',
      '-H', 'Referer: https://kick.com/'
    ];

    if (method === 'POST') {
      args.push('-X', 'POST', '-H', 'Content-Type: application/json');
      if (body) {
        args.push('-d', JSON.stringify(body));
      }
    }

    args.push(url);

    const { stdout } = await execFilePromise(curlBin, args);
    return JSON.parse(stdout);
  } catch (err: any) {
    console.warn('[Kick Stream Curl Error]:', err.message);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channel = (searchParams.get('channel') || '').toLowerCase().replace(/^@+/, '').trim();
  let chatroomId = searchParams.get('chatroomId');
  let channelId = searchParams.get('channelId');

  if (!channel && !chatroomId) {
    return new Response(JSON.stringify({ error: 'Missing channel or chatroomId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 1. Resolve IDs if missing
  if ((!chatroomId || !channelId) && channel) {
    const chanData = await fetchWithCurl(`https://kick.com/api/v2/channels/${channel}`);
    if (chanData) {
      chatroomId = String(chanData.chatroom?.id || chanData.chatroom_id || chatroomId || '');
      channelId = String(chanData.chatroom?.channel_id || chanData.id || channelId || '');
    }
  }

  if (!chatroomId) {
    return new Response(JSON.stringify({ error: 'Could not resolve Kick chatroom ID' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const encoder = new TextEncoder();
  const clientId = 'c-' + Math.random().toString(36).substring(2, 12);

  // 2. Fetch connection URL and guest token from Kick's official realtime API
  let wsUrl = 'wss://realtime.us-west-2.platform.kick.com/connection/websocket';
  let token = '';

  try {
    const connTargetId = channelId || chatroomId;
    const connRes = await fetchWithCurl(
      `https://web.kick.com/api/v1/realtime/channels/${connTargetId}/chat/connection`,
      'POST',
      {
        client: { id: clientId, type: 'web' },
        capabilities: { accepted_providers: [{ provider: 'centrifugo' }] }
      }
    );

    if (connRes?.data?.connections?.[0]?.credentials?.url) {
      wsUrl = connRes.data.connections[0].credentials.url;
    }

    const tokenRes = await fetchWithCurl(
      'https://web.kick.com/api/v1/realtime/auth/connection',
      'POST',
      { client_id: clientId }
    );

    if (tokenRes?.data?.token) {
      token = tokenRes.data.token;
    }
  } catch (err: any) {
    console.warn('[Kick Stream Creds Fetch Error]:', err.message);
  }

  if (!token) {
    return new Response(JSON.stringify({ error: 'Failed to retrieve Kick realtime connection token' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let ws: WebSocket | null = null;
  let isClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Connect to Kick's Centrifugo WebSocket server
      try {
        // Native Node 22 WebSocket supports custom headers in options
        ws = new WebSocket(wsUrl, {
          headers: {
            Origin: 'https://kick.com',
            Referer: 'https://kick.com/'
          }
        } as any);

        let subId = 2;

        ws.onopen = () => {
          if (isClosed || !ws) return;
          // Step 1: Handshake with Centrifugo
          ws.send(JSON.stringify({
            id: 1,
            connect: { token, name: 'js' }
          }));
        };

        ws.onmessage = (event) => {
          if (isClosed) return;
          const raw = typeof event.data === 'string' ? event.data : String(event.data);

          // Centrifugo heartbeat ping
          if (raw === '{}') {
            try {
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send('{}');
              }
            } catch (e) {}
            return;
          }

          const lines = raw.split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);

              // Step 2: On successful connection, subscribe to chatroom channel
              if (parsed.connect) {
                if (ws && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    id: subId++,
                    subscribe: { channel: `chatrooms.${chatroomId}.v2` }
                  }));
                }
              } else {
                const pub = parsed.push?.pub || parsed.pub;
                if (pub?.data) {
                  // Step 3: Stream chat messages to the frontend client
                  const pubData = pub.data;
                  const ssePayload = {
                    channel: parsed.push?.channel || parsed.channel || `chatrooms.${chatroomId}.v2`,
                    event: pubData.event || 'App\\Events\\ChatMessageEvent',
                    data: pubData.data || pubData
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(ssePayload)}\n\n`));
                }
              }
            } catch (err) {
              // Ignore partial frame parse issues
            }
          }
        };

        ws.onerror = (err: any) => {
          console.warn(`[Kick Centrifugo WS Error for chatroom ${chatroomId}]:`, err?.message || 'WS error');
        };

        ws.onclose = () => {
          if (!isClosed) {
            try {
              controller.close();
            } catch (e) {}
            isClosed = true;
          }
        };

      } catch (err: any) {
        console.error('[Kick Stream WS Launch Error]:', err);
        try {
          controller.close();
        } catch (e) {}
        isClosed = true;
      }
    },
    cancel() {
      isClosed = true;
      if (ws) {
        try {
          ws.close();
        } catch (e) {}
        ws = null;
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
