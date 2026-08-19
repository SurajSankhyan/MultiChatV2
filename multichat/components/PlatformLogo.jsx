import React from 'react';
import { GIFTED_BADGES_DATA } from './KickGiftedSubsBadgeData';

// Hardcoded official brand colors so they never change based on theme or hover states
export const TwitchLogo = ({ size = 16, ...props }) => (
  <svg 
    viewBox="0 0 24 24" 
    width={size} 
    height={size} 
    fill="#9146FF"
    {...props}
  >
    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
  </svg>
);

export const TwitchDefaultSubscriberBadge = ({ size = 15, ...props }) => (
  <svg 
    viewBox="0 0 24 24" 
    width={size} 
    height={size} 
    fill="#9146FF"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
    {...props}
  >
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

export const YoutubeLogo = ({ size = 16, ...props }) => (
  <svg 
    viewBox="0 0 24 24" 
    width={size} 
    height={size} 
    fill="#FF0000"
    {...props}
  >
    <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.524 3.545 12 3.545 12 3.545s-7.525 0-9.388.51a3.003 3.003 0 0 0-2.11 2.108C0 8.028 0 12 0 12s0 3.972.502 5.837a3.003 3.003 0 0 0 2.11 2.108c1.863.51 9.388.51 9.388.51s7.524 0 9.388-.51a3.003 3.003 0 0 0 2.11-2.108c.502-1.865.502-5.837.502-5.837s0-3.972-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

export const YoutubeShortsLogo = ({ size = 16, ...props }) => {
  const isNumeric = !isNaN(Number(size));
  const heightVal = isNumeric ? Number(size) * (122.88 / 98.94) : `calc(${size} * 1.24)`;
  return (
    <svg 
      viewBox="0 0 98.94 122.88" 
      width={size} 
      height={heightVal} 
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
      {...props}
    >
      <path d="M63.49 2.71c11.59-6.04 25.94-1.64 32.04 9.83 6.1 11.47 1.65 25.66-9.94 31.7l-9.53 5.01c8.21.3 16.04 4.81 20.14 12.52 6.1 11.47 1.66 25.66-9.94 31.7l-50.82 26.7c-11.59 6.04-25.94 1.64-32.04-9.83-6.1-11.47-1.65-25.66 9.94-31.7l9.53-5.01c-8.21-.3-16.04-4.81-20.14-12.52-6.1-11.47-1.65-25.66 9.94-31.7l50.82-26.7zM36.06 42.53l30.76 18.99-30.76 18.9V42.53z" fill="#f40407"/>
      <path d="M36.06,42.53 V 80.42 L 66.82,61.52Z" fill="#fff"/>
    </svg>
  );
};
export const DefaultSubscriberBadge = ({ size = 16, ...props }) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      width={size} 
      height={size} 
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
      {...props}
    >
      <path d="M0 0 C0.99 0 1.98 0 3 0 C3.35191406 1.02738281 3.70382813 2.05476562 4.06640625 3.11328125 C7.11578602 11.77310065 10.39196361 19.62355472 16 27 C16.52464844 27.69222656 17.04929688 28.38445313 17.58984375 29.09765625 C24.95283616 37.49580859 37.35136173 43.90407003 48 47 C46.48389994 50.03220012 44.21051684 50.14801044 41.0625 51.25 C24.919376 57.33010675 14.87064796 66.59074189 7.6953125 82.19140625 C7.12831264 83.46009198 6.56306204 84.72956171 6 86 C5.54367188 86.99902344 5.08734375 87.99804688 4.6171875 89.02734375 C3.72221187 91.00818142 2.85623769 93.00211205 2 95 C-0.90818003 91.60283395 -2.29729764 87.89001484 -3.8125 83.75 C-6.13488239 77.72868797 -8.61281109 72.8104236 -13 68 C-13.59941406 67.27554688 -14.19882812 66.55109375 -14.81640625 65.8046875 C-22.88938743 56.76662508 -34.06601937 52.6291918 -45 48 C-43 46 -43 46 -39.75 44.875 C-25.35807209 39.58231637 -12.18935144 30.45932892 -5.4375 16.375 C-3.25233731 11.03134256 -1.43879593 5.59111049 0 0 Z " fill="#90D500" transform="translate(48,0)"/>
      <path d="M0 0 C0.99 0 1.98 0 3 0 C5.09230769 4.43076923 5.09230769 4.43076923 4.625 7.3125 C4.41875 7.869375 4.2125 8.42625 4 9 C3.67 8.01 3.34 7.02 3 6 C0.38952199 7.305239 0.31933577 8.35826574 -0.625 11.0625 C-0.88539062 11.79597656 -1.14578125 12.52945312 -1.4140625 13.28515625 C-1.60742188 13.85105469 -1.80078125 14.41695312 -2 15 C-2.66 15 -3.32 15 -4 15 C-2.9318153 9.88634986 -1.76892524 4.92772031 0 0 Z " fill="#368302" transform="translate(48,0)"/>
      <path d="M0 0 C0.66 0 1.32 0 2 0 C1.55123384 1.64846769 1.09069512 3.29373455 0.625 4.9375 C0.36976562 5.85402344 0.11453125 6.77054687 -0.1484375 7.71484375 C-1 10 -1 10 -3 11 C-4.0625 9.1875 -4.0625 9.1875 -5 7 C-4.67 6.01 -4.34 5.02 -4 4 C-3.34 4.33 -2.68 4.66 -2 5 C-1.34 3.35 -0.68 1.7 0 0 Z " fill="#399401" transform="translate(52,84)"/>
    </svg>
  );
};

