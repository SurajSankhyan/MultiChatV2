'use client';

import { Suspense, lazy, useEffect, useState } from 'react';
const Spline = lazy(() => import('@splinetool/react-spline'));

interface InteractiveRobotSplineProps {
  scene: string;
  className?: string;
}

export function InteractiveRobotSpline({ scene, className }: InteractiveRobotSplineProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const removeWatermark = () => {
      const walkDOM = (root: Node) => {
        if (root.nodeType === Node.ELEMENT_NODE) {
          const el = root as HTMLElement;

          // Target anchor tag linking to spline.design or containing watermark text
          if (el.tagName === 'A') {
            const anchor = el as HTMLAnchorElement;
            const href = anchor.href || '';
            const text = anchor.textContent || '';
            if (
              href.includes('spline.design') ||
              text.toLowerCase().includes('built with spline') ||
              text.toLowerCase().includes('spline')
            ) {
              anchor.style.setProperty('display', 'none', 'important');
              anchor.style.setProperty('opacity', '0', 'important');
              anchor.style.setProperty('visibility', 'hidden', 'important');
              anchor.style.setProperty('pointer-events', 'none', 'important');
              try {
                anchor.remove();
              } catch (e) {}
              return;
            }
          }

          // Also check for logo container IDs
          if (
            el.id === 'logo' || 
            el.id === 'spline-watermark' || 
            el.classList.contains('spline-watermark')
          ) {
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('opacity', '0', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
            el.style.setProperty('pointer-events', 'none', 'important');
            try {
              el.remove();
            } catch (e) {}
            return;
          }

          // Traverse shadow DOM if it exists
          if (el.shadowRoot) {
            walkDOM(el.shadowRoot);
          }
        }

        // Copy childNodes array to prevent mutation issues while removing elements
        Array.from(root.childNodes).forEach((child) => walkDOM(child));
      };

      // Traverse standard DOM
      if (document.body) {
        walkDOM(document.body);
      }

      // Traverse same-origin iframes
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach((iframe) => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            walkDOM(iframeDoc);
          }
        } catch (e) {
          // Ignore cross-origin iframe security errors
        }
      });
    };

    // Run cleanups repeatedly to catch asynchronous loads
    removeWatermark();
    const interval = setInterval(removeWatermark, 100);

    // Stop checking after 10 seconds
    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className={`${className} relative`}>
      {/* Glassmorphic Robot Skeleton Loader */}
      <div 
        className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#050505]/60 backdrop-blur-lg transition-all duration-1000 ease-out ${
          isLoaded ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100 scale-100'
        }`}
      >
        <div className="relative flex flex-col items-center gap-3 animate-pulse">
          {/* Head */}
          <div className="w-20 h-16 rounded-[1.5rem] bg-white/5 border border-white/10 flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(0,240,255,0.05)]">
            <div className="w-3.5 h-2 rounded-full bg-[#00f0ff]/40 shadow-[0_0_8px_rgba(0,240,255,0.4)]" />
            <div className="w-3.5 h-2 rounded-full bg-[#00f0ff]/40 shadow-[0_0_8px_rgba(0,240,255,0.4)]" />
          </div>
          {/* Neck */}
          <div className="w-3 h-2 bg-white/5 border-x border-white/10" />
          {/* Torso */}
          <div className="w-28 h-24 rounded-[1.5rem] bg-gradient-to-b from-white/5 to-white/0 border border-white/10 flex items-center justify-center relative shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="w-12 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[7px] font-black tracking-widest text-[#00f0ff]/40">
              3D BOOTING
            </div>
          </div>
          {/* Pedestal Base */}
          <div className="w-36 h-3 rounded-full bg-white/5 border border-white/10 mt-3 shadow-[0_10px_20px_rgba(0,240,255,0.05)]" />
        </div>
      </div>

      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center">
            <svg className="animate-spin h-6 w-6 text-white/30" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l2-2.647z"></path>
            </svg>
          </div>
        }
      >
        {/* Additional CSS rules to hide any anchors inside the spline viewport */}
        <style>{`
          .spline-embed a,
          .spline-canvas-container a,
          #spline-watermark, 
          a[href*="spline.design"],
          .spline-embed a[href*="spline.design"] { 
            display: none !important; 
            opacity: 0 !important; 
            pointer-events: none !important; 
            visibility: hidden !important;
          }
        `}</style>
        <div className="spline-canvas-container" style={{ width: '100%', height: '100%' }}>
          <Spline
            scene={scene}
            style={{ width: '100%', height: '100%' }}
            onLoad={() => setIsLoaded(true)}
          />
        </div>
      </Suspense>
    </div>
  );
}
