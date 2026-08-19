'use client';

import React, { useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import '@/multichat/index.css';
import { Loader2 } from 'lucide-react';

// Load MultiChat App dynamically to disable Server-Side Rendering
// and show a clean loading fallback while dynamic components load
const MultiChatApp = dynamic(
  () => import('@/multichat/App'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#020202] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#00F0FF] animate-spin mb-4" />
        <p className="text-slate-400 text-sm select-none">Loading dashboard...</p>
      </div>
    )
  }
);

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let mounted = true;
    
    // Check URL search, hash, and cookies for Kick OAuth response parameters
    if (typeof window !== 'undefined') {
      const hashStr = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
      const hashParams = new URLSearchParams(hashStr);
      const searchParams = new URLSearchParams(window.location.search);

      const cookieUser = document.cookie.match(/prochat_kick_username=([^;]+)/)?.[1];
      const cookieToken = document.cookie.match(/prochat_kick_auth_token=([^;]+)/)?.[1];
      const cookieRefreshToken = document.cookie.match(/prochat_kick_refresh_token=([^;]+)/)?.[1];

      const kickUser = searchParams.get('kick_user') || hashParams.get('kick_user') || (cookieUser ? decodeURIComponent(cookieUser) : null);
      const kickToken = searchParams.get('kick_token') || hashParams.get('kick_token') || (cookieToken ? decodeURIComponent(cookieToken) : null);
      const kickRefreshToken = searchParams.get('kick_refresh_token') || hashParams.get('kick_refresh_token') || (cookieRefreshToken ? decodeURIComponent(cookieRefreshToken) : null);

      if (kickUser) localStorage.setItem('prochat_kick_username', kickUser);
      if (kickToken) localStorage.setItem('prochat_kick_auth_token', kickToken);
      if (kickRefreshToken) localStorage.setItem('prochat_kick_refresh_token', kickRefreshToken);
    }

    // Check if user session exists in local storage or cookies
    const hasLocalUser = typeof window !== 'undefined' && Boolean(
      localStorage.getItem('prochat_user') || 
      localStorage.getItem('multichat_user') ||
      localStorage.getItem('prochat_kick_username') ||
      localStorage.getItem('prochat_kick_auth_token') ||
      document.cookie.includes('prochat_kick_username') ||
      Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    );

    if (hasLocalUser) {
      return;
    }

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return;
      if (session?.user) {
        return;
      }
      if (!hasLocalUser) {
        router.push('/login?next=/dashboard');
      }
    }).catch(err => {
      console.warn('[Dashboard] Auth check error:', err);
    });

    return () => {
      mounted = false;
    };
  }, [supabase, router]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    if (typeof window !== 'undefined') {
      localStorage.removeItem('prochat_user');
      localStorage.removeItem('multichat_user');
      localStorage.removeItem('prochat_channels');
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
          localStorage.removeItem(k);
        }
      });
    }
    router.push('/login');
  };

  return <MultiChatApp logout={handleLogout} />;
}
