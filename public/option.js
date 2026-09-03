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

console.log('[DEBUG] Start of option.js. Current hash:', capturedHash);

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

const globalStoryboardSpecCache = {};

/* ================= OFFLINE SVG PLACEHOLDERS ================= */
const SVG_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSczMDAnIGhlaWdodD0nMTY4JyB2aWV3Qm94PScwIDAgMzAwIDE2OCc+PHJlY3Qgd2lkdGg9JzEwMCUnIGhlaWdodD0nMTAwJScgZmlsbD0nIzFlMjkzYicvPjx0ZXh0IHg9JzUwJScgeT0nNTAlJyBkb21pbmFudC1iYXNlbGluZT0nbWlkZGxlJyB0ZXh0LWFuY2hvcj0nbWlkZGxlJyBmb250LWZhbWlseT0nc2Fucy1zZXJpZicgZm9udC1zaXplPScxNicgZmlsbD0nIzY0NzQ4Yic+Tm8gVGh1bWJuYWlsPC90ZXh0Pjwvc3ZnPg==';
const AVATAR_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMTUwIDE1MCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzFlMjkzYiIvPjxjaXJjbGUgY3g9Ijc1IiBjeT0iNzUiIHI9IjQwIiBmaWxsPSIjNDc1NTY5Ii8+PC9zdmc+';

function getHighQualityAvatarUrl(url) {
  if (!url) return AVATAR_PLACEHOLDER;
  let highResUrl = url.replace(/=s\d+/, '=s800');
  highResUrl = highResUrl.replace(/sz=\d+/, 'sz=800');
  highResUrl = highResUrl.replace(/\/s\d+-c/, '/s800-c');
  highResUrl = highResUrl.replace(/\/s\d+(-[a-zA-Z0-9_-]+)*\//, '/s800/');
  return highResUrl;
}

// Global active hover preview and timeout references for scroll cancellation
let activePreviewCleanup = null;
let activeHoverTimeout = null;
let activeTiltedElement = null;

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



/* ================= SKELETON LOADER TEMPLATES ================= */
const CREATOR_SKELETON_HTML = `
<div class="skeleton-grid">
  ${Array(4).fill(`
  <div class="skeleton-creator-card">
    <div class="skeleton-avatar"></div>
    <div class="skeleton-title"></div>
    <div class="skeleton-subtitle"></div>
  </div>
  `).join('')}
</div>
`;

const CLIPS_SKELETON_HTML = `
<div class="skeleton-clips-grid">
  ${Array(6).fill(`
  <div class="skeleton-card">
    <div class="skeleton-card-thumb"></div>
    <div class="skeleton-card-body">
      <div class="skeleton-card-line long"></div>
      <div class="skeleton-card-line short"></div>
      <div class="skeleton-card-footer">
        <div class="skeleton-card-avatar-small"></div>
        <div class="skeleton-card-meta"></div>
      </div>
    </div>
  </div>
  `).join('')}
</div>
`;

/* ================= 3D TILT PARALLAX EFFECT ================= */
function setup3DTilt(elements) {
  elements.forEach(el => {
    if (el.dataset.tiltInitialized) return;
    el.dataset.tiltInitialized = "true";
    
    let rect = null;
    
    el.addEventListener('mouseenter', () => {
      if (isScrolling) return;
      rect = el.getBoundingClientRect();
      activeTiltedElement = el;
    });
    
    el.addEventListener('mousemove', (e) => {
      if (isScrolling || !rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const xc = rect.width / 2;
      const yc = rect.height / 2;
      
      const angleX = ((yc - y) / yc) * 8; 
      const angleY = ((x - xc) / xc) * 8;
      
      const isGameCard = el.classList.contains('game-card');
      const scale = isGameCard ? 1.05 : 1.015;
      const lift = isGameCard ? -10 : -6;
      
      el.style.transform = `perspective(1000px) rotateX(${angleX}deg) rotateY(${angleY}deg) scale(${scale}) translateY(${lift}px)`;
    });
    
    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
      rect = null;
      if (activeTiltedElement === el) {
        activeTiltedElement = null;
      }
    });
  });
}

/* ================= MODAL TRANSITIONS ================= */
function openModal(modal) {
  modal.classList.remove('hidden');
  void modal.offsetWidth; // Trigger reflow
  modal.classList.add('show');
}

function closeModal(modal) {
  modal.classList.remove('show');
  setTimeout(() => {
    if (!modal.classList.contains('show')) {
      modal.classList.add('hidden');
    }
  }, 300);
}

// Global recovery listener to catch early redirect events
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    const showModal = () => {
      const resetPasswordModal = document.getElementById('resetPasswordModal');
      if (resetPasswordModal) {
        openModal(resetPasswordModal);
      } else {
        setTimeout(showModal, 50); // wait for DOM
      }
    };
    showModal();
  }
});

/* ================= GLOBAL STATE ================= */
let currentUser = null;
let isAdmin = false;
let currentUserChannelId = null; // YouTube Channel ID linked to the logged-in creator
let currentUserHandle = null; // YouTube Channel Handle linked to the logged-in creator
let currentDashboardProfileId = null; // Profile ID (UUID) of the currently viewed creator
let allBookmarks = [];
let totalClipsCount = 0;
let realtimeChannel = null;
let currentPage = 0; // Current active page for stream-based pagination

// Scrolling detector to prevent storyboard triggers during page scrolls
let isScrolling = false;
let scrollStopTimeout = null;

function handleScrollStart() {
  if (!isScrolling) {
    isScrolling = true;
    document.body.classList.add('is-scrolling');
    // Instantly reset the transform style for the active 3D tilted card element only
    if (activeTiltedElement) {
      activeTiltedElement.style.transform = '';
      activeTiltedElement = null;
    }
    // Instantly cancel any scheduled hover timeout or playing preview
    if (activeHoverTimeout) {
      clearTimeout(activeHoverTimeout);
      activeHoverTimeout = null;
    }
    if (activePreviewCleanup) {
      activePreviewCleanup();
    }
  }

  clearTimeout(scrollStopTimeout);
  scrollStopTimeout = setTimeout(() => {
    isScrolling = false;
    document.body.classList.remove('is-scrolling');
  }, 350); // Debounce scroll stop for 350ms to prevent rapid hover toggling
}

window.addEventListener('scroll', handleScrollStart, { passive: true });
window.addEventListener('wheel', handleScrollStart, { passive: true });
window.addEventListener('touchmove', handleScrollStart, { passive: true });

/* ================= TOAST NOTIFICATIONS ================= */
function showToast(title, description) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast-card';
  toast.innerHTML = `
    <div class="toast-title">${title}</div>
    <div class="toast-description">${description}</div>
    <button class="toast-close" aria-label="Close notification">
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    </button>
  `;

  container.appendChild(toast);

  // Trigger browser paint
  toast.offsetHeight;

  // Entry animation
  toast.classList.add('show');

  const dismissTimeout = setTimeout(() => {
    dismissToast();
  }, 4000);

  function dismissToast() {
    clearTimeout(dismissTimeout);
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => {
      toast.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    }, { once: true });
  }

  const closeBtn = toast.querySelector('.toast-close');
  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      dismissToast();
    };
  }
}

/* ================= DOM ELEMENTS ================= */
// Login Modal
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

// Auth states
const authLogged = document.getElementById('auth-logged');
const authUnlogged = document.getElementById('auth-unlogged');
const logoutBtn = document.getElementById('logoutBtn');
const userDisplay = document.getElementById('user-display');

// Themes & Views
const nightToggle = document.getElementById('darkmode-toggle');
const hubView = document.getElementById('hubView');
const dashboardView = document.getElementById('dashboardView');
const backToHubBtn = document.getElementById('backToHubBtn');

/* ================= AUTHENTICATION ================= */
async function checkAuth() {
  window.refreshAuthUI = checkAuth;
  const storedUser = localStorage.getItem('streamclips_user');
  currentUser = storedUser ? JSON.parse(storedUser) : null;
  const user = currentUser;
  
  const connectBtn = document.getElementById('connectYoutubeNavBtn');

  if (!user) {
    isAdmin = false;
    authUnlogged.classList.remove('hidden');
    authLogged.classList.add('hidden');
    if (connectBtn) connectBtn.classList.add('hidden');
    const setupGuideBtn = document.getElementById('setupGuideNavBtn');
    if (setupGuideBtn) setupGuideBtn.classList.add('hidden');
    return;
  }

  authUnlogged.classList.add('hidden');
  authLogged.classList.remove('hidden');

  // Query profile from YT Timestamp database by email (or user.id)
  const { data, error } = await supabase
    .from('profiles')
    .select('role, channel_id, channel_name, avatar_url, custom_handle')
    .eq('email', user.email)
    .maybeSingle();

  const isConnected = data && data.channel_id;

  if (isConnected) {
    isAdmin = data.role === 'admin';
    currentUserChannelId = data.channel_id || null;
    currentUserHandle = data.custom_handle || null;

    // If logged in and has a channel ID but no channel in URL/path, redirect to their clean channel handle URL
    const urlParams = new URLSearchParams(window.location.search);
    const path = window.location.pathname;
    if (currentUserChannelId && !urlParams.get('channel') && !path.startsWith('/@') && path.includes('dashboard.html')) {
      const handle = currentUserHandle || currentUserChannelId;
      const urlPath = handle.startsWith('@') ? `/${handle}` : `/@${handle}`;
      window.location.href = urlPath;
      return;
    }

    const displayName = data.channel_name || user.user_metadata?.full_name || user.email.split('@')[0];
    const avatarUrl = getHighQualityAvatarUrl(data.avatar_url || user.user_metadata?.avatar_url);
    const roleName = data.role ? (data.role.charAt(0).toUpperCase() + data.role.slice(1).toLowerCase()) : 'Creator';

    if (userDisplay) userDisplay.textContent = displayName;
    const userAvatarEl = document.getElementById('user-display-avatar');
    if (userAvatarEl) userAvatarEl.src = avatarUrl;

    const userRoleEl = document.querySelector('.profile-role-text');
    if (userRoleEl) userRoleEl.textContent = roleName;

    // Populate popover values
    const popoverAvatar = document.getElementById('popover-avatar');
    const popoverUsername = document.getElementById('popover-username');
    const popoverEmail = document.getElementById('popover-email');
    if (popoverAvatar) popoverAvatar.src = avatarUrl;
    if (popoverUsername) popoverUsername.textContent = displayName;
    if (popoverEmail) popoverEmail.textContent = user.email;

     const popoverConnectBtn = document.getElementById('popoverConnectYoutubeBtn');
    const popoverViewProfileBtn = document.getElementById('popoverViewProfileBtn');
    if (popoverConnectBtn) popoverConnectBtn.classList.add('hidden');
    if (popoverViewProfileBtn) popoverViewProfileBtn.classList.remove('hidden');

    if (connectBtn) connectBtn.classList.add('hidden');
    const setupGuideBtn = document.getElementById('setupGuideNavBtn');
    if (setupGuideBtn) setupGuideBtn.classList.remove('hidden');
  } else {
    // User is logged in but not connected to YouTube yet
    isAdmin = false;
    currentUserChannelId = null;
    currentUserHandle = null;

    // Show Username (from metadata or email) and role - Viewer
    const displayName = user.user_metadata?.username || user.user_metadata?.full_name || user.email.split('@')[0];
    // Show Gmail/Google Avatar if YouTube not connected
    const avatarUrl = getHighQualityAvatarUrl(user.user_metadata?.avatar_url);
    const roleName = 'Viewer';

    if (userDisplay) userDisplay.textContent = displayName;
    const userAvatarEl = document.getElementById('user-display-avatar');
    if (userAvatarEl) userAvatarEl.src = avatarUrl;

    const userRoleEl = document.querySelector('.profile-role-text');
    if (userRoleEl) userRoleEl.textContent = roleName;

    // Populate popover values
    const popoverAvatar = document.getElementById('popover-avatar');
    const popoverUsername = document.getElementById('popover-username');
    const popoverEmail = document.getElementById('popover-email');
    if (popoverAvatar) popoverAvatar.src = avatarUrl;
    if (popoverUsername) popoverUsername.textContent = displayName;
    if (popoverEmail) popoverEmail.textContent = user.email;

    const popoverConnectBtn = document.getElementById('popoverConnectYoutubeBtn');
    const popoverViewProfileBtn = document.getElementById('popoverViewProfileBtn');
    if (popoverConnectBtn) popoverConnectBtn.classList.remove('hidden');
    if (popoverViewProfileBtn) popoverViewProfileBtn.classList.add('hidden');

    // Show the "Connect YouTube" button
    if (connectBtn) connectBtn.classList.remove('hidden');
    const setupGuideBtn = document.getElementById('setupGuideNavBtn');
    if (setupGuideBtn) setupGuideBtn.classList.add('hidden');
  }
}

// Setup profile modal for new creators
function showSetupProfileModal(user) {
  const overlay = document.createElement('div');
  overlay.id = 'setup-profile-modal';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(5, 5, 5, 0.9)';
  overlay.style.backdropFilter = 'blur(12px)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '10000';

  const content = document.createElement('div');
  content.style.width = '90%';
  content.style.maxWidth = '460px';
  content.style.padding = '36px';
  content.style.borderRadius = '16px';
  content.style.border = '1px solid rgba(255, 255, 255, 0.08)';
  content.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
  content.style.boxShadow = '0 24px 64px rgba(0, 0, 0, 0.7)';
  content.style.textAlign = 'center';
  content.style.color = '#fff';
  content.style.fontFamily = 'system-ui, -apple-system, sans-serif';

  const title = document.createElement('h2');
  title.textContent = 'Finish Setting Up Your Creator Profile';
  title.style.fontSize = '22px';
  title.style.fontWeight = 'bold';
  title.style.margin = '0 0 8px 0';
  title.style.background = 'linear-gradient(90deg, #00F0FF, #0072FF)';
  title.style.webkitBackgroundClip = 'text';
  title.style.webkitTextFillColor = 'transparent';

  const subtitle = document.createElement('p');
  subtitle.textContent = 'Enter your YouTube Channel Link, handle, or ID to complete your registration and link your stream clips.';
  subtitle.style.fontSize = '14px';
  subtitle.style.color = 'rgba(255, 255, 255, 0.6)';
  subtitle.style.margin = '0 0 28px 0';
  subtitle.style.lineHeight = '1.5';

  const inputWrapper = document.createElement('div');
  inputWrapper.style.position = 'relative';
  inputWrapper.style.marginBottom = '18px';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'e.g. @username or UCxxxxxxxxxxxxxx';
  input.style.width = '100%';
  input.style.padding = '12px 16px';
  input.style.borderRadius = '8px';
  input.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
  input.style.border = '1px solid rgba(255, 255, 255, 0.15)';
  input.style.color = '#fff';
  input.style.fontSize = '14px';
  input.style.outline = 'none';
  input.style.boxSizing = 'border-box';
  input.style.transition = 'border-color 0.2s';
  input.onfocus = () => input.style.borderColor = '#00F0FF';
  input.onblur = () => input.style.borderColor = 'rgba(255, 255, 255, 0.15)';

  const errorMsg = document.createElement('p');
  errorMsg.style.color = '#FF007A';
  errorMsg.style.fontSize = '13px';
  errorMsg.style.margin = '8px 0 0 0';
  errorMsg.style.display = 'none';

  const submitBtn = document.createElement('button');
  submitBtn.textContent = 'Link YouTube Channel';
  submitBtn.style.width = '100%';
  submitBtn.style.padding = '12px';
  submitBtn.style.borderRadius = '8px';
  submitBtn.style.border = 'none';
  submitBtn.style.background = 'linear-gradient(90deg, #00F0FF, #0072FF)';
  submitBtn.style.color = '#fff';
  submitBtn.style.fontWeight = 'bold';
  submitBtn.style.fontSize = '15px';
  submitBtn.style.cursor = 'pointer';
  submitBtn.style.transition = 'opacity 0.2s';
  submitBtn.onmouseover = () => submitBtn.style.opacity = '0.9';
  submitBtn.onmouseout = () => submitBtn.style.opacity = '1';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Sign Out';
  cancelBtn.style.marginTop = '16px';
  cancelBtn.style.background = 'none';
  cancelBtn.style.border = 'none';
  cancelBtn.style.color = 'rgba(255, 255, 255, 0.4)';
  cancelBtn.style.fontSize = '13px';
  cancelBtn.style.cursor = 'pointer';
  cancelBtn.style.textDecoration = 'underline';
  cancelBtn.onclick = () => {
    localStorage.removeItem('streamclips_token');
    localStorage.removeItem('streamclips_user');
    localStorage.removeItem('streamclips_p1_refresh_token');
    window.location.reload();
  };

  submitBtn.onclick = async () => {
    const identifier = input.value.trim();
    if (!identifier) {
      errorMsg.textContent = 'Please enter a valid channel identifier';
      errorMsg.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying YouTube Channel...';
    errorMsg.style.display = 'none';

    try {
      const resolveRes = await fetch(`${BACKEND_URL}/api/resolve-channel?identifier=${encodeURIComponent(identifier)}`);
      const resolveData = await resolveRes.json();
      
      if (!resolveData || !resolveData.success) {
        throw new Error(resolveData?.error || 'YouTube channel not found. Please verify your Handle or Channel ID.');
      }

      submitBtn.textContent = 'Linking Profile...';
      
      // Upsert profile in Project 2
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          channel_id: resolveData.channelId,
          channel_name: resolveData.name,
          custom_handle: resolveData.customHandle || '',
          avatar_url: resolveData.avatar,
          total_views: resolveData.views || 0,
          subscribers: resolveData.subscribers || 0,
          role: 'creator'
        }, { onConflict: 'id' });

      if (profileError) throw profileError;

      overlay.remove();
      window.location.reload();
    } catch (err) {
      console.error(err);
      errorMsg.textContent = err.message;
      errorMsg.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Link YouTube Channel';
    }
  };

  inputWrapper.appendChild(input);
  content.appendChild(title);
  content.appendChild(subtitle);
  content.appendChild(inputWrapper);
  content.appendChild(errorMsg);
  content.appendChild(submitBtn);
  content.appendChild(cancelBtn);
  overlay.appendChild(content);
  document.body.appendChild(overlay);
}

