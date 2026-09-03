// Clean up one-time OAuth query parameters ('code', 'next') from the URL immediately on load
const urlObj = new URL(window.location.href);
if (urlObj.searchParams.has('code') || urlObj.searchParams.has('next')) {
  urlObj.searchParams.delete('code');
  urlObj.searchParams.delete('next');
  window.history.replaceState(null, document.title, urlObj.pathname + urlObj.search + urlObj.hash);
}

// Capture and clear hash immediately before Supabase client initializes
const capturedHash = window.location.hash;
let globalProviderToken = null;
let isConnectingYoutube = false;
let ytProviderToken = null;

console.log('[DEBUG] Start of 3d-demo.js. Current hash:', capturedHash);

// Check if connect_youtube is in query params (preserved through redirect callback)
const urlParamsForYT = new URLSearchParams(window.location.search);
let ytProviderRefreshToken = null;
if (urlParamsForYT.has('connect_youtube')) {
  isConnectingYoutube = true;
  window.isLinkingYoutube = true; // Prevents background reload during link
  if (capturedHash) {
    const hashParams = new URLSearchParams(capturedHash.substring(1));
    ytProviderToken = hashParams.get('provider_token');
    ytProviderRefreshToken = hashParams.get('provider_refresh_token');
  }
  // Clean up connect_youtube query param from address bar
  urlParamsForYT.delete('connect_youtube');
  const newSearch = urlParamsForYT.toString();
  window.history.replaceState(null, document.title, window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash);
}

if (capturedHash) {
  const params = new URLSearchParams(capturedHash.substring(1));
  globalProviderToken = params.get('provider_token');
}

if (capturedHash && (capturedHash.includes('access_token=') || capturedHash.includes('id_token='))) {
  console.log('[DEBUG] Access token detected in hash. Clearing hash to prevent client auto-processing.');
  // Clear hash immediately from the browser URL so Project 2's Supabase client doesn't try to auto-process it
  const cleanUrlObj = new URL(window.location.href);
  cleanUrlObj.hash = '';
  window.history.replaceState(null, document.title, cleanUrlObj.pathname + cleanUrlObj.search);
}

/* ================= SUPABASE CONFIG ================= */
const AUTH_SUPABASE_URL = 'https://bwwdzkhtnaepamsfivds.supabase.co';
const AUTH_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3d2R6a2h0bmFlcGFtc2ZpdmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzUxNjMsImV4cCI6MjA5ODQxMTE2M30.60vipeZzzdplww-8fuRD_LYvQ-2oawfNm-kx2ur3So0';

const DB_SUPABASE_URL = 'https://ashezgjtjmtdchkrcuyx.supabase.co';
const DB_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzaGV6Z2p0am10ZGNoa3JjdXl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NTM0NjEsImV4cCI6MjA5ODMyOTQ2MX0.5-kaqg52jWFo_3nhxbYhqdl7tl9lKianNO-pql2y9-8';

// Initialize auth client pointing to Central Auth Project
const authSupabase = window.supabase.createClient(AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY, {
  auth: {
    detectSessionInUrl: false,
    persistSession: true
  }
});

// Initialize database client pointing to YT Timestamp Project
let storedToken = localStorage.getItem('streamclips_token');
let supabase;

function initSupabaseClient(token) {
  if (token) {
    supabase = window.supabase.createClient(DB_SUPABASE_URL, DB_SUPABASE_ANON_KEY, {
      auth: {
        detectSessionInUrl: false,
        persistSession: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
  } else {
    supabase = window.supabase.createClient(DB_SUPABASE_URL, DB_SUPABASE_ANON_KEY, {
      auth: {
        detectSessionInUrl: false,
        persistSession: false
      }
    });
  }
}

initSupabaseClient(storedToken);

const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '[::1]' || window.location.protocol === 'file:'
  ? 'http://localhost:3000'
  : 'https://yt-timestamp-central-auth-project.onrender.com';

console.log('[DEBUG] isConnectingYoutube:', isConnectingYoutube, 'ytProviderToken length:', ytProviderToken ? ytProviderToken.length : 0);

// If we are connecting YouTube, trigger the backend link API immediately
if (isConnectingYoutube) {
  const userId = localStorage.getItem('temp_link_user_id');
  const email = localStorage.getItem('temp_link_user_email');
  console.log('[DEBUG] temp_link_user_id:', userId, 'temp_link_user_email:', email);

  if (!ytProviderToken) {
    alert('Failed to connect: Google did not return a valid provider token. Please try again.');
  } else if (!userId || !email) {
    alert('Failed to connect: Login session context was lost. Please sign in again and retry.');
  } else {
    console.log('[Connect YouTube] Processing connection via backend...');
    fetch(`${BACKEND_URL}/api/link-youtube`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        email,
        providerToken: ytProviderToken,
        refreshToken: ytProviderRefreshToken
      })
    })
    .then(async res => {
      const isJson = res.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await res.json() : null;
      if (!res.ok) {
        throw new Error(data?.error || `HTTP error ${res.status}`);
      }
      return data;
    })
    .then(data => {
      if (data && data.success) {
        alert('YouTube channel successfully connected: ' + data.channelName);
        localStorage.removeItem('temp_link_user_id');
        localStorage.removeItem('temp_link_user_email');
        window.location.reload();
      } else {
        alert('Failed to connect YouTube channel: ' + (data?.error || 'Unknown error'));
      }
    })
    .catch(err => {
      console.error('[Connect YouTube] Error connecting channel:', err);
      alert('Failed to connect YouTube channel: ' + err.message);
    });
  }
}

const AVATAR_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMTUwIDE1MCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzFlMjkzYiIvPjxjaXJjbGUgY3g9Ijc1IiBjeT0iNzUiIHI9IjQwIiBmaWxsPSIjNDc1NTY5Ii8+PC9zdmc+';

