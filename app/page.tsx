'use client';

import React from 'react';
import Link from 'next/link';
import { MessageSquare, Zap, ArrowRight, Shield, Sparkles } from 'lucide-react';
import ParticlesComponent from '@/components/ui/particles-bg';
import { motion } from 'framer-motion';

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  React.useEffect(() => {
    const handleKickReturnOrCheckLoggedIn = async () => {
      try {
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const code = urlParams.get('code');
          const state = urlParams.get('state');

          if (code && state) {
            window.location.href = `/api/kick/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
            return;
          }
        }

        const storedUser = localStorage.getItem('prochat_user') || localStorage.getItem('multichat_user');
        const hasToken = typeof window !== 'undefined' && Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        
        if (storedUser || hasToken) {
          setIsLoggedIn(true);
        }

        const { createClient } = await import('@/utils/supabase/client');
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setIsLoggedIn(true);
          window.location.href = '/dashboard';
        }
      } catch (e) {}
    };
    handleKickReturnOrCheckLoggedIn();
  }, []);

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-hidden bg-[#020202]">
      {/* Dynamic Animated Particles Background */}
      <ParticlesComponent />

      {/* Glassmorphic Ambient Glow Lights */}
      <div className="absolute top-[20%] left-[20%] w-[30vw] h-[30vw] rounded-full bg-[radial-gradient(circle,rgba(0,240,255,0.08)_0%,rgba(0,0,0,0)_70%)] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[20%] w-[35vw] h-[35vw] rounded-full bg-[radial-gradient(circle,rgba(169,112,255,0.06)_0%,rgba(0,0,0,0)_70%)] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-2 select-none">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-[#00F0FF] to-[#a970ff] p-[1px] shadow-[0_0_20px_rgba(0,240,255,0.2)]">
            <div className="flex h-full w-full items-center justify-center rounded-xl bg-[#0a0a0f]">
              <MessageSquare className="w-5 h-5 text-[#00F0FF]" />
            </div>
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            MultiChat
          </span>
        </div>
        <div className="text-xs text-slate-500 uppercase tracking-widest font-semibold bg-white/5 border border-white/10 px-3 py-1.5 rounded-full backdrop-blur-md">
          v1.0.0 Stable
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 max-w-4xl mx-auto text-center pointer-events-auto my-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="flex flex-col items-center"
        >
          {/* Badge indicator */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-white/5 to-white/10 border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] text-slate-300 text-xs font-medium mb-6">
            <Sparkles className="w-3.5 h-3.5 text-[#00F0FF]" />
            Your Ultimate Streaming Companion
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-tight select-none">
            Consolidate Your Chats <br />
            <span className="bg-gradient-to-r from-[#00F0FF] via-[#53fc18] to-[#a970ff] bg-clip-text text-transparent filter drop-shadow-[0_2px_15px_rgba(0,240,255,0.15)]">
              Stream Seamlessly
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed font-normal">
            Connect your Twitch, YouTube, and Kick live chats in one unified dashboard. Complete with emotes, Level Badges, TTS queues, and custom overlay setups.
          </p>

          {/* Connect Button */}
          <Link href={isLoggedIn ? "/dashboard" : "/login"} className="group relative">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#00F0FF] via-[#a970ff] to-[#53fc18] opacity-75 blur-md group-hover:opacity-100 transition duration-500 group-hover:duration-200" />
            <button className="relative flex items-center gap-3 px-8 py-4 bg-black rounded-xl text-white font-semibold text-lg border border-white/10 transition-all duration-300 group-hover:bg-[#07070a] group-hover:border-white/20 select-none">
              <span>{isLoggedIn ? "Open Dashboard" : "Connect Channels"}</span>
              <ArrowRight className="w-5 h-5 text-[#00F0FF] transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </Link>
        </motion.div>

        {/* Feature Highlights Grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16 max-w-3xl w-full"
        >
          <div className="flex flex-col items-center p-5 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm select-none">
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-gradient-to-tr from-[#a970ff]/20 to-[#a970ff]/5 border border-[#a970ff]/30 text-[#a970ff] mb-3">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="text-white font-semibold text-sm mb-1">Unified Feeds</h3>
            <p className="text-slate-400 text-xs text-center leading-normal">
              Merge chats from Twitch, Kick, and YouTube into one viewport.
            </p>
          </div>

          <div className="flex flex-col items-center p-5 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm select-none">
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-gradient-to-tr from-[#53fc18]/20 to-[#53fc18]/5 border border-[#53fc18]/30 text-[#53fc18] mb-3">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-white font-semibold text-sm mb-1">Low Latency</h3>
            <p className="text-slate-400 text-xs text-center leading-normal">
              IRC WebSockets & Pusher streams deliver instant interactions.
            </p>
          </div>

          <div className="flex flex-col items-center p-5 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm select-none">
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-gradient-to-tr from-[#00F0FF]/20 to-[#00F0FF]/5 border border-[#00F0FF]/30 text-[#00F0FF] mb-3">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-white font-semibold text-sm mb-1">Secure Auth</h3>
            <p className="text-slate-400 text-xs text-center leading-normal">
              Managed by Supabase secure login flows to protect your dashboard.
            </p>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4 pointer-events-auto">
        <p>© 2026 MultiChat Inc. All rights reserved.</p>
        <div className="flex items-center gap-6">
          <span className="hover:text-slate-300 transition cursor-pointer">Privacy Policy</span>
          <span className="hover:text-slate-300 transition cursor-pointer">Terms of Service</span>
          <span className="hover:text-slate-300 transition cursor-pointer">GitHub Source</span>
        </div>
      </footer>
    </div>
  );
}