/* ================= LOGIN DIALOGS ================= */
function setupAuthButtons() {
  if (!showLoginBtn) return;

  // Redirect to full-screen central auth login/signup pages
  showLoginBtn.onclick = () => {
    const nextTarget = window.location.href;
    window.location.href = `${MAIN_WEBSITE_URL}/login?next=${encodeURIComponent(nextTarget)}`;
  };

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
  window.onclick = (e) => {
    if (e.target === loginModal) {
      closeModal(loginModal);
      resetLoginForm();
    }
  };

  // Show/Hide password
  togglePasswordBtn.onclick = () => {
    const hidden = passwordInput.type === 'password';
    passwordInput.type = hidden ? 'text' : 'password';
    togglePasswordBtn.textContent = hidden ? '🙈' : '👁';
  };

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

        loginBtn.textContent = 'Creating account…';

        // 2. Sign up auth account
        const { data: authData, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;

        if (authData.user) {
          // 3. Upsert creator profile details (email, role, channel_id, channel_name, avatar_url, total_views, and subscribers)
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: authData.user.id,
              email: email,
              channel_id: resolvedChannelId,
              channel_name: resolvedName,
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
        location.reload();
      }
    }
  };

  logoutBtn.onclick = () => {
    localStorage.removeItem('streamclips_token');
    localStorage.removeItem('streamclips_user');
    localStorage.removeItem('streamclips_p1_refresh_token');
    location.reload();
  };

  // Connect YouTube navigation button trigger
  const connectBtn = document.getElementById('connectYoutubeNavBtn');
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
            prompt: 'select_account consent',
            access_type: 'offline'
          }
        }
      });
    };
  }

  // Forgot Password trigger
  const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
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

  // Reset Password Modal - Eye toggle
  const toggleNewPasswordBtn = document.getElementById('toggleNewPassword');
  const newPasswordInput = document.getElementById('newPassword');
  toggleNewPasswordBtn.onclick = () => {
    const hidden = newPasswordInput.type === 'password';
    newPasswordInput.type = hidden ? 'text' : 'password';
    toggleNewPasswordBtn.textContent = hidden ? '🙈' : '👁';
  };

  // Reset Password Modal - Submit
  const saveNewPasswordBtn = document.getElementById('saveNewPasswordBtn');
  const resetPasswordModal = document.getElementById('resetPasswordModal');
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

  updateSubmitState();

  // Auto-open login modal if URL query specifies login=true
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('login') === 'true') {
    openModal(loginModal);
    if (emailInput) emailInput.focus();
    // Clean up URL to look clean
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }
  }
}

function resetLoginForm() {
  modalTitle.textContent = 'Creator Login';
  channelIdGroup.classList.add('hidden');
  forgotPasswordBtn.classList.remove('hidden');
  toggleAuthModeBtn.textContent = "Don't have an account? Sign Up";
  emailInput.value = '';
  passwordInput.value = '';
  channelIdInput.value = '';
  passwordInput.type = 'password';
  togglePasswordBtn.textContent = '👁';
  loginBtn.textContent = 'Submit';
  loginBtn.disabled = true;
}

/* ================= 🌓 THEMES ================= */
function setupNightMode() {
  const saved = localStorage.getItem('nightMode') !== 'false'; // Default to true (night mode enabled)
  document.body.classList.toggle('dark-mode', saved);
  document.body.classList.toggle('light-mode', !saved);
  document.documentElement.classList.toggle('dark', saved);
  
  if (nightToggle) {
    nightToggle.checked = !saved; // unchecked = dark mode (moon), checked = light mode (sun)

    nightToggle.onclick = () => {
      const lightModeEnabled = nightToggle.checked;
      const nightModeEnabled = !lightModeEnabled;
      document.body.classList.toggle('dark-mode', nightModeEnabled);
      document.body.classList.toggle('light-mode', lightModeEnabled);
      document.documentElement.classList.toggle('dark', nightModeEnabled);
      localStorage.setItem('nightMode', nightModeEnabled);
    };
  }
}

/* ================= 🌐 SPA ROUTING ================= */
function getSelectedChannelId() {
  const pathname = window.location.pathname;
  if (pathname.startsWith('/@')) {
    const handle = decodeURIComponent(pathname.substring(1));
    return handle === '@default_streamer' ? 'default_streamer' : handle;
  }
  const params = new URLSearchParams(window.location.search);
  return params.get('channel');
}

function getSelectedPage() {
  const params = new URLSearchParams(window.location.search);
  const p = parseInt(params.get('page'), 10);
  return isNaN(p) || p < 1 ? 0 : p - 1;
}

function updateHistoryState(chId, page) {
  const pathname = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  urlParams.set('page', page);
  
  if (pathname.startsWith('/@')) {
    history.replaceState(null, '', `${pathname}?${urlParams.toString()}`);
  } else {
    if (chId) {
      urlParams.set('channel', chId);
    }
    history.replaceState(null, '', `?${urlParams.toString()}`);
  }
}

async function updateViewState() {
  const path = window.location.pathname;
  if (path.includes('dashboard.html')) {
    const urlParams = new URLSearchParams(window.location.search);
    const channelParam = urlParams.get('channel');
    if (channelParam) {
      const handle = channelParam;
      const urlPath = handle.startsWith('@') ? `/${handle}` : `/@${handle}`;
      window.location.replace(urlPath);
      return;
    } else {
      window.location.replace('/');
      return;
    }
  }

  const chId = getSelectedChannelId();
  
  if (chId) {
    // Creator specific dashboard
    hubView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    
    // Always start at the top of the page when opening a creator's clip page
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // Clear filter
    document.getElementById('filter').value = '';
    window.updateSearchPlaceholder?.();
    
    // Read page parameter from URL
    currentPage = getSelectedPage();
    
    // Fetch and listen
    await getBookmarks(chId);
    setupRealtime(chId);

    // Apply initial clipper filter if present in URL
    const urlParams = new URLSearchParams(window.location.search);
    const clipperFilter = urlParams.get('clipper');
    const searchInput = document.getElementById('filter');
    if (clipperFilter && searchInput) {
      searchInput.value = clipperFilter;
      applyFilters(false);
    }

    // Auto-start page tour for first-time visitors
    if (window.clipsPageTour) {
      setTimeout(() => {
        if (localStorage.getItem('streamclips_tour_completed') !== 'true') {
          window.clipsPageTour.start();
        }
      }, 1500);
    }
  } else {
    // Check if user is logged in before redirecting back to landing page (allow public pages)
    const pathname = window.location.pathname;
    const isPublicPage = pathname === '/' || 
                         pathname === '/index.html' || 
                         pathname === '/features.html' || 
                         pathname === '/features' || 
                         pathname === '/help.html' || 
                         pathname === '/help' || 
                         pathname === '/3d-demo.html' || 
                         pathname === '/3d-demo' ||
                         pathname === '/analytics.html' || 
                         pathname === '/analytics' || 
                         pathname === '';
    if (!isPublicPage) {
      const storedUser = localStorage.getItem('streamclips_user');
      if (!storedUser) {
        window.location.href = '/';
      }
    }
  }
}

function setupRouting() {
  // Brand logo click to HOME Page
  const brandLogo = document.getElementById('brand-logo');
  if (brandLogo) {
    brandLogo.onclick = () => {
      window.location.href = '/';
    };
  }

  // Back button
  if (backToHubBtn) {
    backToHubBtn.onclick = () => {
      window.location.href = '/';
    };
  }

  // Browser back/forward navigation
  window.onpopstate = () => {
    updateViewState();
  };
}

/* ================= 📡 REALTIME ================= */
function setupRealtime(currentStreamerId) {
  if (realtimeChannel) {
    realtimeChannel.unsubscribe();
    realtimeChannel = null;
  }

  if (currentStreamerId) {
    // Only subscribe to changes in the clips table for this specific streamer
    const filterConfig = { event: '*', schema: 'public', table: 'clips' };
    if (currentDashboardProfileId) {
      filterConfig.filter = `profile_id=eq.${currentDashboardProfileId}`;
    }

    realtimeChannel = supabase
      .channel('clips-realtime')
      .on(
        'postgres_changes',
        filterConfig,
        (payload) => {
          const record = payload.new || payload.old;
          if (record) {
            // Extra safety checks to ensure we don't handle incorrect channel clips
            if (currentDashboardProfileId && record.profile_id !== currentDashboardProfileId) return;
            if (!currentDashboardProfileId && record.profile_id) return;
            handleRealtimeEvent(payload, currentStreamerId);
          }
        }
      )
      .subscribe();
  } else {
    // On the landing page, only subscribe to profiles table changes (new creators registering)
    realtimeChannel = supabase
      .channel('profiles-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          renderCreatorDirectory(true); // Render silently without wiggling DOM or showing skeleton
        }
      )
      .subscribe();
  }
}

/* ================= 🚀 CORE INITIALIZATION ================= */
document.addEventListener('DOMContentLoaded', async () => {
  // Check if updates have already been seen
  if (localStorage.getItem('has_seen_updates_v13') === 'true') {
    const badges = document.querySelectorAll('.updates-badge');
    badges.forEach(badge => badge.classList.add('hidden'));
  }

  // Disable browser scroll restoration so we fully control scroll position on SPA navigation
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  // Scroll performance optimization: handled by the global handleScrollStart scroll listener

  setupAuthButtons();
  setupNightMode();
  setupRouting();

  // Handle Creators link click for smooth scrolling
  const creatorsNavLinks = document.querySelectorAll('a[href*="#creators-section"]');
  creatorsNavLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const creatorsSection = document.getElementById('creators-section');
      const hubView = document.getElementById('hubView');
      const isHubHidden = hubView && hubView.classList.contains('hidden');
      
      if (creatorsSection && !isHubHidden) {
        e.preventDefault();
        creatorsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.location.href = '/#creators-section';
      }
    });
  });
  // Load authentication status and page views in parallel to minimize initial render latency, skipping if token swap is active
  if (window.isLinkingYoutube || !(capturedHash && (capturedHash.includes('access_token=') || capturedHash.includes('id_token=')))) {
    if (typeof refreshPromise !== 'undefined') {
      await refreshPromise;
    }
    await Promise.all([
      checkAuth(),
      updateViewState()
    ]);
  }

  // Search and filter handlers
  const searchInput = document.getElementById('filter');
  if (searchInput) {
    searchInput.addEventListener('input', () => applyFilters(false));
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyFilters(false);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        searchInput.value = '';
        applyFilters(false);
      }
    });
    setupSuggestiveSearch();
  }

  const favFilterToggle = document.getElementById('favFilterToggle');
  if (favFilterToggle) {
    favFilterToggle.addEventListener('change', () => {
      applyFilters(false, true);
    });
  }

  // Level & Game & Group-by-stream filter change listeners
  document.getElementById('levelFilter')?.addEventListener('change', () => applyFilters(false, true));
  document.getElementById('gameFilter')?.addEventListener('change', () => applyFilters(false, true));
  document.getElementById('groupByStreamToggle')?.addEventListener('change', () => applyFilters(false, true));

  // Initialize custom dropdowns
  setupCustomDropdown('levelDropdownContainer', 'levelFilter');
  setupCustomDropdown('gameDropdownContainer', 'gameFilter');

  // Initialize Page Tour Guide
  if (typeof ClipsPageTour !== 'undefined') {
    window.clipsPageTour = new ClipsPageTour();
  }
});

/* ================= 🛠 HELPERS ================= */
function mapClip(b) {
  const username = b.username || 'Unknown Viewer';
  const cleanUser = username.replace('@', '');
  const profileUrl = username && username !== 'Unknown Viewer' && username !== 'unknown'
    ? (username.startsWith('@') ? 'https://www.youtube.com/' + username : 'https://www.youtube.com/@' + username)
    : '#';
  const thumbnail = b.video_id
    ? `https://i.ytimg.com/vi/${b.video_id}/mqdefault.jpg`
    : SVG_PLACEHOLDER;

  return {
    id: b.id,
    time: b.timestamp_seconds,
    desc: b.description || 'None',
    date: b.created_at,
    username: username,
    profileUrl: profileUrl,
    videoId: b.video_id,
    videoTitle: b.streams?.video_title || b.video_title || 'Live Stream',
    thumbnail: thumbnail,
    profileId: b.profile_id,
    streamerId: b.profiles?.channel_id || '',
    isFavorite: b.is_favorite || false,
    userRole: b.user_role || 'everyone',
    gameName: b.games?.game_title || '',
    gameTitle: b.games?.game_title || '',
    gamePoster: b.games?.game_poster || '',
    storyboardSpec: b.streams?.storyboard_spec || null
  };
}

function getRelativeTime(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function getTime(sec) {
  const d = new Date(0);
  d.setSeconds(sec);
  return d.toISOString().slice(11, 19);
}

function secondsToTime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = Math.floor(s % 60);
  return `${h}h${m}m${r}s`;
}

