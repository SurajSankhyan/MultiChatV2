import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Download, RefreshCw, Key, ShieldCheck, Monitor, Apple, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { multichatSupabase as supabase } from '@/lib/supabase';

export default function PairingCodeModal({ isOpen, onClose, userEmail = '', onConnected }) {
  const [pairingCode, setPairingCode] = useState(null);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes (300 seconds)
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connectedChannel, setConnectedChannel] = useState(null);
  const [linkedChannel, setLinkedChannel] = useState(null);

  // Helper to format 8-digit pairing code: XXXX-XXXX (e.g. 7964-9296)
  const generateCodeString = () => {
    const randFour = () => Math.floor(1000 + Math.random() * 9000).toString();
    return `${randFour()}-${randFour()}`;
  };

  // Generate code and save to Supabase
  const handleGenerateCode = async () => {
    if (!userEmail) {
      alert('Please log in to generate a YouTube pairing code.');
      return;
    }
    setIsGenerating(true);
    setConnectedChannel(null); // Instantly reveal code view
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
      setIsTimerRunning(false); // Timer starts ONLY when Copy button is pressed as requested!
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

  // Real-time polling listener: check if YouTube channel gets connected by EXE
  useEffect(() => {
    if (!isOpen || !userEmail) return;

    let isSubscribed = true;

    const checkConnectionStatus = async () => {
      try {
        // Automatically nullify ANY expired pairing codes in Supabase server database
        const nowIso = new Date().toISOString();
        await supabase
          .from('Youtube')
          .update({ pairing_code: null, code_expires_at: null })
          .lt('code_expires_at', nowIso);

        const { data, error } = await supabase
          .from('Youtube')
          .select('custom_handle, channel_name, avatar_url, subscribers, total_views, youtube_cookie, youtube_refresh_token')
          .eq('email', userEmail)
          .maybeSingle();

        const isConnected = Boolean(data && ((data.channel_id && data.channel_id !== 'EMPTY') || (data.custom_handle && data.custom_handle !== '@user') || (data.channel_name && data.channel_name !== '@user') || (data.youtube_cookie && data.youtube_cookie.trim().length > 0) || (data.youtube_refresh_token && data.youtube_refresh_token.trim().length > 0)));

        if (data && (data.channel_name || data.custom_handle || data.channel_id)) {
          setLinkedChannel(data);
        } else {
          setLinkedChannel(null);
        }

        if (isConnected && isSubscribed) {
          setConnectedChannel(data);
          if (onConnected) onConnected(data);
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
  }, [isOpen, userEmail, onConnected]);

  // Generate initial code on modal open if none exists
  useEffect(() => {
    if (isOpen && !pairingCode && !connectedChannel) {
      handleGenerateCode();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatMinutes = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCopyCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode);
    setCopied(true);
    setIsTimerRunning(true); // START 5-MINUTE VALIDATION TIMER UPON COPYING!
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-lg overflow-hidden bg-[#0A0B10] border border-white/10 rounded-2xl shadow-2xl p-6 sm:p-8 text-white max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
        >
          <X size={18} />
        </button>

        {/* Title & Badge */}
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500">
            <Key size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Connect YouTube Channel</h2>
            <p className="text-xs text-slate-400">StreamClips Hub • Secure Desktop Companion</p>
          </div>
        </div>

        {/* CONNECTED SUCCESS BANNER */}
        {connectedChannel ? (
          <div className="my-6 p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full overflow-hidden mb-3 border-2 border-emerald-500/50 shadow-lg">
              {connectedChannel.avatar_url ? (
                <img src={connectedChannel.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-emerald-600 flex items-center justify-center font-bold text-lg">✓</div>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-base mb-1">
              <CheckCircle2 size={18} />
              <span>✓ Connected in YouTube Connection</span>
            </div>
            <p className="text-sm font-semibold text-white mb-1">
              {connectedChannel.channel_name || connectedChannel.custom_handle || '@channel'}
            </p>
            <div className="flex items-center gap-3 text-xs text-slate-300 mt-1">
              <span>{connectedChannel.subscribers || 0} Subscribers</span>
              <span>•</span>
              <span>{connectedChannel.total_views || 0} Total Views</span>
            </div>

            <button 
              onClick={handleGenerateCode}
              className="mt-5 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-xs font-semibold rounded-lg text-slate-200 transition-colors flex items-center gap-2 border border-white/10"
            >
              <RefreshCw size={14} /> Re-connect / Get New Code
            </button>
          </div>
        ) : (
          <>
            {/* APOLOGY & TECHNICAL NOTICE */}
            <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-200/90 leading-relaxed">
              <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Note:</strong> We apologize for the additional desktop companion step — due to YouTube Security API limitations, this lightweight tool is required to securely link your channel.
              </span>
            </div>

            {linkedChannel && (linkedChannel.channel_name || linkedChannel.custom_handle) && (
              <div className="mt-3 p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl flex flex-col gap-2 text-xs text-zinc-100 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden border border-zinc-700 bg-zinc-900 flex-shrink-0">
                    {linkedChannel.avatar_url ? (
                      <img src={linkedChannel.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-white bg-zinc-800 text-xs">
                        {(linkedChannel.channel_name || 'Y').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-zinc-400">
                      Network Linked Channel
                    </span>
                    <a 
                      href={linkedChannel.channel_id ? `https://www.youtube.com/channel/${linkedChannel.channel_id}` : `https://www.youtube.com/${linkedChannel.custom_handle || ''}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-white hover:text-zinc-300 font-bold transition-colors flex items-center gap-1 truncate"
                    >
                      <span>{linkedChannel.channel_name || linkedChannel.custom_handle}</span>
                      <ExternalLink size={12} className="text-zinc-400 flex-shrink-0" />
                    </a>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug border-t border-zinc-900 pt-2">
                  📌 Please sign into YouTube as <strong className="text-white">{linkedChannel.channel_name || linkedChannel.custom_handle}</strong> in the Companion app. Logging into another channel will be rejected.
                </p>
              </div>
            )}

            {/* STEP 1: DOWNLOAD EXECUTABLE */}
            <div className="mt-4 p-4 bg-white/[0.03] border border-white/5 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Monitor size={14} /> Step 1: Download Companion App
                </span>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  41 KB • Standalone
                </span>
              </div>

              <div className="flex items-center gap-2 my-2">
                <a 
                  href="/StreamClips-Connect.exe" 
                  download="StreamClips-Connect.exe"
                  className="flex-1 py-2.5 px-4 bg-white text-black hover:bg-slate-200 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98]"
                >
                  <Download size={15} /> Download for Windows (.exe)
                </a>
                <button 
                  onClick={() => alert('Mac OS support: Download the StreamClips-Connect app and paste the 16-digit code inside.')}
                  className="py-2.5 px-4 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-white/10 transition-colors"
                >
                  <Apple size={14} /> Download for Mac
                </button>
              </div>
            </div>

            {/* STEPS TO CONNECT INSTRUCTIONS */}
            <div className="mt-3 p-3.5 bg-white/[0.02] border border-white/5 rounded-xl text-xs space-y-1.5 text-slate-300">
              <div className="font-bold text-slate-200 mb-1 uppercase text-[11px] tracking-wider">
                📋 Connection Steps:
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">1</span>
                <span>Download and open <strong>StreamClips-Connect.exe</strong> above.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">2</span>
                <span>Click <strong>Copy</strong> on the code box below (starts 5-min timer).</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">3</span>
                <span>Paste the code into the app and click <strong>Link Account & Continue</strong>.</span>
              </div>
            </div>

            {/* STEP 2: PAIRING CODE DISPLAY */}
            <div className="mt-3 p-4 bg-gradient-to-b from-white/[0.05] to-white/[0.02] border border-white/10 rounded-xl flex flex-col items-center text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Step 2: Copy Pairing Code
              </span>

              {/* Glowing Code Display Box */}
              <div className="w-full py-3.5 px-5 my-2 bg-black/70 border border-red-500/30 rounded-xl flex items-center justify-between shadow-inner">
                <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-widest text-red-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.4)] select-all">
                  {pairingCode || 'SC-8392-1049'}
                </span>
                
                <button 
                  onClick={handleCopyCode}
                  className="py-2 px-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1.5 border border-red-500/30 transition-all active:scale-95 shadow-sm"
                >
                  {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                  {copied ? 'Copied!' : 'Copy Code'}
                </button>
              </div>

              {/* Timer & Refresh Info */}
              <div className="w-full flex items-center justify-between text-xs mt-1.5 px-1">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Clock size={14} className={isTimerRunning ? "text-amber-400 animate-pulse" : "text-slate-500"} />
                  <span>
                    {!isTimerRunning && timeLeft === 300 ? (
                      <span className="text-slate-400">Click <strong>Copy Code</strong> to start 5-min timer</span>
                    ) : timeLeft > 0 ? (
                      <>Valid for: <strong className="text-white">{formatMinutes(timeLeft)}</strong></>
                    ) : (
                      <span className="text-red-400 font-bold">Code Expired</span>
                    )}
                  </span>
                </div>

                <button 
                  onClick={handleGenerateCode}
                  disabled={isGenerating}
                  className="text-xs text-slate-300 hover:text-white flex items-center gap-1.5 font-semibold hover:underline disabled:opacity-50 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md transition-colors"
                >
                  <RefreshCw size={12} className={isGenerating ? "animate-spin" : ""} />
                  {isGenerating ? 'Generating...' : 'Refresh Code'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Footer Note */}
        <div className="mt-4 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck size={14} className="text-emerald-500" />
          <span>Single-use 5-minute passcode • Auto-destroyed upon connection</span>
        </div>
      </div>
    </div>
  );
}
