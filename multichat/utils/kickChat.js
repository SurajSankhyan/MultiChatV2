// Kick Live Chat Client using Pusher WebSocket and Proxy Fallbacks
import { parseMessageContent } from './emotes.js';

export class KickChatClient {
  constructor(onMessageCallback, onStatusCallback) {
    this.socket = null;
    this.onMessage = onMessageCallback;
    this.onStatus = onStatusCallback; // (channel, status: 'connecting' | 'connected' | 'disconnected')
    this.channelsMap = new Map(); // channelName (slug) -> chatroomId
    this.pendingChannels = new Set(); // channels to subscribe once connected
    this.isConnected = false;
    this.isManuallyDisconnected = false;
    this.reconnectInterval = 5000;
    this.subscriberBadgesMap = new Map(); // channelName -> subscriber_badges array
    this.seenEventIds = new Set(); // Deduplicate events across chatroom + channel topics

    // Reload badges dynamically and auto-join if updated in preferences
    if (typeof window !== 'undefined') {
      // 1. Same-window custom event listener (Dashboard)
      window.addEventListener('prochat_kick_badges_updated', (e) => {
        const { channel, badges } = e.detail;
        if (channel) {
          const cleanName = channel.toLowerCase().replace('@', '').trim();
          this.subscriberBadgesMap.set(cleanName, badges);
          console.log(`KickChatClient: Reloaded ${badges.length} subscriber badges for: ${cleanName}`);

          // If we are not currently joined (likely because of previous Cloudflare lookup failure),
          // attempt to join again now that settings/chatroom ID are updated
          if (!this.channelsMap.has(cleanName) && !this.pendingChannels.has(cleanName)) {
            console.log(`KickChatClient: Not currently joined to ${cleanName}. Attempting join now...`);
            this.join(cleanName);
          }
        }
      });

      // 2. Cross-window storage listener (OBS Overlay)
      window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith('prochat_kick_')) {
          const keyParts = e.key.split('_');
          const cleanName = keyParts[keyParts.length - 1];
          if (cleanName) {
            console.log(`KickChatClient: Storage event received for ${cleanName}`);
            
            // Sync custom subscriber badges
            const cachedBadges = localStorage.getItem(`prochat_kick_subscriber_badges_${cleanName}`);
            if (cachedBadges) {
              try {
                this.subscriberBadgesMap.set(cleanName, JSON.parse(cachedBadges));
              } catch (err) {
                // ignore
              }
            }

            // Sync connection if chatroom ID changed and client is disconnected
            const cachedCid = localStorage.getItem(`prochat_kick_chatroom_id_${cleanName}`);
            if (cachedCid && !this.channelsMap.has(cleanName) && !this.pendingChannels.has(cleanName)) {
              console.log(`KickChatClient: Chatroom ID found for ${cleanName}. Auto-joining...`);
              this.join(cleanName);
            }
          }
        }
      });
    }

    // Rotating CORS proxies
    this.proxies = [
      (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
      (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
    ];
    this.eventSources = new Map(); // channelName -> EventSource
  }

  connect() {
    this.isManuallyDisconnected = false;
    this.isConnected = true;
    this.onStatus('kick_all', 'connected');
    
    // Copy to array and clear BEFORE joining, to avoid guard clause blocking the join
    const channelsToJoin = Array.from(this.pendingChannels);
    this.pendingChannels.clear();
    
    channelsToJoin.forEach(channel => {
      this.join(channel);
    });
  }

  // Fetch with local proxy first, then fallback to public proxies
  async fetchWithProxyFallback(url) {
    // 1. Try local proxy first (runs via Next server proxy with server-side fetch / curl fallback)
    if (url.startsWith('https://kick.com')) {
      const prefix = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000');
      const localProxyUrl = url.replace('https://kick.com', `${prefix}/api/kick`);
      try {
        console.log(`Kick client: trying local proxy: ${localProxyUrl}`);
        const res = await fetch(localProxyUrl);
        if (res.ok) {
          const text = await res.text();
          const parsed = JSON.parse(text);
          if (parsed && !parsed.error && (parsed.chatroom || parsed.id || parsed.user || parsed.slug)) return parsed;
        }
      } catch (err) {
        console.warn('Local proxy fetch failed, falling back to public proxies:', err.message);
      }
    }

    // 2. Try direct fetch (takes advantage of client browser session/CORS if allowed)
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        const parsed = JSON.parse(text);
        if (parsed && !parsed.error && (parsed.chatroom || parsed.id || parsed.user || parsed.slug)) return parsed;
      }
    } catch (err) {
      // ignore
    }

    // 2. Try rotating public proxies
    let lastError = null;
    for (let i = 0; i < this.proxies.length; i++) {
      const proxiedUrl = this.proxies[i](url);
      try {
        const res = await fetch(proxiedUrl);
        if (res.ok) {
          const text = await res.text();
          let parsed = JSON.parse(text);
          if (parsed && parsed.contents) {
            try { parsed = JSON.parse(parsed.contents); } catch {}
          }
          if (parsed && !parsed.error && (parsed.chatroom || parsed.id)) return parsed;
        }
      } catch (err) {
        lastError = err;
        console.warn(`Kick client: public proxy index ${i} failed:`, err.message);
      }
    }
    throw lastError || new Error('All CORS proxies failed to load Kick channel info');
  }

  async join(channelName) {
    // Strip '@' if present
    const cleanName = channelName.toLowerCase().replace('@', '').trim();
    if (!cleanName) return;

    // Load custom subscriber badges from local storage if available
    const cachedBadges = localStorage.getItem(`prochat_kick_subscriber_badges_${cleanName}`);
    if (cachedBadges) {
      try {
        this.subscriberBadgesMap.set(cleanName, JSON.parse(cachedBadges));
        console.log(`Kick client: Loaded ${JSON.parse(cachedBadges).length} custom subscriber badges for: ${cleanName}`);
      } catch (e) {
        console.warn('Failed to parse cached subscriber badges:', e.message);
      }
    }

    // Prevent duplicate join triggers during state changes / updates
    if (this.channelsMap.has(cleanName) || this.pendingChannels.has(cleanName)) {
      return;
    }

    if (!this.isConnected) {
      this.pendingChannels.add(cleanName);
      return;
    }

    this.onStatus(cleanName, 'connecting');

    try {
      // Fetch channel metadata from Kick API using proxy fallback (trying v2 first, then v1)
      let data = null;
      let chatroomId = null;
      const targetUrls = [
        `https://kick.com/api/v2/channels/${cleanName}`,
        `https://kick.com/api/v1/channels/${cleanName}`
      ];

      for (const url of targetUrls) {
        try {
          console.log(`Kick client: fetching channel data for: ${cleanName} from ${url}`);
          data = await this.fetchWithProxyFallback(url);
          const cid = data?.chatroom?.id || data?.chatroom_id;
          if (cid) {
            chatroomId = String(cid);
            // Cache successful response in localStorage
            localStorage.setItem(`prochat_kick_chatroom_id_${cleanName}`, chatroomId);
            if (data.subscriber_badges) {
              this.subscriberBadgesMap.set(cleanName, data.subscriber_badges);
              localStorage.setItem(`prochat_kick_subscriber_badges_${cleanName}`, JSON.stringify(data.subscriber_badges));
            }
            break;
          }
        } catch (fetchErr) {
          console.warn(`Kick details fetch failed from ${url}:`, fetchErr.message);
        }
      }

      if (!chatroomId) {
        console.warn(`Kick details fetch failed for ${cleanName}, trying cached data`);
        chatroomId = localStorage.getItem(`prochat_kick_chatroom_id_${cleanName}`);
        if (chatroomId) {
          console.log(`Kick client: Using cached fallback chatroom ID ${chatroomId} for ${cleanName}`);
        }
        const cachedBadges = localStorage.getItem(`prochat_kick_subscriber_badges_${cleanName}`);
        if (cachedBadges) {
          this.subscriberBadgesMap.set(cleanName, JSON.parse(cachedBadges));
        }
      }

      if (!chatroomId) {
        throw new Error('Kick chatroom ID not found and no cached data available');
      }

      this.channelsMap.set(cleanName, chatroomId);

      // Close previous EventSource if exists for this channel
      if (this.eventSources.has(cleanName)) {
        try { this.eventSources.get(cleanName).close(); } catch (e) {}
        this.eventSources.delete(cleanName);
      }

      // Subscribe to Kick chatroom via Next.js SSE relay
      const channelId = String(data?.chatroom?.channel_id || data?.id || '');
      const sseUrl = `/api/kick/stream?channel=${encodeURIComponent(cleanName)}&chatroomId=${encodeURIComponent(chatroomId)}&channelId=${encodeURIComponent(channelId)}`;
      
      try {
        const es = new EventSource(sseUrl);
        this.eventSources.set(cleanName, es);

        es.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            const rawMsg = typeof payload.data === 'string' ? JSON.parse(payload.data) : payload.data;
            if (!rawMsg) return;

            const evtName = String(payload.event || rawMsg.event || rawMsg.type || '').toLowerCase();

            // 1. Kick KICKs Virtual Gifts (KicksGifted / kicks_gifted / gift payload)
            if (
              evtName.includes('kicksgifted') ||
              evtName.includes('kicks_gifted') ||
              evtName.includes('kicks.gifted') ||
              Boolean(rawMsg.gift) ||
              Boolean(rawMsg.metadata?.gift)
            ) {
              this.parseKickGiftEvent(cleanName, rawMsg);
              return;
            }

            // 2. Kick Gifted Subscriptions
            if (
              evtName.includes('giftedsubscriptions') ||
              evtName.includes('luckyuserswhogotgiftsubscriptions') ||
              Array.isArray(rawMsg.gifted_usernames)
            ) {
              this.parseKickGiftedSubsEvent(cleanName, rawMsg);
              return;
            }

            // 3. Kick New / Resubscription
            if (evtName.includes('subscriptionevent') && !evtName.includes('gifted')) {
              this.parseKickSubscriptionEvent(cleanName, rawMsg);
              return;
            }

            // 4. Standard Kick Chat Message
            if (evtName.includes('chatmessage') || rawMsg.content || rawMsg.message || rawMsg.sender) {
              this.parseChatMessage(payload.channel || `chatrooms.${chatroomId}.v2`, rawMsg);
            }
          } catch (err) {
            console.error('Error parsing Kick SSE message:', err);
          }
        };

        es.onerror = (err) => {
          console.warn(`Kick SSE notice for ${cleanName}:`, err);
        };
      } catch (sseErr) {
        console.error('Failed to initialize Kick EventSource:', sseErr);
      }

      let startTime = null;
      let viewers = null;
      if (data && data.livestream && data.livestream.is_live !== false) {
        if (data.livestream.created_at) startTime = data.livestream.created_at;
        if (data.livestream.viewer_count !== undefined) viewers = data.livestream.viewer_count;
        this.onStatus(cleanName, 'connected', { startTime, viewers });
      } else {
        this.onStatus(cleanName, 'offline', { startTime: null, viewers: 0 });
      }

      console.log(`Subscribed to Kick chat via SSE: ${cleanName} (id: ${chatroomId})`);

      // Periodic viewer count update for Kick
      if (!this.viewerIntervals) {
        this.viewerIntervals = new Map();
      }
      if (this.viewerIntervals.has(cleanName)) {
        clearInterval(this.viewerIntervals.get(cleanName));
      }
      const intervalId = setInterval(async () => {
        try {
          console.log(`Kick client: polling viewer count for ${cleanName}`);
          const updatedData = await this.fetchWithProxyFallback(targetUrls[0]);
          if (updatedData && updatedData.livestream && updatedData.livestream.is_live !== false) {
            const startT = updatedData.livestream.created_at;
            const viewC = updatedData.livestream.viewer_count || 0;
            this.onStatus(cleanName, 'connected', { startTime: startT, viewers: viewC });
          } else {
            // Stream offline
            this.onStatus(cleanName, 'offline', { startTime: null, viewers: 0 });
          }
        } catch (e) {
          console.warn(`Kick client: failed to update viewers for ${cleanName}:`, e.message);
        }
      }, 10000); // poll every 10 seconds
      this.viewerIntervals.set(cleanName, intervalId);

    } catch (err) {
      console.error(`Failed to join Kick channel "${cleanName}":`, err);
      this.onStatus(cleanName, 'disconnected');
    }
  }

  leave(channelName) {
    const cleanName = channelName.toLowerCase().replace('@', '').trim();
    if (this.eventSources.has(cleanName)) {
      try {
        this.eventSources.get(cleanName).close();
      } catch (e) {}
      this.eventSources.delete(cleanName);
    }

    this.channelsMap.delete(cleanName);
    this.onStatus(cleanName, 'disconnected');
    this.pendingChannels.delete(cleanName);

    if (this.viewerIntervals && this.viewerIntervals.has(cleanName)) {
      clearInterval(this.viewerIntervals.get(cleanName));
      this.viewerIntervals.delete(cleanName);
    }
  }

  disconnect() {
    this.isManuallyDisconnected = true;
    this.channelsMap.clear();
    this.pendingChannels.clear();
    if (this.viewerIntervals) {
      this.viewerIntervals.forEach(intervalId => clearInterval(intervalId));
      this.viewerIntervals.clear();
    }
    if (this.eventSources) {
      this.eventSources.forEach(es => {
        try { es.close(); } catch (e) {}
      });
      this.eventSources.clear();
    }
  }

  parseKickContent(rawText) {
    if (!rawText) return null;
    const text = typeof rawText === 'string' ? rawText : (typeof rawText?.content === 'string' ? rawText.content : String(rawText));
    if (!text) return null;
    
    // Regex for [emote:ID:name]
    const regex = /\[emote:(\d+):([^\]]+)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const matchIndex = match.index;
      // Add preceding text part, parsed for 7TV/BTTV emotes
      if (matchIndex > lastIndex) {
        const textSegment = text.substring(lastIndex, matchIndex);
        parts.push(...parseMessageContent(textSegment));
      }
      
      const emoteId = match[1];
      const emoteName = match[2];
      parts.push({
        type: 'emote',
        name: emoteName,
        url: `https://files.kick.com/emotes/${emoteId}/fullsize`
      });
      
      lastIndex = regex.lastIndex;
    }
    
    // Add remaining text part, parsed for 7TV/BTTV emotes
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      parts.push(...parseMessageContent(remainingText));
    }
    
    return parts.length > 0 ? parts : null;
  }

  trackSeenEventId(eventId) {
    if (!eventId) return false;
    const key = String(eventId);
    if (this.seenEventIds.has(key)) return true;
    this.seenEventIds.add(key);
    if (this.seenEventIds.size > 600) {
      const iter = this.seenEventIds.values();
      for (let i = 0; i < 200; i++) iter.next();
      const remaining = new Set();
      for (const val of iter) remaining.add(val);
      this.seenEventIds = remaining;
    }
    return false;
  }

  parseKickGiftEvent(channelName, raw) {
    try {
      const sender = raw.sender || raw.user || {};
      const gift = raw.gift || raw.metadata?.gift || {};
      const senderName = sender.username || sender.slug || raw.sender_username || raw.username || 'Kick Viewer';
      const senderSlug = sender.slug || senderName.toLowerCase();
      const giftName = gift.name || gift.gift_name || raw.gift_name || 'KICKs Gift';
      const kicksAmount = gift.amount ?? raw.amount ?? raw.kicks ?? raw.kicks_amount ?? 0;
      const giftImg = gift.image_url || gift.icon_url || gift.thumbnail_url || gift.media_url || null;
      const viewerMsg = typeof raw.message === 'string' ? raw.message.trim() : (raw.content ? String(raw.content).trim() : '');

      const eventId = raw.id || raw.gift_transaction_id || `kick-gift-${senderSlug}-${giftName}-${kicksAmount}-${Math.floor(Date.now() / 5000)}`;
      if (this.trackSeenEventId(eventId)) return;

      const rawAvatar = sender.profile_picture || sender.profile_pic || sender.profilepic || sender.avatar || null;
      let defaultKickIdx = 1;
      const numId = parseInt(sender.id || '');
      if (numId && !isNaN(numId)) defaultKickIdx = (numId % 6) + 1;
      const avatar = rawAvatar ? normalizeUrl(rawAvatar) : `/kick-default-avatars/default-avatar-${defaultKickIdx}.webp`;

      const text = viewerMsg
        ? `sent ${giftName} — ${viewerMsg}`
        : `sent ${giftName}`;

      const parts = [{ type: 'text', content: text }];
      if (giftImg) parts.push({ type: 'emote', name: giftName, url: normalizeUrl(giftImg) });

      this.onMessage({
        id: String(eventId),
        platform: 'kick',
        channel: channelName,
        username: senderSlug,
        displayName: senderName,
        userId: sender.id ? String(sender.id) : null,
        color: sender.identity?.color || '#53fc18',
        text,
        parts,
        avatar,
        badges: [],
        badgeImages: {},
        isSystemEvent: true,
        isGift: true,
        eventType: 'gift',
        giftDetails: {
          name: giftName,
          kicks: String(kicksAmount || ''),
          currency: 'KICKs',
          imageUrl: giftImg ? normalizeUrl(giftImg) : null,
          message: viewerMsg || null
        },
        eventDetails: {
          subType: 'gift',
          giftName,
          kicks: String(kicksAmount || ''),
          amount: kicksAmount ? `${kicksAmount} KICKs` : giftName,
          imageUrl: giftImg ? normalizeUrl(giftImg) : null
        },
        rawTimestamp: Date.now(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      });
    } catch (err) {
      console.error('Error parsing Kick KICKs gift event:', err, raw);
    }
  }

  parseKickGiftedSubsEvent(channelName, raw) {
    try {
      const gifter = raw.gifter_username || raw.sender?.username || raw.username || 'Anonymous';
      const recipients = Array.isArray(raw.gifted_usernames) ? raw.gifted_usernames : [];
      const count = recipients.length || Number(raw.quantity || raw.count || 1);
      const eventId = raw.id || `kick-gsubs-${gifter.toLowerCase()}-${count}-${Math.floor(Date.now() / 5000)}`;
      if (this.trackSeenEventId(eventId)) return;

      const text = count === 1
        ? `gifted a subscription${recipients[0] ? ` to ${recipients[0]}` : ''}!`
        : `gifted ${count} subscriptions to the community!`;

      this.onMessage({
        id: String(eventId),
        platform: 'kick',
        channel: channelName,
        username: gifter.toLowerCase(),
        displayName: gifter,
        color: '#53fc18',
        text,
        parts: [{ type: 'text', content: text }],
        avatar: `/kick-default-avatars/default-avatar-1.webp`,
        badges: ['sub_gifter'],
        badgeImages: {},
        isSystemEvent: true,
        eventType: 'subscription',
        eventDetails: {
          subType: 'gift_purchase',
          isGift: true,
          count,
          tier: `Gifted ${count} Sub${count === 1 ? '' : 's'}`
        },
        rawTimestamp: Date.now(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      });
    } catch (err) {
      console.error('Error parsing Kick gifted subs event:', err, raw);
    }
  }

  parseKickSubscriptionEvent(channelName, raw) {
    try {
      const subscriber = raw.username || raw.sender?.username || 'Kick Viewer';
      const months = Number(raw.months || 1);
      const eventId = raw.id || `kick-sub-${subscriber.toLowerCase()}-${months}-${Math.floor(Date.now() / 5000)}`;
      if (this.trackSeenEventId(eventId)) return;

      const text = months > 1
        ? `subscribed for ${months} months!`
        : `subscribed to the channel!`;

      this.onMessage({
        id: String(eventId),
        platform: 'kick',
        channel: channelName,
        username: subscriber.toLowerCase(),
        displayName: subscriber,
        color: '#53fc18',
        text,
        parts: [{ type: 'text', content: text }],
        avatar: `/kick-default-avatars/default-avatar-2.webp`,
        badges: ['subscriber'],
        badgeImages: {},
        isSystemEvent: true,
        eventType: 'subscription',
        eventDetails: {
          subType: months > 1 ? 'milestone' : 'new_member',
          months: `${months} month${months === 1 ? '' : 's'}`,
          tier: months > 1 ? `Subscribed for ${months} months` : 'New Subscriber'
        },
        rawTimestamp: Date.now(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      });
    } catch (err) {
      console.error('Error parsing Kick subscription event:', err, raw);
    }
  }

  parseChatMessage(pusherChannel, msg) {
    if (msg?.id && this.trackSeenEventId(`kick-chat-${msg.id}`)) return;
    console.log("KICK_RAW_MSG", msg);
    // Locate channel name from chatroomId
    let channelName = '';
    const chatroomIdMatch = pusherChannel.match(/chatrooms?[\._](\d+)/);
    if (chatroomIdMatch) {
      const cid = parseInt(chatroomIdMatch[1]);
      for (const [ch, id] of this.channelsMap.entries()) {
        if (Number(id) === Number(cid) || String(id) === String(cid)) {
          channelName = ch;
          break;
        }
      }
      if (!channelName && typeof window !== 'undefined') {
        for (const [ch] of this.channelsMap.entries()) {
          const cachedId = localStorage.getItem(`prochat_kick_chatroom_id_${ch}`);
          if (cachedId && (Number(cachedId) === Number(cid) || String(cachedId) === String(cid))) {
            channelName = ch;
            break;
          }
        }
      }
    }

    if (!channelName && this.channelsMap.size > 0) {
      channelName = this.channelsMap.keys().next().value;
    }

    try {
      if (!msg) return;
      const sender = msg.sender || msg.chatter || msg.user || {};
      const identity = sender.identity || msg.identity || {};

      const badges = [];
      const badgeImages = {};
      let monthsSubscribed = 0;
      let giftedSubsCount = 0;

      if (identity && Array.isArray(identity.badges)) {
        identity.badges.forEach(b => {
          if (!b) return;
          const typeLower = b.type ? String(b.type).toLowerCase() : '';
          if (!typeLower) return;

          if (typeLower === 'subscriber') {
            monthsSubscribed = parseInt(msg.months_subscribed || b.metadata?.months || b.count || 1) || 1;
          }
          if (typeLower === 'sub_gifter') {
            giftedSubsCount = parseInt(b.count || b.metadata?.count || b.metadata?.gifted || b.text || 1) || 1;
          }

          // Push all available badge types, normalized to lowercase (e.g. subscriber, moderator, vip)
          badges.push(typeLower);

          let isLevelBadge = false;
          let levelNum = 1;

          if (typeLower === 'level' || typeLower.includes('level')) {
            isLevelBadge = true;
            const numMatch = b.text ? String(b.text).match(/\d+/) : null;
            levelNum = b.count || (b.metadata && (b.metadata.level || b.metadata.count)) || (numMatch ? parseInt(numMatch[0]) : 1);
          } else if (typeLower === 'group') {
            const groupVal = b.metadata?.group || '';
            const match = groupVal.match(/level_(\d+)/);
            if (match) {
              isLevelBadge = true;
              levelNum = parseInt(match[1]);
            } else if (groupVal.includes('level')) {
              isLevelBadge = true;
              levelNum = b.count || (b.metadata && (b.metadata.level || b.metadata.count)) || 1;
            }
          } else if (b.text && String(b.text).toLowerCase().includes('level')) {
            isLevelBadge = true;
            const numMatch = String(b.text).match(/\d+/);
            levelNum = b.count || (numMatch ? parseInt(numMatch[0]) : 1);
          }
          
          if (isLevelBadge) {
            badges.push(`level_${levelNum}`);
          }
          
          let badgeUrl = b.url || 
                         b.src || 
                         b.image || 
                         b.imageUrl || 
                         b.metadata?.url || 
                         b.metadata?.src || 
                         b.metadata?.image || 
                         b.metadata?.imageUrl || 
                         b.metadata?.badge_image?.src || 
                         b.metadata?.badge_image?.url || 
                         b.metadata?.badge_image?.srcset || 
                         b.metadata?.badge?.url || 
                         b.metadata?.badge?.srcset || 
                         b.metadata?.badge?.image || 
                         b.metadata?.badge_image_url || 
                         b.metadata?.badgeImageUrl;
          
          if (b.metadata?.badge_image && typeof b.metadata.badge_image === 'string') {
            badgeUrl = b.metadata.badge_image;
          }
          if (b.metadata?.badge && typeof b.metadata.badge === 'string') {
            badgeUrl = b.metadata.badge;
          }
          
          if (typeLower === 'subscriber' && channelName) {
            const subsBadges = this.subscriberBadgesMap.get(channelName.toLowerCase());
            if (subsBadges && subsBadges.length > 0) {
              const months = msg.months_subscribed || b.metadata?.months || b.count || 1;
              let bestBadge = null;
              subsBadges.forEach(badgeObj => {
                if (badgeObj.months <= months) {
                  if (!bestBadge || badgeObj.months > bestBadge.months) {
                    bestBadge = badgeObj;
                  }
                }
              });
              if (bestBadge && bestBadge.badge_image) {
                badgeUrl = bestBadge.badge_image.src || bestBadge.badge_image.url || bestBadge.badge_image.srcset;
              }
            } else {
              // If there are no custom badges, check if the websocket badge URL is a default one
              const isDefaultSubBadge = badgeUrl && (
                badgeUrl.includes('/badges/default/') || 
                badgeUrl.includes('/default/subscriber') ||
                badgeUrl.includes('default-sub')
              );
              if (isDefaultSubBadge) {
                badgeUrl = null; // Force fallback to inline SVG with dynamic colors
              }
            }
          }
          
          if (badgeUrl) {
            const normalized = normalizeUrl(badgeUrl);
            // Do not store level badge images so they fallback to the beautiful dynamic SVGs
            // Also skip built-in role badges that have proper custom SVGs in the components
            const CUSTOM_SVG_BADGES = ['broadcaster', 'moderator', 'vip', 'og', 'verified', 'staff'];
            if (!isLevelBadge && !CUSTOM_SVG_BADGES.includes(typeLower)) {
              badgeImages[typeLower] = normalized;
            }
          }
        });
      }

      // Parse global/watch-time level badges from badges_v2
      if (identity && Array.isArray(identity.badges_v2)) {
        identity.badges_v2.forEach(b => {
          if (!b) return;
          const typeLower = (b.name || b.type || '').toLowerCase();
          if (!typeLower) return;

          if (typeLower === 'sub_gifter') {
            giftedSubsCount = parseInt(b.count || b.metadata?.count || b.metadata?.gifted || b.text || 1) || 1;
          }

          let isLevelBadge = false;
          let levelNum = 1;

          if (typeLower === 'level' || typeLower.includes('level')) {
            isLevelBadge = true;
            levelNum = b.metadata?.level || b.count || (b.metadata && (b.metadata.count || b.metadata.level)) || 1;
          } else if (b.text && String(b.text).toLowerCase().includes('level')) {
            isLevelBadge = true;
            const numMatch = String(b.text).match(/\d+/);
            levelNum = b.count || (numMatch ? parseInt(numMatch[0]) : 1);
          }

          if (isLevelBadge) {
            // Only parse level badge if it is active/selected by the chatter
            if (b.selected !== false) {
              if (!badges.includes(typeLower)) {
                badges.push(typeLower);
              }
              const lvlBadgeName = `level_${levelNum}`;
              if (!badges.includes(lvlBadgeName)) {
                badges.push(lvlBadgeName);
              }
            }
          }

          let badgeUrl = b.image_url || b.url || b.src || b.image || b.imageUrl || b.metadata?.url || b.metadata?.src || b.metadata?.image || b.metadata?.imageUrl;
          if (badgeUrl) {
            const normalized = normalizeUrl(badgeUrl);
            const CUSTOM_SVG_BADGES = ['broadcaster', 'moderator', 'vip', 'og', 'verified', 'staff'];
            if (!isLevelBadge && !CUSTOM_SVG_BADGES.includes(typeLower)) {
              badgeImages[typeLower] = normalized;
            }
          }
        });
      }

      // Check if user is a bot
      const senderSlug = sender.slug || sender.username || sender.name || 'kick_user';
      const senderDisplayName = sender.username || sender.name || senderSlug;
      const lowerUser = senderSlug.toLowerCase();
      const knownBots = ['nightbot', 'streamelements', 'wizebot', 'moobot', 'kickbot', 'botrix', 'botrixoficial', 'botrixofficial', 'streamlabs', 'fossabot', 'soundalerts', 'kbot'];
      if (knownBots.includes(lowerUser) || (lowerUser.endsWith('bot') && lowerUser.length > 3)) {
        badges.push('bot');
      }

      const messageContent = msg.content || msg.message || msg.text || '';
      const parts = this.parseKickContent(messageContent);
      // Kick avatar - use raw properties if present, or assign user-specific default Kick avatar
      const rawKickAvatar = identity?.profile_picture || identity?.profile_pic || sender?.profile_picture || sender?.profile_pic || identity?.profile_image || sender?.profile_image || identity?.avatar || sender?.avatar;
      let defaultKickIdx = 1;
      const numId = parseInt(sender.id || '');
      if (numId && !isNaN(numId)) {
        defaultKickIdx = (numId % 6) + 1;
      } else if (senderSlug) {
        let hash = 0;
        const cleanUser = senderSlug.toLowerCase();
        for (let i = 0; i < cleanUser.length; i++) {
          hash = cleanUser.charCodeAt(i) + ((hash << 5) - hash);
        }
        defaultKickIdx = (Math.abs(hash) % 6) + 1;
      }
      const avatar = rawKickAvatar 
        ? normalizeUrl(rawKickAvatar) 
        : `/kick-default-avatars/default-avatar-${defaultKickIdx}.webp`;

      const parsedMsg = {
        id: msg.id || 'kick_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        platform: 'kick',
        channel: channelName || (this.channelsMap.size > 0 ? this.channelsMap.keys().next().value : 'kick'),
        username: senderSlug,
        displayName: senderDisplayName,
        userId: sender.id ? String(sender.id) : null,
        color: identity.color || '#53fc18',
        text: messageContent,
        parts: parts,
        avatar: avatar,
        badges: badges,
        badgeImages: badgeImages,
        monthsSubscribed: monthsSubscribed,
        giftedSubsCount: giftedSubsCount,
        rawTimestamp: (() => {
          if (msg.created_at || msg.timestamp) {
            const raw = msg.created_at || msg.timestamp;
            let parseable = String(raw).trim();
            if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(parseable)) {
              parseable = parseable.replace(' ', 'T') + 'Z';
            }
            const parsed = Date.parse(parseable);
            if (!isNaN(parsed) && parsed > 0) return parsed;
          }
          return Date.now();
        })(),
        timestamp: (() => {
          if (msg.created_at || msg.timestamp) {
            const raw = msg.created_at || msg.timestamp;
            let parseable = String(raw).trim();
            if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(parseable)) {
              parseable = parseable.replace(' ', 'T') + 'Z';
            }
            const parsed = Date.parse(parseable);
            if (!isNaN(parsed) && parsed > 0) {
              return new Date(parsed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            }
          }
          return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        })()
      };

      const isLiveReply = msg.metadata?.original_sender && msg.metadata?.original_message;
      const replyData = isLiveReply ? msg.metadata : (msg.metadata?.replyTo || msg.replied_to || msg.replies_to || msg.reply_to || msg.metadata?.reply || msg.metadata?.replied_to || msg.reply);
      if (replyData) {
        const replyUsername = replyData.original_sender_username || 
                              replyData.chatterUsername || 
                              replyData.original_sender?.username || 
                              replyData.original_sender?.slug || 
                              replyData.sender?.slug || 
                              replyData.sender?.username || 
                              replyData.username || 
                              'user';
        
        const replyDisplayName = replyData.original_sender_display_name || 
                                 replyData.original_sender_username || 
                                 replyData.chatterDisplayName || 
                                 replyData.original_sender?.username || 
                                 replyData.sender?.username || 
                                 replyUsername;

        let replyText = '';
        if (replyData.original_message_content) {
          replyText = replyData.original_message_content;
        } else if (replyData.original_message) {
          replyText = replyData.original_message.content || replyData.original_message.message || replyData.original_message.text || '';
        } else if (replyData.message) {
          if (typeof replyData.message === 'object') {
            replyText = replyData.message.content || replyData.message.message || replyData.message.text || '';
          } else {
            replyText = replyData.message;
          }
        } else {
          replyText = replyData.content || replyData.text || '';
        }

        const replyId = replyData.reply_to_message_id || 
                        replyData.original_message?.id || 
                        replyData.id || 
                        replyData.message_id || 
                        (replyData.message && typeof replyData.message === 'object' ? replyData.message.id : null) || 
                        Math.random().toString();

        parsedMsg.repliedTo = {
          id: replyId,
          username: replyUsername,
          displayName: replyDisplayName,
          text: String(replyText)
        };
      }

      this.onMessage(parsedMsg);
    } catch (e) {
      console.error('Error parsing Kick Chat Message:', e, msg);
    }
  }
}

function normalizeUrl(url) {
  if (!url) return null;
  let trimmed = url.trim();
  
  // Extract clean URL from srcset format (which is common in Kick badge metadata)
  if (trimmed.includes(',') || trimmed.includes(' ')) {
    const firstCandidate = trimmed.split(',')[0].trim();
    trimmed = firstCandidate.split(' ')[0].trim();
  }
  
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('//')) {
    return 'https:' + trimmed;
  }
  if (trimmed.startsWith('/')) {
    return 'https://kick.com' + trimmed;
  }
  return 'https://' + trimmed;
}
