/**
 * Client-Side Background Resolver for Kick User Avatars
 * Runs entirely in the client browser to resolve custom Kick profile pictures
 * without blocking or lagging live chat message rendering.
 */

// In-memory cache + persistent localStorage cache
const MEMORY_CACHE = new Map();
const PENDING_QUEUE = new Set();
const IN_FLIGHT = new Set();
const FAILED_USERS = new Map(); // username -> cooldown timestamp

const STORAGE_KEY = 'prochat_kick_avatar_cache_v2';
const COOLDOWN_MS = 60000; // 1 minute cooldown for users without custom avatars

// Load existing cache from localStorage on startup
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        Object.entries(parsed).forEach(([k, v]) => {
          if (k && v && typeof v === 'string') {
            MEMORY_CACHE.set(k.toLowerCase().trim(), v);
          }
        });
      }
    }
  } catch (e) {
    console.warn('[KickAvatarResolver] Failed to parse local storage cache:', e);
  }
}

// Save memory cache to localStorage (debounced)
let saveTimeout = null;
function persistCache() {
  if (typeof window === 'undefined') return;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const obj = {};
      MEMORY_CACHE.forEach((v, k) => {
        if (v && !v.includes('/kick-default-avatars/')) {
          obj[k] = v;
        }
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {}
  }, 2000);
}

// Queue processor
let isProcessing = false;
async function processQueue() {
  if (isProcessing || PENDING_QUEUE.size === 0) return;
  isProcessing = true;

  // Process up to 3 users concurrently
  const batch = [];
  for (const item of PENDING_QUEUE) {
    batch.push(item);
    PENDING_QUEUE.delete(item);
    if (batch.length >= 3) break;
  }

  await Promise.allSettled(
    batch.map(async ({ username, userId }) => {
      const cleanUser = (username || '').toLowerCase().replace(/^@+/, '').trim();
      if (!cleanUser || IN_FLIGHT.has(cleanUser)) return;

      IN_FLIGHT.add(cleanUser);
      try {
        const resolvedUrl = await resolveSingleAvatar(cleanUser, userId);
        if (resolvedUrl && typeof resolvedUrl === 'string' && resolvedUrl.startsWith('http') && !resolvedUrl.includes('default-avatar')) {
          MEMORY_CACHE.set(cleanUser, resolvedUrl);
          persistCache();

          // Dispatch reactive update event to UI
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('kick-avatar-resolved', {
                detail: { username: cleanUser, avatar: resolvedUrl }
              })
            );
          }
        } else {
          FAILED_USERS.set(cleanUser, Date.now() + COOLDOWN_MS);
        }
      } catch (err) {
        FAILED_USERS.set(cleanUser, Date.now() + COOLDOWN_MS);
      } finally {
        IN_FLIGHT.delete(cleanUser);
      }
    })
  );

  isProcessing = false;
  if (PENDING_QUEUE.size > 0) {
    setTimeout(processQueue, 150);
  }
}

// Fetch avatar via local API / direct Kick endpoints with fallback
async function resolveSingleAvatar(cleanUser, userId) {
  // Strategy 1: Call internal /api/kick/avatar route with json=true
  try {
    const query = new URLSearchParams({
      username: cleanUser,
      userId: userId ? String(userId) : '',
      json: 'true'
    });
    const res = await fetch(`/api/kick/avatar?${query.toString()}`, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.avatar && typeof data.avatar === 'string' && data.avatar.startsWith('http') && !data.avatar.includes('default-avatar')) {
        return data.avatar;
      }
    }
  } catch (e) {}

  // Strategy 2: Direct Kick public channels API via local /api/kick proxy
  try {
    const res = await fetch(`/api/kick/api/v1/channels/${cleanUser}`, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      const userObj = data?.user || data;
      const avatar = userObj?.profile_pic || userObj?.avatar;
      if (avatar && typeof avatar === 'string' && avatar.startsWith('http') && !avatar.includes('default-avatar')) {
        return avatar;
      }
    }
  } catch (e) {}

  return null;
}

/**
 * Main API: Request avatar resolution in background.
 * Returns cached avatar immediately if available, or null if pending.
 */
export function requestKickAvatar(username, userId) {
  if (!username) return null;
  const cleanUser = username.toLowerCase().replace(/^@+/, '').trim();
  if (!cleanUser) return null;

  // 1. Return from memory cache if available
  if (MEMORY_CACHE.has(cleanUser)) {
    return MEMORY_CACHE.get(cleanUser);
  }

  // 2. Check if currently on cooldown (already checked and user has no custom avatar)
  const cooldownUntil = FAILED_USERS.get(cleanUser);
  if (cooldownUntil && Date.now() < cooldownUntil) {
    return null;
  }

  // 3. Queue for background resolution
  if (!IN_FLIGHT.has(cleanUser)) {
    let alreadyInQueue = false;
    for (const item of PENDING_QUEUE) {
      if (item.username === cleanUser) {
        alreadyInQueue = true;
        break;
      }
    }
    if (!alreadyInQueue) {
      PENDING_QUEUE.add({ username: cleanUser, userId: userId ? String(userId) : '' });
      setTimeout(processQueue, 50);
    }
  }

  return null;
}

export function getCachedKickAvatar(username) {
  if (!username) return null;
  const clean = username.toLowerCase().replace(/^@+/, '').trim();
  return MEMORY_CACHE.get(clean) || null;
}

export function setCachedKickAvatar(username, avatarUrl) {
  if (!username || !avatarUrl) return;
  const clean = username.toLowerCase().replace(/^@+/, '').trim();
  if (clean && typeof avatarUrl === 'string' && avatarUrl.startsWith('http') && !avatarUrl.includes('default-avatar')) {
    MEMORY_CACHE.set(clean, avatarUrl);
    persistCache();
  }
}
