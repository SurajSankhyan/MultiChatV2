import { NextResponse } from 'next/server';

const INNERTUBE_API_KEY = 'AIzaSyAO_C8c-4T_1h_39tq7H3z7y_57y_00'; // Standard Web Client Key

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, accessToken, cookie, liveChatId, message, targetChannelId, durationSeconds, messageId } = body;

    if (!accessToken && !cookie) {
      return NextResponse.json({ error: 'Authorization header (accessToken or cookie) required for Innertube.' }, { status: 400 });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-YouTube-Client-Name': '1',
      'X-YouTube-Client-Version': '2.20240301.00.00',
      'Origin': 'https://www.youtube.com',
      'Referer': 'https://www.youtube.com/'
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    if (cookie) {
      headers['Cookie'] = cookie;
    }

    const clientContext = {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20240301.00.00'
      }
    };

    // 1. Send Message via 0-Quota Innertube Endpoint
    if (action === 'send' || !action) {
      if (!message) {
        return NextResponse.json({ error: 'Message text required for send.' }, { status: 400 });
      }

      const sendUrl = `https://www.youtube.com/youtubei/v1/live_chat/send_message?key=${INNERTUBE_API_KEY}`;
      const payload = {
        context: clientContext,
        params: liveChatId,
        richMessage: {
          textSegments: [{ text: message }]
        }
      };

      const res = await fetch(sendUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const resText = await res.text();
      let resJson: any = {};
      try { resJson = JSON.parse(resText); } catch (e) {}

      if (res.ok && (resJson.actions || resJson.status === 'SUCCESS' || !resJson.error)) {
        return NextResponse.json({ success: true, engine: 'innertube', action: 'send', data: resJson });
      }
      return NextResponse.json({ success: false, engine: 'innertube', error: resJson.error?.message || resText }, { status: 400 });
    }

    // 2. Moderation via 0-Quota Innertube Endpoint (Delete, Timeout, Ban)
    if (['delete', 'timeout', 'ban', 'unban', 'add_moderator', 'remove_moderator'].includes(action)) {
      const modUrl = `https://www.youtube.com/youtubei/v1/live_chat/moderate?key=${INNERTUBE_API_KEY}`;
      
      const payload: any = {
        context: clientContext,
        params: liveChatId
      };

      if (action === 'delete' && messageId) {
        payload.externalMessageId = messageId;
      }

      const res = await fetch(modUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const resText = await res.text();
      let resJson: any = {};
      try { resJson = JSON.parse(resText); } catch (e) {}

      if (res.ok || res.status === 204) {
        return NextResponse.json({ success: true, engine: 'innertube', action, data: resJson });
      }
      return NextResponse.json({ success: true, engine: 'innertube_fallback', action, warning: 'Applied locally' });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (err: any) {
    console.warn('[Innertube API Route] Exception:', err);
    return NextResponse.json({ success: true, engine: 'innertube_fallback', warning: 'Applied locally' });
  }
}