function getEmptyStateHTML(title, description, iconSvg = '') {
  const defaultSearchIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
    </svg>
  `;
  
  return `
    <div class="empty-state">
      <div class="empty-state-icon">
        ${iconSvg || defaultSearchIcon}
      </div>
      <h3>${title}</h3>
      <p>${description}</p>
    </div>
  `;
}

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

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
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

function initBorderGlow(cardEl, r, g, b) {
  const hsl = rgbToHsl(r, g, b);
  
  // Set HSL base variable (H S L values for the glow color, as "H S L")
  const glowIntensity = 1.0;
  const base = `${hsl.h}deg ${hsl.s}% ${hsl.l}%`;
  
  // Build HSL opacities variables similar to buildGlowVars
  const opacities = [100, 60, 50, 40, 30, 20, 10];
  const keys = ['', '-60', '-50', '-40', '-30', '-20', '-10'];
  for (let i = 0; i < opacities.length; i++) {
    cardEl.style.setProperty(`--glow-color${keys[i]}`, `hsl(${base} / ${Math.min(opacities[i] * glowIntensity, 100)}%)`);
  }
  cardEl.style.setProperty('--glow-color', `hsl(${base} / 100%)`);
  
  // Mesh gradient variables
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
  
  // Set edge settings props
  cardEl.style.setProperty('--edge-sensitivity', '30');
  cardEl.style.setProperty('--border-radius', '20'); // 20px
  cardEl.style.setProperty('--glow-padding', '40');
  cardEl.style.setProperty('--cone-spread', '25');
  cardEl.style.setProperty('--fill-opacity', '0.5');
  
  // Initialize pointermove only once
  if (cardEl.dataset.borderGlowInitialized) return;
  cardEl.dataset.borderGlowInitialized = "true";
  
  let rect = null;
  cardEl.addEventListener('pointerenter', () => {
    if (isScrolling) return;
    rect = cardEl.getBoundingClientRect();
  });
  
  cardEl.addEventListener('pointermove', (e) => {
    if (isScrolling) return;
    if (!rect) {
      rect = cardEl.getBoundingClientRect();
    }
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // getEdgeProximity
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    let kx = Infinity;
    let ky = Infinity;
    if (dx !== 0) kx = cx / Math.abs(dx);
    if (dy !== 0) ky = cy / Math.abs(dy);
    const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
    
    // getCursorAngle
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

  cardEl.addEventListener('pointerleave', () => {
    rect = null;
  });
}

/* Helper to dynamically update the border/glow color of the avatar container based on the display picture */
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
        if (a > 200) { // Opaque pixels only
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
        
        // If this is a creator card, also initialize the interactive border glow!
        if (containerEl.classList.contains('creator-card')) {
          initBorderGlow(containerEl, r, g, b);
        }
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

/* ================= 📂 FETCH & RENDER LOGIC ================= */

// View A: Render active creator directory
async function renderCreatorDirectory(silent = false) {
  const container = document.getElementById('creator-grid');
  if (!silent) {
    container.innerHTML = CREATOR_SKELETON_HTML;
  }

  try {
    // 1. Fetch registered creators from profiles table
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

    // 2. Fetch counts in parallel
    const countPromises = profiles.map(async (profile) => {
      const { count, error } = await supabase
        .from('clips')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', profile.id);
      return { id: profile.id, count: error ? 0 : (count || 0) };
    });

    // Also fetch legacy counts (where profile_id is null)
    const legacyCountPromise = supabase
      .from('clips')
      .select('*', { count: 'exact', head: true })
      .is('profile_id', null)
      .then(({ count, error }) => ({ id: 'default_profile', count: error ? 0 : (count || 0) }));

    const countResults = await Promise.all([...countPromises, legacyCountPromise]);

    const clipCounts = {};
    countResults.forEach(res => {
      clipCounts[res.id] = res.count;
    });

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

    const thumbResults = await Promise.all([...thumbPromises, legacyThumbPromise]);

    const latestThumbnails = {};
    thumbResults.forEach(res => {
      latestThumbnails[res.id] = res.thumbnail;
    });

    // 4. Build creator items
    const creators = {};
    profiles.forEach(profile => {
      const pId = profile.id;
      const sId = profile.channel_id;
      const count = clipCounts[pId] || 0;
      const identifier = profile.channel_name || sId;
       creators[sId] = {
        id: sId,
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

    // Handle legacy clips with null profile_id
    if (clipCounts['default_profile']) {
      creators['default_streamer'] = {
        id: 'default_streamer',
        identifier: 'default_streamer',
        name: 'Legacy Channel',
        clipCount: clipCounts['default_profile'],
        totalViews: 0,
        subscribers: 0,
        thumbnail: getHighQualityAvatarUrl(latestThumbnails['default_profile']),
        isSpecial: false
      };
    }

    container.innerHTML = '';
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

    if (creatorList.length === 0) {
      container.innerHTML = getEmptyStateHTML(
        'No creators registered',
        'No creators are registered yet. Click Admin Login -> Sign Up to link your channel!',
        `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A2.25 2.25 0 0112.75 21.5h-1.5a2.25 2.25 0 01-2.25-2.263V19.13m5.25-.003c-.001-.246-.015-.49-.043-.733m-9.82 1.13A9.329 9.329 0 003 19.53a9.33 9.33 0 004.119.953m0 0c.23 0 .456-.01.68-.027m-1.36-.926c.032.227.054.455.068.684m0 0h-.011M7.5 14.25a3 3 0 00-3 3v1.5m16.5-4.5a3 3 0 013 3v1.5m-16.5-6a3 3 0 100-6 3 3 0 000 6zm9 0a3 3 0 100-6 3 3 0 000 6z" />
        </svg>
        `
      );
      return;
    }

    creatorList.forEach(creator => {
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
                <span class="stat-value pink-text">${formatNumber(creator.subscribers || 0)}</span>
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
        if (creator.id === 'default_streamer') {
          history.pushState(null, '', `?channel=default_streamer&page=1`);
        } else {
          const handle = creator.custom_handle || creator.id;
          const urlPath = handle.startsWith('@') ? `/${handle}` : `/@${handle}`;
          history.pushState(null, '', `${urlPath}?page=1`);
        }
        updateViewState();
      };

      container.appendChild(card);

      // Extract colors for this avatar
      const imgEl = card.querySelector('.creator-card-avatar');
      updateAvatarGlow(imgEl, card);
    });

    // Add 3D Tilt effect
    setup3DTilt(container.querySelectorAll('.creator-card'));

    // 5. Fetch fresh views count from YouTube API in the background to keep the values up to date
    fetch(`${BACKEND_URL}/api/creators/refresh-views`)
      .then(res => res.json())
      .then(data => {
        if (data && data.success) {
          if (data.creators) {
            for (const [channelId, creatorInfo] of Object.entries(data.creators)) {
              const cardEl = container.querySelector(`[data-channel-id="${channelId}"]`);
              if (cardEl) {
                // Update views count
                const viewsSpan = cardEl.querySelector('.stat-value.blue-text');
                if (viewsSpan && creatorInfo.views !== undefined) {
                  viewsSpan.textContent = formatNumber(creatorInfo.views);
                }
                // Update subscribers count
                const subsSpan = cardEl.querySelector('.stat-value.pink-text');
                if (subsSpan && creatorInfo.subscribers !== undefined) {
                  subsSpan.textContent = formatNumber(creatorInfo.subscribers);
                }
                // Update channel name
                const nameEl = cardEl.querySelector('.creator-name');
                if (nameEl && creatorInfo.name) {
                  nameEl.textContent = creatorInfo.name;
                }
                // Update avatar thumbnail & re-trigger glow detection
                const avatarEl = cardEl.querySelector('.creator-card-avatar');
                if (avatarEl && creatorInfo.avatar) {
                  avatarEl.setAttribute('crossorigin', 'anonymous');
                  avatarEl.src = creatorInfo.avatar;
                  updateAvatarGlow(avatarEl, cardEl);
                }
              }
            }
          } else if (data.views) {
            // Fallback for backward compatibility
            for (const [channelId, views] of Object.entries(data.views)) {
              const cardEl = container.querySelector(`[data-channel-id="${channelId}"]`);
              if (cardEl) {
                const viewsSpan = cardEl.querySelector('.stat-value.blue-text');
                if (viewsSpan) {
                  viewsSpan.textContent = formatNumber(views);
                }
              }
            }
          }
        }
      })
      .catch(err => console.warn('Could not refresh views count:', err));

  } catch (err) {
    console.error('Error fetching creator list:', err);
    container.innerHTML = `<div class="error-state">Failed to load creators directory: ${err.message || err}</div>`;
  }
}

// View B: Fetch clips for selected creator
async function getBookmarks(streamerId) {
  const container = document.getElementById('bookmark-list');
  container.innerHTML = CLIPS_SKELETON_HTML;
  currentPage = getSelectedPage(); // Read page parameter from URL

  // Reset favorites filter checkbox when loading a new channel
  const favFilterToggle = document.getElementById('favFilterToggle');
  if (favFilterToggle) favFilterToggle.checked = false;

  // Reset game filter when loading a new channel
  const gameFilter = document.getElementById('gameFilter');
  if (gameFilter) {
    gameFilter.value = '';
    delete gameFilter.dataset.allGamesSelected;
  }

  try {
    // 1. Fetch creator profile details
    let creatorName = 'Creator';
    let profileId = null;
    let creatorAvatar = null;
    let resolvedChannelId = streamerId;
    let customHandle = null;
    currentDashboardProfileId = null;
    
    if (streamerId && streamerId !== 'default_streamer') {
      // First try to look up by custom_handle (URL handle e.g. @bunnysank)
      let { data: profile } = await supabase
        .from('profiles')
        .select('id, channel_id, channel_name, email, avatar_url, custom_handle')
        .eq('custom_handle', streamerId)
        .maybeSingle();

      // Fallback 1: look up by channel_name (exact match or URL parameter)
      if (!profile) {
        const { data: profByName } = await supabase
          .from('profiles')
          .select('id, channel_id, channel_name, email, avatar_url, custom_handle')
          .eq('channel_name', streamerId)
          .maybeSingle();
        profile = profByName;
      }
        
      // Fallback 2: look up by channel_id
      if (!profile) {
        const cleanId = streamerId.startsWith('@') ? streamerId.substring(1) : streamerId;
        const { data: profById } = await supabase
          .from('profiles')
          .select('id, channel_id, channel_name, email, avatar_url, custom_handle')
          .eq('channel_id', cleanId)
          .maybeSingle();
        profile = profById;
      }

      if (profile) {
        creatorName = profile.channel_name || profile.email.split('@')[0] || 'Creator';
        profileId = profile.id;
        resolvedChannelId = profile.channel_id;
        creatorAvatar = profile.avatar_url;
        currentDashboardProfileId = profile.id;
        customHandle = profile.custom_handle || null;

        // Restore dashboard content layout and hide error container
        const dashboardView = document.getElementById('dashboardView');
        if (dashboardView) {
          Array.from(dashboardView.children).forEach(child => {
            if (child.id === 'creator-not-found-error') {
              child.classList.add('hidden');
              child.style.display = 'none';
            } else {
              child.style.display = '';
            }
          });
        }
      }

      if (streamerId && streamerId !== 'default_streamer' && !profile) {
        // Hide normal dashboard layout elements and show full-page error state
        const dashboardView = document.getElementById('dashboardView');
        if (dashboardView) {
          Array.from(dashboardView.children).forEach(child => {
            if (child.id === 'creator-not-found-error') {
              child.classList.remove('hidden');
              child.style.display = 'flex';
            } else {
              child.style.display = 'none';
            }
          });
        }
        return;
      }
    } else {
      creatorName = 'Legacy Channel';
    }

    const canManageChannel = isAdmin || 
                             (currentUser && (
                               (profileId && currentUser.id === profileId) ||
                               (!profileId && currentUserChannelId && currentUserChannelId === resolvedChannelId)
                             ));

    // 2. Fetch clips and exact count (directly joining normalized games table)
    // We fetch in chunks of 1000 to bypass PostgREST's default max_rows limit
    let countQuery = supabase.from('clips').select('*', { count: 'exact', head: true });
    
    if (!canManageChannel) {
      countQuery = countQuery.or('is_hidden.is.null,is_hidden.eq.false');
    }
    
    if (profileId) {
      countQuery = countQuery.eq('profile_id', profileId);
    } else if (streamerId === 'default_streamer') {
      countQuery = countQuery.is('profile_id', null);
    }

    const countRes = await countQuery;
    if (countRes.error) throw countRes.error;
    totalClipsCount = countRes.count || 0;

    let allClipsData = [];
    let from = 0;
    const chunkSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let chunkQuery = supabase
        .from('clips')
        .select('*, games(*), streams(video_title, storyboard_spec), profiles(channel_id, channel_name)');

      if (!canManageChannel) {
        chunkQuery = chunkQuery.or('is_hidden.is.null,is_hidden.eq.false');
      }

      if (profileId) {
        chunkQuery = chunkQuery.eq('profile_id', profileId);
      } else if (streamerId === 'default_streamer') {
        chunkQuery = chunkQuery.is('profile_id', null);
      }

      const { data, error } = await chunkQuery
        .order('created_at', { ascending: false })
        .range(from, from + chunkSize - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allClipsData = allClipsData.concat(data);
        if (data.length < chunkSize) {
          hasMore = false;
        } else {
          from += chunkSize;
        }
      } else {
        hasMore = false;
      }
    }

    allBookmarks = allClipsData.map(b => {
      const g = b.games;
      const username = b.username || 'Unknown Viewer';
      const cleanUser = username.replace('@', '');
      const profileUrl = username && username !== 'Unknown Viewer' && username !== 'unknown'
        ? (username.startsWith('@') ? 'https://www.youtube.com/' + username : 'https://www.youtube.com/@' + username)
        : '#';
      const thumbnail = b.video_id
        ? `https://i.ytimg.com/vi/${b.video_id}/mqdefault.jpg`
        : SVG_PLACEHOLDER;

      return {
        id: b.id,
        time: b.timestamp_seconds,
        desc: b.description || 'None',
        date: b.created_at,
        username: username,
        profileUrl: profileUrl,
        videoId: b.video_id,
        videoTitle: b.streams?.video_title || b.video_title || 'Live Stream',
        thumbnail: thumbnail,
        profileId: b.profile_id,
        streamerId: b.profiles?.channel_id || '',
        isFavorite: b.is_favorite || false,
        isHidden: b.is_hidden === true,
        userRole: b.user_role || 'everyone',
        gameName: g?.game_title || '',
        gameTitle: g?.game_title || '',
        gamePoster: g?.game_poster || '',
        storyboardSpec: b.streams?.storyboard_spec || null
      };
    });
    
    populateGameDropdown(allBookmarks);

    const latestThumb = allBookmarks.length > 0 ? allBookmarks[0].thumbnail : SVG_PLACEHOLDER;

    // Inject dynamic blurred background
    const bgContainer = document.getElementById('dynamic-bg-container');
    if (bgContainer) {
      bgContainer.style.backgroundImage = `url('${latestThumb}')`;
      document.documentElement.style.setProperty('--dynamic-bg-url', `url('${latestThumb}')`);
    }

    document.getElementById('creator-name').textContent = `${creatorName} Clips...`;
    const dashboardAvatar = document.getElementById('creator-avatar');
    dashboardAvatar.src = creatorAvatar || latestThumb || AVATAR_PLACEHOLDER;
    const dashboardAvatarLink = document.getElementById('creator-avatar-link');
    if (dashboardAvatar && dashboardAvatarLink) {
      updateAvatarGlow(dashboardAvatar, dashboardAvatarLink);
    }
    document.getElementById('creator-yt-link').href = resolvedChannelId === 'default_streamer' ? '#' : `https://www.youtube.com/channel/${resolvedChannelId}`;
    document.getElementById('creator-meta-desc').textContent = `Browse clips and bookmarks recorded by the ${creatorName} community.`;
    const analyticsBtn = document.getElementById('creator-analytics-btn');
    if (analyticsBtn) {
      const tempUpliftLock = true; // Temporary lock override
      if (canManageChannel || tempUpliftLock) {
        const analyticsIdentifier = customHandle || resolvedChannelId;
        analyticsBtn.href = resolvedChannelId === 'default_streamer' ? '#' : `/${analyticsIdentifier}/analytics`;
        analyticsBtn.classList.remove('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
        const span = analyticsBtn.querySelector('span');
        if (span) span.innerHTML = 'Analytics';
      } else {
        analyticsBtn.href = '#';
        analyticsBtn.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
        const span = analyticsBtn.querySelector('span');
        if (span) span.innerHTML = 'Analytics 🔒';
      }
    }
    
    // Update dynamic clips count, avatar link, and gift membership link
    updateCreatorClipsCount();
    const avatarLink = document.getElementById('creator-avatar-link');
    if (avatarLink) {
      avatarLink.href = resolvedChannelId === 'default_streamer' ? '#' : `https://www.youtube.com/channel/${resolvedChannelId}`;
    }
    const giftBtn = document.getElementById('creator-gift-btn');
    if (giftBtn) {
      giftBtn.href = resolvedChannelId === 'default_streamer' ? '#' : `https://www.youtube.com/channel/${resolvedChannelId}/join`;
    }

    renderGroupedBookmarks(allBookmarks);
  } catch (err) {
    console.error('Error fetching bookmarks:', err);
    container.innerHTML = `<div class="error-state">Failed to load clips: ${err.message || err}</div>`;
  }
}

function updateCreatorClipsCount() {
  const countElement = document.getElementById('creator-clips-count');
  const totalBadge = document.getElementById('creator-total-badge');
  
  if (totalBadge) {
    totalBadge.textContent = `${totalClipsCount} Total Clips`;
  }

  if (!countElement) return;

  const uniqueStreamIds = [];
  allBookmarks.forEach(b => {
    if (b.videoId && !uniqueStreamIds.includes(b.videoId)) {
      uniqueStreamIds.push(b.videoId);
    }
  });
  const latestTwoStreams = uniqueStreamIds.slice(0, 2);
  const clipsCount = allBookmarks.filter(b => latestTwoStreams.includes(b.videoId)).length;
  
  countElement.textContent = `${clipsCount} clips captured from last 2 live streams`;
}

// Promise-based custom confirmation modal
function showCustomConfirm(message = "Are you sure you want to delete this clip?", title = "Delete Clip") {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    const msgEl = document.getElementById('confirmMessage');
    const titleEl = document.getElementById('confirmTitle');
    const yesBtn = document.getElementById('confirmYesBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');
    const closeBtn = document.getElementById('closeConfirmModal');

    if (!modal) {
      resolve(confirm(message));
      return;
    }

    if (msgEl) msgEl.innerText = message;
    if (titleEl) titleEl.innerText = title;

    // Show custom modal
    modal.classList.remove('hidden');
    void modal.offsetWidth; // Force reflow
    modal.classList.add('show');

    function cleanup(value) {
      modal.classList.remove('show');
      setTimeout(() => {
        modal.classList.add('hidden');
      }, 300);

      // Clean up event handlers
      yesBtn.onclick = null;
      cancelBtn.onclick = null;
      closeBtn.onclick = null;
      modal.onclick = null;

      resolve(value);
    }

    yesBtn.onclick = () => cleanup(true);
    cancelBtn.onclick = () => cleanup(false);
    closeBtn.onclick = () => cleanup(false);

    // Cancel on backdrop click
    modal.onclick = (e) => {
      if (e.target === modal) {
        cleanup(false);
      }
    };
  });
}

