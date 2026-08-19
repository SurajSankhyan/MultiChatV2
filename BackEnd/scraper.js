import axios from 'axios';

/**
 * Slugifies a string by converting it to lowercase, replacing non-alphanumeric characters with hyphens, and trimming hyphens.
 * @param {string} name 
 * @returns {string}
 */
export function slugify(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Traverses a JSON node to recursively find a richMetadataRenderer containing game details.
 * @param {any} node 
 * @returns {{name: string, title: string, poster: string}|null}
 */
function extractGameFromYtInitialData(node) {
  if (!node || typeof node !== 'object') return null;

  // 1. Modern videoAttributesSectionViewModel parsing (new YouTube design)
  if (node.videoAttributesSectionViewModel) {
    const section = node.videoAttributesSectionViewModel;
    const isGaming = section.headerTitle === 'Games' || 
                     section.footerButton?.buttonViewModel?.iconName === 'GAMING_LOGO' ||
                     section.footerButton?.buttonViewModel?.title === 'Gaming';
                     
    if (isGaming && Array.isArray(section.videoAttributeViewModels)) {
      const model = section.videoAttributeViewModels[0]?.videoAttributeViewModel;
      if (model && model.title) {
        const poster = model.image?.sources?.[model.image.sources.length - 1]?.url || 
                       model.image?.sources?.[0]?.url || '';
        return {
          name: model.title,
          title: model.title,
          poster: poster
        };
      }
    }
  }

  // 2. Classic richMetadataRenderer parsing (legacy/fallback)
  if (node.richMetadataRenderer) {
    const renderer = node.richMetadataRenderer;
    // Check if the title is available and contains text
    if (renderer.title && renderer.title.simpleText) {
      return {
        name: renderer.title.simpleText,
        title: renderer.title.simpleText,
        poster: renderer.thumbnail?.thumbnails?.[0]?.url || ''
      };
    }
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const result = extractGameFromYtInitialData(item);
      if (result) return result;
    }
  } else {
    for (const key of Object.keys(node)) {
      const result = extractGameFromYtInitialData(node[key]);
      if (result) return result;
    }
  }

  return null;
}

/**
 * Fetches game details for a given YouTube video.
 * Extracts the official tagged game in the description card.
 * 
 * @param {string} videoId 
 * @param {string} videoTitle 
 * @param {string} videoDesc 
 * @returns {Promise<{name: string|null, title: string|null, poster: string|null, storyboardSpec: string|null}>}
 */