export const KickGiftedSubsBadge = ({ giftedCount = 1, size = 16, style = {}, ...props }) => {
  if (giftedCount < 1) return null;

  // Find the closest bracket that is <= giftedCount
  const brackets = [1, 5, 10, 25, 50, 100, 200, 500];
  let activeBracket = 1;
  for (const b of brackets) {
    if (giftedCount >= b) {
      activeBracket = b;
    }
  }

  const badge = GIFTED_BADGES_DATA[String(activeBracket)];
  if (!badge) return null;

  return (
    <svg 
      className="kick-svg-element" 
      viewBox={badge.viewBox} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      style={{ width: size, height: size, verticalAlign: 'middle', marginRight: 4, display: 'inline-block', ...style }}
      {...props}
    >
      {badge.elements.map((el, idx) => {
        const Tag = el.type;
        const attribs = {};
        for (const [k, v] of Object.entries(el.attribs)) {
          let cleanK = k;
          if (k === 'fill-rule') cleanK = 'fillRule';
          else if (k === 'clip-rule') cleanK = 'clipRule';
          else if (k === 'stroke-width') cleanK = 'strokeWidth';
          attribs[cleanK] = v;
        }
        return <Tag key={idx} {...attribs} />;
      })}
    </svg>
  );
};




export const KickLogo = ({ size = 16, style = {}, ...props }) => (
  <svg 
    viewBox="0 0 24 24" 
    width={size} 
    height={size} 
    fill="#53FC18"
    style={{
      filter: 'drop-shadow(0px 1.5px 2px rgba(0, 0, 0, 0.75))',
      ...style
    }}
    {...props}
  >
    <path d="M1.333 0h8v5.333H12V2.667h2.667V0h8v8H20v2.667h-2.667v2.666H20V16h2.667v8h-8v-2.667H12v-2.666H9.333V24h-8Z" />
  </svg>
);

export const TiktokLogo = ({ size = 16, style = {}, ...props }) => (
  <svg 
    viewBox="0 0 24 24" 
    width={size} 
    height={size} 
    fill="#FE0979"
    style={{
      filter: 'drop-shadow(0px 1.5px 2px rgba(0, 0, 0, 0.45))',
      ...style
    }}
    {...props}
  >
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.05 1.62 4.2 1.07 1.1 2.58 1.8 4.19 1.9v3.96c-1.68-.02-3.32-.5-4.73-1.42-.14-.09-.27-.2-.41-.3-.08 2.58-.02 5.15-.05 7.73-.1 1.9-.84 3.74-2.19 5.03-1.57 1.49-3.78 2.27-5.93 2.12-2.31-.1-4.51-1.28-5.78-3.23-1.41-2.07-1.74-4.79-.88-7.13C3.21 10.3 5.41 8.5 7.91 8.18c.02 1.34.01 2.68.02 4.02-1.07.13-2.08.77-2.61 1.72-.61.98-.67 2.26-.17 3.24.49 1.05 1.56 1.77 2.72 1.87 1.25.13 2.52-.45 3.19-1.52.41-.63.53-1.39.51-2.14.02-5.12.01-10.23.02-15.35z" />
  </svg>
);

export const RumbleLogo = ({ size = 16, style = {}, ...props }) => (
  <svg 
    viewBox="0 0 24 24" 
    width={size} 
    height={size} 
    fill="#85B72C"
    style={{
      filter: 'drop-shadow(0px 1.5px 2px rgba(0, 0, 0, 0.45))',
      ...style
    }}
    {...props}
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5h-2v-5h2v5zm0-7h-2V7h2v2.5z" />
  </svg>
);

export const XLogo = ({ size = 16, style = {}, ...props }) => (
  <svg 
    viewBox="0 0 24 24" 
    width={size} 
    height={size} 
    fill="#E7E9EA"
    style={{
      filter: 'drop-shadow(0px 1.5px 2px rgba(0, 0, 0, 0.45))',
      ...style
    }}
    {...props}
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export default function PlatformLogo({ platform, isShorts = false, size = 16, style = {}, ...props }) {
  const norm = platform ? platform.toLowerCase() : '';
  const mergedStyle = {
    filter: norm === 'kick'
      ? 'drop-shadow(0px 1.5px 2px rgba(0, 0, 0, 0.75))'
      : 'drop-shadow(0px 1.5px 2.5px rgba(0, 0, 0, 0.45))',
    ...style
  };

  if (norm === 'youtube_shorts' || (norm === 'youtube' && isShorts)) {
    return <YoutubeShortsLogo size={size} style={mergedStyle} {...props} />;
  }
  switch (norm) {
    case 'twitch':
      return <TwitchLogo size={size} style={mergedStyle} {...props} />;
    case 'youtube':
      return <YoutubeLogo size={size} style={mergedStyle} {...props} />;
    case 'kick':
      return <KickLogo size={size} style={mergedStyle} {...props} />;
    case 'tiktok':
      return <TiktokLogo size={size} style={mergedStyle} {...props} />;
    case 'rumble':
      return <RumbleLogo size={size} style={mergedStyle} {...props} />;
    case 'x':
    case 'twitter':
      return <XLogo size={size} style={mergedStyle} {...props} />;
    default:
      return null;
  }
}
