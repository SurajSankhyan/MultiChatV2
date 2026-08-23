import { NextResponse } from 'next/server';
import { asSupabase as supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: rows, error } = await supabase
      .from('Youtube')
      .select('id, email, channel_id, custom_handle, channel_name, avatar_url');

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const channels = (rows || []).map((r: any) => ({
      id: r.id,
      email: r.email,
      channelId: r.channel_id,
      handle: r.custom_handle || r.email,
      name: r.channel_name || r.custom_handle || r.email,
      avatarUrl: r.avatar_url
    }));

    return NextResponse.json({ success: true, channels });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
