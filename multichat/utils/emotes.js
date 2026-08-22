// Dictionary of global emotes mapped to their image CDN URLs
export const EMOTE_MAP = {
  Kappa: 'https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/1.0',
  LUL: 'https://static-cdn.jtvnw.net/emoticons/v2/425618/default/dark/1.0',
  PogChamp: 'https://static-cdn.jtvnw.net/emoticons/v2/305954156/default/dark/1.0',
  BibleThump: 'https://static-cdn.jtvnw.net/emoticons/v2/86/default/dark/1.0',
  WutFace: 'https://static-cdn.jtvnw.net/emoticons/v2/28087/default/dark/1.0',
  ResidentSleeper: 'https://static-cdn.jtvnw.net/emoticons/v2/245/default/dark/1.0',
  HeyGuys: 'https://static-cdn.jtvnw.net/emoticons/v2/30259/default/dark/1.0',
  DansGame: 'https://static-cdn.jtvnw.net/emoticons/v2/33/default/dark/1.0',
  CoolCat: 'https://static-cdn.jtvnw.net/emoticons/v2/58765/default/dark/1.0',
  
  // 7TV / BTTV Emotes
  KEKW: 'https://cdn.7tv.app/emote/607fc8323f22e7e38a85e497/1x.webp',
  Pepega: 'https://cdn.7tv.app/emote/60ae3d1512ca517b1b5c453d/1x.webp',
  monkaS: 'https://cdn.7tv.app/emote/607fc71c3f22e7e38a85e3d0/1x.webp',
  Sadge: 'https://cdn.7tv.app/emote/607fc95e3f22e7e38a85e504/1x.webp',
  EZ: 'https://cdn.7tv.app/emote/60ae38d112ca517b1b5c4123/1x.webp',
  POGGERS: 'https://cdn.7tv.app/emote/607fc88a3f22e7e38a85e4c0/1x.webp',
  WidePeepoHappy: 'https://cdn.7tv.app/emote/607fcb4a3f22e7e38a85e5c7/1x.webp',
  Copium: 'https://cdn.7tv.app/emote/60a2ab8668744959db2cc7b6/1x.webp',
  GigaChad: 'https://cdn.7tv.app/emote/6122d26fdf21c83a7c645b20/1x.webp'
};

const PARSE_CACHE = new Map();
const MAX_PARSE_CACHE = 2000;

/**
 * Parses a plain text message and replaces matching emote words with HTML img elements.
 * Returns an array of message parts (either strings or object representing emote image).
 * Memoized with an LRU cache for 0ms execution on repeated renders.
 */
export function parseMessageContent(text) {
  if (!text) return [];
  if (typeof text !== 'string') return [{ type: 'text', content: String(text) }];
  
  const cached = PARSE_CACHE.get(text);
  if (cached) return cached;

  const words = text.split(' ');
  const parts = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (EMOTE_MAP[word]) {
      parts.push({
        type: 'emote',
        name: word,
        url: EMOTE_MAP[word]
      });
    } else {
      // Group contiguous text strings together
      if (parts.length > 0 && parts[parts.length - 1].type === 'text') {
        parts[parts.length - 1].content += ' ' + word;
      } else {
        parts.push({
          type: 'text',
          content: word
        });
      }
    }
  }

  if (PARSE_CACHE.size >= MAX_PARSE_CACHE) {
    const firstKey = PARSE_CACHE.keys().next().value;
    PARSE_CACHE.delete(firstKey);
  }
  PARSE_CACHE.set(text, parts);

  return parts;
}