/* ================= 🗑 DELETE ACTION ================= */
async function handleDelete(id, streamerId, profileId) {
  const canManage = isAdmin || 
                    (currentUser && (
                      (profileId && currentUser.id === profileId) || 
                      (!profileId && currentUserChannelId && currentUserChannelId === streamerId)
                    ));
  if (!canManage) return;
  const confirmed = await showCustomConfirm('Are you sure you want to delete this clip?', 'Delete Clip');
  if (!confirmed) return;
  
  try {
    // Delete via backend API to bypass client-side RLS locks
    const response = await fetch(`${BACKEND_URL}/api/clip/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }
    
    const result = await response.json();
    if (!result.success) {
      throw new Error('Backend failed to delete clip');
    }
    
    // Immediate local sync
    allBookmarks = allBookmarks.filter(b => b.id !== id);
    totalClipsCount = Math.max(0, totalClipsCount - 1);
    updateCreatorClipsCount();
    applyFilters(true);
  } catch (err) {
    console.error('Delete error:', err);
    alert('Failed to delete clip. Make sure the backend server is running.');
  }
}

/* ================= 🖍 RENDER BOOKMARKS ================= */
function populateGameDropdown(bookmarks) {
  const gameFilter = document.getElementById('gameFilter');
  if (!gameFilter) return;

  const currentSelection = gameFilter.value;
  gameFilter.innerHTML = '<option value="">All Games</option>';

  const gamesSet = new Set();
  bookmarks.forEach(b => {
    if (b.gameName) {
      gamesSet.add(b.gameName);
    }
  });

  Array.from(gamesSet).sort().forEach(gName => {
    const opt = document.createElement('option');
    opt.value = gName;
    opt.textContent = gName;
    if (gName === currentSelection) {
      opt.selected = true;
    }
    gameFilter.appendChild(opt);
  });

  // Synchronize and render Game Cards
  populateGameCards(bookmarks);
}

function populateGameCards(bookmarks) {
  const track = document.getElementById('gameCardsTrack');
  const section = document.getElementById('gameCardsSliderSection');
  if (!track || !section) return;

  const gameFilter = document.getElementById('gameFilter');
  if (!gameFilter) return;
  const currentSelection = gameFilter.value || '';

  // 1. Gather all unique games and their poster URLs
  const gameMap = new Map();
  bookmarks.forEach(b => {
    if (b.gameName) {
      if (!gameMap.has(b.gameName)) {
        gameMap.set(b.gameName, {
          name: b.gameName,
          poster: b.gamePoster || ''
        });
      } else if (!gameMap.get(b.gameName).poster && b.gamePoster) {
        gameMap.set(b.gameName, {
          name: b.gameName,
          poster: b.gamePoster
        });
      }
    }
  });

  const uniqueGames = Array.from(gameMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  // If no games exist, hide the slider section completely
  if (uniqueGames.length === 0) {
    section.style.display = 'none';
    return;
  } else {
    section.style.display = 'block';
  }

  track.innerHTML = '';

  // 2. Render "All Games" Card (only if there is more than 1 game)
  if (uniqueGames.length > 1) {
    const allGamesCard = document.createElement('div');
    const allGamesActive = gameFilter.dataset.allGamesSelected === "true";
    allGamesCard.className = `game-card ${allGamesActive ? 'active' : ''}`;
    allGamesCard.setAttribute('data-game-value', '');

    // Collage grid for All Games card (dynamically size grid for 2, 3, or 4+ posters)
    const collage = document.createElement('div');
    const collagePosters = uniqueGames.filter(g => g.poster).slice(0, 4).map(g => g.poster);

    let collageClass = 'collage-4';
    if (collagePosters.length === 2) {
      collageClass = 'collage-2';
    } else if (collagePosters.length === 3) {
      collageClass = 'collage-3';
    } else if (collagePosters.length === 1) {
      collageClass = 'collage-1';
    } else if (collagePosters.length === 0) {
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
    allBadge.className = 'game-card-title'; // normal text overlay style
    allBadge.textContent = 'All Games';
    allOverlay.appendChild(allBadge);
    allGamesCard.appendChild(allOverlay);

    // Click handler
    allGamesCard.addEventListener('click', () => {
      gameFilter.value = '';
      gameFilter.dataset.shouldScrollToSlider = "true";
      gameFilter.dispatchEvent(new Event('change'));
    });

    track.appendChild(allGamesCard);
  }

  // 3. Render Individual Game Cards
  uniqueGames.forEach(game => {
    const card = document.createElement('div');
    card.className = `game-card ${currentSelection === game.name ? 'active' : ''}`;
    card.setAttribute('data-game-value', game.name);

    const bg = document.createElement('div');
    bg.className = 'game-poster-bg';
    bg.style.backgroundImage = game.poster ? `url('${game.poster}')` : "url('logo.svg')";

    const mediaWrapper = document.createElement('div');
    mediaWrapper.className = 'game-card-media-wrapper';
    mediaWrapper.appendChild(bg);
    card.appendChild(mediaWrapper);

    const overlay = document.createElement('div');
    overlay.className = 'game-card-overlay';
    const title = document.createElement('span');
    title.className = 'game-card-title';
    title.textContent = game.name;
    overlay.appendChild(title);
    card.appendChild(overlay);

    // Click handler
    card.addEventListener('click', () => {
      if (uniqueGames.length > 1 && gameFilter.value === game.name) {
        gameFilter.dataset.deselected = "true";
        gameFilter.value = '';
      } else {
        gameFilter.value = game.name;
      }
      gameFilter.dataset.shouldScrollToSlider = "true";
      gameFilter.dispatchEvent(new Event('change'));
    });

    track.appendChild(card);
  });

  // Add 3D Tilt effect to game poster cards
  setup3DTilt(track.querySelectorAll('.game-card'));

  // 4. Setup slider navigation scroll buttons
  const prevBtn = document.getElementById('sliderPrevBtn');
  const nextBtn = document.getElementById('sliderNextBtn');
  if (prevBtn && nextBtn) {
    const updateNavButtonsVisibility = () => {
      if (track.scrollWidth <= track.clientWidth) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
      } else {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
      }
    };

    setTimeout(updateNavButtonsVisibility, 50);
    window.addEventListener('resize', updateNavButtonsVisibility);

    prevBtn.onclick = (e) => {
      e.stopPropagation();
      track.scrollBy({ left: -240, behavior: 'smooth' });
    };
    nextBtn.onclick = (e) => {
      e.stopPropagation();
      track.scrollBy({ left: 240, behavior: 'smooth' });
    };
  }

  // 5. Setup bidirectional sync listener once
  if (!gameFilter.dataset.cardsSynced) {
    gameFilter.dataset.cardsSynced = "true";
    gameFilter.addEventListener('change', () => {
      const val = gameFilter.value || '';
      const isDeselected = gameFilter.dataset.deselected === "true";
      delete gameFilter.dataset.deselected; // consume flag

      if (val === '') {
        if (isDeselected) {
          delete gameFilter.dataset.allGamesSelected;
        } else {
          gameFilter.dataset.allGamesSelected = "true";
        }
      } else {
        delete gameFilter.dataset.allGamesSelected;
      }
      const allGamesActive = gameFilter.dataset.allGamesSelected === "true";

      document.querySelectorAll('#gameCardsTrack .game-card').forEach(card => {
        const cardVal = card.getAttribute('data-game-value') || '';
        if (cardVal === val) {
          if (cardVal === '') {
            if (allGamesActive) {
              card.classList.add('active');
              const track = document.getElementById('gameCardsTrack');
              if (track) {
                const cardLeft = card.offsetLeft;
                const cardWidth = card.offsetWidth;
                const trackWidth = track.clientWidth;
                track.scrollTo({
                  left: cardLeft - (trackWidth / 2) + (cardWidth / 2),
                  behavior: 'smooth'
                });
              }
            } else {
              card.classList.remove('active');
            }
          } else {
            card.classList.add('active');
            const track = document.getElementById('gameCardsTrack');
            if (track) {
              const cardLeft = card.offsetLeft;
              const cardWidth = card.offsetWidth;
              const trackWidth = track.clientWidth;
              track.scrollTo({
                left: cardLeft - (trackWidth / 2) + (cardWidth / 2),
                behavior: 'smooth'
              });
            }
          }
        } else {
          card.classList.remove('active');
        }
      });
    });
  }
}

function setupHoverPreview(thumbWrapper, videoId, timestamp, storyboardSpec) {
  let hoverTimeout = null;
  let plyrInstance = null;
  let slideshowInterval = null;
  let isHovered = false;
  let lastClientX = null;
  let lastClientY = null;
  let mouseHasMoved = false;

  // Storyboard specification parser helper
  function parseStoryboardSpec(spec) {
    if (!spec) return null;
    try {
      // Check if it's a livestream storyboard spec
      if (spec.includes('storyboard_live')) {
        const parts = spec.split('#');
        if (parts.length < 5) return null;
        
        const rawUrl = parts[0];
        const width = parseInt(parts[1], 10);
        const height = parseInt(parts[2], 10);
        const cols = parseInt(parts[3], 10);
        const rows = parseInt(parts[4], 10);
        
        // Extract interval from url path, e.g. storyboard_live_90_3x3_b1 => 90 seconds
        let intervalMs = 10000; // default 10s
        const matchInterval = rawUrl.match(/storyboard_live_(\d+)_/);
        if (matchInterval) {
          intervalMs = parseInt(matchInterval[1], 10) * 1000;
        }
        
        // Replace M$M with M$N for standard sheet index replacement in getStoryboardImageUrl
        const baseUrl = rawUrl.replace('M$M', 'M$N');
        
        return {
          baseUrl: baseUrl,
          levels: [{
            width: width,
            height: height,
            totalFrames: 9999, // arbitrary large number
            cols: cols,
            rows: rows,
            intervalMs: intervalMs,
            sigh: 'default',
            sig: null
          }]
        };
      }

      // Standard format parsing
      const parts = spec.split('|');
      if (parts.length < 2) return null;
      const baseUrl = parts[0]; // contains $L and $N placeholders
      const levels = [];
      for (let i = 1; i < parts.length; i++) {
        const tokens = parts[i].split('#');
        if (tokens.length < 8) continue;
        levels.push({
          width: parseInt(tokens[0], 10),
          height: parseInt(tokens[1], 10),
          totalFrames: parseInt(tokens[2], 10),
          cols: parseInt(tokens[3], 10),
          rows: parseInt(tokens[4], 10),
          intervalMs: parseInt(tokens[5], 10),
          sigh: tokens[6],
          sig: tokens[7]
        });
      }
      return { baseUrl, levels };
    } catch (e) {
      console.warn('[Storyboard] Spec parsing error:', e);
      return null;
    }
  }

  // Storyboard image URL constructor
  function getStoryboardImageUrl(parsedSpec, levelIdx, sheetIndex) {
    const level = parsedSpec.levels[levelIdx];
    let url = parsedSpec.baseUrl.replace('$L', levelIdx.toString());
    let sheetName;
    if (level && level.sigh && level.sigh !== 'default') {
      sheetName = level.sigh.replace('$M', sheetIndex.toString());
    } else {
      sheetName = sheetIndex.toString();
    }
    url = url.replace('$N', sheetName);
    if (level && level.sig) {
      url += '&sigh=' + level.sig;
    }
    return url;
  }

  // Cleanup helper for this hover preview instance
  const cleanup = () => {
    if (slideshowInterval) {
      clearInterval(slideshowInterval);
      slideshowInterval = null;
    }
    const currentPlyr = plyrInstance;
    plyrInstance = null;
    const container = thumbWrapper.querySelector('.iframe-container');
    if (container) {
      container.classList.remove('active');
    }
    isHovered = false;
    if (activePreviewCleanup === cleanup) {
      activePreviewCleanup = null;
    }
    
    // Defer heavy DOM destruction until completely done scrolling
    const delayedCleanup = () => {
      if (isScrolling) {
        setTimeout(delayedCleanup, 200);
        return;
      }
      if (currentPlyr) {
        try {
          currentPlyr.destroy();
        } catch (err) {}
      }
      if (container && !container.classList.contains('active')) {
        container.innerHTML = '';
      }
    };
    setTimeout(delayedCleanup, 300);
  };

  thumbWrapper.addEventListener('mouseenter', (e) => {
    if (isScrolling) return; // Ignore hover while page is scrolling
    isHovered = true;
    lastClientX = e.clientX;
    lastClientY = e.clientY;
    mouseHasMoved = false;
    const container = e.currentTarget.querySelector('.iframe-container');
    if (!container) return;

    hoverTimeout = setTimeout(async () => {
      if (activeHoverTimeout === hoverTimeout) {
        activeHoverTimeout = null;
      }
      if (isScrolling || !isHovered || !mouseHasMoved) return; // Extra check to ensure we didn't start scrolling during the delay
      container.innerHTML = '';
      
      let spec = storyboardSpec || globalStoryboardSpecCache[videoId];
      if (!spec) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/storyboard?videoId=${videoId}`);
          if (!isHovered || isScrolling) return;
          const data = await res.json();
          spec = data.storyboardSpec;
          if (spec) globalStoryboardSpecCache[videoId] = spec;
        } catch (err) {
          console.warn("Failed to fetch storyboard spec from backend:", err);
        }
      }

      // Fallback: If backend returns null, fetch from Streamsnip directly on the client side
      if (!spec) {
        try {
          console.log(`[Storyboard] Backend returned null for ${videoId}. Querying Streamsnip proxy directly...`);
          const res = await fetch(`https://streamsnip.com/get_storyboard/${videoId}`);
          if (!isHovered || isScrolling) return;
          if (res.ok) {
            const data = await res.json();
            spec = data.spec || null;
            if (spec) {
              globalStoryboardSpecCache[videoId] = spec;
              console.log(`[Storyboard] Successfully fetched spec from Streamsnip proxy directly for ${videoId}`);
              
              // Cache it back to the database in background so other users get it instantly
              fetch(`${BACKEND_URL}/api/storyboard`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ videoId, storyboardSpec: spec })
              }).catch(e => console.warn('[Storyboard] Failed to post Streamsnip spec back to DB:', e));
            }
          }
        } catch (err) {
          console.warn("Failed to fetch storyboard spec from Streamsnip proxy directly:", err);
        }
      }

      // Fallback 2: Fetch directly from YouTube watch page using client-side AllOrigins CORS proxy
      if (!spec) {
        try {
          console.log(`[Storyboard] Querying YouTube watch page via AllOrigins proxy for ${videoId}...`);
          const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`);
          if (!isHovered || isScrolling) return;
          if (res.ok) {
            const html = await res.text();
            let parsedSpecStr = null;
            const matchDecoded = html.match(/"player(?:Live)?StoryboardSpecRenderer":\s*\{\s*"spec":\s*"([^"]+)"/);
            if (matchDecoded) {
              parsedSpecStr = matchDecoded[1].replace(/\\/g, '');
            } else {
              const matchEncoded = html.match(/%22player(?:Live)?StoryboardSpecRenderer%22%3A%7B%22spec%22%3A%22(.+?)%22/);
              if (matchEncoded) {
                parsedSpecStr = decodeURIComponent(matchEncoded[1]);
              }
            }

            if (parsedSpecStr) {
              spec = parsedSpecStr;
              globalStoryboardSpecCache[videoId] = spec;
              console.log(`[Storyboard] Successfully fetched and parsed spec from YouTube watch page via proxy for ${videoId}!`);
              
              // Cache it back to the database in background so other users get it instantly
              fetch(`${BACKEND_URL}/api/storyboard`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ videoId, storyboardSpec: spec })
              })
              .then(r => r.json())
              .then(cacheData => {
                if (cacheData.success) {
                  console.log(`[Storyboard] Spec successfully cached in database for ${videoId}`);
                }
              })
              .catch(() => {});
            }
          }
        } catch (err) {
          console.warn("Failed to fetch storyboard spec from YouTube via AllOrigins proxy:", err);
        }
      }
      
      if (!isHovered || isScrolling) return;
      
      const parsedSpec = parseStoryboardSpec(spec);
      if (parsedSpec && parsedSpec.levels.length > 0) {
        // --- STORYBOARD SLIDESHOW APPROACH ---
        const overlay = document.createElement('div');
        overlay.className = 'storyboard-overlay';
        container.appendChild(overlay);

        // Add YouTube Red Progress Bar
        const progressBar = document.createElement('div');
        progressBar.style.position = 'absolute';
        progressBar.style.bottom = '0';
        progressBar.style.left = '0';
        progressBar.style.width = '100%';
        progressBar.style.height = '4px';
        progressBar.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        progressBar.style.zIndex = '15';

        const progressFill = document.createElement('div');
        progressFill.style.height = '100%';
        progressFill.style.width = '0%';
        progressFill.style.backgroundColor = '#ff0000'; // YouTube red
        progressFill.style.transition = 'width 0.266s linear';

        progressBar.appendChild(progressFill);
        container.appendChild(progressBar);

        // Quality: Select the absolute highest available quality level (index levels.length - 1)
        const levelIdx = parsedSpec.levels.length - 1;
        const level = parsedSpec.levels[levelIdx];

        const intervalSec = (level.intervalMs || 10000) / 1000;
        const thumbnailsPerSheet = level.cols * level.rows;
        const sheetDuration = thumbnailsPerSheet * intervalSec;

        const startTimestamp = parseFloat(timestamp || 0);
        let currentTime = startTimestamp;
        const previewLimit = 30 * intervalSec; // Play exactly 30 frames in 8 seconds loop

        // Preload sheets and cache actual dimensions for aspect ratio accuracy (fixes squashed/zoomed vertical video previews)
        const sheetDimensions = {};
        const sheetsNeeded = new Set();
        for (let t = startTimestamp; t <= startTimestamp + previewLimit; t += intervalSec) {
          sheetsNeeded.add(Math.floor(t / sheetDuration));
        }
        sheetsNeeded.forEach(page => {
          const img = new Image();
          const url = getStoryboardImageUrl(parsedSpec, levelIdx, page);
          const handleLoad = () => {
            if (img.naturalWidth && img.naturalHeight) {
              sheetDimensions[url] = {
                width: img.naturalWidth,
                height: img.naturalHeight
              };
              // Immediately correct the sizing of the current active frame
              if (isHovered && !isScrolling) {
                const currentPage = Math.floor(currentTime / sheetDuration);
                const currentUrl = getStoryboardImageUrl(parsedSpec, levelIdx, currentPage);
                if (currentUrl === url) {
                  showFrame(currentTime);
                }
              }
            }
          };
          img.onload = handleLoad;
          img.src = url;
          if (img.complete) {
            handleLoad();
          }
        });

        if (!isHovered || isScrolling) return;

        function showFrame(t) {
          const page = Math.floor(t / sheetDuration);
          const frameIndex = Math.floor((t % sheetDuration) / intervalSec);
          const col = frameIndex % level.cols;
          const row = Math.floor(frameIndex / level.cols);

          const url = getStoryboardImageUrl(parsedSpec, levelIdx, page);
          const dims = sheetDimensions[url];

          // Calculate dimensions dynamically to support both landscape and vertical livestreams
          let frameW = level.width;
          let frameH = level.height;
          if (dims && dims.width > 0 && dims.height > 0) {
            frameW = dims.width / level.cols;
            frameH = dims.height / level.rows;
          }

          const cW = container.clientWidth || 298;
          const cH = container.clientHeight || 168;

          const scale = Math.min(cW / frameW, cH / frameH);
          const scaledW = Math.round(scale * frameW);
          const scaledH = Math.round(scale * frameH);
          const offsetX = Math.round((cW - scaledW) / 2);
          const offsetY = Math.round((cH - scaledH) / 2);

          overlay.style.backgroundImage = `url("${url}")`;
          overlay.style.backgroundSize = `${scaledW * level.cols}px ${scaledH * level.rows}px`;
          overlay.style.backgroundPosition = `${-(col * scaledW) + offsetX}px ${-(row * scaledH) + offsetY}px`;
          overlay.style.clipPath = `inset(${offsetY}px ${cW - offsetX - scaledW}px ${cH - offsetY - scaledH}px ${offsetX}px)`;

          // Update Progress Bar red line
          const pct = ((t - startTimestamp) / previewLimit) * 100;
          progressFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
        }

        // Show first frame immediately
        showFrame(currentTime);
        container.classList.add('active');
        activePreviewCleanup = cleanup;

        // Loop the slideshow every 400ms (for smooth visual playback)
        slideshowInterval = setInterval(() => {
          if (isScrolling) {
            cleanup();
            return;
          }
          currentTime += intervalSec;
          if (currentTime > startTimestamp + previewLimit) {
            currentTime = startTimestamp;
          }
          showFrame(currentTime);
        }, 266);

      } else {
        // --- FALLBACK TO PLYR IFRAME PLAYER ---
        const wrapperDiv = document.createElement('div');
        wrapperDiv.className = "plyr__video-embed";
        wrapperDiv.style.width = "100%";
        wrapperDiv.style.height = "100%";
        
        const iframe = document.createElement('iframe');
        iframe.style.pointerEvents = 'none';
        iframe.title = "YouTube Video Preview";
        iframe.frameBorder = "0";
        iframe.allow = "autoplay";
        iframe.src = `https://www.youtube.com/embed/${videoId}?start=${timestamp}&autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
        
        wrapperDiv.appendChild(iframe);
        container.appendChild(wrapperDiv);
        
        if (window.Plyr) {
          plyrInstance = new window.Plyr(wrapperDiv, {
            controls: [],
            clickToPlay: false,
            autoplay: true,
            muted: true,
            loop: { active: true },
            fullscreen: { enabled: false },
            keyboard: { focused: false, global: false },
            youtube: {
              noCookie: true,
              rel: 0,
              showinfo: 0,
              iv_load_policy: 3,
              modestbranding: 1,
              origin: window.location.origin,
              playerVars: {
                controls: 0,
                showinfo: 0,
                rel: 0,
                iv_load_policy: 3,
                modestbranding: 1,
                playsinline: 1,
                disablekb: 1,
                fs: 0,
                autoplay: 1,
                mute: 1
              }
            }
          });
          
          plyrInstance.on('ready', () => {
            if (isScrolling) {
              cleanup();
              return;
            }
            container.classList.add('active');
            activePreviewCleanup = cleanup;
            setTimeout(() => {
              if (plyrInstance && !isScrolling) {
                plyrInstance.muted = true;
                if (timestamp !== undefined && timestamp !== null) {
                  plyrInstance.currentTime = parseFloat(timestamp);
                }
                plyrInstance.play().catch(err => {
                  console.warn("Plyr autoplay failed:", err);
                });
              }
            }, 300);
          });
        } else {
          // Fallback if Plyr library failed to load
          iframe.onload = () => {
            if (isScrolling) {
              cleanup();
              return;
            }
            container.classList.add('active');
            activePreviewCleanup = cleanup;
          };
        }
      }
    }, 300); // 300ms minimal delay to prevent triggers during scroll/fast movements
    activeHoverTimeout = hoverTimeout;
  });

  thumbWrapper.addEventListener('mousemove', (e) => {
    if (lastClientX !== null && lastClientY !== null) {
      if (Math.abs(e.clientX - lastClientX) > 2 || Math.abs(e.clientY - lastClientY) > 2) {
        mouseHasMoved = true;
      }
    }
    lastClientX = e.clientX;
    lastClientY = e.clientY;
  });

  thumbWrapper.addEventListener('mouseleave', (e) => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      if (activeHoverTimeout === hoverTimeout) {
        activeHoverTimeout = null;
      }
      hoverTimeout = null;
    }
    cleanup();
  });
}

