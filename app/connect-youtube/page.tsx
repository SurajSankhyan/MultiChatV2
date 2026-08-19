'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, Check, Download, RefreshCw, Terminal, Shield, ShieldAlert, Monitor, Apple, CheckCircle2, Clock, Info, ShieldCheck, Zap, Radio, Sparkles, ChevronRight, Cpu, Lock, Key, ArrowRight, ExternalLink } from 'lucide-react';
import { multichatSupabase as supabase } from '@/lib/supabase';

export default function ConnectYoutubePage() {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 minutes (300s)
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [connectedChannel, setConnectedChannel] = useState<any>(null);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [linkedChannel, setLinkedChannel] = useState<any>(null);

  // Dynamically load authenticated user's email
  useEffect(() => {
    const fetchUserEmail = async () => {
      try {
        const { createClient } = await import('@/utils/supabase/client');
        const client = createClient();
        const { data: { session } } = await client.auth.getSession();
        if (session?.user?.email) {
          setUserEmail(session.user.email);
          return;
        }
        const stored = localStorage.getItem('prochat_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.email) {
            setUserEmail(parsed.email);
            return;
          }
        }
      } catch (e) {}
    };
    fetchUserEmail();
  }, []);

  const handleUnlinkChannel = async () => {
    const channelTitle = linkedChannel?.channel_name || linkedChannel?.custom_handle || 'this channel';
    if (!confirm(`Are you sure you want to unlink ${channelTitle}? This will allow you to connect a different YouTube channel across all your sites.`)) return;
    try {
      await supabase
        .from('Youtube')
        .update({ 
          channel_id: null,
          channel_name: null,
          custom_handle: null,
          youtube_cookie: null,
          youtube_refresh_token: null,
          pairing_code: null,
          code_expires_at: null,
          avatar_url: null,
          total_views: null,
          subscribers: null
        })
        .eq('email', userEmail);

      setLinkedChannel(null);
      setConnectedChannel(null);
      setPairingCode(null);
      alert('Channel unlinked successfully. You can now pair a new YouTube channel.');
    } catch (e) {
      console.warn('Unlink error:', e);
    }
  };

  // Helper to format 8-digit pairing code: XXXX-XXXX (e.g. 7964-9296)
  const generateCodeString = () => {
    const randFour = () => Math.floor(1000 + Math.random() * 9000).toString();
    return `${randFour()}-${randFour()}`;
  };

  // Generate code and save to Supabase
  const handleGenerateCode = async (fromUserAction = false) => {
    if (!userEmail) {
      alert('Please log in to generate a YouTube pairing code.');
      return;
    }
    setIsGenerating(true);
    if (fromUserAction) {
      setIsReconnecting(true);
      setConnectedChannel(null); // Clear connected view to force code card display!
    }
    try {
      const code = generateCodeString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min expiry

      // Save pairing_code & code_expires_at to Supabase Youtube table
      const { data, error } = await supabase
        .from('Youtube')
        .update({ 
          pairing_code: code,
          code_expires_at: expiresAt 
        })
        .eq('email', userEmail)
        .select();

      // If no existing row matched by email, insert a new row
      if (!error && (!data || data.length === 0)) {
        await supabase
          .from('Youtube')
          .insert({
            email: userEmail,
            pairing_code: code,
            code_expires_at: expiresAt
          });
      }

      setPairingCode(code);
      setTimeLeft(300);
      setIsTimerRunning(true); // Timer starts AUTOMATICALLY as soon as code is revealed!
      setCopied(false);
    } catch (err) {
      console.warn('Pairing code generation handler:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Live 5-minute countdown timer
  useEffect(() => {
    if (!pairingCode || !isTimerRunning || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsTimerRunning(false);

          // Nullify expired pairing_code & code_expires_at in Supabase immediately!
          if (userEmail) {
            supabase
              .from('Youtube')
              .update({ 
                pairing_code: null, 
                code_expires_at: null 
              })
              .eq('email', userEmail)
              .then(() => {
                console.log('Expired pairing code nullified in Supabase');
              });
          }

          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [pairingCode, isTimerRunning, timeLeft, userEmail]);

  // Real-time polling listener: check if YouTube channel gets connected or pairing code updated
  useEffect(() => {
    if (!userEmail) return;

    let isSubscribed = true;

    const checkConnectionStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('Youtube')
          .select('channel_id, custom_handle, channel_name, avatar_url, subscribers, total_views, youtube_cookie, youtube_refresh_token, pairing_code, code_expires_at')
          .eq('email', userEmail)
          .maybeSingle();

        if (data && isSubscribed) {
          if (data.channel_name || data.custom_handle || data.channel_id) {
            setLinkedChannel(data);
          } else {
            setLinkedChannel(null);
          }
          const isConnected = Boolean(
            (data.channel_id && data.channel_id !== 'EMPTY') ||
            (data.custom_handle && data.custom_handle !== '@user') ||
            (data.channel_name && data.channel_name !== '@user') ||
            (data.youtube_cookie && data.youtube_cookie.trim().length > 0) ||
            (data.youtube_refresh_token && data.youtube_refresh_token.trim().length > 0)
          );

          if (isConnected) {
            if (isReconnecting) {
              if (!data.pairing_code) {
                setConnectedChannel(data);
                setIsReconnecting(false);
              }
            } else {
              setConnectedChannel(data);
            }
          }

          // If a valid unexpired code exists in Supabase, sync state
          if (data.pairing_code && data.code_expires_at) {
            const expires = new Date(data.code_expires_at).getTime();
            const diffSecs = Math.floor((expires - Date.now()) / 1000);
            if (diffSecs > 0) {
              setPairingCode(data.pairing_code);
              setTimeLeft(diffSecs);
              setIsTimerRunning(true);
            } else {
              setPairingCode(null);
              setTimeLeft(0);
              setIsTimerRunning(false);
            }
          }
        }
      } catch (err) {
        console.warn('Status check warning:', err);
      }
    };

    checkConnectionStatus();
    const interval = setInterval(checkConnectionStatus, 3000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [userEmail, isReconnecting]);

  const formatMinutes = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCopyCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100 flex flex-col items-center justify-between p-4 sm:p-8 lg:p-12 font-sans selection:bg-white selection:text-black relative overflow-hidden">
      
      {/* Background Subtle Grid & Radial Ambient Lighting */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.15]" 
        style={{
          backgroundImage: `linear-gradient(to right, #1F1F24 1px, transparent 1px), linear-gradient(to bottom, #1F1F24 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[300px] bg-white/[0.03] blur-[150px] pointer-events-none rounded-full" />

      {/* Top Left Navigation Bar */}
      <div className="w-full max-w-7xl flex items-center justify-start pt-2 mb-6 relative z-10">
        <Link 
          href="/dashboard"
          className="inline-flex items-center gap-2.5 text-xs font-bold text-zinc-300 hover:text-white bg-zinc-900/90 hover:bg-zinc-800 px-4 py-2.5 rounded-xl border border-zinc-800 transition-all active:scale-95 shadow-md"
        >
          <ArrowLeft size={15} /> Return to Dashboard
        </Link>
      </div>

      {/* Main Hero Container */}
      <main className="w-full max-w-7xl relative z-10 my-auto space-y-10">
        
        {/* Hero Title Section */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Connect Your YouTube Channel
          </h1>

          <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto font-normal leading-relaxed">
            Link your creator account seamlessly using our ultra-lightweight desktop companion application.
          </p>

          {/* Technical Apology Notice Card */}
          <div className="mt-4 inline-flex items-start gap-3 p-4 bg-zinc-900/70 border border-zinc-800 rounded-2xl text-xs text-zinc-300 max-w-2xl text-left shadow-lg backdrop-blur-md">
            <Info size={18} className="text-zinc-300 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              <strong>Technical Notice:</strong> We apologize for the additional companion app step — due to YouTube authentication policies, a quick standalone companion tool is required to securely link your creator channel.
            </span>
          </div>
        </div>

        {/* 3-CARD HORIZONTAL DASHBOARD GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          
          {/* CARD 1: DOWNLOAD COMPANION APP */}
          <div className="bg-[#0A0A0E] border border-zinc-800/90 hover:border-zinc-700/90 rounded-2xl p-6 sm:p-8 shadow-2xl flex flex-col justify-between transition-all group relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            
            <div>
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-mono font-bold text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-lg">STEP 01</span>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2.5 py-1 rounded-full border border-zinc-800">
                  41 KB Standalone
                </span>
              </div>

              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2.5">
                <Monitor size={19} className="text-zinc-300" /> Download Companion
              </h2>

              <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                Download the lightweight companion tool for your operating system to link your YouTube channel cleanly.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <a 
                href="/StreamClips-Connect.exe" 
                download="StreamClips-Connect.exe"
                className="w-full py-3.5 px-4 bg-white text-black hover:bg-zinc-200 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] shadow-lg"
              >
                <Download size={16} /> Windows (.exe)
              </a>

              <button 
                onClick={() => alert('Mac OS support: Download the StreamClips-Connect app and paste the 16-digit code inside.')}
                className="w-full py-3.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-zinc-800 transition-all active:scale-[0.98]"
              >
                <Apple size={16} /> macOS App
              </button>
            </div>
          </div>

          {/* CARD 2: PAIRING PASSCODE & TIMER */}
          <div className="bg-[#0A0A0E] border border-zinc-800/90 hover:border-zinc-700/90 rounded-2xl p-6 sm:p-8 shadow-2xl flex flex-col justify-between transition-all group relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <div>
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-mono font-bold text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-lg">STEP 02</span>
                <button 
                  onClick={() => handleGenerateCode(true)}
                  disabled={isGenerating}
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 font-medium hover:underline disabled:opacity-50"
                >
                  <RefreshCw size={12} className={isGenerating ? "animate-spin" : ""} />
                  {isGenerating ? 'Generating...' : 'Refresh Code'}
                </button>
              </div>

              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2.5">
                <Terminal size={19} className="text-zinc-300" /> Pairing Passcode
              </h2>

              <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                Click <strong>Copy Code</strong> below to copy your pairing passcode and activate the 5-minute timer.
              </p>

              {linkedChannel && (linkedChannel.channel_name || linkedChannel.custom_handle) && (
                <div className="mb-5 p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 flex flex-col gap-3 shadow-xl relative overflow-hidden">
                  <div className="flex items-center gap-3.5">
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-full overflow-hidden border border-zinc-700 bg-zinc-900 flex-shrink-0 shadow-md">
                      {linkedChannel.avatar_url ? (
                        <img 
                          src={linkedChannel.avatar_url} 
                          alt={linkedChannel.channel_name || 'Channel Avatar'} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-white bg-zinc-800 text-sm">
                          {(linkedChannel.channel_name || 'Y').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Channel Details */}
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md">
                          Network Linked Channel
                        </span>
                      </div>
                      <a 
                        href={linkedChannel.channel_id ? `https://www.youtube.com/channel/${linkedChannel.channel_id}` : `https://www.youtube.com/${linkedChannel.custom_handle || ''}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-white hover:text-zinc-300 font-extrabold text-sm transition-colors inline-flex items-center gap-1.5 truncate"
                      >
                        <span>{linkedChannel.channel_name || linkedChannel.custom_handle}</span>
                        {linkedChannel.custom_handle && (
                          <span className="text-xs font-normal text-zinc-400">({linkedChannel.custom_handle})</span>
                        )}
                        <ExternalLink size={13} className="text-zinc-400 flex-shrink-0" />
                      </a>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed border-t border-zinc-900 pt-2.5">
                    📌 Your account is linked to <strong className="text-zinc-200">{linkedChannel.channel_name || linkedChannel.custom_handle}</strong>. Please sign into YouTube as <strong className="text-zinc-200">this channel only</strong> in the Desktop Companion tool. Logging into any other YouTube account will be rejected.
                  </p>
                </div>
              )}
            </div>

            {connectedChannel && !isReconnecting ? (
              <div className="space-y-4">
                {/* Hidden Passcode Banner */}
                <div className="w-full py-6 px-4 bg-[#000000] border border-zinc-800 rounded-xl flex flex-col items-center justify-center text-center space-y-2 shadow-inner">
                  <span className="font-mono text-2xl font-bold tracking-widest text-zinc-600">
                    ****-****
                  </span>
                  <span className="text-xs font-semibold text-zinc-400">
                    Passcode Hidden • Account Already Connected
                  </span>
                </div>

                {/* Info Bar */}
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-center text-xs text-zinc-400">
                  Click <strong>Re-connect / Get New Code</strong> on Card 03 to generate a new passcode.
                </div>
              </div>
            ) : pairingCode ? (
              <div className="space-y-4">
                {/* High-Tech Code Box */}
                <div className="w-full py-4 px-4 bg-[#000000] border border-zinc-700 rounded-xl flex flex-col items-center justify-center gap-3 shadow-inner">
                  <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-widest text-white select-all">
                    {pairingCode}
                  </span>
                  
                  <button 
                    onClick={handleCopyCode}
                    className="w-full py-3 bg-white hover:bg-zinc-200 text-black rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copied to Clipboard!' : 'Copy Code'}
                  </button>
                </div>

                {/* Timer Status Bar */}
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Clock size={14} className={timeLeft > 0 ? "text-white animate-pulse" : "text-zinc-600"} />
                    <span>
                      {timeLeft > 0 ? (
                        <>Valid for: <strong className="text-white font-mono">{formatMinutes(timeLeft)}</strong></>
                      ) : (
                        <span className="text-zinc-400 font-bold">Code Expired</span>
                      )}
                    </span>
                  </div>
                  {timeLeft > 0 && (
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Timer Active
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <button 
                  onClick={() => handleGenerateCode(true)}
                  disabled={isGenerating}
                  className="w-full py-4 bg-white hover:bg-zinc-200 text-black rounded-xl text-xs font-extrabold flex items-center justify-center gap-2.5 transition-all active:scale-95 shadow-lg disabled:opacity-50"
                >
                  {isGenerating ? <RefreshCw size={16} className="animate-spin" /> : <Key size={16} />}
                  {isGenerating ? 'Generating Passcode...' : 'Generate Pairing Passcode'}
                </button>
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-center text-xs text-zinc-400">
                  Click above to generate your secure 8-digit passcode.
                </div>
              </div>
            )}
          </div>

          {/* CARD 3: REAL-TIME VERIFICATION & CONNECTED STATUS */}
          <div className="bg-[#0A0A0E] border border-zinc-800/90 hover:border-zinc-700/90 rounded-2xl p-6 sm:p-8 shadow-2xl flex flex-col justify-between transition-all group relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <div>
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-mono font-bold text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-lg">STEP 03</span>
                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <Radio size={14} className="text-zinc-400 animate-pulse" />
                  <span>Real-Time Sync</span>
                </div>
              </div>

              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2.5">
                <ShieldCheck size={19} className="text-zinc-300" /> Channel Verification
              </h2>

              <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                Paste the code into <strong>StreamClips-Connect.exe</strong> and click <strong>Link Account & Continue</strong>.
              </p>
            </div>

            {connectedChannel && !isReconnecting ? (
              <div className="p-5 bg-zinc-900/90 border border-zinc-700 rounded-xl flex flex-col items-center text-center shadow-lg">
                <div className="w-16 h-16 rounded-full overflow-hidden mb-3 border border-zinc-600 bg-zinc-800 shadow-lg">
                  {connectedChannel.avatar_url ? (
                    <img src={connectedChannel.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-lg text-white">✓</div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-white font-bold text-sm mb-1">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span>✓ Connected in YouTube Connection</span>
                </div>

                <p className="text-xs font-medium text-zinc-300 mb-2">
                  {connectedChannel.channel_name || connectedChannel.custom_handle || '@channel'}
                </p>

                <div className="flex items-center gap-3 text-[11px] text-zinc-400 bg-black/60 px-3.5 py-1.5 rounded-lg border border-zinc-800 mb-4">
                  <span>{connectedChannel.subscribers || 0} Subs</span>
                  <span>•</span>
                  <span>{connectedChannel.total_views || 0} Views</span>
                </div>

                <button 
                  onClick={() => handleGenerateCode(true)}
                  className="w-full py-3 bg-white text-black hover:bg-zinc-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 shadow-md"
                >
                  <RefreshCw size={14} /> Re-connect / Get New Code
                </button>
              </div>
            ) : (
              <div className="p-5 bg-zinc-950/90 border border-zinc-800 rounded-xl flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                  <Lock size={20} />
                </div>

                <span className="text-xs font-bold text-white">Awaiting Passcode Input</span>
                <p className="text-[11px] text-zinc-500 leading-normal">
                  Open StreamClips-Connect.exe, paste your 16-digit code, and click Link Account.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM HORIZONTAL STEP WORKFLOW PROGRESS BAR */}
        <div className="p-6 bg-[#0A0A0E] border border-zinc-800/80 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <Sparkles size={18} className="text-white shrink-0" />
            <div>
              <span className="text-xs font-bold text-white">4-Step Quick Connection Workflow</span>
              <p className="text-[11px] text-zinc-500">Simple setup designed for stream creators</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 text-xs font-mono text-zinc-400 overflow-x-auto w-full md:w-auto">
            <span className="bg-zinc-900 px-3.5 py-1.5 rounded-lg border border-zinc-800">01 Download App</span>
            <ChevronRight size={14} className="text-zinc-600 shrink-0" />
            <span className="bg-zinc-900 px-3.5 py-1.5 rounded-lg border border-zinc-800">02 Copy Passcode</span>
            <ChevronRight size={14} className="text-zinc-600 shrink-0" />
            <span className="bg-zinc-900 px-3.5 py-1.5 rounded-lg border border-zinc-800">03 Enter in App</span>
            <ChevronRight size={14} className="text-zinc-600 shrink-0" />
            <span className="bg-zinc-900 px-3.5 py-1.5 rounded-lg border border-zinc-800 text-white font-bold">04 Verified</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mt-10 pt-4 border-t border-zinc-800/80 text-center text-xs text-zinc-500 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <ShieldCheck size={15} className="text-zinc-400" />
          <span>Single-use 5-minute passcode • Auto-destroyed upon connection</span>
        </div>
        <span>StreamClips Hub © 2026</span>
      </footer>
    </div>
  );
}