function getHighQualityAvatarUrl(url) {
  if (!url) return AVATAR_PLACEHOLDER;
  let highResUrl = url.replace(/=s\d+/, '=s800');
  highResUrl = highResUrl.replace(/sz=\d+/, 'sz=800');
  highResUrl = highResUrl.replace(/\/s\d+-c/, '/s800-c');
  highResUrl = highResUrl.replace(/\/s\d+(-[a-zA-Z0-9_-]+)*\//, '/s800/');
  return highResUrl;
}

// Global state
let isScrolling = false;
let currentUser = null;
let isAdmin = false;
let currentUserChannelId = null;
let currentUserHandle = null;

// Dynamic configuration based on environment (login is served on same origin)
const MAIN_WEBSITE_URL = window.location.origin;

async function handleTokenSwapCallback(hash) {
  console.log('[DEBUG] handleTokenSwapCallback called with hash:', hash);
  if (window.isLinkingYoutube) {
    console.log('[DEBUG] YouTube linking in progress. Deferring token swap.');
    return;
  }
  if (hash && (hash.includes('access_token=') || hash.includes('id_token='))) {
    const params = new URLSearchParams(hash.substring(1));
    const project1Token = params.get('access_token');
    console.log('[DEBUG] Extracted Project 1 Access Token:', project1Token ? project1Token.substring(0, 15) + '...' : 'none');
    if (!project1Token) return;

    const BRIDGE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:54321/functions/v1/swap-token'
      : 'https://ashezgjtjmtdchkrcuyx.supabase.co/functions/v1/swap-token';

    try {
      console.log('Swapping token...');
      const swapRes = await fetch(BRIDGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${project1Token}`
        }
      });

      if (!swapRes.ok) {
        const errData = await swapRes.json();
        throw new Error(errData.error || 'Token swap bridge failed');
      }

      const swapData = await swapRes.json();
      
      const refresh_token = params.get('refresh_token');
      if (refresh_token) {
        localStorage.setItem('streamclips_p1_refresh_token', refresh_token);
      }
      
      localStorage.setItem('streamclips_token', swapData.access_token);
      localStorage.setItem('streamclips_user', JSON.stringify(swapData.user));
      
      console.log('Token swap successful!');
      window.location.reload();
    } catch (err) {
      console.error('Token swap error:', err);
      alert('Login failed: ' + err.message);
    }
  }
}

const PROJECT_1_URL = 'https://bwwdzkhtnaepamsfivds.supabase.co';
const PROJECT_1_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3d2R6a2h0bmFlcGFtc2ZpdmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzUxNjMsImV4cCI6MjA5ODQxMTE2M30.60vipeZzzdplww-8fuRD_LYvQ-2oawfNm-kx2ur3So0';

function getJwtExpiry(token) {
  if (!token) return 0;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    const payload = JSON.parse(jsonPayload);
    return payload.exp || 0;
  } catch (e) {
    return 0;
  }
}

async function refreshSessionIfNeeded() {
  const token = localStorage.getItem('streamclips_token');
  const p1RefreshToken = localStorage.getItem('streamclips_p1_refresh_token');
  if (!token || !p1RefreshToken) return;

  const expiry = getJwtExpiry(token);
  const currentTime = Math.floor(Date.now() / 1000);
  
  // Refresh if token expires in less than 5 minutes (300 seconds)
  if (expiry > 0 && expiry - currentTime < 300) {
    console.log('[DEBUG] Token is close to expiring. Refreshing session...');
    try {
      const refreshRes = await fetch(`${PROJECT_1_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': PROJECT_1_ANON_KEY
        },
        body: JSON.stringify({
          refresh_token: p1RefreshToken
        })
      });

      if (!refreshRes.ok) {
        throw new Error('Project 1 token refresh request failed');
      }

      const refreshData = await refreshRes.json();
      const newP1AccessToken = refreshData.access_token;
      const newP1RefreshToken = refreshData.refresh_token;

      if (newP1RefreshToken) {
        localStorage.setItem('streamclips_p1_refresh_token', newP1RefreshToken);
      }

      const BRIDGE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:54321/functions/v1/swap-token'
        : 'https://ashezgjtjmtdchkrcuyx.supabase.co/functions/v1/swap-token';

      const swapRes = await fetch(BRIDGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${newP1AccessToken}`
        }
      });

      if (!swapRes.ok) {
        throw new Error('Token swap bridge failed during refresh');
      }

      const swapData = await swapRes.json();
      localStorage.setItem('streamclips_token', swapData.access_token);
      localStorage.setItem('streamclips_user', JSON.stringify(swapData.user));
      console.log('[DEBUG] Session refreshed successfully in the background!');
      
      // Update global supabase client headers
      initSupabaseClient(swapData.access_token);

      // Update UI auth state dynamically if the auth script has initialized
      if (typeof window.refreshAuthUI === 'function') {
        window.refreshAuthUI();
      }
    } catch (err) {
      console.error('[DEBUG] Failed to refresh token in background:', err);
    }
  }
}

// Run swap listener and refresh scheduler on load
handleTokenSwapCallback(capturedHash);
const refreshPromise = refreshSessionIfNeeded();
setInterval(refreshSessionIfNeeded, 60000);

/* ================= 🎬 VIDEO SMOOTH SCRUBBING & SCROLL ANIMATIONS ================= */
const canvas = document.getElementById('scrubCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const frames = [];
let totalFrames = 0;
let isLoaded = false;
let videoDuration = 8; // fallback duration in seconds

const FPS = 15; // 15fps provides excellent scroll smoothness with half the memory/CPU footprint
const frameDuration = 1 / FPS;

// Shared frame drawing helper that handles responsive canvas scaling (object-cover)
function drawSingleFrame(frame) {
  if (!canvas || !ctx || !frame) return;
  
  // Guard against drawing un-decoded video frames that would render transparent/blank
  if (frame instanceof HTMLVideoElement && frame.readyState < 3) {
    return;
  }
  
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const imageWidth = frame.videoWidth || frame.width || 1920;
  const imageHeight = frame.videoHeight || frame.height || 1080;
  
  const canvasRatio = canvasWidth / canvasHeight;
  const imageRatio = imageWidth / imageHeight;
  
  let drawWidth, drawHeight, drawX, drawY;
  
  if (canvasRatio > imageRatio) {
    drawWidth = canvasWidth;
    drawHeight = canvasWidth / imageRatio;
    drawX = 0;
    drawY = (canvasHeight - drawHeight) / 2;
  } else {
    drawWidth = canvasHeight * imageRatio;
    drawHeight = canvasHeight;
    drawX = (canvasWidth - drawWidth) / 2;
    drawY = 0;
  }
  
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.drawImage(frame, drawX, drawY, drawWidth, drawHeight);
}

// Source video file
const videoSourceUrl = '3D/test_v3.mp4';

// Load first frame placeholder image instantly (takes <50ms)
const placeholderImg = new Image();
placeholderImg.src = '3D/first_frame.jpg';
placeholderImg.onload = () => {
  if (frames.length === 0 || !frames[0]) {
    frames[0] = placeholderImg;
    resizeCanvas();
    drawSingleFrame(placeholderImg);
    if (canvas) {
      canvas.style.opacity = '0.9';
    }
  }
};

const instantVideo = document.getElementById('preload-video') || document.createElement('video');
instantVideo.muted = true;
instantVideo.playsInline = true;
instantVideo.preload = 'auto';

// Ensure the video element is connected to the DOM (some browsers won't decode detached video elements)
if (!instantVideo.parentNode) {
  instantVideo.style.position = 'absolute';
  instantVideo.style.top = '-9999px';
  instantVideo.style.left = '-9999px';
  instantVideo.style.width = '320px';
  instantVideo.style.height = '180px';
  instantVideo.style.opacity = '0';
  instantVideo.style.pointerEvents = 'none';
  document.body.appendChild(instantVideo);
}

// Persistent seeked listener for the scroll fallback to prevent flicker
instantVideo.addEventListener('seeked', () => {
  const targetTimeVal = currentPercent * videoDuration;
  const targetIndex = Math.floor(targetTimeVal / frameDuration);
  
  if (typeof instantVideo.requestVideoFrameCallback === 'function') {
    instantVideo.requestVideoFrameCallback(() => {
      if (frames.length === 0 || !frames[targetIndex]) {
        drawSingleFrame(instantVideo);
      }
    });
  } else {
    requestAnimationFrame(() => {
      if (frames.length === 0 || !frames[targetIndex]) {
        drawSingleFrame(instantVideo);
      }
    });
  }
});

const handleMetadataLoaded = () => {
  videoDuration = instantVideo.duration || 8.0;
  totalFrames = Math.floor(videoDuration * FPS);
  
  // Kick off decoder pipeline by playing and pausing immediately
  instantVideo.play().then(() => {
    instantVideo.pause();
    setTimeout(startIncrementalExtraction, 300);
  }).catch(err => {
    console.warn("Failed to play/pause instantVideo:", err);
    setTimeout(startIncrementalExtraction, 300);
  });
};

// Scroll detection to pause background extraction during user scrolling
let isUserScrolling = false;
let extractionScrollTimeout = null;

window.addEventListener('scroll', () => {
  isUserScrolling = true;
  if (extractionScrollTimeout) clearTimeout(extractionScrollTimeout);
  extractionScrollTimeout = setTimeout(() => {
    isUserScrolling = false;
  }, 100);
}, { passive: true });

// Incremental extraction logic that runs on a separate isolated video element to avoid seeking conflicts
function startIncrementalExtraction() {
  const tempVideo = document.createElement('video');
  tempVideo.muted = true;
  tempVideo.playsInline = true;
  tempVideo.preload = 'auto';
  
  // Connect to DOM to guarantee decoding in all browsers
  tempVideo.style.position = 'absolute';
  tempVideo.style.top = '-9999px';
  tempVideo.style.left = '-9999px';
  tempVideo.style.width = '320px';
  tempVideo.style.height = '180px';
  tempVideo.style.opacity = '0';
  tempVideo.style.pointerEvents = 'none';
  document.body.appendChild(tempVideo);

  tempVideo.src = videoSourceUrl;

  tempVideo.addEventListener('loadedmetadata', () => {
    // If requestVideoFrameCallback is supported, use sequential play-based caching for 10x speed and 0ms seek latency
    if (typeof tempVideo.requestVideoFrameCallback === 'function') {
      tempVideo.playbackRate = 2.0; // Decode at 2x speed for ultra-fast sequential caching (completes in 4 seconds)
      
      const captureFrameCallback = (now, metadata) => {
        // Slow down background decoding during scroll events to preserve 100% CPU priority for scrolling
        if (isUserScrolling) {
          tempVideo.playbackRate = 0.5;
        } else {
          tempVideo.playbackRate = 2.0;
        }
        
        const mediaTime = metadata.mediaTime;
        const index = Math.floor(mediaTime / frameDuration);
        
        if (index >= 0 && index < totalFrames && !frames[index]) {
          const offscreen = document.createElement('canvas');
          offscreen.width = tempVideo.videoWidth || 1920;
          offscreen.height = tempVideo.videoHeight || 1080;
          const oCtx = offscreen.getContext('2d');
          oCtx.drawImage(tempVideo, 0, 0, offscreen.width, offscreen.height);
          
          createImageBitmap(offscreen).then(bitmap => {
            frames[index] = bitmap;
          }).catch(() => {
            frames[index] = offscreen;
          });
        }
        
        if (!tempVideo.paused && !tempVideo.ended) {
          tempVideo.requestVideoFrameCallback(captureFrameCallback);
        }
      };
      
      tempVideo.play().then(() => {
        tempVideo.requestVideoFrameCallback(captureFrameCallback);
      }).catch(err => {
        console.warn("Failed to play tempVideo for sequential extraction, falling back to seek:", err);
        runSeekFallback();
      });
      
      tempVideo.addEventListener('ended', () => {
        console.log("Sequential extraction complete. Cached:", frames.filter(Boolean).length);
        isLoaded = true;
        tempVideo.remove();
      });
    } else {
      runSeekFallback();
    }
    
    function runSeekFallback() {
      // Play and pause immediately to initialize decoder
      tempVideo.play().then(() => {
        tempVideo.pause();
        startExtraction();
      }).catch(err => {
        console.warn("Failed to play/pause tempVideo:", err);
        startExtraction();
      });

      function startExtraction() {
        let currentSeekTime = frameDuration;
        
        function extractNextFrame() {
          if (currentSeekTime >= videoDuration) {
            console.log("All frames extracted. Total:", frames.length);
            isLoaded = true;
            tempVideo.remove();
            return;
          }
          
          if (isUserScrolling) {
            setTimeout(extractNextFrame, 80);
            return;
          }
          
          tempVideo.currentTime = currentSeekTime;
        }

        tempVideo.addEventListener('seeked', function onExtractionSeek() {
          const captureTime = currentSeekTime;
          
          const processFrame = () => {
            const offscreen = document.createElement('canvas');
            offscreen.width = tempVideo.videoWidth || 1920;
            offscreen.height = tempVideo.videoHeight || 1080;
            const oCtx = offscreen.getContext('2d');
            oCtx.drawImage(tempVideo, 0, 0, offscreen.width, offscreen.height);
            
            createImageBitmap(offscreen).then(bitmap => {
              const index = Math.floor(captureTime / frameDuration);
              if (index >= 0) {
                frames[index] = bitmap;
              }
              
              currentSeekTime += frameDuration;
              setTimeout(extractNextFrame, 8);
            }).catch(err => {
              console.error("Extraction frame error:", err);
              const index = Math.floor(captureTime / frameDuration);
              if (index >= 0) {
                frames[index] = offscreen;
              }
              currentSeekTime += frameDuration;
              setTimeout(extractNextFrame, 8);
            });
          };

          requestAnimationFrame(processFrame);
        });

        extractNextFrame();
      }
    }
  });

  tempVideo.load();
}

// Start loading the video immediately on script execution
instantVideo.src = videoSourceUrl;
if (instantVideo.readyState >= 1) {
  handleMetadataLoaded();
} else {
  instantVideo.addEventListener('loadedmetadata', handleMetadataLoaded);
}
instantVideo.load();

function resizeCanvas() {
  if (canvas) {
    canvas.width = canvas.clientWidth || window.innerWidth;
    canvas.height = canvas.clientHeight || window.innerHeight;
  }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Mock video object to keep existing reference code happy
const video = {
  get duration() { return videoDuration; },
  currentTime: 0,
  paused: true,
  play: function() {
    this.paused = false;
    return Promise.resolve();
  },
  pause: function() {
    this.paused = true;
  },
  error: null,
  networkState: 1,
  readyState: 4,
  addEventListener: function() {},
  removeEventListener: function() {},
  load: function() {}
};
const introTitle = document.getElementById('introTitle');
const scrollIndicator = document.getElementById('scrollIndicator');
const copyBtn = document.getElementById('copy-btn-3d');
const setupCommand = document.getElementById('setup-command-3d');
const debugEl = document.getElementById('videoDebug');
const typingTitleContainer = document.getElementById('typingTitleContainer');
const disperseWord = document.getElementById('disperseWord');

let targetPercent = 0;
let currentPercent = 0;
let lastSeekTime = 0;
const lerpFactor = 0.08; // Smooth, premium easing factor (cinematic glide inertia)
const seekThrottleMs = 30; // Seek at most ~33 times per second to prevent hardware lag

let activeCreatorsList = [];

const defaultCreators = [
  { name: "CarryMinati", thumbnail: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=100&q=80" },
  { name: "MrBeast", thumbnail: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80" },
  { name: "Triggered Insaan", thumbnail: "https://images.unsplash.com/photo-1527983359383-4758693f760c?auto=format&fit=crop&w=100&q=80" },
  { name: "Techno Gamerz", thumbnail: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=100&q=80" },
  { name: "Scout", thumbnail: "https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=100&q=80" },
  { name: "Dynamo Gaming", thumbnail: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80" },
];

const notificationsConfig = [
  // Left side: 3 notifications (unaligned, pushed to edges)
  { text: "!clip savage", side: "left", top: "18%", left: "2%", delay: 100 },
  { text: "!clip monkey dance", side: "left", top: "45%", left: "5%", delay: 300 },
  { text: "!clip 1v5 clutch", side: "left", top: "72%", left: "3%", delay: 500 },

  // Right side: 3 notifications (unaligned, pushed to edges)
  { text: "!clip $100,000 challenge", side: "right", top: "24%", right: "2%", delay: 200 },
  { text: "!clip happy birthday", side: "right", top: "52%", right: "4%", delay: 400 },
  { text: "!clip Happy Birthday Dance", side: "right", top: "80%", right: "3%", delay: 600 },
];

const notificationsContainer = document.getElementById('laptopNotifications');
let notificationsTriggered = false;

// Create notifications DOM elements on load, but keep them hidden
function initNotifications() {
  if (!notificationsContainer) return;
  
  const listToUse = activeCreatorsList.length > 0 ? activeCreatorsList : defaultCreators;
  const existingCards = notificationsContainer.children;
  
  // If cards already exist in DOM, update their image and name in-place to prevent layout flashes/resets
  if (existingCards.length === notificationsConfig.length) {
    notificationsConfig.forEach((config, idx) => {
      const el = existingCards[idx];
      const creator = listToUse[idx % listToUse.length];
      const creatorName = creator.name || creator.channel_name || "Creator";
      const creatorThumbnail = getHighQualityAvatarUrl(creator.thumbnail || creator.avatar_url);
      
      const img = el.querySelector('img');
      if (img) {
        img.src = creatorThumbnail;
        img.alt = creatorName;
      }
      const nameSpan = el.querySelector('span.text-\\[12px\\]');
      if (nameSpan) {
        nameSpan.textContent = creatorName;
      }
    });
    return;
  }

  notificationsContainer.innerHTML = '';
  notificationsTriggered = false; // Reset flag to allow fresh DOM elements to animate in
  
  notificationsConfig.forEach((config, idx) => {
    const el = document.createElement('div');
    el.className = `notification-item side-${config.side}`;
    
    // Position
    el.style.top = config.top;
    if (config.side === 'left') {
      el.style.left = config.left;
    } else {
      el.style.right = config.right;
    }
    
    // Retrieve creator details safely inside loop
    const creator = listToUse[idx % listToUse.length];
    const creatorName = creator.name || creator.channel_name || "Creator";
    const creatorThumbnail = getHighQualityAvatarUrl(creator.thumbnail || creator.avatar_url);
    
    el.innerHTML = `
      <!-- Creator Avatar DP instead of Message Icon -->
      <div class="w-9 h-9 rounded-full overflow-hidden border border-white/10 flex-shrink-0 shadow-sm">
        <img src="${creatorThumbnail}" alt="${creatorName}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='${AVATAR_PLACEHOLDER}';" />
      </div>
      <!-- Text Content Area -->
      <div class="flex-grow flex flex-col justify-center min-w-0 pr-8 relative">
        <span class="text-[12px] font-bold text-white truncate">${creatorName}</span>
        <span class="text-[11px] text-zinc-300 font-medium font-sans truncate mt-0.5">${config.text}</span>
        <!-- Timestamp 'now' -->
        <span class="absolute right-0 top-1 text-[10px] text-zinc-500 font-medium">now</span>
      </div>
    `;
    
    notificationsContainer.appendChild(el);
    // Force a browser reflow to register initial transform/opacity state before active class triggers transition
    void el.offsetHeight;
  });

  // Post-init check: if user is already at the scroll threshold, trigger the animation immediately
  const scrollPos = window.scrollY;
  const viewportHeight = window.innerHeight;
  if (scrollPos >= viewportHeight * 1.8 && scrollPos < viewportHeight * 2.5) {
    showNotifications();
  }
}

function showNotifications() {
  if (notificationsTriggered) return;
  notificationsTriggered = true;
  
  // Wait for the browser to paint the initial off-screen state first
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!notificationsTriggered) return; // Guard if user scrolled back up during frame delay
      
      const items = notificationsContainer.children;
      for (let i = 0; i < items.length; i++) {
        const config = notificationsConfig[i];
        const el = items[i];
        setTimeout(() => {
          if (!notificationsTriggered || !el) return; // Guard if user scrolled back up during animation
          el.classList.add('active');
        }, config.delay);
      }
    });
  });
}

function hideNotifications() {
  if (!notificationsTriggered) return;
  notificationsTriggered = false;
  
  const items = notificationsContainer.children;
  for (let i = 0; i < items.length; i++) {
    const el = items[i];
    if (el) {
      el.classList.remove('active');
    }
  }
}

// Initialize on execution
initNotifications();

// Track page scroll to set target scrub percentage and toggle overlays
window.addEventListener('scroll', () => {
  const scrollPos = window.scrollY;
  const viewportHeight = window.innerHeight;
  
  // 1. Title & Scroll Indicator Fade Out
  if (scrollPos > 50) {
    if (scrollIndicator) scrollIndicator.style.opacity = '0';
    introTitle.style.opacity = Math.max(0, 1 - scrollPos / (viewportHeight * 0.2));
    introTitle.style.transform = `translateY(${-scrollPos / 3}px)`;
  } else {
    if (scrollIndicator) scrollIndicator.style.opacity = '1';
    introTitle.style.opacity = '1';
    introTitle.style.transform = 'translateY(0px)';
  }

  // 1.5. Typing / Disperse Title Fade In & Out according to scroll
  const fadeStart = viewportHeight * 0.1;
  const fadeInEnd = viewportHeight * 0.6;
  const fadeOutStart = viewportHeight * 1.05;
  const fadeEnd = viewportHeight * 1.3;

  let opacity = 0;

  if (scrollPos <= fadeStart) {
    opacity = 0;
  } else if (scrollPos < fadeInEnd) {
    opacity = (scrollPos - fadeStart) / (fadeInEnd - fadeStart);
  } else if (scrollPos <= fadeOutStart) {
    opacity = 1;
  } else if (scrollPos < fadeEnd) {
    opacity = 1 - (scrollPos - fadeOutStart) / (fadeEnd - fadeOutStart);
  } else {
    opacity = 0;
  }

  // Clamp opacity
  opacity = Math.max(0, Math.min(1, opacity));

  typingTitleContainer.style.opacity = opacity;
  if (opacity > 0.01) {
    typingTitleContainer.style.pointerEvents = 'auto';
    if (opacity >= 0.15) {
      triggerTypingAnimation(); // Start typing when the container starts becoming visible
    }
  } else {
    typingTitleContainer.style.pointerEvents = 'none';
  }

  // 2. Video Timeline Scrubbing Progress (Stepped Mapping)
  const duration = video.duration;
  if (duration && !isNaN(duration)) {
    const step1Time = 1.08; // 00:00:01:02 (1s 2f)
    let targetTime = 0;
    
    const textFadeEnd = viewportHeight * 0.2;
    
    if (scrollPos <= textFadeEnd) {
      // Keep video at start frame while text is fading out
      targetTime = 0;
    } else if (scrollPos <= viewportHeight) {
      // 1st Scroll Snap Segment: scrub from 0 to 1.08s after text disappears
      const progress = (scrollPos - textFadeEnd) / (viewportHeight - textFadeEnd);
      targetTime = progress * step1Time;
    } else if (scrollPos <= viewportHeight * 2) {
      // 2nd Scroll Snap Segment: scrub from step1Time to midTime2 (1.08s to ~6.6s)
      const midTime1 = step1Time + 0.45 * (duration - step1Time); // ~4.2s (laptop open)
      const midTime2 = step1Time + 0.80 * (duration - step1Time); // ~6.6s (popouts complete)
      const pct = (scrollPos - viewportHeight) / viewportHeight;
      if (pct <= 0.85) {
        // Laptop opening (slow & smooth, occupying 85% of scroll)
        const progress = pct / 0.85;
        targetTime = step1Time + progress * (midTime1 - step1Time);
      } else {
        // Notifications pop-out (occupying final 15% of scroll)
        const progress = (pct - 0.85) / 0.15;
        targetTime = midTime1 + progress * (midTime2 - midTime1);
      }
    } else if (scrollPos <= viewportHeight * 3) {
      // 3rd Scroll Snap Segment: scrub the final 20% of the video (~6.6s to end)
      const midTime2 = step1Time + 0.80 * (duration - step1Time);
      const pct = (scrollPos - viewportHeight * 2) / viewportHeight;
      targetTime = midTime2 + pct * (duration - midTime2);
    } else {
      targetTime = duration;
    }
    
    targetPercent = targetTime / duration;
  } else {
    // Fallback if duration is not loaded yet
    const textFadeEnd = viewportHeight * 0.2;
    const scrubRange = viewportHeight * 3.0;
    if (scrollPos <= textFadeEnd) {
      targetPercent = 0;
    } else {
      targetPercent = Math.max(0, Math.min(1, (scrollPos - textFadeEnd) / (scrubRange - textFadeEnd)));
    }
  }

  // Trigger notifications when 2nd scroll is done (between 1.8 * viewportHeight and 2.5 * viewportHeight)
  if (scrollPos >= viewportHeight * 1.8 && scrollPos < viewportHeight * 2.5) {
    showNotifications();
  } else {
    hideNotifications();
  }

  // Dynamic Scroll Snapping Toggle:
  // If the user reaches below the active creators section top (3.1 * viewportHeight),
  // disable scroll snapping so they can scroll down freely to view the creators list and the footer.
  if (scrollPos >= viewportHeight * 3.1) {
    document.documentElement.style.scrollSnapType = 'none';
  } else {
    document.documentElement.style.scrollSnapType = 'y mandatory';
  }
});

// Render Loop for canvas frame-by-frame rendering and diagnostic info updates
function renderLoop() {
  const duration = video.duration;
  const hasDuration = duration && !isNaN(duration);
  
  if (hasDuration) {
    const isBackwards = targetPercent < currentPercent;
    const activeLerp = lerpFactor; // Smooth, symmetrical tracking in both scroll directions
    
    currentPercent += (targetPercent - currentPercent) * activeLerp;
    
    // Snap to target if very close to prevent infinite micro-seeking
    if (Math.abs(targetPercent - currentPercent) < 0.001) {
      currentPercent = targetPercent;
    }
    
    const targetTime = currentPercent * duration;
    const roundedTime = Math.max(0, Math.min(duration - 0.02, targetTime));
    
    // Keep mock video playhead in sync
    video.currentTime = roundedTime;
    
    // Draw pre-cached frame onto the scrub canvas, falling back to direct video seek if not cached yet
    const targetTimeVal = currentPercent * videoDuration;
    const targetIndex = Math.floor(targetTimeVal / frameDuration);
    
    if (frames[targetIndex]) {
      const frame = frames[targetIndex];
      drawSingleFrame(frame);
    } else {
      // Seek video element directly (throttled to avoid seek spamming). The persistent listener handles drawing on seeked.
      const seekTarget = Math.max(0, Math.min(videoDuration - 0.02, targetTimeVal));
      if (!instantVideo.seeking && Math.abs(instantVideo.currentTime - seekTarget) > 0.04) {
        instantVideo.currentTime = seekTarget;
      }
    }
  }

  // Update Diagnostic Panel
  if (debugEl) {
    let errText = 'None';
    if (video.error) {
      errText = `Code ${video.error.code} (${video.error.message || 'Source block'})`;
    }
    
    debugEl.innerHTML = `
      <span class="text-purple-400 font-bold uppercase tracking-wider mb-1">Interactive Diagnostics</span>
      <span>Frames Cached: ${frames.length} (${isLoaded ? 'COMPLETE' : 'DECODING...'})</span>
      <span>Playhead: ${video.currentTime.toFixed(3)}s</span>
      <span>Scroll Percent: ${(targetPercent * 100).toFixed(1)}%</span>
      <span>Render Mode: GPU Canvas Cache</span>
      <span>Error: <span class="text-emerald-400">${errText}</span></span>
    `;
  }

  requestAnimationFrame(renderLoop);
}
requestAnimationFrame(renderLoop);

// Setup Copy Command Button handled globally in option.js



/* ================= 👥 CREATOR DIRECTORY DYNAMIC CARDS ================= */

// Helper to convert number formats (e.g. 1500 -> 1.5K)
function formatNumber(num) {
  if (!num) return '0';
  const n = parseInt(num, 10);
  if (isNaN(n)) return '0';
  if (n >= 1000000000) {
    return (n / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (n >= 1000000) {
    return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return n.toString();
}

// Color conversion helpers for glowing borders
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function hslToHex(h, s, l) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Dynamic Glowing Border logic (matches main dashboard)
function initBorderGlow(cardEl, r, g, b) {
  const hsl = rgbToHsl(r, g, b);
  const glowIntensity = 1.0;
  const base = `${hsl.h}deg ${hsl.s}% ${hsl.l}%`;
  
  const opacities = [100, 60, 50, 40, 30, 20, 10];
  const keys = ['', '-60', '-50', '-40', '-30', '-20', '-10'];
  for (let i = 0; i < opacities.length; i++) {
    cardEl.style.setProperty(`--glow-color${keys[i]}`, `hsl(${base} / ${Math.min(opacities[i] * glowIntensity, 100)}%)`);
  }
  cardEl.style.setProperty('--glow-color', `hsl(${base} / 100%)`);
  
  const hexColor1 = rgbToHex(r, g, b);
  const hsl2 = { ...hsl, h: (hsl.h + 45) % 360 };
  const hsl3 = { ...hsl, h: (hsl.h + 90) % 360 };
  const hexColor2 = hslToHex(hsl2.h, hsl2.s, hsl2.l);
  const hexColor3 = hslToHex(hsl3.h, hsl3.s, hsl3.l);
  const colors = [hexColor1, hexColor2, hexColor3];
  
  const GRADIENT_POSITIONS = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%'];
  const GRADIENT_KEYS = ['--gradient-one', '--gradient-two', '--gradient-three', '--gradient-four', '--gradient-five', '--gradient-six', '--gradient-seven'];
  const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1];
  
  for (let i = 0; i < 7; i++) {
    const c = colors[Math.min(COLOR_MAP[i], colors.length - 1)];
    cardEl.style.setProperty(GRADIENT_KEYS[i], `radial-gradient(at ${GRADIENT_POSITIONS[i]}, ${c} 0px, transparent 50%)`);
  }
  cardEl.style.setProperty('--gradient-base', `linear-gradient(${colors[0]} 0 100%)`);
  
  cardEl.style.setProperty('--edge-sensitivity', '30');
  cardEl.style.setProperty('--border-radius', '20');
  cardEl.style.setProperty('--glow-padding', '40');
  cardEl.style.setProperty('--cone-spread', '25');
  cardEl.style.setProperty('--fill-opacity', '0.5');
  
  if (cardEl.dataset.borderGlowInitialized) return;
  cardEl.dataset.borderGlowInitialized = "true";
  
  cardEl.addEventListener('pointermove', (e) => {
    const rect = cardEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    let kx = Infinity;
    let ky = Infinity;
    if (dx !== 0) kx = cx / Math.abs(dx);
    if (dy !== 0) ky = cy / Math.abs(dy);
    const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
    
    let angle = 0;
    if (dx !== 0 || dy !== 0) {
      const radians = Math.atan2(dy, dx);
      let degrees = radians * (180 / Math.PI) + 90;
      if (degrees < 0) degrees += 360;
      angle = degrees;
    }
    
    cardEl.style.setProperty('--edge-proximity', `${(edge * 100).toFixed(3)}`);
    cardEl.style.setProperty('--cursor-angle', `${angle.toFixed(3)}deg`);
  });
}

// Dynamically extract avatar primary color for glowing border
function updateAvatarGlow(imgEl, containerEl) {
  if (!imgEl || !containerEl) return;

  function applyGlow() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 10;
      canvas.height = 10;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgEl, 0, 0, 10, 10);
      
      const imgData = ctx.getImageData(0, 0, 10, 10).data;
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      
      for (let i = 0; i < imgData.length; i += 4) {
        const r = imgData[i];
        const g = imgData[i+1];
        const b = imgData[i+2];
        const a = imgData[i+3];
        if (a > 200) {
          rSum += r;
          gSum += g;
          bSum += b;
          count++;
        }
      }
      
      if (count > 0) {
        const r = Math.round(rSum / count);
        const g = Math.round(gSum / count);
        const b = Math.round(bSum / count);
        containerEl.style.setProperty('--glow-color-rgb', `${r}, ${g}, ${b}`);
        initBorderGlow(containerEl, r, g, b);
      }
    } catch (err) {
      console.warn('Could not extract color from avatar:', err);
    }
  }

  if (imgEl.complete && imgEl.naturalWidth > 0) {
    applyGlow();
  } else {
    imgEl.removeEventListener('load', applyGlow);
    imgEl.addEventListener('load', applyGlow);
  }
}

// 3D Parallax Tilt Effect
function setup3DTilt(elements) {
  elements.forEach(el => {
    if (el.dataset.tiltInitialized) return;
    el.dataset.tiltInitialized = "true";
    
    let rect = null;
    let isClicking = false;
    
    const updateTransform = (e) => {
      if (isScrolling || !rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const xc = rect.width / 2;
      const yc = rect.height / 2;
      
      const angleX = ((yc - y) / yc) * 8; 
      const angleY = ((x - xc) / xc) * 8;
      
      if (isClicking) {
        // Active click animation: scale 0.95 and rotateZ 1.7deg
        el.style.transform = `perspective(1000px) rotateX(${angleX}deg) rotateY(${angleY}deg) scale(0.95) rotateZ(1.7deg) translateY(-2px)`;
      } else {
        // Normal hover animation: scale 1.02 and translateY -6px
        el.style.transform = `perspective(1000px) rotateX(${angleX}deg) rotateY(${angleY}deg) scale(1.02) translateY(-6px)`;
      }
    };
    
    el.addEventListener('mouseenter', () => {
      rect = el.getBoundingClientRect();
      // Apply temporary smooth transition for tracking cursor movements
      el.style.transition = 'transform 0.15s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.3s ease, border-color 0.3s ease';
    });
    
    el.addEventListener('mousemove', (e) => {
      updateTransform(e);
    });
    
    el.addEventListener('mousedown', (e) => {
      isClicking = true;
      updateTransform(e);
    });
    
    el.addEventListener('mouseup', (e) => {
      isClicking = false;
      updateTransform(e);
    });
    
    el.addEventListener('mouseleave', () => {
      isClicking = false;
      // Revert transition and transform values to default stylesheet rules
      el.style.transition = '';
      el.style.transform = '';
      rect = null;
    });
  });
}

let selectedGame = '';
let allGamesSelectedManually = false;
let searchQuery = '';
let profileGames = {}; // profileId -> Set of game names
let allCreators = [];  // Array of creator card objects

// Fetch creators and render cards
async function renderCreatorDirectory() {
  try {
    // 1. Fetch profiles
    let profiles = [];
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .not('channel_id', 'is', null);
      if (error) throw error;
      profiles = data || [];
    } catch (dbErr) {
      console.error('Failed to load profiles from database:', dbErr);
    }

    // 2. Fetch clips count in parallel
    const countPromises = profiles.map(async (profile) => {
      const { count, error } = await supabase
        .from('clips')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', profile.id);
      return { id: profile.id, count: error ? 0 : (count || 0) };
    });

    const legacyCountPromise = supabase
      .from('clips')
      .select('*', { count: 'exact', head: true })
      .is('profile_id', null)
      .then(({ count, error }) => ({ id: 'default_profile', count: error ? 0 : (count || 0) }));

    // 3. Fetch latest thumbnails as fallbacks in parallel
    const thumbPromises = profiles.map(async (profile) => {
      const { data, error } = await supabase
        .from('clips')
        .select('video_id')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1);
      const videoId = (data && data[0]) ? data[0].video_id : null;
      return { id: profile.id, thumbnail: videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : null };
    });

    const legacyThumbPromise = supabase
      .from('clips')
      .select('video_id')
      .is('profile_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const videoId = (data && data[0]) ? data[0].video_id : null;
        return { id: 'default_profile', thumbnail: videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : null };
      });

    // 4. Fetch clips with game details to map games to profiles
    const clipsWithGamesPromise = supabase
      .from('clips')
      .select('profile_id, games(game_title, game_poster)');

    const [countResults, thumbResults, clipsWithGamesResult] = await Promise.all([
      Promise.all([...countPromises, legacyCountPromise]),
      Promise.all([...thumbPromises, legacyThumbPromise]),
      clipsWithGamesPromise
    ]);

    const clipCounts = {};
    countResults.forEach(res => { clipCounts[res.id] = res.count; });

    const latestThumbnails = {};
    thumbResults.forEach(res => { latestThumbnails[res.id] = res.thumbnail; });

    // Build games mapping and collect unique games
    const gameMap = new Map();
    profileGames = {};
    
    const clipsWithGames = clipsWithGamesResult.data;
    if (clipsWithGames) {
      clipsWithGames.forEach(clip => {
        const pId = clip.profile_id || 'default_profile';
        const gTitle = clip.games?.game_title || '';
        const gPoster = clip.games?.game_poster || '';
        
        if (gTitle) {
          if (!profileGames[pId]) {
            profileGames[pId] = new Set();
          }
          profileGames[pId].add(gTitle);
          
          if (!gameMap.has(gTitle)) {
            gameMap.set(gTitle, gPoster);
          }
        }
      });
    }

    // Build creator models
    const creators = {};
    profiles.forEach(profile => {
      const pId = profile.id;
      const sId = profile.channel_id;
      const count = clipCounts[pId] || 0;
      const identifier = profile.channel_name || sId;
      creators[sId] = {
        id: sId,
        profileDbId: pId,
        identifier: identifier,
        name: profile.channel_name || profile.email.split('@')[0] || 'Creator Channel',
        custom_handle: profile.custom_handle || '',
        clipCount: count,
        totalViews: profile.total_views || 0,
        subscribers: profile.subscribers || 0,
        thumbnail: getHighQualityAvatarUrl(profile.avatar_url || latestThumbnails[pId]),
        isSpecial: profile.is_special || false
      };
    });

    // Handle legacy clips
    if (clipCounts['default_profile']) {
      creators['default_streamer'] = {
        id: 'default_streamer',
        profileDbId: 'default_profile',
        identifier: 'default_streamer',
        name: 'Legacy Channel',
        clipCount: clipCounts['default_profile'],
        totalViews: 0,
        subscribers: 0,
        thumbnail: getHighQualityAvatarUrl(latestThumbnails['default_profile']),
        isSpecial: false
      };
    }

    const creatorList = Object.values(creators);
    // Sort creatorList: Special creators pinned first, then sorted by subscriber count descending
    creatorList.sort((a, b) => {
      const aSpecial = a.isSpecial ? 1 : 0;
      const bSpecial = b.isSpecial ? 1 : 0;
      if (aSpecial !== bSpecial) {
        return bSpecial - aSpecial;
      }
      return (b.subscribers || 0) - (a.subscribers || 0);
    });
    allCreators = creatorList;
    activeCreatorsList = creatorList; // Update notifications creators
    initNotifications(); // Re-initialize notifications with DPs

    // Initial render and setup search bar event listener
    filterAndRenderCreators();
    
    // Render dynamic game cards track slider
    renderGameCardsSlider(Array.from(gameMap.entries()));

    // Populate select options for gameFilter
    const gameFilter = document.getElementById('gameFilter');
    if (gameFilter) {
      gameFilter.innerHTML = '<option value="">All Games</option>';
      Array.from(gameMap.keys()).sort().forEach(gameName => {
        const opt = document.createElement('option');
        opt.value = gameName;
        opt.textContent = gameName;
        gameFilter.appendChild(opt);
      });
      
      gameFilter.addEventListener('change', () => {
        selectedGame = gameFilter.value;
        
        // Sync active card in slider
        const track = document.getElementById('gameCardsTrack');
        if (track) {
          track.querySelectorAll('.game-card').forEach(c => {
            const val = c.getAttribute('data-game-value');
            if (val === selectedGame) {
              if (selectedGame !== '' || allGamesSelectedManually) {
                c.classList.add('active');
              } else {
                c.classList.remove('active');
              }
            } else {
              c.classList.remove('active');
            }
          });
        }
        
        filterAndRenderCreators();
      });

      setupCustomDropdown('gameDropdownContainer', 'gameFilter');
    }

    const filterInput = document.getElementById('creatorFilterInput');
    if (filterInput) {
      filterInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        filterAndRenderCreators();
      });
      setupCreatorSuggestiveSearch();
    }

    // 5. Background refresh of creator statistics
    fetch(`${BACKEND_URL}/api/creators/refresh-views`)
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.creators) {
          let needsReFilter = false;
          for (const [channelId, creatorInfo] of Object.entries(data.creators)) {
            const matchCreator = allCreators.find(c => c.id === channelId);
            if (matchCreator) {
              if (creatorInfo.views !== undefined) matchCreator.totalViews = creatorInfo.views;
              if (creatorInfo.subscribers !== undefined) matchCreator.subscribers = creatorInfo.subscribers;
              needsReFilter = true;
            }
          }
          if (needsReFilter) {
            filterAndRenderCreators();
          }
        }
      })
      .catch(err => console.warn('Background stats refresh failed:', err));

  } catch (err) {
    console.error('Failed to render creator directory:', err);
    const container = document.getElementById('creator-grid-3d');
    if (container) {
      container.innerHTML = `<p class="text-rose-500 text-center col-span-full py-12">Failed to load creators. Please refresh or try again.</p>`;
    }
  }
}

function filterAndRenderCreators() {
  const container = document.getElementById('creator-grid-3d');
  if (!container) return;

  const filtered = allCreators.filter(creator => {
    const matchesSearch = creator.name.toLowerCase().includes(searchQuery);
    let matchesGame = true;
    if (selectedGame) {
      const pId = creator.profileDbId || 'default_profile';
      matchesGame = profileGames[pId] && profileGames[pId].has(selectedGame);
    }
    return matchesSearch && matchesGame;
  });

  renderFilteredCreatorGrid(filtered);
}

function renderFilteredCreatorGrid(filteredList) {
  const container = document.getElementById('creator-grid-3d');
  if (!container) return;

  container.innerHTML = '';

  if (filteredList.length === 0) {
    container.innerHTML = `<p class="text-slate-500 text-center col-span-full py-12">No active creators match the selected filters.</p>`;
    return;
  }

  filteredList.forEach(creator => {
    const card = document.createElement('div');
    card.className = `creator-card glassmorphism border-glow-card${creator.isSpecial ? ' special-creator-card' : ''}`;
    card.setAttribute('data-channel-id', creator.id);
    card.innerHTML = `
      <span class="edge-light"></span>
      <div class="border-glow-inner">
        <div class="avatar-container">
          <img src="${creator.thumbnail}" crossorigin="anonymous" alt="${creator.name}" class="creator-card-avatar" onerror="this.onerror=null; this.src='${AVATAR_PLACEHOLDER}'; this.removeAttribute('crossorigin');" />
        </div>
        <div class="creator-card-overlay"></div>
        ${creator.isSpecial ? `
        <div class="special-heart-badge">
          <img src="heart.svg" alt="Special Creator" />
        </div>
        ` : ''}
        <div class="creator-card-body">
          <div class="creator-stats">
            <div class="stat-item">
              <span class="stat-value pink-text">${formatNumber(creator.subscribers)}</span>
              <span class="stat-label">SUBS</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-value purple-text">${formatNumber(creator.clipCount)}</span>
              <span class="stat-label">CLIPS</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-value blue-text">${formatNumber(creator.totalViews)}</span>
              <span class="stat-label">VIEWS</span>
            </div>
          </div>
          <h3 class="creator-name">${creator.name}</h3>
        </div>
      </div>
    `;

    card.onclick = () => {
      const handle = creator.custom_handle || creator.id;
      const urlPath = handle.startsWith('@') ? `/${handle}` : `/@${handle}`;
      window.location.href = urlPath;
    };

    container.appendChild(card);

    const imgEl = card.querySelector('.creator-card-avatar');
    updateAvatarGlow(imgEl, card);
  });

  setup3DTilt(container.querySelectorAll('.creator-card'));
}

function renderGameCardsSlider(gamesList) {
  const track = document.getElementById('gameCardsTrack');
  const section = document.getElementById('gameCardsSliderSection');
  if (!track || !section) return;

  if (gamesList.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';
  track.innerHTML = '';

  // 1. Render "All Games" Card
  if (gamesList.length > 1) {
    const allGamesCard = document.createElement('div');
    allGamesCard.className = `game-card ${(selectedGame === '' && allGamesSelectedManually) ? 'active' : ''}`;
    allGamesCard.setAttribute('data-game-value', '');

    const collage = document.createElement('div');
    const collagePosters = gamesList.map(g => g[1]).filter(p => p).slice(0, 4);
    let collageClass = 'collage-4';
    if (collagePosters.length === 2) collageClass = 'collage-2';
    else if (collagePosters.length === 3) collageClass = 'collage-3';
    else if (collagePosters.length === 1) collageClass = 'collage-1';
    else if (collagePosters.length === 0) {
      collagePosters.push('logo.svg');
      collageClass = 'collage-1';
    }

    collage.className = `all-games-collage ${collageClass}`;
    collagePosters.forEach(posterUrl => {
      const item = document.createElement('div');
      item.className = 'collage-item';
      item.style.backgroundImage = `url('${posterUrl}')`;
      collage.appendChild(item);
    });

    const mediaWrapper = document.createElement('div');
    mediaWrapper.className = 'game-card-media-wrapper';
    mediaWrapper.appendChild(collage);
    allGamesCard.appendChild(mediaWrapper);

    const allOverlay = document.createElement('div');
    allOverlay.className = 'game-card-overlay';
    const allBadge = document.createElement('span');
    allBadge.className = 'game-card-title';
    allBadge.textContent = 'All Games';
    allOverlay.appendChild(allBadge);
    allGamesCard.appendChild(allOverlay);

    allGamesCard.addEventListener('click', () => {
      track.querySelectorAll('.game-card').forEach(c => c.classList.remove('active'));
      
      if (selectedGame === '' && allGamesSelectedManually) {
        allGamesSelectedManually = false;
      } else {
        selectedGame = '';
        allGamesSelectedManually = true;
        allGamesCard.classList.add('active');
      }
      
      const gameFilter = document.getElementById('gameFilter');
      if (gameFilter) {
        gameFilter.value = '';
        gameFilter.dispatchEvent(new Event('change'));
      } else {
        filterAndRenderCreators();
      }
    });

    track.appendChild(allGamesCard);
  }

  // 2. Render individual game cards
  gamesList.forEach(([gameName, gamePoster]) => {
    const card = document.createElement('div');
    card.className = `game-card ${selectedGame === gameName ? 'active' : ''}`;
    card.setAttribute('data-game-value', gameName);

    const bg = document.createElement('div');
    bg.className = 'game-poster-bg';
    bg.style.backgroundImage = gamePoster ? `url('${gamePoster}')` : "url('logo.svg')";

    const mediaWrapper = document.createElement('div');
    mediaWrapper.className = 'game-card-media-wrapper';
    mediaWrapper.appendChild(bg);
    card.appendChild(mediaWrapper);

    const overlay = document.createElement('div');
    overlay.className = 'game-card-overlay';
    const title = document.createElement('span');
    title.className = 'game-card-title';
    title.textContent = gameName;
    overlay.appendChild(title);
    card.appendChild(overlay);

    card.addEventListener('click', () => {
      track.querySelectorAll('.game-card').forEach(c => c.classList.remove('active'));
      if (selectedGame === gameName) {
        selectedGame = '';
        allGamesSelectedManually = false;
      } else {
        selectedGame = gameName;
        allGamesSelectedManually = false;
        card.classList.add('active');
      }
      
      const gameFilter = document.getElementById('gameFilter');
      if (gameFilter) {
        gameFilter.value = selectedGame;
        gameFilter.dispatchEvent(new Event('change'));
      } else {
        filterAndRenderCreators();
      }
    });

    track.appendChild(card);
  });

  setup3DTilt(track.querySelectorAll('.game-card'));

  // 3. Setup slider navigation buttons
  const prevBtn = document.getElementById('sliderPrevBtn');
  const nextBtn = document.getElementById('sliderNextBtn');
  if (prevBtn && nextBtn) {
    const updateNavVisibility = () => {
      if (track.scrollWidth <= track.clientWidth) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
      } else {
        prevBtn.style.display = track.scrollLeft <= 5 ? 'none' : 'flex';
        nextBtn.style.display = (track.scrollLeft + track.clientWidth >= track.scrollWidth - 5) ? 'none' : 'flex';
      }
    };

    updateNavVisibility();
    track.removeEventListener('scroll', updateNavVisibility);
    track.addEventListener('scroll', updateNavVisibility);

    prevBtn.onclick = () => {
      track.scrollBy({ left: -260, behavior: 'smooth' });
    };
    nextBtn.onclick = () => {
      track.scrollBy({ left: 260, behavior: 'smooth' });
    };
  }
}

// Track if body/window is scrolling to suppress 3D hover effects when scrolling
let scrollTimeout;
window.addEventListener('scroll', () => {
  isScrolling = true;
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    isScrolling = false;
  }, 100);
});

/* ================= 🔀 TEXT DISPERSE & TYPING ANIMATION ================= */
const transforms = [
  { x: -0.8, y: -0.6, rotationZ: -29 },
  { x: -0.2, y: -0.4, rotationZ: -6 },
  { x: -0.05, y: 0.1, rotationZ: 12 },
  { x: -0.05, y: -0.1, rotationZ: -9 },
  { x: -0.1, y: 0.55, rotationZ: 3 },
  { x: 0, y: -0.1, rotationZ: 9 },
  { x: 0, y: 0.15, rotationZ: -12 },
  { x: 0, y: 0.15, rotationZ: -17 },
  { x: 0, y: -0.65, rotationZ: 9 },
  { x: 0.1, y: 0.4, rotationZ: 12 },
  { x: 0, y: -0.15, rotationZ: -9 },
  { x: 0.2, y: 0.15, rotationZ: 12 },
  { x: 0.8, y: 0.6, rotationZ: 20 },
  { x: -0.3, y: -0.5, rotationZ: 15 },
  { x: 0.4, y: -0.2, rotationZ: -10 },
  { x: -0.5, y: 0.3, rotationZ: 25 },
  { x: 0.6, y: 0.4, rotationZ: -20 },
  { x: -0.2, y: 0.6, rotationZ: 18 },
  { x: 0.3, y: -0.6, rotationZ: -15 },
  { x: 0.5, y: 0.2, rotationZ: 8 }
];

const targetWord = "!clip = Best Moments";
let isTyped = false;

// Pre-populate disperseWord with spans immediately on load to prevent hover animation skip during typing
function initializeDisperseWord() {
  const wordEl = document.getElementById('disperseWord');
  if (!wordEl) return;
  wordEl.innerHTML = '';
  const chars = targetWord.split('');
  chars.forEach((char) => {
    const span = document.createElement('span');
    span.className = 'disperse-char';
    if (char === ' ') {
      span.innerHTML = '&nbsp;';
    } else {
      span.innerText = char;
    }
    span.style.opacity = '0';
    span.style.transition = 'opacity 0.3s ease';
    wordEl.appendChild(span);
  });
}

// Call on script load
initializeDisperseWord();

function triggerTypingAnimation() {
  if (isTyped) return;
  isTyped = true;
  
  const wordEl = document.getElementById('disperseWord');
  if (!wordEl) return;
  const spans = wordEl.querySelectorAll('.disperse-char');
  spans.forEach((span, idx) => {
    setTimeout(() => {
      span.style.opacity = '1';
    }, idx * 75);
  });
}

function resetTypingAnimation() {
  if (!isTyped) return;
  isTyped = false;
  const wordEl = document.getElementById('disperseWord');
  if (!wordEl) return;
  const spans = wordEl.querySelectorAll('.disperse-char');
  spans.forEach(span => {
    span.style.opacity = '0';
  });
}

// Hover effects for dispersion via Web Animations API to prevent skip during scroll
if (disperseWord) {
  let activeAnimations = [];

  disperseWord.addEventListener('mouseenter', () => {
    const spans = disperseWord.querySelectorAll('.disperse-char');
    // Capture current computed transform of all spans mid-animation
    const currentTransforms = Array.from(spans).map(span => window.getComputedStyle(span).transform);

    // Cancel any ongoing animations to prevent overlaps
    activeAnimations.forEach(anim => anim.cancel());
    activeAnimations = [];

    spans.forEach((span, idx) => {
      const t = transforms[idx] || { x: 0, y: 0, rotationZ: 0 };
      const startTransform = currentTransforms[idx] !== 'none' ? currentTransforms[idx] : 'translate(0px, 0px) rotate(0deg)';
      const targetTransform = `translate(${t.x}em, ${t.y}em) rotate(${t.rotationZ}deg)`;

      const anim = span.animate([
        { transform: startTransform },
        { transform: targetTransform }
      ], {
        duration: 750,
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
        fill: 'forwards'
      });

      activeAnimations.push(anim);
      anim.onfinish = () => {
        span.style.transform = targetTransform;
      };
    });
  });
  
  disperseWord.addEventListener('mouseleave', () => {
    const spans = disperseWord.querySelectorAll('.disperse-char');
    // Capture current computed transform of all spans mid-animation
    const currentTransforms = Array.from(spans).map(span => window.getComputedStyle(span).transform);

    // Cancel any ongoing animations to prevent overlaps
    activeAnimations.forEach(anim => anim.cancel());
    activeAnimations = [];

    spans.forEach((span, idx) => {
      const startTransform = currentTransforms[idx] !== 'none' ? currentTransforms[idx] : 'translate(0px, 0px) rotate(0deg)';
      const targetTransform = 'translate(0px, 0px) rotate(0deg)';

      const anim = span.animate([
        { transform: startTransform },
        { transform: targetTransform }
      ], {
        duration: 750,
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
        fill: 'forwards'
      });

      activeAnimations.push(anim);
      anim.onfinish = () => {
        span.style.transform = targetTransform;
      };
    });
  });
}

// Setup Guide Modal Controller handled globally in option.js


/* ================= 🎥 TUTORIAL VIDEO MODAL CONTROLLER ================= */
const videoModal = document.getElementById('videoModal');
const videoIframe = document.getElementById('videoIframe');
const tutorialVideoCard = document.getElementById('tutorialVideoCard');

function toggleVideoModal(show) {
  if (!videoModal || !videoIframe) return;
  const contentCard = videoModal.querySelector('.relative');
  if (show) {
    videoIframe.src = 'https://www.youtube.com/embed/bp8QKSlOvoM?autoplay=1';
    videoModal.classList.remove('opacity-0', 'pointer-events-none');
    if (contentCard) {
      contentCard.classList.remove('scale-95');
      contentCard.classList.add('scale-100');
    }
  } else {
    videoIframe.src = '';
    videoModal.classList.add('opacity-0', 'pointer-events-none');
    if (contentCard) {
      contentCard.classList.remove('scale-100');
      contentCard.classList.add('scale-95');
    }
  }
}

if (tutorialVideoCard) {
  tutorialVideoCard.onclick = () => toggleVideoModal(true);
}
window.toggleVideoModal = toggleVideoModal;

/* ================= 🔍 SUGGESTIVE SEARCH FOR CREATORS ================= */
function setupCreatorSuggestiveSearch() {
  const searchInput = document.getElementById('creatorFilterInput');
  const overlay = document.getElementById('creatorSearchPlaceholderOverlay');
  const suggestionsDropdown = document.getElementById('creatorSearchSuggestions');
  if (!searchInput || !overlay) return;
  const placeholderTextSpan = overlay.querySelector('.placeholder-text');
  if (!placeholderTextSpan) return;

  const suggestions = [
    "Search creators...",
    "Search by creator name (e.g. CarryMinati)...",
    "Search by handle...",
    "Filter creator channels..."
  ];

  let currentSuggestionIndex = 0;
  let currentCharIndex = 0;
  let isDeleting = false;
  let timeoutId = null;

  // Speeds in ms
  const typeSpeed = 80;
  const deleteSpeed = 40;
  const pauseAfterType = 1800;
  const pauseBeforeType = 300;

  function tick() {
    const fullText = suggestions[currentSuggestionIndex];
    
    if (isDeleting) {
      currentCharIndex--;
    } else {
      currentCharIndex++;
    }

    placeholderTextSpan.textContent = fullText.slice(0, currentCharIndex);

    let nextDelay = isDeleting ? deleteSpeed : typeSpeed;

    if (!isDeleting && currentCharIndex === fullText.length) {
      isDeleting = true;
      nextDelay = pauseAfterType;
    } else if (isDeleting && currentCharIndex === 0) {
      isDeleting = false;
      currentSuggestionIndex = (currentSuggestionIndex + 1) % suggestions.length;
      nextDelay = pauseBeforeType;
    }

    timeoutId = setTimeout(tick, nextDelay);
  }

  function updateVisibility() {
    const isActive = !searchInput.value && document.activeElement !== searchInput;
    if (isActive) {
      overlay.classList.remove('hidden');
      if (!timeoutId) {
        tick();
      }
    } else {
      overlay.classList.add('hidden');
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }
  }

  function showCreatorSuggestions() {
    if (!suggestionsDropdown) return;
    const wrapper = document.getElementById('creatorSearchSuggestionsWrapper');
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
      suggestionsDropdown.style.display = 'none';
      suggestionsDropdown.classList.add('hidden');
      if (wrapper) wrapper.classList.remove('open');
      return;
    }

    // Filter matching creators by name or handle/identifier
    const matches = allCreators.filter(c => {
      const nameMatch = c.name ? c.name.toLowerCase().includes(query) : false;
      const handleMatch = c.identifier ? c.identifier.toLowerCase().includes(query) : false;
      return nameMatch || handleMatch;
    }).slice(0, 5); // Max 5 suggestions

    if (matches.length === 0) {
      suggestionsDropdown.style.display = 'none';
      suggestionsDropdown.classList.add('hidden');
      if (wrapper) wrapper.classList.remove('open');
      return;
    }

    suggestionsDropdown.innerHTML = '';
    matches.forEach(creator => {
      const item = document.createElement('div');
      item.className = 'custom-dropdown-item flex items-center gap-3';
      item.innerHTML = `
        <img src="${creator.thumbnail}" class="w-6 h-6 rounded-full object-cover" onerror="this.onerror=null; this.src='${AVATAR_PLACEHOLDER}';" />
        <div class="flex flex-col">
          <span class="font-semibold text-white text-xs">${creator.name}</span>
          <span class="text-[10px] text-slate-500">@${creator.identifier || creator.id}</span>
        </div>
      `;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        searchInput.value = creator.name;
        searchQuery = creator.name.toLowerCase().trim();
        filterAndRenderCreators();
        suggestionsDropdown.style.display = 'none';
        suggestionsDropdown.classList.add('hidden');
        if (wrapper) wrapper.classList.remove('open');
        updateVisibility();
      });
      suggestionsDropdown.appendChild(item);
    });

    suggestionsDropdown.style.display = 'block';
    suggestionsDropdown.classList.remove('hidden');
    if (wrapper) wrapper.classList.add('open');
  }

  searchInput.addEventListener('focus', updateVisibility);
  searchInput.addEventListener('blur', updateVisibility);
  searchInput.addEventListener('input', () => {
    updateVisibility();
    showCreatorSuggestions();
  });

  // Close suggestions on click outside
  document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('creatorSearchSuggestionsWrapper');
    if (suggestionsDropdown && !searchInput.contains(e.target) && !suggestionsDropdown.contains(e.target)) {
      suggestionsDropdown.style.display = 'none';
      suggestionsDropdown.classList.add('hidden');
      if (wrapper) wrapper.classList.remove('open');
    }
  });

  // Initial update
  updateVisibility();
}

/* ================= 🎨 CUSTOM DROPDOWN SELECTS ================= */
function setupCustomDropdown(containerId, hiddenSelectId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const select = document.getElementById(hiddenSelectId);
  if (!select) return;

  const trigger = container.querySelector('.custom-dropdown-trigger');
  const triggerText = trigger.querySelector('.trigger-text');
  const menu = container.querySelector('.custom-dropdown-menu');

  // Toggle dropdown on click
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    
    // Close other custom dropdowns
    document.querySelectorAll('.custom-dropdown-wrapper').forEach(wrapper => {
      if (wrapper !== container) {
        wrapper.classList.remove('open');
        wrapper.querySelector('.custom-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
      }
    });

    const isOpen = container.classList.toggle('open');
    trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  // Re-generate custom items from the select element options
  function syncOptions() {
    menu.innerHTML = '';
    const options = Array.from(select.options);
    
    options.forEach(opt => {
      const item = document.createElement('div');
      item.className = 'custom-dropdown-item';
      item.textContent = opt.textContent;
      item.setAttribute('data-value', opt.value);
      if (opt.value === select.value) {
        item.classList.add('selected');
        triggerText.textContent = opt.textContent;
      }

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        
        if (select.id === 'gameFilter') {
          if (opt.value === '') {
            allGamesSelectedManually = true;
          } else {
            allGamesSelectedManually = false;
          }
        }
        
        // Select the option
        select.value = opt.value;
        // Trigger change event
        select.dispatchEvent(new Event('change'));

        // Update selected class
        menu.querySelectorAll('.custom-dropdown-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');

        // Close dropdown
        container.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      });

      menu.appendChild(item);
    });

    // Update trigger text
    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption) {
      triggerText.textContent = selectedOption.textContent;
    }
  }

  // Initial sync
  syncOptions();

  // Watch for dynamic changes in the select element's children (like gameFilter)
  const observer = new MutationObserver(() => {
    syncOptions();
  });
  observer.observe(select, { childList: true, subtree: true });

  // Also listen for change event on the select element to sync if changed programmatically
  select.addEventListener('change', () => {
    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption) {
      triggerText.textContent = selectedOption.textContent;
      menu.querySelectorAll('.custom-dropdown-item').forEach(item => {
        if (item.getAttribute('data-value') === select.value) {
          item.classList.add('selected');
        } else {
          item.classList.remove('selected');
        }
      });
    }
  });

  // Global click outside listener to close custom dropdown
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      container.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    }
  });
}

// Helper to format time ago dynamically
function formatTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  if (diffMs < 0) return 'Just now';
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// Fetch landing page statistics from Supabase
async function fetchLandingPageStats() {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayISO = startOfToday.toISOString();

    // Query 1: count today
    const { count, error: countError } = await supabase
      .from('clips')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfTodayISO);
    
    // Query 2: latest clip
    const { data: latestClips, error: latestError } = await supabase
      .from('clips')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    const countVal = countError ? 0 : (count || 0);
    
    let timeAgoText = "Latest Clip: Never";
    if (!latestError && latestClips && latestClips.length > 0) {
      const latestTime = new Date(latestClips[0].created_at);
      timeAgoText = `Latest Clip: ${formatTimeAgo(latestTime)}`;
    }

    const clipsCountEl = document.getElementById('clipsCapturedToday');
    const latestClipEl = document.getElementById('latestClipTime');
    if (clipsCountEl) {
      let startTimestamp = null;
      const duration = 1500;
      const startValue = 0;
      const targetValue = countVal;
      
      function step(timestamp) {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        // Easing curve: easeOutExpo (starts fast, decelerates beautifully towards the end)
        const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const currentValue = Math.floor(easeProgress * (targetValue - startValue) + startValue);
        
        clipsCountEl.innerText = `${currentValue} Clips Captured Today`;
        
        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      }
      window.requestAnimationFrame(step);
    }
    if (latestClipEl) latestClipEl.innerText = timeAgoText;
  } catch (err) {
    console.error('Error fetching landing page stats:', err);
  }
}

// Load creator directory and landing page stats, waiting for token refresh first to prevent query errors
(async () => {
  if (typeof refreshPromise !== 'undefined') {
    await refreshPromise;
  }
  renderCreatorDirectory();
  fetchLandingPageStats();
})();

// Initialize 3D Parallax Tilt on info and video cards
setup3DTilt(document.querySelectorAll('.premium-info-card-wrapper, #tutorialVideoCard'));

/* ================= MODAL TRANSITIONS ================= */
function openModal(modal) {
  if (!modal) return;
  modal.classList.remove('hidden');
  void modal.offsetWidth; // Trigger reflow
  modal.classList.add('show');
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove('show');
  setTimeout(() => {
    if (!modal.classList.contains('show')) {
      modal.classList.add('hidden');
    }
  }, 300);
}

/* ================= LOCAL AUTHENTICATION DIALOGS ================= */
function setupLocalAuth() {
  const loginModal = document.getElementById('loginModal');
  const showLoginBtn = document.getElementById('showLoginBtn');
  const closeLoginModalBtn = document.getElementById('closeLoginModal');
  const cancelLoginBtn = document.getElementById('cancelLogin');

  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const togglePasswordBtn = document.getElementById('togglePassword');
  const loginBtn = document.getElementById('loginBtn');
  const loginForm = document.getElementById('loginForm');

  const channelIdGroup = document.getElementById('channelIdGroup');
  const channelIdInput = document.getElementById('channelId');
  const toggleAuthModeBtn = document.getElementById('toggleAuthModeBtn');
  const modalTitle = document.getElementById('modalTitle');
  const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');

  const newPasswordInput = document.getElementById('newPassword');
  const toggleNewPasswordBtn = document.getElementById('toggleNewPassword');
  const saveNewPasswordBtn = document.getElementById('saveNewPasswordBtn');
  const resetPasswordModal = document.getElementById('resetPasswordModal');

  const authUnlogged = document.getElementById('auth-unlogged');
  const authLogged = document.getElementById('auth-logged');
  const userDisplay = document.getElementById('user-display');
  const logoutBtn = document.getElementById('logoutBtn');

  // Redirect to full-screen central auth login/signup pages
  if (showLoginBtn) {
    showLoginBtn.onclick = () => {
      const nextTarget = window.location.href;
      window.location.href = `${MAIN_WEBSITE_URL}/login?next=${encodeURIComponent(nextTarget)}`;
    };
  }

  const getStartedBtn = document.getElementById('getStartedBtn');
  if (getStartedBtn) {
    getStartedBtn.onclick = () => {
      const nextTarget = window.location.href;
      window.location.href = `${MAIN_WEBSITE_URL}/signup?next=${encodeURIComponent(nextTarget)}`;
    };
  }

  if (loginModal) {
    let isSignUpMode = false;

  // Toggle Login/Signup Modes
  toggleAuthModeBtn.onclick = (e) => {
    e.preventDefault();
    isSignUpMode = !isSignUpMode;

    if (isSignUpMode) {
      modalTitle.textContent = 'Creator Sign Up';
      channelIdGroup.classList.remove('hidden');
      forgotPasswordBtn.classList.add('hidden');
      toggleAuthModeBtn.textContent = 'Already have an account? Login';
      loginBtn.textContent = 'Sign Up';
    } else {
      modalTitle.textContent = 'Creator Login';
      channelIdGroup.classList.add('hidden');
      forgotPasswordBtn.classList.remove('hidden');
      toggleAuthModeBtn.textContent = "Don't have an account? Sign Up";
      loginBtn.textContent = 'Submit';
    }
    resetLoginFormInputs();
  };

  // Show Modal
  showLoginBtn.onclick = () => {
    openModal(loginModal);
    emailInput.focus();
  };

  // Close Modal (x)
  closeLoginModalBtn.onclick = () => {
    closeModal(loginModal);
    resetLoginForm();
  };

  // Close Modal (Cancel)
  cancelLoginBtn.onclick = () => {
    closeModal(loginModal);
    resetLoginForm();
  };

  // Click outside to close modal
  window.addEventListener('click', (e) => {
    if (e.target === loginModal) {
      closeModal(loginModal);
      resetLoginForm();
    }
    if (e.target === resetPasswordModal) {
      closeModal(resetPasswordModal);
    }
  });

  // Show/Hide password
  togglePasswordBtn.onclick = () => {
    const hidden = passwordInput.type === 'password';
    passwordInput.type = hidden ? 'text' : 'password';
    togglePasswordBtn.textContent = hidden ? '🙈' : '👁';
  };

  if (toggleNewPasswordBtn && newPasswordInput) {
    toggleNewPasswordBtn.onclick = () => {
      const hidden = newPasswordInput.type === 'password';
      newPasswordInput.type = hidden ? 'text' : 'password';
      toggleNewPasswordBtn.textContent = hidden ? '🙈' : '👁';
    };
  }

  function updateSubmitState() {
    const emailOk = emailInput.value.trim().length > 0;
    const passwordOk = passwordInput.value.trim().length >= 6;
    const channelIdOk = !isSignUpMode || (channelIdInput.value.trim().length >= 3);

    loginBtn.disabled = !(emailOk && passwordOk && channelIdOk);
  }

  function resetLoginFormInputs() {
    emailInput.value = '';
    passwordInput.value = '';
    channelIdInput.value = '';
    passwordInput.type = 'password';
    togglePasswordBtn.textContent = '👁';
    updateSubmitState();
  }

  function resetLoginForm() {
    modalTitle.textContent = 'Creator Login';
    channelIdGroup.classList.add('hidden');
    forgotPasswordBtn.classList.remove('hidden');
    toggleAuthModeBtn.textContent = "Don't have an account? Sign Up";
    loginBtn.textContent = 'Submit';
    resetLoginFormInputs();
    isSignUpMode = false;
  }

  emailInput.addEventListener('input', updateSubmitState);
  passwordInput.addEventListener('input', updateSubmitState);
  channelIdInput.addEventListener('input', updateSubmitState);

  [emailInput, passwordInput, channelIdInput].forEach(el => {
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !loginBtn.disabled) {
        e.preventDefault();
        loginBtn.click();
      }
    });
  });

  loginBtn.onclick = async () => {
    if (loginBtn.disabled) return;

    if (isSignUpMode) {
      loginBtn.textContent = 'Verifying YouTube channel…';
      loginBtn.disabled = true;

      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();
      const channelInputVal = channelIdInput.value.trim();

      try {
        // 1. Resolve handle or channel ID on the backend
        const resolveRes = await fetch(`${BACKEND_URL}/api/resolve-channel?identifier=${encodeURIComponent(channelInputVal)}`);
        const resolveData = await resolveRes.json();
        
        if (!resolveData || !resolveData.success) {
          throw new Error(resolveData?.error || 'YouTube channel not found. Please verify your Handle or Channel ID.');
        }

        const resolvedChannelId = resolveData.channelId;
        const resolvedName = resolveData.name;
        const resolvedAvatar = resolveData.avatar;
        const resolvedViews = resolveData.views || 0;
        const resolvedSubscribers = resolveData.subscribers || 0;
        const resolvedHandle = resolveData.customHandle || '';

        loginBtn.textContent = 'Creating account…';

        // 2. Sign up auth account
        const { data: authData, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;

        if (authData.user) {
          // 3. Upsert creator profile details (email, role, channel_id, channel_name, avatar_url, total_views, subscribers)
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: authData.user.id,
              email: email,
              channel_id: resolvedChannelId,
              channel_name: resolvedName,
              custom_handle: resolvedHandle,
              avatar_url: resolvedAvatar,
              total_views: resolvedViews,
              subscribers: resolvedSubscribers,
              role: 'creator'
            }, { onConflict: 'id' });

          if (profileError) throw profileError;
        }

        alert('Creator account registered successfully! You are now logged in.');
        location.reload();
      } catch (err) {
        alert('Sign Up failed: ' + err.message);
        loginBtn.textContent = 'Sign Up';
        updateSubmitState();
      }
    } else {
      loginBtn.textContent = 'Logging in…';
      loginBtn.disabled = true;

      const { error } = await supabase.auth.signInWithPassword({
        email: emailInput.value.trim(),
        password: passwordInput.value.trim()
      });

      if (error) {
        alert(error.message);
        loginBtn.textContent = 'Submit';
        updateSubmitState();
      } else {
        alert('Logged in successfully!');
        location.reload();
      }
    }
  };

  // Forgot Password trigger
  forgotPasswordBtn.onclick = async (e) => {
    e.preventDefault();
    const email = prompt("Enter your admin email address to receive a password reset link:");
    if (!email || !email.trim()) return;

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + window.location.pathname
      });
      if (error) throw error;
      alert("Password reset email sent! Check your inbox.");
      closeModal(loginModal);
      resetLoginForm();
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  // Reset Password Modal - Submit
  if (saveNewPasswordBtn && resetPasswordModal) {
    saveNewPasswordBtn.onclick = async () => {
      const newPassword = newPasswordInput.value.trim();
      if (newPassword.length < 6) {
        alert("Password must be at least 6 characters.");
        return;
      }

      saveNewPasswordBtn.textContent = 'Saving...';
      saveNewPasswordBtn.disabled = true;

      try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        alert("Password updated successfully! You are now logged in.");
        closeModal(resetPasswordModal);
        location.reload();
      } catch (err) {
        alert("Error updating password: " + err.message);
        saveNewPasswordBtn.textContent = 'Save Password';
        saveNewPasswordBtn.disabled = false;
      }
    };
  }

  // Supabase password recovery handler
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      if (resetPasswordModal) {
        openModal(resetPasswordModal);
      }
    }
  });

    updateSubmitState();
  }

  // checkAuth function to resolve user status and update header elements
  async function checkAuth() {
    const storedUser = localStorage.getItem('streamclips_user');
    currentUser = storedUser ? JSON.parse(storedUser) : null;
    const user = currentUser;
    
    const connectBtn = document.getElementById('connectYoutubeNavBtn');

    if (!user) {
      isAdmin = false;
      if (authUnlogged) authUnlogged.classList.remove('hidden');
      if (authLogged) authLogged.classList.add('hidden');
      if (connectBtn) connectBtn.classList.add('hidden');
      return;
    }

    if (authUnlogged) authUnlogged.classList.add('hidden');
    if (authLogged) authLogged.classList.remove('hidden');

    try {
      // Query profile and users_data from YT Timestamp database by email in parallel
      const [profileResult, userDataResult] = await Promise.all([
        supabase.from('profiles').select('role, channel_id, channel_name, avatar_url, custom_handle').eq('email', user.email).maybeSingle(),
        supabase.from('users_data').select('name').eq('email', user.email).maybeSingle()
      ]);

      const { data, error } = profileResult;
      const { data: userData } = userDataResult;

      const isConnected = data && data.channel_id;

      if (isConnected) {
        isAdmin = data.role === 'admin';
        currentUserChannelId = data.channel_id || null;
        currentUserHandle = data.custom_handle || null;

        const displayName = data.channel_name || user.user_metadata?.full_name || user.email.split('@')[0];
        const avatarUrl = getHighQualityAvatarUrl(data.avatar_url || user.user_metadata?.avatar_url);
        const roleName = data.role ? (data.role.charAt(0).toUpperCase() + data.role.slice(1).toLowerCase()) : 'Creator';

        if (userDisplay) userDisplay.textContent = displayName;
        const userAvatarEl = document.getElementById('user-display-avatar');
        if (userAvatarEl) userAvatarEl.src = avatarUrl;

        const userRoleEl = document.querySelector('.profile-role-text');
        if (userRoleEl) userRoleEl.textContent = roleName;

        const popoverAvatar = document.getElementById('popover-avatar');
        const popoverUsername = document.getElementById('popover-username');
        const popoverEmail = document.getElementById('popover-email');
        if (popoverAvatar) popoverAvatar.src = avatarUrl;
        const signupName = (userData && userData.name) || user.user_metadata?.name || user.user_metadata?.username || user.user_metadata?.full_name || user.email.split('@')[0];
        if (popoverUsername) popoverUsername.textContent = signupName;
        if (popoverEmail) popoverEmail.textContent = user.email;

        // Connected to Youtube: hide Connect button in popover, show Your Clips
        const popoverConnectBtn = document.getElementById('popoverConnectYoutubeBtn');
        const popoverViewProfileBtn = document.getElementById('popoverViewProfileBtn');
        if (popoverConnectBtn) popoverConnectBtn.classList.add('hidden');
        if (popoverViewProfileBtn) popoverViewProfileBtn.classList.remove('hidden');

        if (connectBtn) connectBtn.classList.add('hidden');
      } else {
        isAdmin = false;
        currentUserChannelId = null;

        const displayName = user.user_metadata?.username || user.user_metadata?.full_name || user.email.split('@')[0];
        const avatarUrl = getHighQualityAvatarUrl(user.user_metadata?.avatar_url);
        const roleName = 'Viewer';

        if (userDisplay) userDisplay.textContent = displayName;
        const userAvatarEl = document.getElementById('user-display-avatar');
        if (userAvatarEl) userAvatarEl.src = avatarUrl;

        const userRoleEl = document.querySelector('.profile-role-text');
        if (userRoleEl) userRoleEl.textContent = roleName;

        const popoverAvatar = document.getElementById('popover-avatar');
        const popoverUsername = document.getElementById('popover-username');
        const popoverEmail = document.getElementById('popover-email');
        if (popoverAvatar) popoverAvatar.src = avatarUrl;
        const signupName = (userData && userData.name) || user.user_metadata?.name || user.user_metadata?.username || user.user_metadata?.full_name || user.email.split('@')[0];
        if (popoverUsername) popoverUsername.textContent = signupName;
        if (popoverEmail) popoverEmail.textContent = user.email;

        // NOT connected to Youtube: show Connect button in popover, hide Your Clips
        const popoverConnectBtn = document.getElementById('popoverConnectYoutubeBtn');
        const popoverViewProfileBtn = document.getElementById('popoverViewProfileBtn');
        if (popoverConnectBtn) popoverConnectBtn.classList.remove('hidden');
        if (popoverViewProfileBtn) popoverViewProfileBtn.classList.add('hidden');

        if (connectBtn) connectBtn.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  }

  // Connect YouTube navigation button trigger
  const connectBtn = document.getElementById('connectYoutubeNavBtn') || document.getElementById('popoverConnectYoutubeBtn');
  if (connectBtn) {
    connectBtn.onclick = async () => {
      const storedUser = localStorage.getItem('streamclips_user');
      const user = storedUser ? JSON.parse(storedUser) : null;

      const userEmail = user?.email || 'cocthrushed72@gmail.com';
      const userId = user?.id || '';

      connectBtn.disabled = true;
      connectBtn.innerText = 'Connecting...';

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/youtube/headless-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userEmail, userId: userId })
        });
        const data = await res.json();
        if (data.success) {
          alert('YouTube channel connected successfully: ' + (data.handle || '@duplicatebunnysank9'));
          location.reload();
        } else {
          alert('Connection error: ' + (data.error || 'Failed to complete login.'));
        }
      } catch (err) {
        alert('Connection error: ' + err.message);
      } finally {
        connectBtn.disabled = false;
        connectBtn.innerText = 'Connect YouTube';
      }
    };
  }

  window.refreshAuthUI = checkAuth;

  // Initial check, skipping if token swap is active
  if (window.isLinkingYoutube || !(capturedHash && (capturedHash.includes('access_token=') || capturedHash.includes('id_token=')))) {
    checkAuth();
  }
}

// Setup local authentication modal triggers
setupLocalAuth();