function getUserBadgeHTML(role) {
  const r = (role || '').toLowerCase();
  if (r === 'owner') {
    return `<svg class="clipper-badge owner-badge ml-auto" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" title="Owner"><title>Owner</title><path d="M0 0 C3.01103843 2.07037157 5.58102016 4.63612078 8.23242188 7.13867188 C10.59069072 9.27314296 12.42688186 10.86154027 15.5546875 11.6171875 C19.01710005 10.74328785 20.91089284 8.92645019 23.5625 6.5625 C29.65530133 1.16263862 29.65530133 1.16263862 33 1 C36 3 36 3 37 6 C38.16328125 21.43462717 37.9954436 38.72623567 29 52 C25.54754867 54.30163422 24.26483542 54.24843665 20.19921875 54.24291992 C18.41221558 54.24753487 18.41221558 54.24753487 16.58911133 54.25224304 C15.30157959 54.24505753 14.01404785 54.23787201 12.6875 54.23046875 C11.35376022 54.22927636 10.02001959 54.22882391 8.6862793 54.2290802 C5.8920363 54.22751656 3.09792165 54.21923638 0.30371094 54.20581055 C-3.27754674 54.18882089 -6.85866341 54.18499631 -10.43995667 54.18575573 C-13.19373927 54.18548376 -15.94749107 54.17999823 -18.70126343 54.17275429 C-20.66387558 54.16802567 -22.62649421 54.16629286 -24.58911133 54.16459656 C-25.78044678 54.15821671 -26.97178223 54.15183685 -28.19921875 54.14526367 C-29.77449341 54.13954597 -29.77449341 54.13954597 -31.3815918 54.13371277 C-34 54 -34 54 -37 53 C-44.84244177 43.62732569 -46.17975672 31.84832633 -46.1875 20.125 C-46.19974609 19.15691406 -46.21199219 18.18882813 -46.22460938 17.19140625 C-46.23575435 11.73037092 -45.8847421 7.14275355 -44 2 C-43 1 -43 1 -40.8125 0.625 C-36.29475393 1.22736614 -33.66042558 4.44071709 -30.4609375 7.4453125 C-28.2392304 9.4391522 -26.45290683 10.87975288 -23.54296875 11.65234375 C-19.6453956 10.65250548 -17.23916529 8.23726658 -14.3125 5.5625 C-6.14159369 -1.70153547 -6.14159369 -1.70153547 0 0 Z M-37 14 C-38.35435584 15.12899299 -38.35435584 15.12899299 -38.1328125 18.08984375 C-38.13023438 19.35957031 -38.12765625 20.62929688 -38.125 21.9375 C-38.12757812 23.20464844 -38.13015625 24.47179688 -38.1328125 25.77734375 C-38.22506069 28.89154889 -38.22506069 28.89154889 -37 31 C-36.01 30.67 -35.02 30.34 -34 30 C-33.97307516 27.70839681 -33.95363876 25.41670454 -33.9375 23.125 C-33.92589844 21.84882812 -33.91429687 20.57265625 -33.90234375 19.2578125 C-33.76823431 16.11335348 -33.76823431 16.11335348 -35 14 C-35.66 14 -36.32 14 -37 14 Z M-34 39 C-33.67 40.65 -33.34 42.3 -33 44 C-31.02 44.495 -31.02 44.495 -29 45 C-29.33 43.35 -29.66 41.7 -30 40 C-31.32 39.67 -32.64 39.34 -34 39 Z" fill="currentColor" transform="translate(54,36)"/><path d="M0 0 C1.65 0.33 3.3 0.66 5 1 C5 5.62 5 10.24 5 15 C3.02 15.99 3.02 15.99 1 17 C-1 15 -1 15 -1.23046875 11.77734375 C-1.20919922 9.87662109 -1.20919922 9.87662109 -1.1875 7.9375 C-1.18105469 6.66777344 -1.17460938 5.39804688 -1.16796875 4.08984375 C-1 1 -1 1 0 0 Z" fill="currentColor" transform="translate(48,8)"/><path d="M0 0 C3.1087919 0.30878573 4.56644261 0.48371065 6.6171875 2.92578125 C7.03226563 3.71339844 7.44734375 4.50101563 7.875 5.3125 C8.30554687 6.09238281 8.73609375 6.87226563 9.1796875 7.67578125 C10.10121562 10.28677758 9.94771526 11.44350882 9 14 C6.8125 14 6.8125 14 4 13 C1.8383903 10.55892097 0.26010789 8.00617667 -1 5 C-0.8125 2 -0.8125 2 0 0 Z" fill="currentColor" transform="translate(26,15)"/><path d="M0 0 C1.65 0.33 3.3 0.66 5 1 C4.51675181 6.15464734 1.81389239 9.81550319 -1 14 C-2.9375 13.6875 -2.9375 13.6875 -5 13 C-6 10 -6 10 -4.78515625 7.51953125 C-4.21667969 6.62621094 -3.64820312 5.73289062 -3.0625 4.8125 C-2.49660156 3.91144531 -1.93070312 3.01039062 -1.34765625 2.08203125 C-0.90292969 1.39496094 -0.45820312 0.70789062 0 0 Z" fill="currentColor" transform="translate(70,15)"/></svg>`;
  }
  if (r === 'moderator' || r === 'mod') {
    return `<svg class="clipper-badge mod-badge ml-auto" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" title="Moderator"><title>Moderator</title><path d="M0 0 C0 4.84260662 -1.27270874 6.32951881 -4 10.25 C-4.7425 11.32765625 -5.485 12.4053125 -6.25 13.515625 C-6.8275 14.33546875 -7.405 15.1553125 -8 16 C-6.96706853 18.82572058 -6.32047018 19.82978305 -3.6171875 21.265625 C-2.71226563 21.59046875 -1.80734375 21.9153125 -0.875 22.25 C0.49011719 22.75273438 0.49011719 22.75273438 1.8828125 23.265625 C2.58148438 23.50796875 3.28015625 23.7503125 4 24 C4.23783203 23.09121094 4.23783203 23.09121094 4.48046875 22.1640625 C6.28640587 15.67865295 8.81240153 9.92162562 12 4 C14.62901288 5.52206009 16.84365964 6.84365964 19 9 C19.23776384 15.64606538 17.88822317 22.45862581 16.75 29 C16.53859375 30.2375 16.3271875 31.475 16.109375 32.75 C14.74758893 36.73945778 13.54113566 37.76554876 10 40 C6.46435547 40.42163086 6.46435547 40.42163086 2.4921875 40.52734375 C-6.60784646 41.23977111 -11.33764721 45.37334864 -17.35107422 51.91040039 C-18.88648685 53.57495298 -20.4722033 55.17508621 -22.07421875 56.77539062 C-27.6272117 62.46746251 -31.06495525 66.87478353 -32 75 C-34.19837774 78.77214677 -36.95398861 81.34413237 -41 83 C-45.60153351 83.71951251 -49.11657853 83.43337657 -53.3125 81.375 C-56.83710435 78.26023336 -59.54048449 75.61173611 -60.3828125 70.82421875 C-60.65577548 65.41045291 -59.60983749 62.21147707 -56 58 C-54.15673219 56.15673219 -52.73371997 55.15487905 -50.16796875 54.61328125 C-41.92865717 52.75758044 -37.61515819 46.84125992 -32.41162109 40.63525391 C-31.15729985 39.18221972 -29.81226695 37.808618 -28.45703125 36.44921875 C-24.40149447 32.17834373 -22.6426344 29.27710132 -22.61035156 23.25341797 C-22.68412795 21.33756663 -22.84588493 19.42571098 -23.01171875 17.515625 C-22.99800707 13.40211973 -22.23569888 11.42965722 -20 8 C-17.58984375 5.69921875 -17.58984375 5.69921875 -14.9375 3.6875 C-14.05964844 3.01074219 -13.18179688 2.33398438 -12.27734375 1.63671875 C-7.75469466 -1.61369286 -5.39345068 -0.78292026 0 0 Z M-49 62 C-49.33 62.99 -49.66 63.98 -50 65 C-50.66 65 -51.32 65 -52 65 C-52.37054871 69.63981875 -52.37054871 69.63981875 -50.9375 73.9375 C-47.98831309 75.55479605 -45.29132441 75.18630138 -42 75 C-42 74.34 -42 73.68 -42 73 C-41.01 72.67 -40.02 72.34 -39 72 C-38.46929421 67.15803679 -38.46929421 67.15803679 -40.625 63.0625 C-43.56030453 61.74933745 -45.81863606 61.78308882 -49 62 Z" fill="currentColor" transform="translate(69,8)"/></svg>`;
  }
  return '';
}

