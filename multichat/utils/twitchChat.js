// Anonymous Twitch IRC WebSocket Client
import { parseMessageContent } from './emotes';

export class TwitchChatClient {
  constructor(onMessageCallback, onStatusCallback) {
    this.socket = null;
    this.onMessage = onMessageCallback;
    this.onStatus = onStatusCallback; // (channel, status: 'connecting' | 'connected' | 'disconnected')
    this.channels = new Set();
    this.reconnectInterval = 5000;
    this.isConnected = false;
    this.isManuallyDisconnected = false;
    this.username = `justinfan${Math.floor(10000 + Math.random() * 90000)}`;
    this.globalBadges = null;
    this.channelBadgesMap = new Map();
    this.viewerIntervals = new Map();
    this.proxies = [
      (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
      (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
    ];

    window.twitchBadges = {
      global: null,
      channels: this.channelBadgesMap
    };

    // Pre-fetch global badges immediately
    this.fetchGlobalBadges();
  }

  connect() {
    this.isManuallyDisconnected = false;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.onStatus('all', 'connecting');
    this.socket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

    this.socket.onopen = () => {
      this.isConnected = true;
      this.onStatus('all', 'connected');
      
      // Log in anonymously
      this.socket.send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership');
      this.socket.send(`PASS SCHMOOPIE`);
      this.socket.send(`NICK ${this.username}`);
      this.socket.send(`USER ${this.username} 8 * :${this.username}`);

      // Join all buffered channels
      this.channels.forEach(channel => {
        this.joinChannel(channel);
      });
    };

    this.socket.onmessage = (event) => {
      const data = event.data;
      const lines = data.split('\r\n');
      
      lines.forEach(line => {
        if (!line) return;
        
        // Handle PING to keep connection alive
        if (line.startsWith('PING ')) {
          this.socket.send('PONG ' + line.substring(5));
          return;
        }

        // Parse standard Twitch PRIVMSG
        if (line.includes(' PRIVMSG #')) {
          this.parsePrivMsg(line);
        }
      });
    };

    this.socket.onclose = () => {
      this.isConnected = false;
      this.onStatus('all', 'disconnected');
      
      if (this.isManuallyDisconnected) {
        console.log('TwitchChatClient: Manually disconnected. Reconnection suppressed.');
        return;
      }
      
      // Attempt reconnection after delay
      setTimeout(() => {
        if (this.isManuallyDisconnected) return;
        this.connect();
      }, this.reconnectInterval);
    };

    this.socket.onerror = (error) => {
      console.error('Twitch WebSocket Error:', error);
      this.socket.close();
    };
  }

  join(channelName) {
    const formatted = channelName.toLowerCase().replace('#', '').replace('@', '').trim();
    if (!formatted) return;

    this.channels.add(formatted);
    // Pre-fetch channel badges immediately
    this.fetchChannelBadges(formatted);

    // Setup polling for viewer counts / uptime
    if (!this.viewerIntervals) {
      this.viewerIntervals = new Map();
    }
    if (this.viewerIntervals.has(formatted)) {
      clearInterval(this.viewerIntervals.get(formatted));
    }

    const pollFunc = async () => {
      try {
        console.log(`TwitchChatClient: polling viewer count for ${formatted}`);
        const viewerRes = await fetch(`https://decapi.me/twitch/viewercount/${formatted}`);
        const viewerText = (await viewerRes.text()).trim();
        
        const uptimeRes = await fetch(`https://decapi.me/twitch/uptime/${formatted}`);
        const uptimeText = (await uptimeRes.text()).trim();
        
        const isOffline = viewerText.toLowerCase().includes('offline') || uptimeText.toLowerCase().includes('offline');
        if (!isOffline) {
          const viewers = parseInt(viewerText, 10);
          
          let totalMs = 0;
          const daysMatch = uptimeText.toLowerCase().match(/(\d+)\s*day/);
          const hoursMatch = uptimeText.toLowerCase().match(/(\d+)\s*hour/);
          const minutesMatch = uptimeText.toLowerCase().match(/(\d+)\s*minute/);
          const secondsMatch = uptimeText.toLowerCase().match(/(\d+)\s*second/);
          
          if (daysMatch) totalMs += parseInt(daysMatch[1], 10) * 24 * 60 * 60 * 1000;
          if (hoursMatch) totalMs += parseInt(hoursMatch[1], 10) * 60 * 60 * 1000;
          if (minutesMatch) totalMs += parseInt(minutesMatch[1], 10) * 60 * 1000;
          if (secondsMatch) totalMs += parseInt(secondsMatch[1], 10) * 1000;
          
          const startTime = new Date(Date.now() - totalMs).toISOString();
          
          this.onStatus(formatted, 'connected', { startTime, viewers });
        } else {
          this.onStatus(formatted, 'connected', { startTime: null, viewers: 0 });
        }
      } catch (e) {
        console.warn(`TwitchChatClient: failed to update viewers for ${formatted}:`, e.message);
      }
    };
    pollFunc();
    const intervalId = setInterval(pollFunc, 10000);
    this.viewerIntervals.set(formatted, intervalId);

    if (this.isConnected && this.socket.readyState === WebSocket.OPEN) {
      this.joinChannel(formatted);
    }
  }

  leave(channelName) {
    const formatted = channelName.toLowerCase().replace('#', '').replace('@', '').trim();
    this.channels.delete(formatted);
    
    if (this.viewerIntervals && this.viewerIntervals.has(formatted)) {
      clearInterval(this.viewerIntervals.get(formatted));
      this.viewerIntervals.delete(formatted);
    }

    if (this.isConnected && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(`PART #${formatted}`);
      this.onStatus(formatted, 'disconnected');
    }
  }

  joinChannel(channel) {
    this.socket.send(`JOIN #${channel}`);
    this.onStatus(channel, 'connected');
    this.fetchChannelBadges(channel);
  }

  async fetchWithProxy(url) {
    for (const proxyFn of this.proxies) {
      try {
        const res = await fetch(proxyFn(url));
        if (res.ok) {
          const text = await res.text();
          const parsed = JSON.parse(text);
          if (parsed && parsed.contents) {
            return JSON.parse(parsed.contents);
          }
          return parsed;
        }
      } catch (err) {
        // try next proxy
      }
    }
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (e) {}
    return null;
  }

  transformIvrBadges(ivrBadgesArray) {
    const badgeSets = {};
    if (Array.isArray(ivrBadgesArray)) {
      ivrBadgesArray.forEach(set => {
        if (set && set.set_id) {
          const versionsObj = {};
          if (Array.isArray(set.versions)) {
            set.versions.forEach(v => {
              if (v && v.id) {
                versionsObj[v.id] = {
                  image_url_1x: v.image_url_1x || null,
                  image_url_2x: v.image_url_2x || null,
                  image_url_4x: v.image_url_4x || null
                };
              }
            });
          }
          badgeSets[set.set_id] = {
            versions: versionsObj
          };
        }
      });
    }
    return badgeSets;
  }

  async fetchGlobalBadges() {
    // 1. Try local dev proxy (bypasses browser adblockers and CORS locally)
    try {
      const res = await fetch('/api/twitch-badges/v2/twitch/badges/global');
      if (res.ok) {
        const data = await res.json();
        this.globalBadges = this.transformIvrBadges(data);
        if (window.twitchBadges) window.twitchBadges.global = this.globalBadges;
        console.log('TwitchChatClient: Loaded global badges from local proxy');
        return;
      }
    } catch (e) {
      console.warn('TwitchChatClient: Failed to fetch global badges from local proxy:', e.message);
    }

    // 2. Try direct fetch (falls back in production/statically hosted environments)
    try {
      const res = await fetch('https://api.ivr.fi/v2/twitch/badges/global');
      if (res.ok) {
        const data = await res.json();
        this.globalBadges = this.transformIvrBadges(data);
        if (window.twitchBadges) window.twitchBadges.global = this.globalBadges;
        console.log('TwitchChatClient: Loaded global badges directly from api.ivr.fi');
        return;
      }
    } catch (e) {
      console.warn('TwitchChatClient: Failed to fetch global badges directly from api.ivr.fi:', e.message);
    }

    // 3. Try fetch with proxy helper
    try {
      const url = 'https://api.ivr.fi/v2/twitch/badges/global';
      const data = await this.fetchWithProxy(url);
      if (data) {
        this.globalBadges = this.transformIvrBadges(data);
        if (window.twitchBadges) window.twitchBadges.global = this.globalBadges;
        console.log('TwitchChatClient: Loaded global badges from api.ivr.fi via proxy helper');
      }
    } catch (e) {
      console.warn('TwitchChatClient: Failed to fetch global badges via proxy helper:', e.message);
    }
  }

  async fetchChannelBadges(channelName) {
    const cleanChan = channelName.toLowerCase();

    // 1. Try local dev proxy (bypasses browser adblockers and CORS locally)
    try {
      const res = await fetch(`/api/twitch-badges/v2/twitch/badges/channel?login=${cleanChan}`);
      if (res.ok) {
        const data = await res.json();
        const badgeSets = this.transformIvrBadges(data);
        this.channelBadgesMap.set(cleanChan, badgeSets);
        if (window.twitchBadges) window.twitchBadges.channels = this.channelBadgesMap;
        console.log(`TwitchChatClient: Loaded channel badges for ${channelName} from local proxy`);
        return;
      }
    } catch (e) {
      console.warn(`TwitchChatClient: Failed to fetch channel badges for ${channelName} from local proxy:`, e.message);
    }

    // 2. Try direct fetch (falls back in production/statically hosted environments)
    try {
      const res = await fetch(`https://api.ivr.fi/v2/twitch/badges/channel?login=${cleanChan}`);
      if (res.ok) {
        const data = await res.json();
        const badgeSets = this.transformIvrBadges(data);
        this.channelBadgesMap.set(cleanChan, badgeSets);
        if (window.twitchBadges) window.twitchBadges.channels = this.channelBadgesMap;
        console.log(`TwitchChatClient: Loaded channel badges for ${channelName} directly from api.ivr.fi`);
        return;
      }
    } catch (e) {
      console.warn(`TwitchChatClient: Failed to fetch channel badges for ${channelName} directly from api.ivr.fi:`, e.message);
    }

    // 3. Try fetch with proxy helper
    try {
      const url = `https://api.ivr.fi/v2/twitch/badges/channel?login=${cleanChan}`;
      const data = await this.fetchWithProxy(url);
      if (data) {
        const badgeSets = this.transformIvrBadges(data);
        this.channelBadgesMap.set(cleanChan, badgeSets);
        if (window.twitchBadges) window.twitchBadges.channels = this.channelBadgesMap;
        console.log(`TwitchChatClient: Loaded channel badges for ${channelName} via proxy helper`);
      }
    } catch (e) {
      console.warn(`TwitchChatClient: Failed to fetch channel badges via proxy helper for ${channelName}:`, e.message);
    }
  }

  getBadgeImageUrl(channelName, badgeName, version) {
    const cleanChan = channelName.toLowerCase();
    const ivrBadgeName = badgeName.replace(/_/g, '-');
    if (this.channelBadgesMap && this.channelBadgesMap.has(cleanChan)) {
      const chanSets = this.channelBadgesMap.get(cleanChan);
      if (chanSets && chanSets[ivrBadgeName]) {
        const versions = chanSets[ivrBadgeName].versions || {};
        let versionObj = versions[version];
        if (!versionObj) {
          const keys = Object.keys(versions);
          if (keys.length > 0) versionObj = versions[keys[0]];
        }
        if (versionObj) {
          return versionObj.image_url_1x || versionObj.image_url_2x || versionObj.image_url_4x;
        }
      }
    }
    if (this.globalBadges && this.globalBadges[ivrBadgeName]) {
      const versions = this.globalBadges[ivrBadgeName].versions || {};
      let versionObj = versions[version];
      if (!versionObj) {
        const keys = Object.keys(versions);
        if (keys.length > 0) versionObj = versions[keys[0]];
      }
      if (versionObj) {
        return versionObj.image_url_1x || versionObj.image_url_2x || versionObj.image_url_4x;
      }
    }
    return null;
  }

  parseTwitchEmotes(text, emotesTag) {
    if (!emotesTag || !text) return null;
    
    try {
      const instances = [];
      const sets = emotesTag.split('/');
      
      sets.forEach(set => {
        const [emoteId, rangesStr] = set.split(':');
        if (!emoteId || !rangesStr) return;
        
        const ranges = rangesStr.split(',');
        ranges.forEach(range => {
          const [startStr, endStr] = range.split('-');
          const start = parseInt(startStr, 10);
          const end = parseInt(endStr, 10);
          
          if (!isNaN(start) && !isNaN(end)) {
            instances.push({ id: emoteId, start, end });
          }
        });
      });
      
      if (instances.length === 0) return null;
      
      // Sort instances by start index
      instances.sort((a, b) => a.start - b.start);
      
      const parts = [];
      let currentIndex = 0;
      
      for (const inst of instances) {
        if (inst.start < currentIndex || inst.end < inst.start || inst.end >= text.length) {
          continue;
        }
        
        if (inst.start > currentIndex) {
          const textSegment = text.substring(currentIndex, inst.start);
          parts.push(...parseMessageContent(textSegment));
        }
        
        const emoteName = text.substring(inst.start, inst.end + 1);
        parts.push({
          type: 'emote',
          name: emoteName,
          url: `https://static-cdn.jtvnw.net/emoticons/v2/${inst.id}/default/dark/1.0`
        });
        
        currentIndex = inst.end + 1;
      }
      
      if (currentIndex < text.length) {
        const remainingText = text.substring(currentIndex);
        parts.push(...parseMessageContent(remainingText));
      }
      
      return parts;
    } catch (err) {
      console.warn('Failed to parse Twitch emotes tag:', err);
      return null;
    }
  }

  disconnect() {
    this.isManuallyDisconnected = true;
    this.channels.clear();
    if (this.viewerIntervals) {
      this.viewerIntervals.forEach(intervalId => clearInterval(intervalId));
      this.viewerIntervals.clear();
    }
    if (this.socket) {
      this.socket.close();
    }
  }

  parsePrivMsg(line) {
    // Example format:
    // @badge-info=subscriber/6;badges=moderator/1,subscriber/6;color=#FF4500;display-name=ViewerName;emotes=;id=123-abc;mod=1;room-id=456;subscriber=1;tmi-sent-ts=1620000000000;turbo=0;user-id=789;user-type=mod :viewername!viewername@viewername.tmi.twitch.tv PRIVMSG #channel :Hello world!
    
    try {
      const parts = line.split(' PRIVMSG #');
      if (parts.length < 2) return;

      const rightPart = parts[1];
      const channelEndIdx = rightPart.indexOf(' :');
      if (channelEndIdx === -1) return;

      const channel = rightPart.substring(0, channelEndIdx).toLowerCase();
      const text = rightPart.substring(channelEndIdx + 2);

      const leftPart = parts[0];
      const tagsPart = leftPart.startsWith('@') ? leftPart.substring(1) : '';
      
      // Parse tags
      const tags = {};
      if (tagsPart) {
        const tagPairs = tagsPart.split(';');
        tagPairs.forEach(pair => {
          const [key, value] = pair.split('=');
          tags[key] = value ? decodeURIComponent(value) : '';
        });
      }

      // Extract username from hostmask if display-name tag is missing
      let username = tags['display-name'];
      if (!username) {
        const userMatch = leftPart.match(/:([^!]+)!/);
        username = userMatch ? userMatch[1] : 'anon';
      }

      // Resolve user color (default if none provided)
      const color = tags['color'] || this.getRandomColor(username);

      // Determine badges
      const badges = [];
      const badgeImages = {};
      const badgeVersions = {};
      const badgeTag = tags['badges'] || '';
      
      if (badgeTag) {
        const pairs = badgeTag.split(',');
        pairs.forEach(p => {
          const [rawBadgeName, version] = p.split('/');
          if (rawBadgeName) {
            const badgeName = rawBadgeName.replace(/-/g, '_');
            badges.push(badgeName);
            badgeVersions[badgeName] = version;
            const url = this.getBadgeImageUrl(channel, rawBadgeName, version);
            if (url) {
              badgeImages[badgeName] = url;
            }
          }
        });
      } else {
        if (badgeTag.includes('broadcaster/')) {
          badges.push('broadcaster');
          badgeVersions['broadcaster'] = '1';
        }
        if (badgeTag.includes('moderator/')) {
          badges.push('moderator');
          badgeVersions['moderator'] = '1';
        }
        if (badgeTag.includes('vip/')) {
          badges.push('vip');
          badgeVersions['vip'] = '1';
        }
        if (badgeTag.includes('subscriber/')) {
          badges.push('subscriber');
          badgeVersions['subscriber'] = '1';
        }
        if (badgeTag.includes('partner/')) {
          badges.push('partner');
          badgeVersions['partner'] = '1';
        }
      }
      
      // Check if user is a known developer/admin for ProChat
      if (username.toLowerCase() === 'prochat_dev' || username.toLowerCase() === 'antigravity') {
        if (!badges.includes('developer')) {
          badges.push('developer');
          badgeVersions['developer'] = '1';
        }
      }

      // Check if user is a bot
      const lowerUser = username.toLowerCase();
      const knownBots = ['nightbot', 'streamelements', 'wizebot', 'moobot', 'kickbot', 'botrix', 'botrixoficial', 'botrixofficial', 'streamlabs', 'fossabot', 'soundalerts', 'kbot'];
      if (knownBots.includes(lowerUser) || (lowerUser.endsWith('bot') && lowerUser.length > 3)) {
        if (!badges.includes('bot')) {
          badges.push('bot');
          badgeVersions['bot'] = '1';
        }
      }

      // Compile message object
      const message = {
        id: tags['id'] || Math.random().toString(36).substring(2, 11),
        platform: 'twitch',
        channel: channel,
        username: username,
        displayName: username,
        color: color,
        text: text,
        parts: this.parseTwitchEmotes(text, tags['emotes']) || undefined,
        badges: badges,
        badgeImages: badgeImages,
        badgeVersions: badgeVersions,
        rawTimestamp: Date.now(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      };

      if (tags['reply-parent-msg-id']) {
        message.repliedTo = {
          id: tags['reply-parent-msg-id'],
          username: tags['reply-parent-user-login'],
          displayName: tags['reply-parent-display-name'] || tags['reply-parent-user-login'],
          text: tags['reply-parent-msg-body'] ? tags['reply-parent-msg-body'].replace(/\\s/g, ' ') : ''
        };
      }

      this.onMessage(message);
    } catch (e) {
      console.error('Error parsing IRC PRIVMSG:', e, line);
    }
  }

  getRandomColor(username) {
    const colors = [
      '#FF0000', '#0000FF', '#00FF00', '#B22222', '#FF7F50',
      '#9ACD32', '#FF4500', '#2E8B57', '#DAA520', '#D2691E',
      '#5F9EA0', '#1E90FF', '#FF69B4', '#8A2BE2', '#00FF7F'
    ];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % colors.length;
    return colors[idx];
  }
}

export function getLiveTwitchBadgeUrl(channelName, badgeName, version) {
  if (window.twitchBadges) {
    const cleanChan = channelName.toLowerCase();
    const ivrBadgeName = badgeName.replace(/_/g, '-');
    const channels = window.twitchBadges.channels;
    if (channels && channels.has(cleanChan)) {
      const chanSets = channels.get(cleanChan);
      if (chanSets && chanSets[ivrBadgeName]) {
        const versions = chanSets[ivrBadgeName].versions || {};
        let versionObj = versions[version];
        if (!versionObj) {
          const keys = Object.keys(versions);
          if (keys.length > 0) versionObj = versions[keys[0]];
        }
        if (versionObj) {
          return versionObj.image_url_1x || versionObj.image_url_2x || versionObj.image_url_4x;
        }
      }
    }
    const globalBadges = window.twitchBadges.global;
    if (globalBadges && globalBadges[ivrBadgeName]) {
      const versions = globalBadges[ivrBadgeName].versions || {};
      let versionObj = versions[version];
      if (!versionObj) {
        const keys = Object.keys(versions);
        if (keys.length > 0) versionObj = versions[keys[0]];
      }
      if (versionObj) {
        return versionObj.image_url_1x || versionObj.image_url_2x || versionObj.image_url_4x;
      }
    }
  }
  return null;
}
