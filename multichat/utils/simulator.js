// realistic chat simulator for non-Twitch platforms (YouTube, Kick, TikTok, Rumble, X)
import { EMOTE_MAP } from './emotes';

const MOCK_USERNAMES = [
  'StreamFan99', 'GamerPro_44', 'X_Ninja_X', 'PixelArtisan', 'HyperActive',
  'CodeNinja', 'SavageBeast', 'LofiVibes', 'AlphaOmega', 'NeonRider',
  'ShadowWalker', 'GlitchInMatrix', 'RetroPixel', 'WebDeveloper101', 'CyberPunk2077',
  'CoffeeAddict', 'LunaTick', 'SpeedRunner', 'CosmicDust', 'TechGuru',
  'FrostBite', 'FireFly', 'SilentStrike', 'ThunderBolt', 'AquaMan',
  'Nightbot', 'Botrix', 'AnilNichlani_Nitin'
];

const MOCK_MESSAGES = [
  'POGGERS what a play!',
  'KEKW that was so funny',
  'monkaS is he going to survive?',
  'Is this game free to play?',
  'What specs are your PC?',
  'LUL classic stream moment',
  'GigaChad absolute legend',
  'WidePeepoHappy so wholesome',
  'Can you say hi to my friend Tim?',
  'Just subscribed! Love the content! widepeepoHappy',
  'Is there a discord server?',
  'Kappa sure buddy',
  'Copium he will win the next game for sure',
  'Oh my god, did you see that?',
  'EZ first try!',
  'Sadge that was close though',
  'What music is playing in the background?',
  'How long have you been streaming?',
  'That is crazy! LUL',
  'Hello from Germany! 🇩🇪',
  'Let\'s goooo! PogChamp',
  'Wait, how did you do that dash?',
  'Awesome stream today!',
  'Nice one! ResidentSleeper jk it was sick',
  'Can we get a hype train going? HeyGuys'
];

const MOCK_PLATFORM_WORDS = {
  youtube: ['Super Chat', 'Member for 3 months', 'Like the stream guys!', 'Subscribed!'],
  kick: ['Green wall!', 'Kick is so fast', 'Awesome emote support KEKW', 'Host incoming!'],
  tiktok: ['Sent a Rose 🌹', 'Double tap the screen!', 'Followed the host!', 'Shared the LIVE'],
  rumble: ['Rumbled!', 'Rumble chat speed is crazy', 'Battle premium!', 'Green verified badge'],
  x: ['Retweeted!', 'Spaces are great', 'Posted a reply', 'Premium verified user']
};

export class ChatSimulator {
  constructor(onMessageCallback) {
    this.onMessage = onMessageCallback;
    this.intervals = [];
    this.isRunning = false;
    this.youtubeRankSlots = { 1: 'streamfan99', 2: 'gamerpro_44', 3: 'alphaomega' };
  }

  start(channels) {
    this.stop();
    if (!channels || channels.length === 0) return;

    this.isRunning = true;
    
    // Create generation loop for each active channel
    channels.forEach(ch => {
      // High-speed generation loop for demo mode
      const speedMs = 300 + Math.random() * 300;
      
      const intervalId = setInterval(() => {
        if (!this.isRunning) return;
        this.generateMessage(ch.name, ch.platform);
      }, speedMs);

      this.intervals.push(intervalId);
      
      // High-speed Special Events (Subscriptions, Tips) every 3-5 seconds
      const eventIntervalId = setInterval(() => {
        if (!this.isRunning) return;
        this.generateSpecialEvent(ch.name, ch.platform);
      }, 3000 + Math.random() * 2000);
      
      this.intervals.push(eventIntervalId);
    });
  }

  stop() {
    this.isRunning = false;
    this.intervals.forEach(clearInterval);
    this.intervals = [];
  }