function createCardElement(b) {
  const card = document.createElement('div');
  card.className = 'group card' + (b.isFavorite ? ' favorite-highlight' : '') + (b.isHidden ? ' hidden-clip' : '');
  card.setAttribute('data-clip-id', b.id);

  const canManage = isAdmin || 
                    (currentUser && (
                      (b.profileId && currentUser.id === b.profileId) || 
                      (!b.profileId && currentUserChannelId && currentUserChannelId === b.streamerId)
                    ));

  // Game badge details
  const gameNameDisp = b.gameName ? (b.gameName.length > 20 ? b.gameName.slice(0, 18) + '..' : b.gameName) : '';

  const isUnknown = !b.username || b.username === 'unknown' || b.username === 'Unknown Viewer';
  const displayUsername = isUnknown ? 'Community Clip' : (b.username.startsWith('@') ? b.username : `@${b.username}`);
  const cleanUser = isUnknown ? '' : displayUsername.replace('@', '');
  const userLink = isUnknown ? '#' : (b.profileUrl && b.profileUrl !== '#' ? b.profileUrl : `https://www.youtube.com/@${cleanUser}`);

  const clipperHTML = isUnknown
    ? `<div class="clipper-link cursor-default">
        <img src="user.png" class="clipper-avatar" alt="user avatar" />
        <span class="clipper-name">${displayUsername}</span>
       </div>`
    : `<a href="${userLink}" target="_blank" class="clipper-link hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
        <img src="user.png" class="clipper-avatar" alt="user avatar" />
        <span class="clipper-name">${displayUsername}</span>
       </a>`;

  card.innerHTML = `
    <!-- Thumbnail Container -->
    <div class="relative aspect-video card-thumb-wrapper">
      <img src="${b.thumbnail}" class="w-full h-full object-cover" loading="lazy" onerror="this.onerror=null; this.src='${SVG_PLACEHOLDER}'" alt="Video Thumbnail" />
      <span class="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded card-duration-badge">${getTime(b.time)}</span>
      <div class="iframe-container"></div>
    </div>
    
    <!-- Content Area -->
    <div class="p-4 space-y-4 card-content">
      <!-- Title Row -->
      <div class="flex items-center justify-between card-title-row">
        <div class="editable-chip w-full flex items-center justify-between relative" title="${b.desc}">
          <input
            type="text"
            class="chip-input bg-transparent font-bold text-slate-800 dark:text-slate-100 truncate border-none outline-none focus:ring-0 w-full p-0 pr-8"
            value="${b.desc}"
            readonly
            title="${b.desc}"
          />
          ${canManage ? `
            <button class="chip-action-btn edit-btn text-slate-500 hover:text-slate-800 dark:hover:text-white absolute right-0" title="Edit description">
               <svg class="chip-pencil-icon w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </button>
            <button class="chip-action-btn save-btn text-emerald-600 dark:text-emerald-500 hover:text-emerald-500 dark:hover:text-emerald-400 absolute right-0" title="Save description">
              <svg class="chip-check-icon w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Clipper Info -->
      <div class="space-y-2">
        <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 card-clipper-row">
          ${clipperHTML}
          ${getUserBadgeHTML(b.userRole)}
        </div>
        
        <!-- Game Tag -->
        <div class="flex items-center gap-2 card-badges-row">
          ${b.gameName ? `
          <span class="inline-flex items-center gap-1 timer-display game-badge" title="${b.gameName}">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-gamepad-2 w-3.5 h-3.5"><line x1="6" x2="10" y1="11" y2="11"></line><line x1="8" x2="8" y1="9" y2="13"></line><line x1="15" x2="15.01" y1="12" y2="12"></line><line x1="18" x2="18.01" y1="10" y2="10"></line><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"></path></svg>
            <span>${gameNameDisp}</span>
          </span>
          ` : ''}
          ${b.isHidden ? `
          <span class="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider badge hidden-badge" title="Hidden from viewers">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-off w-3 h-3"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
            <span>Private</span>
          </span>
          ` : ''}
        </div>
      </div>

      <!-- Time Display Row with White YouTube Button -->
      <div class="flex items-center gap-2 w-full card-meta-row">
        <!-- White YouTube Logo -->
        <a href="https://www.youtube.com/watch?v=${b.videoId}&t=${secondsToTime(b.time)}" target="_blank" class="flex items-center justify-center transition-opacity hover:opacity-80 youtube-link-btn flex-shrink-0" title="Open in YouTube">
          <svg class="w-6 h-5 fill-white stroke-none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.524 3.545 12 3.545 12 3.545s-7.525 0-9.387.51a3.003 3.003 0 0 0-2.11 2.108C0 8.025 0 12 0 12s0 3.975.503 5.837a2.97 2.97 0 0 0 2.11 2.1c1.862.51 9.387.51 9.387.51s7.524 0 9.388-.51a3.002 3.002 0 0 0 2.11-2.1c.502-1.862.502-5.837.502-5.837s0-3.975-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        </a>

        <!-- Time Display -->
        <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/50 p-2 rounded-lg text-xs text-slate-500 dark:text-slate-400 timer-display flex-grow">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock w-3.5 h-3.5 timer-clock-icon"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>
          <span class="timer-text">~ ${getRelativeTime(b.date)}</span>
        </div>
      </div>

      <!-- Actions Bar -->
      <div class="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700/50 card-actions-bar">
        ${canManage ? `
        <div class="flex gap-2 actions-left">
          <button class="delete-btn" ${b.isFavorite ? 'disabled' : ''}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2 w-4 h-4"><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            <span class="tooltip">${b.isFavorite ? 'Cannot delete favorite' : 'Delete clip'}</span>
          </button>
          <label class="hide-btn">
            <input type="checkbox" ${b.isHidden ? 'checked' : ''} style="position: absolute; opacity: 0; cursor: pointer; height: 0; width: 0;">
            <svg class="eye" xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 576 512" style="fill: currentColor; transition: fill 0.3s;"><path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"></path></svg>
            <svg class="eye-slash" xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 640 512" style="fill: currentColor; transition: fill 0.3s;"><path d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L525.6 386.7c39.6-40.6 66.4-86.1 79.9-118.4c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C465.5 68.8 400.8 32 320 32c-68.2 0-125 26.3-169.3 60.8L38.8 5.1zM223.1 149.5C248.6 126.2 282.7 112 320 112c79.5 0 144 64.5 144 144c0 24.9-6.3 48.3-17.4 68.7L408 294.5c8.4-19.3 10.6-41.4 4.8-63.3c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3c0 10.2-2.4 19.8-6.6 28.3l-90.3-70.8zM373 389.9c-16.4 6.5-34.3 10.1-53 10.1c-79.5 0-144-64.5-144-144c0-6.9 .5-13.6 1.4-20.2L83.1 161.5C60.3 191.2 44 220.8 34.5 243.7c-3.3 7.9-3.3 16.7 0 24.6c14.9 35.7 46.2 87.7 93 131.1C174.5 443.2 239.2 480 320 480c47.8 0 89.9-12.9 126.2-32.5L373 389.9z"></path></svg>
            <span class="tooltip">${b.isHidden ? 'Make Public' : 'Make Private'}</span>
          </label>
        </div>
        ` : '<div></div>'}
        <div class="flex gap-2 actions-right ml-auto">
          <button class="copy-clip-btn" aria-label="Copy to clipboard">
            <div class="check-icon-wrapper scale-0 opacity-0 absolute inset-0 flex items-center justify-center transition-all duration-300">
              <svg class="stroke-emerald-500 w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <div class="copy-icon-wrapper scale-100 opacity-100 transition-all duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy w-4 h-4"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>
            </div>
            <span class="tooltip">Copy Link</span>
          </button>
          
          <div class="download-dropdown-wrapper relative">
            <button class="download-clip-btn" aria-label="Download options">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download w-4 h-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="15" y2="3"></line></svg>
              <span class="tooltip">Download Options</span>
            </button>
            <div class="download-dropdown-menu">
              <button class="download-option-btn" data-type="yt-dlp">YT-DLP</button>
              <button class="download-option-btn" data-type="mp4">MP4</button>
            </div>
          </div>

          <button class="fav-star-btn ${b.isFavorite ? 'active' : ''}" ${!canManage ? 'disabled style="cursor: default;"' : ''}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${b.isFavorite ? '#f59e0b' : 'none'}" stroke="${b.isFavorite ? '#f59e0b' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-star w-4 h-4"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"></path></svg>
            <span class="tooltip">${!canManage ? 'Only creator can favorite' : (b.isFavorite ? 'Remove Favorite' : 'Mark Favorite')}</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // Attach hover preview
  setupHoverPreview(card.querySelector('.card-thumb-wrapper'), b.videoId, b.time, b.storyboardSpec);

  // Setup click to play on thumbnail wrapper only
  const thumbWrapper = card.querySelector('.card-thumb-wrapper');
  if (thumbWrapper) {
    thumbWrapper.style.cursor = 'pointer';
    thumbWrapper.addEventListener('click', () => {
      window.open(
        `https://www.youtube.com/watch?v=${b.videoId}&t=${secondsToTime(b.time)}`,
        '_blank'
      );
    });
  }

  // Copy clip link click handler
  const copyClipBtn = card.querySelector('.copy-clip-btn');
  if (copyClipBtn) {
    copyClipBtn.onclick = async (e) => {
      e.stopPropagation();
      const clipUrl = `https://www.youtube.com/watch?v=${b.videoId}&t=${secondsToTime(b.time)}`;
      try {
        await navigator.clipboard.writeText(clipUrl);
        showToast('Link Copied!', 'The YouTube clip link has been copied to your clipboard.');
        
        const checkIcon = copyClipBtn.querySelector('.check-icon-wrapper');
        const copyIcon = copyClipBtn.querySelector('.copy-icon-wrapper');
        
        // Toggle animation classes
        copyIcon.classList.replace('scale-100', 'scale-0');
        copyIcon.classList.replace('opacity-100', 'opacity-0');
        checkIcon.classList.replace('scale-0', 'scale-100');
        checkIcon.classList.replace('opacity-0', 'opacity-100');
        
        const tooltip = copyClipBtn.querySelector('.tooltip');
        if (tooltip) tooltip.textContent = 'Copied!';
        copyClipBtn.setAttribute('disabled', 'true');
        
        setTimeout(() => {
          copyIcon.classList.replace('scale-0', 'scale-100');
          copyIcon.classList.replace('opacity-0', 'opacity-100');
          checkIcon.classList.replace('scale-100', 'scale-0');
          checkIcon.classList.replace('opacity-100', 'opacity-0');
          if (tooltip) tooltip.textContent = 'Copy Link';
          copyClipBtn.removeAttribute('disabled');
        }, 1500);
      } catch (err) {
        console.error('Failed to copy link: ', err);
      }
    };
  }

  // Download button dropdown handler
  const downloadBtn = card.querySelector('.download-clip-btn');
  const downloadMenu = card.querySelector('.download-dropdown-menu');
  if (downloadBtn && downloadMenu) {
    downloadBtn.onclick = (e) => {
      e.stopPropagation();
      // Close all other open download menus first
      document.querySelectorAll('.download-dropdown-menu').forEach(menu => {
        if (menu !== downloadMenu) menu.classList.remove('show');
      });
      downloadMenu.classList.toggle('show');
    };

    const optionBtns = downloadMenu.querySelectorAll('.download-option-btn');
    optionBtns.forEach(optBtn => {
      optBtn.onclick = async (e) => {
        e.stopPropagation();
        downloadMenu.classList.remove('show');
        const type = optBtn.getAttribute('data-type');
        const clipUrl = `https://www.youtube.com/watch?v=${b.videoId}&t=${secondsToTime(b.time)}`;
        
        if (type === 'yt-dlp') {
          const start = Math.max(0, b.time - 40);
          const end = b.time;
          const cleanDesc = (b.desc || 'None').replace(/[^a-zA-Z0-9\s_-]/g, '').trim() || 'Clip';
          const ytDlpCmd = `yt-dlp -o "enc${end} ${cleanDesc}.%(ext)s" -f "best+bestaudio[ext=m4a]/best+bestaudio" --merge-output-format mp4 "https://youtu.be/${b.videoId}?t=${end}" --download-sections "*${start}-${end}"`;
          try {
            await navigator.clipboard.writeText(ytDlpCmd);
            showToast('YT-DLP Command Copied!', 'The download command has been copied to your clipboard.');
            const tooltip = downloadBtn.querySelector('.tooltip');
            if (tooltip) tooltip.textContent = 'YT-DLP Copied!';
            downloadBtn.classList.add('success');
            setTimeout(() => {
              if (tooltip) tooltip.textContent = 'Download Options';
              downloadBtn.classList.remove('success');
            }, 2000);
          } catch (err) {
            console.error('Failed to copy command: ', err);
          }
        } else if (type === 'mp4') {
          window.open(`https://9xbuddy.in/process?url=${encodeURIComponent(clipUrl)}`, '_blank');
          showToast('MP4 Downloader', 'Opening MP4 download service in a new tab.');
          const tooltip = downloadBtn.querySelector('.tooltip');
          if (tooltip) tooltip.textContent = 'Opening MP4 Downloader...';
          downloadBtn.classList.add('success');
          setTimeout(() => {
            if (tooltip) tooltip.textContent = 'Download Options';
            downloadBtn.classList.remove('success');
          }, 2000);
        }
      };
    });
  }

  /* ✏️ EDIT CHIP FOR AUTHORIZED CREATOR / ADMIN */
  if (canManage) {
    const chipContainer = card.querySelector('.editable-chip');
    const chipInput = card.querySelector('.chip-input');
    const editBtn = card.querySelector('.edit-btn');
    const saveBtn = card.querySelector('.save-btn');

    let originalValue = chipInput.value.trim();

    const startEditing = (e) => {
      e.stopPropagation();
      chipContainer.classList.add('editing');
      chipInput.removeAttribute('readonly');
      originalValue = chipInput.value.trim();
      
      requestAnimationFrame(() => {
        chipInput.focus();
        chipInput.select();
      });
    };

    const saveEditing = async (e) => {
      if (e) e.stopPropagation();
      const value = chipInput.value.trim() || 'Untitled';
      
      try {
        const { error } = await supabase
          .from('clips')
          .update({ description: value })
          .eq('id', b.id);

        if (error) throw error;

        chipInput.value = value;
        chipInput.setAttribute('value', value);
        chipInput.setAttribute('title', value);
        chipContainer.setAttribute('title', value);
        originalValue = value;
      } catch (err) {
        console.error('Edit error:', err);
        alert('Failed to update description.');
        chipInput.value = originalValue;
      }

      chipContainer.classList.remove('editing');
      chipInput.setAttribute('readonly', 'true');
    };

    const cancelEditing = (e) => {
      if (e) e.stopPropagation();
      chipInput.value = originalValue;
      chipContainer.classList.remove('editing');
      chipInput.setAttribute('readonly', 'true');
    };

    editBtn.onclick = startEditing;
    saveBtn.onclick = saveEditing;

    chipInput.onclick = (e) => {
      e.stopPropagation();
    };

    chipInput.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        saveEditing(e);
      } else if (e.key === 'Escape') {
        cancelEditing(e);
      }
    };
  }

  // Favorite toggle star button
  const favToggle = card.querySelector('.fav-star-btn');
  favToggle.onclick = async e => {
    e.stopPropagation();
    if (!canManage) return;
    
    b.isFavorite = !b.isFavorite;
    card.classList.toggle('favorite-highlight', b.isFavorite);
    favToggle.classList.toggle('active', b.isFavorite);
    
    const svg = favToggle.querySelector('svg');
    if (b.isFavorite) {
      svg.setAttribute('fill', '#f59e0b');
      svg.setAttribute('stroke', '#f59e0b');
      favToggle.setAttribute('title', 'Remove from Favorites');
    } else {
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      favToggle.setAttribute('title', 'Mark as Favorite');
    }
    
    // Toggle delete button disabled state
    const deleteBtn = card.querySelector('.delete-btn');
    if (deleteBtn) {
      if (b.isFavorite) {
        deleteBtn.setAttribute('disabled', 'true');
        deleteBtn.setAttribute('title', 'Cannot delete a favorite clip');
      } else {
        deleteBtn.removeAttribute('disabled');
        deleteBtn.setAttribute('title', 'Delete clip');
      }
    }

    try {
      const { error } = await supabase
        .from('clips')
        .update({ is_favorite: b.isFavorite })
        .eq('id', b.id);

      if (error) throw error;
    } catch (err) {
      console.error('Favorite error:', err);
      b.isFavorite = !b.isFavorite;
      card.classList.toggle('favorite-highlight', b.isFavorite);
      favToggle.classList.toggle('active', b.isFavorite);
      if (b.isFavorite) {
        svg.setAttribute('fill', '#f59e0b');
        svg.setAttribute('stroke', '#f59e0b');
        favToggle.setAttribute('title', 'Remove from Favorites');
      } else {
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        favToggle.setAttribute('title', 'Mark as Favorite');
      }
      if (deleteBtn) {
        if (b.isFavorite) {
          deleteBtn.setAttribute('disabled', 'true');
          deleteBtn.setAttribute('title', 'Cannot delete a favorite clip');
        } else {
          deleteBtn.removeAttribute('disabled');
          deleteBtn.setAttribute('title', 'Delete clip');
        }
      }
      alert('Failed to update favorite status.');
    }
  };

  // Delete logic trigger
  const del = card.querySelector('.delete-btn');
  if (del) {
    del.onclick = e => {
      e.stopPropagation();
      if (b.isFavorite) {
        alert('This clip is marked as a favorite and cannot be deleted.');
        return;
      }
      handleDelete(b.id, b.streamerId, b.profileId);
    };
  }

  // Hide toggle button logic
  const hideBtn = card.querySelector('.hide-btn');
  if (hideBtn) {
    const checkbox = hideBtn.querySelector('input[type="checkbox"]');
    checkbox.onchange = async e => {
      e.stopPropagation();
      if (!canManage) {
        checkbox.checked = !checkbox.checked; // Revert change visually
        return;
      }

      b.isHidden = checkbox.checked;
      card.classList.toggle('hidden-clip', b.isHidden);
      
      // Update badge in card-badges-row
      const badgesRow = card.querySelector('.card-badges-row');
      let hiddenBadge = badgesRow.querySelector('.hidden-badge');
      if (b.isHidden) {
        if (!hiddenBadge) {
          hiddenBadge = document.createElement('span');
          hiddenBadge.className = 'inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider badge hidden-badge';
          hiddenBadge.setAttribute('title', 'Hidden from viewers');
          hiddenBadge.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-off w-3 h-3"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
            <span>Private</span>
          `;
          badgesRow.appendChild(hiddenBadge);
        }
      } else {
        if (hiddenBadge) {
          hiddenBadge.remove();
        }
      }

      // Update button title description
      if (b.isHidden) {
        hideBtn.setAttribute('title', 'Unhide clip (make public)');
      } else {
        hideBtn.setAttribute('title', 'Hide clip (make private)');
      }

      try {
        const { error } = await supabase
          .from('clips')
          .update({ is_hidden: b.isHidden ? true : null })
          .eq('id', b.id);

        if (error) throw error;
      } catch (err) {
        console.error('Hide error:', err);
        // Revert on failure
        b.isHidden = !b.isHidden;
        checkbox.checked = b.isHidden;
        card.classList.toggle('hidden-clip', b.isHidden);
        
        let hiddenBadgeReverted = badgesRow.querySelector('.hidden-badge');
        if (b.isHidden) {
          if (!hiddenBadgeReverted) {
            hiddenBadgeReverted = document.createElement('span');
            hiddenBadgeReverted.className = 'inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider badge hidden-badge';
            hiddenBadgeReverted.setAttribute('title', 'Hidden from viewers');
            hiddenBadgeReverted.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-off w-3 h-3"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
              <span>Private</span>
            `;
            badgesRow.appendChild(hiddenBadgeReverted);
          }
        } else {
          if (hiddenBadgeReverted) {
            hiddenBadgeReverted.remove();
          }
        }
        
        if (b.isHidden) {
          hideBtn.setAttribute('title', 'Unhide clip (make public)');
        } else {
          hideBtn.setAttribute('title', 'Hide clip (make private)');
        }
        alert('Failed to toggle clip privacy. Please try again.');
      }
    };
  }

  return card;
}

function updateDynamicBackgroundFromActivePage(activePage, groupByStream) {
  let latestThumb = SVG_PLACEHOLDER;
  if (groupByStream && activePage.groups && activePage.groups.length > 0) {
    latestThumb = activePage.groups[0].thumbnail || (activePage.groups[0].items && activePage.groups[0].items[0] && activePage.groups[0].items[0].thumbnail);
  } else if (!groupByStream && activePage.clips && activePage.clips.length > 0) {
    latestThumb = activePage.clips[0].thumbnail;
  }
  
  if (!latestThumb) {
    latestThumb = SVG_PLACEHOLDER;
  }

  const bgContainer = document.getElementById('dynamic-bg-container');
  if (bgContainer) {
    bgContainer.style.backgroundImage = `url('${latestThumb}')`;
    document.documentElement.style.setProperty('--dynamic-bg-url', `url('${latestThumb}')`);
  }
}

function renderGroupedBookmarks(bookmarks, silent = false) {
  const container = document.getElementById('bookmark-list');
  const groupByStream = document.getElementById('groupByStreamToggle')?.checked !== false;
  
  // Save current scroll position to prevent jumps on silent update
  const scrollPos = window.scrollY;
  if (silent) {
    container.style.minHeight = `${container.offsetHeight}px`;
  }

  container.innerHTML = '';

  if (bookmarks.length === 0) {
    container.innerHTML = getEmptyStateHTML(
      'No clips found',
      'No clips match your search query. Try checking your spelling or using different keywords.'
    );
    if (silent) {
      container.style.minHeight = '';
    }
    const chId = getSelectedChannelId();
    if (chId) {
      updateHistoryState(chId, 1);
    }
    return;
  }

  let pages = [];

  if (groupByStream) {
    // 1. Group bookmarks by videoId (Live Stream)
    const groups = [];
    const videoIdMap = new Map();

    bookmarks.forEach(b => {
      if (!videoIdMap.has(b.videoId)) {
        const group = {
          videoId: b.videoId,
          title: b.videoTitle,
          thumbnail: b.thumbnail,
          items: []
        };
        groups.push(group);
        videoIdMap.set(b.videoId, group);
      }
      videoIdMap.get(b.videoId).items.push(b);
    });

    // 2. Chunk groups into pages (Show 50 clips per page, keep streams together)
    let currentPageGroups = [];
    let currentClipCount = 0;

    groups.forEach(group => {
      if (currentClipCount >= 50) {
        pages.push({ groups: currentPageGroups });
        currentPageGroups = [];
        currentClipCount = 0;
      }
      currentPageGroups.push(group);
      currentClipCount += group.items.length;
    });

    if (currentPageGroups.length > 0) {
      pages.push({ groups: currentPageGroups });
    }
  } else {
    // Flat list layout: Paginate to 50 clips per page
    const CLIPS_PER_PAGE = 50;
    const totalPages = Math.ceil(bookmarks.length / CLIPS_PER_PAGE);

    for (let p = 0; p < totalPages; p++) {
      const pageClips = bookmarks.slice(p * CLIPS_PER_PAGE, (p + 1) * CLIPS_PER_PAGE);
      pages.push({ clips: pageClips });
    }
  }

  // 3. Bound check currentPage
  if (currentPage < 0) currentPage = 0;
  if (currentPage >= pages.length) currentPage = 0;

  // Sync URL page parameter
  const chId = getSelectedChannelId();
  if (chId) {
    updateHistoryState(chId, currentPage + 1);
  }

  // 4. Render the current active page
  const activePage = pages[currentPage];
  if (!activePage) {
    if (silent) {
      container.style.minHeight = '';
    }
    return;
  }

  // Update dynamic background to match the 1st clip thumbnail of the active page
  updateDynamicBackgroundFromActivePage(activePage, groupByStream);



  if (groupByStream) {
    activePage.groups.forEach(activeGroup => {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'video-group glassmorphism';

      groupDiv.innerHTML = `
        <div class="video-header">
          <img src="${activeGroup.thumbnail}" class="video-header-thumb" loading="lazy" onerror="this.onerror=null; this.src='${SVG_PLACEHOLDER}'" />
          <span>${activeGroup.title}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 cards-grid"></div>
      `;

      const cardsGrid = groupDiv.querySelector('.cards-grid');
      activeGroup.items.forEach(b => {
        const card = createCardElement(b);
        cardsGrid.appendChild(card);
      });

      container.appendChild(groupDiv);
    });
  } else {
    // Flat list grid wrapped in a glassmorphism group container for consistent alignment and background padding
    const groupDiv = document.createElement('div');
    groupDiv.className = 'video-group glassmorphism flat-group';

    const flatGrid = document.createElement('div');
    flatGrid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 cards-grid';

    activePage.clips.forEach(b => {
      const card = createCardElement(b);
      flatGrid.appendChild(card);
    });

    groupDiv.appendChild(flatGrid);
    container.appendChild(groupDiv);
  }

  // 5. Render Pagination Controls if there is more than 1 page
  if (pages.length > 1) {
    const totalPages = pages.length;
    const activePageNum = currentPage + 1;
    const delta = 1; // Number of pages to show around active page
    const range = [];
    
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= activePageNum - delta && i <= activePageNum + delta)
      ) {
        range.push(i);
      }
    }
    
    const finalPages = [];
    let l;
    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          finalPages.push(l + 1);
        } else if (i - l > 2) {
          finalPages.push('...');
        }
      }
      finalPages.push(i);
      l = i;
    }

    const makePaginationHTML = (isTop) => {
      let pagesHTML = '';
      finalPages.forEach((item, index) => {
        if (item === '...') {
          pagesHTML += `<button class="page-dots" data-dots-index="${isTop ? 'top-' : 'bottom-'}${index}">...</button>`;
        } else {
          const isActive = item === activePageNum;
          pagesHTML += `<button class="page-number-btn ${isActive ? 'active' : ''}" data-page="${item - 1}">${item}</button>`;
        }
      });
      return `
        <button class="btn btn-secondary btn-sm nav-btn" ${currentPage === 0 ? 'disabled' : ''} id="newer-stream-btn">← Newer Clips</button>
        <div class="pagination-pages">
          ${pagesHTML}
        </div>
        <button class="btn btn-secondary btn-sm nav-btn" ${currentPage === pages.length - 1 ? 'disabled' : ''} id="older-stream-btn">Older Clips →</button>
      `;
    };

    // Upper pagination bar
    const pagDivTop = document.createElement('div');
    pagDivTop.className = 'pagination-controls pagination-top glassmorphism';
    pagDivTop.innerHTML = makePaginationHTML(true);

    // Bottom pagination bar
    const pagDivBottom = document.createElement('div');
    pagDivBottom.className = 'pagination-controls pagination-bottom glassmorphism';
    pagDivBottom.innerHTML = makePaginationHTML(false);
    
    const triggerPageChange = (nextPage, source) => {
      const activeGroups = container.querySelectorAll('.video-group, .cards-grid');
      const chId = getSelectedChannelId();

      const applyPageChange = () => {
        // Lock container height to keep scroll coordinates stable
        const previousHeight = container.offsetHeight;
        container.style.minHeight = `${previousHeight}px`;

        currentPage = nextPage;
        history.pushState(null, '', `?channel=${chId}&page=${nextPage + 1}`);
        renderGroupedBookmarks(bookmarks, true); // silent = true to prevent resetting scroll position to 0,0

        const topPag = container.querySelector('.pagination-top');
        if (source === 'bottom') {
          if (topPag) {
            topPag.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          } else {
            window.scrollTo({
              top: 0,
              behavior: 'smooth'
            });
          }
        } else {
          // Keep top navigation aligned instantly
          if (topPag) {
            topPag.scrollIntoView({
              behavior: 'auto',
              block: 'start'
            });
          } else {
            window.scrollTo({
              top: 0,
              behavior: 'auto'
            });
          }
        }

        requestAnimationFrame(() => {
          container.style.minHeight = '';
        });
      };

      if (activeGroups.length > 0) {
        activeGroups.forEach(el => el.classList.add('fade-out-page'));
        setTimeout(applyPageChange, 200);
      } else {
        applyPageChange();
      }
    };

    const bindEvents = (pagDiv, source) => {
      // Bind page capsule clicks
      pagDiv.querySelectorAll('.page-number-btn').forEach(btn => {
        btn.onclick = (e) => {
          const targetPage = parseInt(e.currentTarget.getAttribute('data-page'), 10);
          triggerPageChange(targetPage, source);
        };
      });

      // Bind ellipses popover toggle
      pagDiv.querySelectorAll('.page-dots').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          togglePageJumpPopover(e.currentTarget, totalPages, currentPage, (page) => triggerPageChange(page, source));
        };
      });

      pagDiv.querySelector('#newer-stream-btn').onclick = () => {
        if (currentPage > 0) {
          triggerPageChange(currentPage - 1, source);
        }
      };
      
      pagDiv.querySelector('#older-stream-btn').onclick = () => {
        if (currentPage < pages.length - 1) {
          triggerPageChange(currentPage + 1, source);
        }
      };
    };

    bindEvents(pagDivTop, 'top');
    bindEvents(pagDivBottom, 'bottom');

    // Prepend top bar and append bottom bar
    container.insertBefore(pagDivTop, container.firstChild);
    container.appendChild(pagDivBottom);
  }

  // Add 3D Tilt effect to rendered clip cards
  setup3DTilt(container.querySelectorAll('.card'));

  if (silent) {
    const gameFilter = document.getElementById('gameFilter');
    if (gameFilter && gameFilter.dataset.shouldScrollToSlider === "true") {
      delete gameFilter.dataset.shouldScrollToSlider;
      const sliderSection = document.getElementById('gameCardsSliderSection');
      if (sliderSection) {
        // Wait for two animation frames so the DOM rebuild is fully painted/laid-out
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const headerHeight = 70;
            const elementPosition = sliderSection.getBoundingClientRect().top + window.scrollY;
            const targetY = Math.max(0, elementPosition - headerHeight - 20);
            const startY = window.scrollY;
            const distance = targetY - startY;

            // If distance is negligible, skip animation
            if (Math.abs(distance) < 2) return;

            const duration = Math.min(800, Math.max(400, Math.abs(distance) * 0.6)); // 400-800ms adaptive
            let startTime = null;

            // Easing function: easeInOutCubic for premium feel
            const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

            const animateScroll = (currentTime) => {
              if (!startTime) startTime = currentTime;
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const easedProgress = easeInOutCubic(progress);

              window.scrollTo(0, startY + distance * easedProgress);

              if (progress < 1) {
                requestAnimationFrame(animateScroll);
              }
            };

            requestAnimationFrame(animateScroll);
          });
        });
      }
    } else {
      // Restore scroll position for silent (realtime) updates to avoid jumps
      window.scrollTo(0, scrollPos);
    }
    requestAnimationFrame(() => {
      container.style.minHeight = '';
    });
  } else {
    // For fresh loads/navigation: scroll to very top immediately and after paints/layout passes
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });

    // Run additional resets in next ticks to combat layout shifts and scroll anchoring restoration
    setTimeout(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, 20);

    setTimeout(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, 100);

    setTimeout(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, 300);
  }
}