export async function fetchGameDetails(videoId, videoTitle, videoDesc = '') {
  let storyboardSpec = null;
  let scraped = null;

  // Attempt scraping YouTube watch page for official rich game details & storyboard spec
  let html = null;
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 6000
    });
    html = data;
  } catch (err) {
    console.warn(`[GameScraper] Direct scrape failed for video ${videoId} (${err.message}). Trying Codetabs proxy...`);
    try {
      const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
      const { data } = await axios.get(proxyUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        },
        timeout: 10000
      });
      html = data;
    } catch (proxyErr) {
      console.warn(`[GameScraper] Codetabs proxy fetch failed for video ${videoId} (${proxyErr.message}). Trying AllOrigins proxy...`);
      try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
        const { data } = await axios.get(proxyUrl, { timeout: 12000 });
        html = data;
      } catch (aoErr) {
        console.error(`[GameScraper] AllOrigins proxy fetch failed for video ${videoId}: ${aoErr.message}`);
      }
    }
  }

  if (html) {
    const matchPlayer = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (matchPlayer) {
      try {
        const playerResponse = JSON.parse(matchPlayer[1]);
        storyboardSpec = playerResponse?.storyboards?.playerStoryboardSpecRenderer?.spec ||
                         playerResponse?.storyboards?.playerLiveStoryboardSpecRenderer?.spec ||
                         null;
      } catch (e) {
        console.warn(`[StoryboardScraper] Failed to parse ytInitialPlayerResponse: ${e.message}`);
      }
    }

    if (!storyboardSpec) {
      const matchEncoded = html.match(/%22player(?:Live)?StoryboardSpecRenderer%22%3A%7B%22spec%22%3A%22(.+?)%22/);
      if (matchEncoded) {
        try {
          storyboardSpec = decodeURIComponent(matchEncoded[1]);
          console.log('[StoryboardScraper] Successfully extracted URL-encoded storyboard spec!');
        } catch (e) {
          console.warn(`[StoryboardScraper] Failed to decode URL-encoded spec: ${e.message}`);
        }
      }
    }

    const matchData = html.match(/ytInitialData\s*=\s*({.+?});/);
    if (matchData) {
      try {
        const ytInitialData = JSON.parse(matchData[1]);
        scraped = extractGameFromYtInitialData(ytInitialData);
      } catch (e) {
        console.warn(`[GameScraper] Failed to parse ytInitialData: ${e.message}`);
      }
    }
  }

  // Fallback to Streamsnip storyboard API proxy if direct scrape failed for storyboard
  if (!storyboardSpec) {
    try {
      console.log(`[StoryboardScraper] Direct scrape returned null for ${videoId}. Querying Streamsnip proxy...`);
      const { data: snipData } = await axios.get(`https://streamsnip.com/get_storyboard/${videoId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        },
        timeout: 4000
      });
      if (snipData && snipData.spec) {
        storyboardSpec = snipData.spec;
        console.log(`[StoryboardScraper] Successfully retrieved storyboard spec from Streamsnip proxy for ${videoId}`);
      }
    } catch (snipErr) {
      console.warn(`[StoryboardScraper] Streamsnip proxy query failed for ${videoId}: ${snipErr.message}`);
    }
  }

  if (scraped && scraped.name) {
    console.log(`[GameScraper] Scraped game details successfully for ${videoId}:`, scraped.name);
    return {
      name: scraped.name,
      title: scraped.title,
      poster: scraped.poster,
      storyboardSpec
    };
  }

  // 3. Fallback to keyword matching if watch page scrape got blocked (e.g. 429) or returned no game details
  const fallbackGames = [
    {
      id: 'call-of-duty-mobile',
      title: 'Call of Duty: Mobile',
      poster: 'https://yt3.ggpht.com/rmb7VQ6ZmVzbTZIdJZ2jR0i4bC8vvJfarJ9MNds08CMXI_SUbrAswe7GCeBuckWua6-36xGPhg=s224-w160-h224-c-k-c0x00ffffff-no-nd-rj',
      keywords: ['cod mobile', 'codm', 'call of duty', 'warzone']
    },
    {
      id: 'battlegrounds-mobile-india',
      title: 'Battlegrounds Mobile India',
      poster: 'https://static-cdn.jtvnw.net/ttv-boxart/517616_IGDB-285x380.jpg',
      keywords: ['bgmi', 'battlegrounds mobile', 'pubg']
    },
    {
      id: 'arena-breakout-realistic-fps',
      title: 'Arena Breakout: Realistic FPS',
      poster: 'https://yt3.ggpht.com/bPo6k-bGP0dewEh1pcoF3TN26AKPVckV8D5Tj9-11VbP8ls1LgyJ9meKkdeJ7VJXvYgw7ABN=s224-w160-h224-c-k-c0x00ffffff-no-nd-rj',
      keywords: ['arena breakout', 'ab mobile']
    },
    {
      id: 'minecraft',
      title: 'Minecraft',
      poster: 'https://static-cdn.jtvnw.net/ttv-boxart/27471_IGDB-285x380.jpg',
      keywords: ['minecraft']
    },
    {
      id: 'grand-theft-auto-v',
      title: 'Grand Theft Auto V',
      poster: 'https://static-cdn.jtvnw.net/ttv-boxart/32982_IGDB-285x380.jpg',
      keywords: ['gta', 'grand theft auto']
    },
    {
      id: 'valorant',
      title: 'Valorant',
      poster: 'https://yt3.ggpht.com/6YP4iglHxNxrzSKoKeJkdrccIJWeI-MGS2sBcsxxS9_6K2fe3D3xG31HaUezMVhBUJBOWlCI6Q=s224-w160-h224-c-k-c0x00ffffff-no-nd-rj',
      keywords: ['valorant', 'valo']
    }
  ];

  const lowerTitle = (videoTitle || '').toLowerCase();
  const lowerDesc = (videoDesc || '').toLowerCase();

  for (const game of fallbackGames) {
    const matched = game.keywords.some(kw => lowerTitle.includes(kw) || lowerDesc.includes(kw));
    if (matched) {
      console.log(`[GameScraper] Scraper blocked/null. Fell back to title/description keyword match: ${game.title}`);
      return {
        name: game.title,
        title: game.title,
        poster: game.poster,
        storyboardSpec
      };
    }
  }

  console.log(`[GameScraper] No official game details found and keywords did not match for ${videoId}. Returning null.`);
  return {
    name: null,
    title: null,
    poster: null,
    storyboardSpec
  };
}