  generateMessage(channel, platform) {
    const baseName = MOCK_USERNAMES[Math.floor(Math.random() * MOCK_USERNAMES.length)];
    let username = baseName.toLowerCase();
    let displayName = baseName.replace(/([A-Z0-9])/g, ' $1').trim().replace(/_/g, ' ');
    displayName = displayName.replace(/\s+/g, ' ');
    
    if (baseName === 'AnilNichlani_Nitin') {
      username = 'anil_nichlani';
      displayName = 'anil nichlani (nitin)';
    }
    
    // Choose message content (mix of standard + platform specific + occasional random emotes)
    let messagePool = [...MOCK_MESSAGES];
    if (MOCK_PLATFORM_WORDS[platform] && Math.random() > 0.5) {
      messagePool = [...messagePool, ...MOCK_PLATFORM_WORDS[platform]];
    }
    let text = messagePool[Math.floor(Math.random() * messagePool.length)];

    // Determine random badges
    const badges = [];
    const badgeImages = {};

    // 100% chance to have at least one badge in demo chat to make it look very diverse
    if (true) {
      if (platform === 'kick') {
        // level badge (90% chance) - rotate through levels to show circle, rounded rect, hexagon, octagon, star, etc.
        if (Math.random() > 0.1) {
          const levels = [5, 12, 22, 35, 48, 55, 62, 77, 88, 99];
          const levelNum = levels[Math.floor(Math.random() * levels.length)];
          badges.push(`level_${levelNum}`);
        }
        
        // role badge (90% chance)
        if (Math.random() > 0.1) {
          const roles = ['broadcaster', 'moderator', 'vip', 'og', 'verified', 'bot', 'subscriber', 'sub_gifter', 'founder'];
          const role = roles[Math.floor(Math.random() * roles.length)];
          badges.push(role);
          
          if (role === 'subscriber') {
            // 50% chance for custom image, 50% fallback to DefaultSubscriberBadge
            if (Math.random() > 0.5) {
              const mockBadges = [
                'https://files.kick.com/emotes/3218/fullsize',
                'https://files.kick.com/emotes/4215/fullsize'
              ];
              badgeImages.subscriber = mockBadges[Math.floor(Math.random() * mockBadges.length)];
            }
          }
        }
      } else if (platform === 'youtube') {
        const roles = ['broadcaster', 'moderator', 'member', 'verified'];
        const role = roles[Math.floor(Math.random() * roles.length)];
        badges.push(role);
        
        if (role === 'member') {
          // 50% chance to have a custom membership badge image, 50% fallback
          if (Math.random() > 0.5) {
            badgeImages.member = 'https://yt3.ggpht.com/qLpx0c5tY4U2e18n2c27kC5vL1PzM3zK=s16-c-k';
          }
        }

        // 8% chance that this user claims or switches a rank (#1, #2, or #3), displacing previous holder
        if (Math.random() < 0.08) {
          const r = Math.floor(Math.random() * 3) + 1;
          if (this.youtubeRankSlots) {
            // Vacate any other slot this user was in
            for (let slot = 1; slot <= 3; slot++) {
              if (this.youtubeRankSlots[slot] === username) {
                this.youtubeRankSlots[slot] = null;
              }
            }
            this.youtubeRankSlots[r] = username;
          }
          badges.push(`rank_${r}`);
        } else if (this.youtubeRankSlots) {
          // If user already currently holds a top 3 rank, retain their rank badge
          for (let slot = 1; slot <= 3; slot++) {
            if (this.youtubeRankSlots[slot] === username) {
              badges.push(`rank_${slot}`);
              break;
            }
          }
        }
      } else if (platform === 'twitch') {
        const roles = ['broadcaster', 'moderator', 'vip', 'subscriber', 'bot'];
        const role = roles[Math.floor(Math.random() * roles.length)];
        badges.push(role);
        
        if (role === 'subscriber') {
          if (Math.random() > 0.5) {
            badgeImages.subscriber = 'https://static-cdn.jtvnw.net/badges/v1/5b986610-6186-4e19-a9e4-41375d65427d/1';
          }
        }
      }
    }

    if (Math.random() > 0.98 && !badges.includes('developer')) {
      badges.push('developer');
    }

    // Check if user is a bot
    const lowerUser = username.toLowerCase();
    const knownBots = ['nightbot', 'streamelements', 'wizebot', 'moobot', 'kickbot', 'botrix', 'botrixoficial', 'botrixofficial', 'streamlabs', 'fossabot', 'soundalerts', 'kbot'];
    if (knownBots.includes(lowerUser) || (lowerUser.endsWith('bot') && lowerUser.length > 3)) {
      if (!badges.includes('bot')) badges.push('bot');
      if (lowerUser === 'botrix' || lowerUser === 'streamlabs') {
        if (!badges.includes('moderator')) badges.push('moderator');
        if (!badges.includes('verified')) badges.push('verified');
      }
    }

    // Resolve user color
    const color = this.getRandomColor(username);

    // Cache of last messages to allow simulated replies
    if (!this.lastMessages) {
      this.lastMessages = [];
    }

    // Randomize sub tenure and gifted counts for variety
    const monthsSubscribed = (badges.includes('subscriber') || badges.includes('member') || badges.includes('founder'))
      ? Math.floor(Math.random() * 36) + 1
      : 0;

    const giftedSubsCount = badges.includes('sub_gifter')
      ? [1, 5, 10, 25, 50, 100, 200, 500][Math.floor(Math.random() * 8)]
      : 0;

    let isGift = false;
    let giftDetails = null;
    const parts = [];

    // 25% chance for YouTube to send a simulated Jewel Gift
    if (platform === 'youtube' && Math.random() < 0.25) {
      const mockGifts = [
        { name: 'Samosa', jewels: '20', emoji: '🥟' },
        { name: 'Hiding...', jewels: '10', emoji: '🙇' },
        { name: 'Treat', jewels: '10', emoji: '🦴' },
        { name: 'Boba', jewels: '50', emoji: '🧋' },
        { name: 'Mic Drop', jewels: '100', emoji: '🎤' },
        { name: 'Crown', jewels: '500', emoji: '👑' },
        { name: 'Diamond', jewels: '1000', emoji: '💎' },
        { name: 'Sports Car', jewels: '2500', emoji: '🏎️' }
      ];
      const selectedGift = mockGifts[Math.floor(Math.random() * mockGifts.length)];
      isGift = true;
      text = `sent ${selectedGift.name} ${selectedGift.emoji}`;
      giftDetails = {
        name: selectedGift.name,
        jewels: selectedGift.jewels,
        imageUrl: null
      };
      parts.push({
        type: 'text',
        content: `sent ${selectedGift.name} ${selectedGift.emoji}`
      });
    }

    const message = {
      id: Math.random().toString(36).substring(2, 11),
      platform: platform,
      channel: channel.toLowerCase(),
      username: username,
      displayName: displayName,
      color: color,
      text: text,
      parts: parts.length > 0 ? parts : [{ type: 'text', content: text }],
      isGift: isGift,
      giftDetails: giftDetails,
      badges: badges,
      badgeImages: badgeImages,
      youtubeRank: badges.find(b => typeof b === 'string' && b.startsWith('rank_')) ? parseInt(badges.find(b => typeof b === 'string' && b.startsWith('rank_')).replace('rank_', ''), 10) : undefined,
      monthsSubscribed: monthsSubscribed || undefined,
      giftedSubsCount: giftedSubsCount || undefined,
      rawTimestamp: Date.now(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
    };

    // 15% chance to make it a reply to a previous message from the same platform
    const platformPrevMsgs = this.lastMessages.filter(m => m.platform === platform);
    if (platformPrevMsgs.length > 0 && Math.random() < 0.15) {
      const parent = platformPrevMsgs[Math.floor(Math.random() * platformPrevMsgs.length)];
      message.repliedTo = {
        id: parent.id,
        username: parent.username,
        displayName: parent.displayName,
        text: parent.text
      };
    }

    this.lastMessages.push(message);
    if (this.lastMessages.length > 30) {
      this.lastMessages.shift();
    }

    this.onMessage(message);
  }

  generateSpecialEvent(channel, platform) {
    const baseName = MOCK_USERNAMES[Math.floor(Math.random() * MOCK_USERNAMES.length)];
    let username = baseName.toLowerCase();
    let displayName = baseName.replace(/([A-Z0-9])/g, ' $1').trim().replace(/_/g, ' ');
    displayName = displayName.replace(/\s+/g, ' ');
    
    if (baseName === 'AnilNichlani_Nitin') {
      username = 'anil_nichlani';
      displayName = 'anil nichlani (nitin)';
    }
    const color = this.getRandomColor(username);
    
    let text = '';
    let eventType = 'subscription'; // 'subscription' | 'donation'
    let details = {};

    if (platform === 'youtube') {
      const rolls = Math.random();
      if (rolls > 0.7) {
        // Community Gifted Memberships
        const counts = [5, 10, 20, 50];
        const count = counts[Math.floor(Math.random() * counts.length)];
        eventType = 'subscription';
        text = `gifted ${count} memberships to the community!`;
        details = { 
          tier: `Gifted ${count} Memberships`, 
          isGift: true,
          giftCount: count,
          amount: `${count} Gifted Memberships`,
          headerBg: '#0f9d58',
          bodyBg: '#0b8043',
          authorTextColor: '#ffffff'
        };
      } else if (rolls > 0.45) {
        // Super Chat
        const amounts = [1.99, 4.99, 9.99, 19.99, 49.99, 99.99];
        const amount = amounts[Math.floor(Math.random() * amounts.length)];
        eventType = 'donation';
        text = `sent a $${amount.toFixed(2)} Super Chat!`;
        details = { amount: `$${amount.toFixed(2)}`, type: 'Super Chat' };
      } else if (rolls > 0.2) {
        // Super Sticker
        const amounts = [2.00, 5.00, 10.00];
        const amount = amounts[Math.floor(Math.random() * amounts.length)];
        eventType = 'donation';
        text = `sent a $${amount.toFixed(0)}.00 Super Sticker!`;
        details = { 
          amount: `$${amount.toFixed(0)}.00`, 
          type: 'Super Sticker',
          stickerUrl: 'https://www.gstatic.com/youtube/img/stickers/celebration/party_popper.png'
        };
      } else {
        // Direct individual membership purchase
        eventType = 'subscription';
        text = `joined the channel membership!`;
        details = { tier: 'Member', headerBg: '#0f9d58', bodyBg: '#0b8043', authorTextColor: '#ffffff' };
      }
    } else if (platform === 'kick') {
      const rolls = Math.random();
      if (rolls > 0.7) {
        // Community Gifted Subs
        const counts = [5, 10, 20, 50];
        const count = counts[Math.floor(Math.random() * counts.length)];
        text = `gifted ${count} Tier 1 subscriptions to the community!`;
        details = { amount: `${count} Gifted Subs`, type: 'gift' };
      } else if (rolls > 0.4) {
        // Kick Coin Tips / Tipped money
        eventType = 'donation';
        if (Math.random() > 0.5) {
          const coins = [100, 500, 1000, 5000];
          const count = coins[Math.floor(Math.random() * coins.length)];
          text = `sent ${count} Kick Coins!`;
          details = { amount: `${count} Coins` };
        } else {
          const tips = [5.00, 10.00, 20.00, 50.00];
          const count = tips[Math.floor(Math.random() * tips.length)];
          text = `tipped $${count.toFixed(2)}!`;
          details = { amount: `$${count.toFixed(2)}` };
        }
      } else if (rolls > 0.2) {
        // Individual gift sub
        const recipient = MOCK_USERNAMES[Math.floor(Math.random() * MOCK_USERNAMES.length)];
        text = `gifted a subscription to ${recipient}!`;
        details = { gift: 'Subscription' };
      } else {
        // Subscription
        const subTiers = ['Tier 1', 'Tier 2', 'Tier 3'];
        const tier = subTiers[Math.floor(Math.random() * subTiers.length)];
        text = `subscribed at ${tier}!`;
        details = { tier };
      }
    } else if (platform === 'twitch') {
      const rolls = Math.random();
      if (rolls > 0.6) {
        // Bits cheer
        eventType = 'donation';
        const bits = [100, 500, 1000, 5000];
        const count = bits[Math.floor(Math.random() * bits.length)];
        text = `cheered with ${count} Bits!`;
        details = { amount: `${count} Bits` };
      } else if (rolls > 0.3) {
        // Community Gifted Subs
        const counts = [5, 10, 20];
        const count = counts[Math.floor(Math.random() * counts.length)];
        text = `gifted ${count} Tier 1 subscriptions to the community!`;
        details = { amount: `${count} Gifted Subs` };
      } else {
        // Subscription
        text = `subscribed at Tier 1!`;
        details = { tier: 'Tier 1' };
      }
    } else if (platform === 'tiktok') {
      const gifts = ['Rose 🌹', 'Finger Heart 🫰', 'TikTok Crown 👑', 'Universe 🌌'];
      const gift = gifts[Math.floor(Math.random() * gifts.length)];
      eventType = 'donation';
      text = `sent a ${gift}!`;
      details = { gift };
    } else {
      text = `just subscribed!`;
    }

    const message = {
      id: Math.random().toString(36).substring(2, 11),
      platform: platform,
      channel: channel.toLowerCase(),
      username: username,
      displayName: displayName,
      color: color,
      text: text,
      isSystemEvent: true,
      eventType: eventType,
      eventDetails: details,
      badges: ['subscriber'],
      rawTimestamp: Date.now(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
    };

    this.onMessage(message);
  }

  getRandomColor(username) {
    const colors = [
      '#FF0000', '#0000FF', '#00FF00', '#FF7F50', '#8A2BE2',
      '#DAA520', '#D2691E', '#FF69B4', '#1E90FF', '#00FF7F',
      '#9146FF', '#53FC18', '#FF007F', '#FE0979', '#85B72C'
    ];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % colors.length;
    return colors[idx];
  }
}