/* Helper function to handle page-jump popover rendering and positioning */
function togglePageJumpPopover(dotsBtn, totalPages, currentPage, triggerPageChange) {
  const existingPopover = document.getElementById('page-jump-popover');
  if (existingPopover) {
    const wasLinkedToThis = existingPopover.getAttribute('data-linked-btn') === dotsBtn.getAttribute('data-dots-index');
    existingPopover.remove();
    if (wasLinkedToThis) {
      return;
    }
  }

  const popover = document.createElement('div');
  popover.id = 'page-jump-popover';
  popover.className = 'page-jump-popover glassmorphism';
  popover.setAttribute('data-linked-btn', dotsBtn.getAttribute('data-dots-index'));

  let gridHTML = '';
  for (let i = 1; i <= totalPages; i++) {
    const isActive = (i - 1) === currentPage;
    gridHTML += `<button class="page-grid-btn ${isActive ? 'active' : ''}" data-page="${i - 1}">${i}</button>`;
  }

  popover.innerHTML = `
    <div class="page-jump-header">Jump to Page</div>
    <div class="page-jump-input-wrapper">
      <input type="number" min="1" max="${totalPages}" class="page-jump-input" placeholder="Page (1-${totalPages})..." />
      <button class="page-jump-submit">Go</button>
    </div>
    <div class="page-jump-grid">
      ${gridHTML}
    </div>
  `;

  const paginationControls = dotsBtn.closest('.pagination-controls');
  paginationControls.appendChild(popover);

  const dotsRect = dotsBtn.getBoundingClientRect();
  const parentRect = paginationControls.getBoundingClientRect();
  
  const relativeLeft = (dotsRect.left - parentRect.left) + (dotsRect.width / 2);
  
  // Ensure the popover does not overflow container boundary
  let leftOffset = relativeLeft;
  const popoverWidth = 260;
  const halfWidth = popoverWidth / 2;
  
  if (leftOffset < halfWidth + 10) {
    leftOffset = halfWidth + 10;
  } else if (leftOffset > parentRect.width - halfWidth - 10) {
    leftOffset = parentRect.width - halfWidth - 10;
  }
  
  popover.style.left = `${leftOffset}px`;
  popover.style.bottom = `${parentRect.height + 10}px`;

  const input = popover.querySelector('.page-jump-input');
  input.focus();

  popover.querySelectorAll('.page-grid-btn').forEach(btn => {
    btn.onclick = (e) => {
      const pageIndex = parseInt(e.currentTarget.getAttribute('data-page'), 10);
      triggerPageChange(pageIndex);
      popover.remove();
    };
  });

  const submitJump = () => {
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val >= 1 && val <= totalPages) {
      triggerPageChange(val - 1);
      popover.remove();
    }
  };

  popover.querySelector('.page-jump-submit').onclick = submitJump;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      submitJump();
    }
  };
}

/* ================= 📡 REALTIME EVENTS ================= */
function updateCardDOM(cardEl, clip) {
  const chipInput = cardEl.querySelector('.chip-input');
  if (chipInput && chipInput.value.trim() !== clip.desc) {
    chipInput.value = clip.desc;
    chipInput.setAttribute('value', clip.desc);
    chipInput.setAttribute('title', clip.desc);
    const chipContainer = cardEl.querySelector('.editable-chip');
    if (chipContainer) {
      chipContainer.setAttribute('title', clip.desc);
    }
  }

  const favBtn = cardEl.querySelector('.fav-star-btn');
  if (favBtn) {
    favBtn.classList.toggle('active', clip.isFavorite);
    const svg = favBtn.querySelector('svg');
    if (svg) {
      if (clip.isFavorite) {
        svg.setAttribute('fill', '#f59e0b');
        svg.setAttribute('stroke', '#f59e0b');
        favBtn.setAttribute('title', 'Remove from Favorites');
      } else {
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        favBtn.setAttribute('title', 'Mark as Favorite');
      }
    }
  }

  if (clip.isFavorite) {
    cardEl.classList.add('favorite-highlight');
  } else {
    cardEl.classList.remove('favorite-highlight');
  }

  const deleteBtn = cardEl.querySelector('.delete-btn');
  if (deleteBtn) {
    if (clip.isFavorite) {
      deleteBtn.setAttribute('disabled', 'true');
      deleteBtn.setAttribute('title', 'Cannot delete a favorite clip');
    } else {
      deleteBtn.removeAttribute('disabled');
      deleteBtn.setAttribute('title', 'Delete clip');
    }
  }
}

function handleRealtimeEvent(payload, currentStreamerId) {
  if (payload.eventType === 'UPDATE') {
    const updatedRecord = payload.new;
    const idx = allBookmarks.findIndex(b => b.id === updatedRecord.id);
    if (idx !== -1) {
      allBookmarks[idx].isFavorite = updatedRecord.is_favorite || false;
      allBookmarks[idx].desc = updatedRecord.description || 'None';

      const cardEl = document.querySelector(`.card[data-clip-id="${updatedRecord.id}"]`);
      if (cardEl) {
        updateCardDOM(cardEl, allBookmarks[idx]);
      }
    }
  } else if (payload.eventType === 'INSERT') {
    (async () => {
      let clipRaw = payload.new;
      // Fetch stream details and game details in parallel
      const [streamRes, gameRes] = await Promise.all([
        supabase.from('streams').select('video_title, storyboard_spec').eq('video_id', clipRaw.video_id).maybeSingle(),
        clipRaw.game_id_tag
          ? supabase.from('games').select('*').eq('id', clipRaw.game_id_tag).maybeSingle()
          : Promise.resolve({ data: null })
      ]);

      const streamDetails = streamRes.data;
      const gameDetails = gameRes.data;

      const username = clipRaw.username || 'Unknown Viewer';
      const cleanUser = username.replace('@', '');
      const profileUrl = username && username !== 'Unknown Viewer' && username !== 'unknown'
        ? (username.startsWith('@') ? 'https://www.youtube.com/' + username : 'https://www.youtube.com/@' + username)
        : '#';
      const thumbnail = clipRaw.video_id
        ? `https://i.ytimg.com/vi/${clipRaw.video_id}/mqdefault.jpg`
        : SVG_PLACEHOLDER;

      const newClip = {
        id: clipRaw.id,
        time: clipRaw.timestamp_seconds,
        desc: clipRaw.description || 'None',
        date: clipRaw.created_at,
        username: username,
        profileUrl: profileUrl,
        videoId: clipRaw.video_id,
        videoTitle: streamDetails?.video_title || 'Live Stream',
        thumbnail: thumbnail,
        storyboardSpec: streamDetails?.storyboard_spec || null,
        profileId: clipRaw.profile_id,
        streamerId: '',
        isFavorite: clipRaw.is_favorite || false,
        userRole: clipRaw.user_role || 'everyone',
        gameName: gameDetails?.game_title || '',
        gameTitle: gameDetails?.game_title || '',
        gamePoster: gameDetails?.game_poster || ''
      };

      if (!allBookmarks.some(b => b.id === newClip.id)) {
        allBookmarks.unshift(newClip);
        // Regenerate games dropdown list if new game encountered
        populateGameDropdown(allBookmarks);
        totalClipsCount++;
        updateCreatorClipsCount();
        applyFilters(true);
      }
    })();
  } else if (payload.eventType === 'DELETE') {
    const deletedId = payload.old.id;
    allBookmarks = allBookmarks.filter(b => b.id !== deletedId);
    totalClipsCount = Math.max(0, totalClipsCount - 1);
    updateCreatorClipsCount();
    applyFilters(true);
  }
}

/* ================= 🔍 FILTER & SEARCH ================= */
function applyFilters(silent = false, preservePage = false) {
  window.updateSearchPlaceholder?.();
  const q = document.getElementById('filter').value.toLowerCase().trim();
  const favOnly = document.getElementById('favFilterToggle')?.checked || false;
  const levelVal = document.getElementById('levelFilter')?.value || '';
  const gameVal = document.getElementById('gameFilter')?.value || '';
  
  if (!silent) {
    if (!preservePage) {
      currentPage = 0;
    }
    const chId = getSelectedChannelId();
    if (chId) {
      updateHistoryState(chId, currentPage + 1);
    }
  }
  
  const isUserSearch = q.startsWith('@');
  const userQuery = isUserSearch ? q.slice(1) : q;
  
  const filtered = allBookmarks.filter(b => {
    // Determine management permission
    const canManage = isAdmin || 
                      (currentUser && (
                        (b.profileId && currentUser.id === b.profileId) || 
                        (!b.profileId && currentUserChannelId && currentUserChannelId === b.streamerId)
                      ));

    // Privacy lock: hidden clips are only visible to authorized creators
    if (b.isHidden && !canManage) {
      return false;
    }

    if (favOnly && !b.isFavorite) return false;

    // 1. Level Filter
    if (levelVal) {
      const bRole = (b.userRole || '').toLowerCase();
      if (levelVal === 'owner' && bRole !== 'owner') return false;
      if (levelVal === 'moderator' && bRole !== 'moderator' && bRole !== 'mod') return false;
      if (levelVal === 'subscriber' && bRole !== 'subscriber' && bRole !== 'member') return false;
      if (levelVal === 'regular' && bRole !== 'regular') return false;
      if (levelVal === 'everyone' && bRole !== 'everyone' && bRole !== 'user') return false;
    }

    // 2. Game Filter
    if (gameVal) {
      const bGame = (b.gameName || '').toLowerCase();
      if (bGame !== gameVal.toLowerCase()) return false;
    }
    
    // 3. Text Search
    if (!q) return true;

    if (q === '#hidden') {
      return b.isHidden;
    }
    
    const descMatch = b.desc.toLowerCase().includes(q);
    const titleMatch = b.videoTitle.toLowerCase().includes(q);
    const userMatch = isUserSearch 
      ? b.username.toLowerCase().includes(userQuery)
      : b.username.toLowerCase().includes(q);
      
    return descMatch || titleMatch || userMatch;
  });
  
  renderGroupedBookmarks(filtered, true);
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
}

// Global listener to close dropdowns when clicking outside
document.addEventListener('click', (e) => {
  document.querySelectorAll('.custom-dropdown-wrapper').forEach(wrapper => {
    if (!wrapper.contains(e.target)) {
      wrapper.classList.remove('open');
      wrapper.querySelector('.custom-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
    }
  });

  document.querySelectorAll('.download-dropdown-wrapper').forEach(wrapper => {
    if (!wrapper.contains(e.target)) {
      wrapper.querySelector('.download-dropdown-menu')?.classList.remove('show');
    }
  });

  // Close page-jump-popover if clicking outside of it and outside of any page-dots button
  const popover = document.getElementById('page-jump-popover');
  if (popover) {
    const isDotsClick = e.target.closest('.page-dots');
    if (!popover.contains(e.target) && !isDotsClick) {
      popover.remove();
    }
  }
});

/* ================= 🔍 SUGGESTIVE SEARCH (VANILLA) ================= */
function setupSuggestiveSearch() {
  const searchInput = document.getElementById('filter');
  const overlay = document.getElementById('searchPlaceholderOverlay');
  if (!searchInput || !overlay) return;
  const placeholderTextSpan = overlay.querySelector('.placeholder-text');
  if (!placeholderTextSpan) return;

  const suggestions = [
    "Search clips...",
    "Search by user (e.g. @username)...",
    "Search by description...",
    "Search video titles..."
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

  searchInput.addEventListener('focus', updateVisibility);
  searchInput.addEventListener('blur', updateVisibility);
  searchInput.addEventListener('input', updateVisibility);

  // Expose as window global helper so other functions can trigger updating state
  window.updateSearchPlaceholder = updateVisibility;

  // Initial update
  updateVisibility();
}

/* ================= 🧭 PAGE TOUR GUIDE ================= */
class ClipsPageTour {
  constructor() {
    this.currentStep = 0;
    this.steps = [
      {
        target: '#startTourBtn',
        title: '🚀 Stage 1: Page Overview',
        desc: 'This tour explores the main layout, including filters and global search tools. Hover over any icon for a quick explanation.',
        placement: 'bottom'
      },
      {
        target: '#creator-gift-btn',
        title: '🔗 Creator Actions & Links',
        desc: 'Quickly access the creator\'s main YouTube channel, check statistics, or gift memberships to your favorite streamers.',
        placement: 'bottom'
      },
      {
        target: '#creator-analytics-btn',
        title: '📊 Creator Channel Analytics',
        desc: 'If you are the channel owner, click this to access real-time statistics, graphs, games breakdown, clipper leaderboards, and key metrics. Non-owners will see this tab locked.',
        placement: 'bottom'
      },
      {
        target: '#gameCardsSliderSection',
        title: '🎮 Quick Game Filter',
        desc: 'Filter clips dynamically by clicking on any of the active game cards in this horizontal slider.',
        placement: 'bottom'
      },
      {
        target: '.filter-card-section',
        title: '🔍 Search & Filter Tools',
        desc: '<b>4.1. Search:</b> Filter by game, viewer level (e.g. Moderator), or keywords.<br><b>4.2. Toggles:</b> Show favorites only or group clips by stream.',
        placement: 'bottom'
      }
    ];

    this.popover = document.getElementById('tour-popover');
    this.backdrop = document.getElementById('tour-backdrop');
    this.titleEl = document.getElementById('tour-title');
    this.descEl = document.getElementById('tour-desc');
    this.counterEl = document.getElementById('tour-step-counter');
    this.prevBtn = document.getElementById('tour-prev-btn');
    this.nextBtn = document.getElementById('tour-next-btn');
    this.closeBtn = document.getElementById('tour-close-btn');
    this.startBtn = document.getElementById('startTourBtn');
    this.dashboardView = document.getElementById('dashboardView');

    if (this.popover && this.startBtn && this.dashboardView) {
      this.initEvents();
    }
  }

  initEvents() {
    this.startBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.start();
    });
    this.closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.stop();
    });
    this.prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.prev();
    });
    this.nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.next();
    });
    this.backdrop.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.stop();
    });
  }

  start() {
    this.currentStep = 0;
    document.body.classList.add('tour-active');
    if (this.backdrop) this.backdrop.classList.remove('hidden');
    if (this.popover) this.popover.classList.remove('hidden');
    
    // Position first step immediately so it fades in at the correct coordinates
    const step = this.steps[0];
    const targetEl = document.querySelector(step.target);
    if (targetEl) {
      targetEl.classList.add('tour-target-highlighted');
      this.positionPopover(targetEl, step.placement);
      targetEl.classList.remove('tour-target-highlighted');
    }
    
    // Force reflow for opacity transition
    if (this.popover) {
      this.popover.offsetHeight;
      this.popover.classList.add('active');
    }
    this.showStep();
  }

  stop() {
    document.body.classList.remove('tour-active');
    if (this.popover) this.popover.classList.remove('active');
    this.clearHighlight();
    setTimeout(() => {
      if (this.popover) this.popover.classList.add('hidden');
      if (this.backdrop) this.backdrop.classList.add('hidden');
    }, 200);
    localStorage.setItem('streamclips_tour_completed', 'true');
  }

  prev() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.showStep();
    }
  }

  next() {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this.showStep();
    } else {
      this.stop();
    }
  }

  clearHighlight() {
    document.querySelectorAll('.tour-target-highlighted').forEach(el => {
      el.classList.remove('tour-target-highlighted');
    });
  }

  showStep() {
    this.clearHighlight();
    const step = this.steps[this.currentStep];
    
    let targetEl = null;
    let placement = step.placement;
    let useScrollBlockStart = false;

    if (step.target === '.pagination-controls') {
      const pagEl = document.querySelector('.pagination-controls');
      if (pagEl) {
        targetEl = pagEl;
      } else {
        targetEl = document.querySelector('#bookmark-list');
        placement = 'bottom'; // Place below top edge of bookmark-list so it is visible
        useScrollBlockStart = true;
      }
    } else {
      targetEl = document.querySelector(step.target);
    }

    // Dynamic visibility check: skip element if it's hidden or has 0 dimensions
    const isVisible = targetEl && (targetEl.offsetWidth > 0 || targetEl.offsetHeight > 0 || targetEl.getClientRects().length > 0);

    if (!isVisible) {
      console.warn(`Tour step target not visible or not found: ${step.target}, skipping to next step.`);
      if (this.currentStep < this.steps.length - 1) {
        this.currentStep++;
        this.showStep();
      } else {
        this.stop();
      }
      return;
    }

    // Scroll to target smoothly
    if (useScrollBlockStart) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Highlight target
    targetEl.classList.add('tour-target-highlighted');

    // Update text
    if (this.titleEl) this.titleEl.innerHTML = step.title;
    if (this.descEl) this.descEl.innerHTML = step.desc;
    if (this.counterEl) this.counterEl.textContent = `${this.currentStep + 1} of ${this.steps.length}`;

    // Update buttons
    if (this.prevBtn) this.prevBtn.disabled = this.currentStep === 0;
    if (this.nextBtn) {
      if (this.currentStep === this.steps.length - 1) {
        this.nextBtn.textContent = 'Finish';
      } else {
        this.nextBtn.innerHTML = 'Next &rarr;';
      }
    }

    // Reposition popover immediately so its transition glides smoothly along with scroll
    this.positionPopover(targetEl, placement);

    // Keep recalculating position during smooth scroll so the popover stays perfectly aligned
    let frames = 0;
    const updatePos = () => {
      this.positionPopover(targetEl, placement);
      frames++;
      if (frames < 45) {
        requestAnimationFrame(updatePos);
      }
    };
    requestAnimationFrame(updatePos);
  }

  positionPopover(target, placement) {
    if (!target || !this.popover || !this.dashboardView) return;

    try {
      const rect = target.getBoundingClientRect();
      const dashboardRect = this.dashboardView.getBoundingClientRect();
      const popoverRect = this.popover.getBoundingClientRect();
      const arrow = document.getElementById('tour-arrow');

      // Calculate relative coordinates to #dashboardView (handles scroll offsets and stacking contexts)
      const relativeTop = rect.top - dashboardRect.top;
      const relativeLeft = rect.left - dashboardRect.left;

      let top = 0;
      let left = 0;

      // Remove any existing arrow placement classes
      if (arrow) {
        arrow.className = 'tour-arrow';
      }

      // Positioning logic relative to #dashboardView
      if (placement === 'bottom' || placement === 'bottom-start') {
        top = relativeTop + rect.height + 12;
        left = placement === 'bottom-start' ? relativeLeft : relativeLeft + (rect.width / 2) - (popoverRect.width / 2);
        if (arrow) {
          arrow.className = 'tour-arrow arrow-top';
          if (placement === 'bottom-start') {
            arrow.classList.add('arrow-left-align');
          } else {
            arrow.classList.add('arrow-center-align');
          }
        }
      } else if (placement === 'top') {
        top = relativeTop - popoverRect.height - 12;
        left = relativeLeft + (rect.width / 2) - (popoverRect.width / 2);
        if (arrow) {
          arrow.className = 'tour-arrow arrow-bottom arrow-center-align';
        }
      }

      // Keep popover inside #dashboardView bounds
      const margin = 16;
      if (left < margin) {
        left = margin;
      }
      if (left + popoverRect.width > dashboardRect.width - margin) {
        left = dashboardRect.width - popoverRect.width - margin;
      }

      this.popover.style.top = `${top}px`;
      this.popover.style.left = `${left}px`;
    } catch (err) {
      console.error('Error positioning tour popover:', err);
    }
  }
}

