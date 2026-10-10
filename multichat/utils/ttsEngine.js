/**
 * Centralized Text-to-Speech (TTS) Engine for MultiChat
 * Includes:
 * - Anti-spam filtering (commands, emojis, character floods, rate limits)
 * - Text sanitization (emotes, URLs, excessive punctuation)
 * - Unified sequential queue manager
 * - Chromium keep-alive pulse (prevents Chrome SpeechSynthesis 15s timeout / stalls)
 */

const ttsRecentHistory = [];
let keepAliveTimer = null;

const startKeepAlive = () => {
  if (keepAliveTimer || typeof window === 'undefined' || !window.speechSynthesis) return;
  keepAliveTimer = setInterval(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }
  }, 10000);
};

const stopKeepAlive = () => {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
};

/**
 * Validates whether a message is spam and should be skipped by TTS
 */
export const isTtsSpam = (rawText, username = '') => {
  if (!rawText || typeof rawText !== 'string') return { isSpam: true, reason: 'empty' };

  const text = rawText.trim();
  if (text.length === 0) return { isSpam: true, reason: 'empty' };

  // 1. Bot & Chat Commands: starts with !, /, ., #, $ followed by word (e.g. !drop, !points, !discord, !uptime)
  if (/^[!/.#$][a-zA-Z0-9_-]{2,}/i.test(text)) {
    return { isSpam: true, reason: 'command' };
  }

  // 2. Pure Links / URLs
  const urlRegex = /https?:\/\/\S+|discord\.(gg|io|me)\/\S+|t\.me\/\S+|bit\.ly\/\S+/gi;
  const withoutUrls = text.replace(urlRegex, '').trim();
  if (withoutUrls.length < 2 && text.match(urlRegex)) {
    return { isSpam: true, reason: 'link_only' };
  }

  // 3. Pure Emojis, Emotes, or Symbols (nothing readable for TTS)
  const readableChars = text
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/:[a-zA-Z0-9_]+:/g, '')
    .replace(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`§±\s]/g, '')
    .trim();

  if (readableChars.length === 0) {
    return { isSpam: true, reason: 'emoji_or_symbol_only' };
  }

  // 4. Character Flood Spam (e.g. "aaaaaaaaaaaa", "wwwwwwwwwwww", "GGGGGGGGGGGGGG")
  const singleCharRepeats = text.match(/(.)\1{4,}/gi);
  if (singleCharRepeats) {
    const totalRepeatedChars = singleCharRepeats.reduce((sum, m) => sum + m.length, 0);
    if (totalRepeatedChars >= 8 || totalRepeatedChars / text.length >= 0.45) {
      return { isSpam: true, reason: 'character_flood' };
    }
  }

  // Check repeating 2-char or 3-char patterns (e.g. "hahahahahaha", "lolololololol", "kekwkekw")
  const patternMatch = text.match(/(.{2,3})\1{3,}/gi);
  if (patternMatch) {
    const totalPatternChars = patternMatch.reduce((sum, m) => sum + m.length, 0);
    if (totalPatternChars / text.length >= 0.5) {
      return { isSpam: true, reason: 'pattern_flood' };
    }
  }

  // 5. Word Flood Spam (e.g. "hi hi hi hi hi hi" or "sub sub sub sub sub sub")
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length >= 4) {
    const freq = {};
    for (const w of words) {
      freq[w] = (freq[w] || 0) + 1;
    }
    const maxFreq = Math.max(...Object.values(freq));
    if (maxFreq / words.length >= 0.55) {
      return { isSpam: true, reason: 'word_flood' };
    }
  }

  // 6. User Flood & Duplicate Message Rate Limiting
  if (username) {
    const userKey = username.toLowerCase().trim();
    const now = Date.now();
    const normalizedText = text.toLowerCase().replace(/\s+/g, ' ').trim();

    // Clean history older than 25 seconds
    while (ttsRecentHistory.length > 0 && (now - ttsRecentHistory[0].time) > 25000) {
      ttsRecentHistory.shift();
    }

    const userRecent = ttsRecentHistory.filter(h => h.username === userKey);

    // Duplicate message by same user within 15 seconds
    if (userRecent.some(h => h.text === normalizedText && (now - h.time) < 15000)) {
      return { isSpam: true, reason: 'duplicate_user_message' };
    }

    // Rate limit: same user sending more than 2 messages within 6 seconds
    const rapidCount = userRecent.filter(h => (now - h.time) < 6000).length;
    if (rapidCount >= 2) {
      return { isSpam: true, reason: 'user_rate_limit' };
    }
  }

  return { isSpam: false };
};

/**
 * Cleans and formats chat text for optimal, natural speech synthesis
 */
export const sanitizeTtsText = (text, maxChars = 150) => {
  if (!text || typeof text !== 'string') return '';

  let clean = text
    // Strip links
    .replace(/https?:\/\/\S+/gi, '')
    // Strip colon/bracket emotes like :smile: or [emote:123]
    .replace(/:[a-zA-Z0-9_]+:/g, '')
    .replace(/\[emote:[^\]]+\]/gi, '')
    // Strip emojis so TTS doesn't read out "fire flame red heart"
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, '')
    // Collapse single character repetitions: e.g. "sooooo" -> "soo", "Wwwwwww" -> "Ww"
    .replace(/(.)\1{2,}/gi, '$1$1')
    // Collapse repeated words: e.g. "hi hi hi hi" -> "hi hi"
    .replace(/\b(\w+)(?:\s+\1\b){2,}/gi, '$1 $1')
    // Collapse punctuation: "????" -> "?", "!!!!" -> "!"
    .replace(/([?!.,~])\1+/g, '$1')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // Enforce max character limit to prevent audio lockup from wall of text
  if (maxChars && clean.length > maxChars) {
    clean = clean.substring(0, maxChars).trim() + '...';
  }

  return clean;
};

// Global TTS Queue Manager to speak messages sequentially (1 by 1)
export const ttsManager = {
  queue: [],
  isSpeaking: false,
  activeUtterances: new Set(),

  speak: function(text, volume = 0.5, rate = 1.0, voiceName = '', forceImmediate = false, username = '', readUsername = false, antiSpam = true, maxChars = 150) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // Run anti-spam filter for queued/auto-read messages
    if (!forceImmediate && antiSpam) {
      const spamCheck = isTtsSpam(text, username);
      if (spamCheck.isSpam) {
        console.log(`[TTS Anti-Spam] Skipped spam chat from ${username || 'User'} (${spamCheck.reason}): "${text}"`);
        return;
      }
    }

    // Clean text of emotes, excessive repeats, emojis, links, and length limit
    const cleanText = sanitizeTtsText(text, maxChars);
    if (!cleanText || cleanText.length === 0) return;

    // Record entry into recent history for flood protection
    if (username) {
      ttsRecentHistory.push({
        username: username.toLowerCase().trim(),
        text: cleanText.toLowerCase().trim(),
        time: Date.now()
      });
      if (ttsRecentHistory.length > 50) ttsRecentHistory.shift();
    }

    const textToSpeak = readUsername && username ? `${username} says: ${cleanText}` : cleanText;

    if (forceImmediate) {
      this.cancel();

      try {
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.volume = volume;
        utterance.rate = rate;
        this.activeUtterances.add(utterance);

        if (voiceName) {
          const voices = window.speechSynthesis.getVoices();
          const voice = voices.find(v => v.name === voiceName);
          if (voice) utterance.voice = voice;
        }

        utterance.onend = () => {
          this.activeUtterances.delete(utterance);
          stopKeepAlive();
        };
        utterance.onerror = () => {
          this.activeUtterances.delete(utterance);
          stopKeepAlive();
        };

        startKeepAlive();
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.error("[TTS] Manual error:", e);
        stopKeepAlive();
      }
      return;
    }

    // Auto-play queuing: cap queue size to 10 to prevent backlog
    if (this.queue.length >= 10) {
      this.queue.shift();
    }

    this.queue.push({
      textToSpeak,
      volume,
      rate,
      voiceName
    });

    if (!this.isSpeaking) {
      this.processNext();
    }
  },

  processNext: function() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (this.queue.length === 0) {
      this.isSpeaking = false;
      stopKeepAlive();
      return;
    }

    this.isSpeaking = true;
    startKeepAlive();
    const next = this.queue.shift();

    try {
      const utterance = new SpeechSynthesisUtterance(next.textToSpeak);
      utterance.volume = next.volume;
      utterance.rate = next.rate;
      this.activeUtterances.add(utterance);

      if (next.voiceName) {
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.name === next.voiceName);
        if (voice) utterance.voice = voice;
      }

      utterance.onend = () => {
        this.activeUtterances.delete(utterance);
        this.processNext();
      };
      utterance.onerror = (e) => {
        this.activeUtterances.delete(utterance);
        console.warn("[TTS] Utterance error:", e);
        this.processNext();
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("[TTS] Queue error:", e);
      this.isSpeaking = false;
      this.processNext();
    }
  },

  cancel: function() {
    this.queue = [];
    this.isSpeaking = false;
    this.activeUtterances.clear();
    stopKeepAlive();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
};

// Bind to window for global access across components
if (typeof window !== 'undefined') {
  window.ttsManager = ttsManager;
}

export const speakMessage = (username, text, ttsVolume = 0.5, ttsSpeed = 1.0, readUsername = true, ttsVoiceName = '', antiSpam = true, maxChars = 150) => {
  ttsManager.speak(text, ttsVolume, ttsSpeed, ttsVoiceName, false, username, readUsername, antiSpam, maxChars);
};