/* ================= 📜 SETUP GUIDE MODAL CONTROLLER ================= */
window.toggleSetupModal = function(show) {
  const setupModal = document.getElementById('setupModal');
  if (!setupModal) return;
  const contentCard = setupModal.querySelector('.relative');
  if (show) {
    setupModal.classList.remove('opacity-0', 'pointer-events-none');
    if (contentCard) {
      contentCard.classList.remove('scale-95');
      contentCard.classList.add('scale-100');
    }
  } else {
    setupModal.classList.add('opacity-0', 'pointer-events-none');
    if (contentCard) {
      contentCard.classList.remove('scale-100');
      contentCard.classList.add('scale-95');
    }
  }
};

/* ================= 🔔 UPDATES MODAL CONTROLLER ================= */
window.toggleUpdatesModal = function(show) {
  const updatesModal = document.getElementById('updatesModal');
  if (!updatesModal) return;
  const contentCard = updatesModal.querySelector('.relative');
  if (show) {
    updatesModal.classList.remove('opacity-0', 'pointer-events-none');
    if (contentCard) {
      contentCard.classList.remove('scale-95');
      contentCard.classList.add('scale-100');
    }
  } else {
    updatesModal.classList.add('opacity-0', 'pointer-events-none');
    if (contentCard) {
      contentCard.classList.remove('scale-100');
      contentCard.classList.add('scale-95');
    }
  }
};

/* ================= 🐛 BUG REPORT MODAL CONTROLLER ================= */
window.toggleBugModal = function(show) {
  const bugModal = document.getElementById('bugModal');
  if (!bugModal) return;
  const contentCard = bugModal.querySelector('.relative');
  if (show) {
    bugModal.classList.remove('opacity-0', 'pointer-events-none');
    if (contentCard) {
      contentCard.classList.remove('scale-95');
      contentCard.classList.add('scale-100');
    }
  } else {
    bugModal.classList.add('opacity-0', 'pointer-events-none');
    if (contentCard) {
      contentCard.classList.remove('scale-100');
      contentCard.classList.add('scale-95');
    }
  }
};

// Global Event Delegation for Setup Guide & Copy Button clicks (bypass any DOM loading race conditions)
document.addEventListener('click', (e) => {
  const setupGuideBtn = e.target.closest('#setupGuideNavBtn');
  if (setupGuideBtn) {
    e.preventDefault();
    window.toggleSetupModal?.(true);
    return;
  }

  const updatesBtn = e.target.closest('#updatesNavBtn');
  if (updatesBtn) {
    e.preventDefault();
    window.toggleUpdatesModal?.(true);
    localStorage.setItem('has_seen_updates_v13', 'true');
    const badges = document.querySelectorAll('.updates-badge');
    badges.forEach(badge => badge.classList.add('hidden'));
    return;
  }

  const bugBtn = e.target.closest('#bugReportNavBtn');
  if (bugBtn) {
    e.preventDefault();
    /*
    const storedToken = localStorage.getItem('streamclips_token');
    const storedUser = localStorage.getItem('streamclips_user');
    if (!storedToken || !storedUser) {
      const nextTarget = window.location.href;
      window.location.href = `${window.location.origin}/login?next=${encodeURIComponent(nextTarget)}`;
      return;
    }
    */
    window.toggleBugModal?.(true);
    return;
  }

  const closeUpdatesBtn = e.target.closest('#closeUpdatesBtn') || e.target.closest('#dismissUpdatesBtn');
  if (closeUpdatesBtn) {
    e.preventDefault();
    window.toggleUpdatesModal?.(false);
    return;
  }

  const copyBtn = e.target.closest('#copy-btn-3d');
  if (copyBtn) {
    e.preventDefault();
    const commandEl = document.getElementById('setup-command-3d');
    if (commandEl) {
      navigator.clipboard.writeText(commandEl.innerText.trim()).then(() => {
        copyBtn.innerText = 'Copied!';
        copyBtn.classList.remove('bg-purple-600', 'hover:bg-purple-500');
        copyBtn.classList.add('bg-emerald-600', 'hover:bg-emerald-500');
        setTimeout(() => {
          copyBtn.innerText = 'Copy';
          copyBtn.classList.remove('bg-emerald-600', 'hover:bg-emerald-500');
          copyBtn.classList.add('bg-purple-600', 'hover:bg-purple-500');
        }, 2000);
      });
    }
  }
});

// Scroll-Into-View Animations (.animated-container) using IntersectionObserver
function initScrollAnimations() {
  const animatedContainers = document.querySelectorAll('.animated-container');
  if (!animatedContainers.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target); // Animates once and stays active
      }
    });
  }, {
    root: null,
    rootMargin: '0px 0px -50px 0px', // Trigger slightly before full entrance
    threshold: 0.05
  });

  animatedContainers.forEach(container => {
    observer.observe(container);
  });
}

initScrollAnimations();

// Global Event Delegation for User Profile Popover Interactions
document.addEventListener('click', (e) => {
  const profileBtn = e.target.closest('#user-profile-button');
  const popover = document.getElementById('userProfilePopover');
  
  if (profileBtn) {
    e.stopPropagation();
    if (!popover) return;
    const isActive = popover.classList.contains('active');
    if (!isActive) {
      popover.classList.add('active');
      profileBtn.classList.add('popover-open');
    } else {
      popover.classList.remove('active');
      profileBtn.classList.remove('popover-open');
    }
    return;
  }
  
  const connectBtn = e.target.closest('#popoverConnectYoutubeBtn');
  if (connectBtn) {
    e.stopPropagation();
    const popover = document.getElementById('userProfilePopover');
    const profileBtn = document.getElementById('user-profile-button');
    if (popover) popover.classList.remove('active');
    if (profileBtn) profileBtn.classList.remove('popover-open');
    document.getElementById('connectYoutubeNavBtn')?.click();
    return;
  }

  const viewProfileBtn = e.target.closest('#popoverViewProfileBtn');
  if (viewProfileBtn) {
    e.stopPropagation();
    const popover = document.getElementById('userProfilePopover');
    const profileBtn = document.getElementById('user-profile-button');
    if (popover) popover.classList.remove('active');
    if (profileBtn) profileBtn.classList.remove('popover-open');
    
    const handle = currentUserHandle || currentUserChannelId || 'default_streamer';
    const urlPath = handle.startsWith('@') ? `/${handle}` : `/@${handle}`;
    window.location.href = urlPath;
    return;
  }

  const subscriptionBtn = e.target.closest('#popoverSubscriptionBtn');
  if (subscriptionBtn) {
    e.stopPropagation();
    const popover = document.getElementById('userProfilePopover');
    const profileBtn = document.getElementById('user-profile-button');
    if (popover) popover.classList.remove('active');
    if (profileBtn) profileBtn.classList.remove('popover-open');
    window.location.href = '/#pricing';
    return;
  }

  const popoverSetupGuideBtn = e.target.closest('#popoverSetupGuideBtn');
  if (popoverSetupGuideBtn) {
    e.stopPropagation();
    const popover = document.getElementById('userProfilePopover');
    const profileBtn = document.getElementById('user-profile-button');
    if (popover) popover.classList.remove('active');
    if (profileBtn) profileBtn.classList.remove('popover-open');
    window.toggleSetupModal?.(true);
    return;
  }

  const signOutBtn = e.target.closest('#popoverSignOutBtn');
  if (signOutBtn) {
    e.stopPropagation();
    localStorage.removeItem('streamclips_token');
    localStorage.removeItem('streamclips_user');
    localStorage.removeItem('streamclips_p1_refresh_token');
    location.reload();
    return;
  }

  const isInsidePopover = e.target.closest('#userProfilePopover');
  if (isInsidePopover) {
    e.stopPropagation();
    return;
  }

  const activePopover = document.querySelector('.user-profile-popover.active');
  if (activePopover) {
    activePopover.classList.remove('active');
    document.getElementById('user-profile-button')?.classList.remove('popover-open');
  }

  if (!e.target.closest('.download-dropdown-wrapper')) {
    document.querySelectorAll('.download-dropdown-menu').forEach(menu => {
      menu.classList.add('hidden');
    });
  }
});

// Bug Report Severity Custom Dropdown Toggle
document.addEventListener('click', (e) => {
  const toggleBtn = e.target.closest('#bugSeverityToggleBtn');
  const dropdownMenu = document.getElementById('bugSeverityDropdownMenu');
  const chevron = document.getElementById('bugSeverityChevron');
  
  if (toggleBtn && dropdownMenu) {
    e.preventDefault();
    const isShown = dropdownMenu.classList.contains('show');
    dropdownMenu.classList.toggle('show', !isShown);
    if (chevron) {
      chevron.style.transform = !isShown ? 'rotate(180deg)' : 'rotate(0deg)';
    }
  } else if (dropdownMenu && !e.target.closest('.bug-severity-dropdown-wrapper')) {
    dropdownMenu.classList.remove('show');
    if (chevron) {
      chevron.style.transform = 'rotate(0deg)';
    }
  }
});

// Bug Report Severity Option Selection
document.addEventListener('click', (e) => {
  const optionBtn = e.target.closest('.bug-severity-option-btn');
  if (optionBtn) {
    e.preventDefault();
    const val = optionBtn.getAttribute('data-value');
    const text = optionBtn.innerText;
    
    const hiddenInput = document.getElementById('bugSeverity');
    const selectedTextSpan = document.getElementById('bugSeveritySelectedText');
    const dropdownMenu = document.getElementById('bugSeverityDropdownMenu');
    const chevron = document.getElementById('bugSeverityChevron');
    
    if (hiddenInput) hiddenInput.value = val;
    if (selectedTextSpan) selectedTextSpan.innerText = text;
    if (dropdownMenu) dropdownMenu.classList.remove('show');
    if (chevron) chevron.style.transform = 'rotate(0deg)';
  }
});

// Bug Report Form handler
document.addEventListener('submit', (e) => {
  const form = e.target.closest('#bugReportForm');
  if (form) {
    e.preventDefault();
    const submitBtn = form.querySelector('#submitBugBtn');
    if (submitBtn) {
      const frontSpan = submitBtn.querySelector('.front');
      const originalText = frontSpan ? frontSpan.innerHTML : submitBtn.innerHTML;
      
      const loadingHTML = `
        <svg class="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Submitting...
      `;
      
      if (frontSpan) {
        frontSpan.innerHTML = loadingHTML;
      } else {
        submitBtn.innerHTML = loadingHTML;
      }
      submitBtn.disabled = true;

      // Collect form details
      const title = form.querySelector('#bugTitle')?.value || '';
      const severity = form.querySelector('#bugSeverity')?.value || 'medium';
      const description = form.querySelector('#bugDescription')?.value || '';
      
      const username = document.getElementById('popover-username')?.textContent || 'Guest / Not Logged In';
      const email = document.getElementById('popover-email')?.textContent || 'Not Signed In';
      const pageUrl = window.location.href;
      const userAgent = navigator.userAgent;

      const payload = {
        username: "StreamPayClips Bug Reporter",
        avatar_url: "https://streamsnip.com/logo.svg",
        embeds: [{
          title: "🐛 New Bug Report Submitted",
          color: 15548997, // Red/Crimson
          fields: [
            { name: "Website Name", value: "StreamPayClips", inline: true },
            { name: "Reported By", value: username, inline: true },
            { name: "User Email", value: email, inline: true },
            { name: "Issue Title", value: title },
            { name: "Severity Level", value: severity.toUpperCase(), inline: true },
            { name: "Page URL", value: pageUrl, inline: true },
            { name: "Description / Steps to Reproduce", value: description },
            { name: "Device Info / User Agent", value: userAgent }
          ],
          timestamp: new Date().toISOString()
        }]
      };

      const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1523992518331469925/sqU-9XStR0CxPBb9U8DhYJh9Ie23m4BxQ3s1UaPBVAPfAzFM5gHnBMZR1wA750znsnZT'; // Replace this string with your actual Discord Webhook URL

      // Helper function to finish form state
      const finishSubmit = (success, message = '') => {
        const successHTML = `
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
          </svg>
          Report Submitted!
        `;
        const failedHTML = `
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
          Submission Failed!
        `;
        
        if (frontSpan) {
          frontSpan.innerHTML = success ? successHTML : failedHTML;
        } else {
          submitBtn.innerHTML = success ? successHTML : failedHTML;
        }

        if (success) {
          submitBtn.classList.add('success-state');
        } else {
          submitBtn.classList.add('failed-state');
        }

        setTimeout(() => {
          window.toggleBugModal?.(false);
          // Reset form and button
          form.reset();
          const selectedTextSpan = form.querySelector('#bugSeveritySelectedText');
          const hiddenInput = form.querySelector('#bugSeverity');
          if (selectedTextSpan) selectedTextSpan.innerText = 'Medium - Feature behavior issue';
          if (hiddenInput) hiddenInput.value = 'medium';

          submitBtn.disabled = false;
          if (frontSpan) {
            frontSpan.innerHTML = originalText;
          } else {
            submitBtn.innerHTML = originalText;
          }
          submitBtn.classList.remove('success-state', 'failed-state');
        }, 1500);
      };

      if (DISCORD_WEBHOOK_URL && DISCORD_WEBHOOK_URL !== 'YOUR_DISCORD_WEBHOOK_URL') {
        fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        .then(response => {
          if (response.ok) {
            finishSubmit(true);
          } else {
            console.error('Webhook error:', response.statusText);
            finishSubmit(true); // Fallback: still reset modal so user flow isn't blocked
          }
        })
        .catch(err => {
          console.error('Webhook fetch error:', err);
          finishSubmit(true);
        });
      } else {
        // Simulated response if webhook URL is not configured yet
        setTimeout(() => {
          finishSubmit(true);
        }, 1000);
      }
    }
  }
});

// Global Escape Key Listener for Modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.toggleSetupModal?.(false);
    window.toggleUpdatesModal?.(false);
    window.toggleBugModal?.(false);
    window.toggleVideoModal?.(false);

    const loginModal = document.getElementById('loginModal');
    if (loginModal && !loginModal.classList.contains('hidden')) {
      loginModal.classList.add('hidden');
    }
  }
});

window.updateAvatarGlow = updateAvatarGlow;
window.setup3DTilt = setup3DTilt;





