"use client";

import { useEffect, useCallback, useRef } from "react";

export default function ParticlesComponent() {
  const decayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper: read current particle count from pJSDom
  const getParticleSystem = useCallback(() => {
    // @ts-ignore
    const pJSDom = window.pJSDom;
    if (!pJSDom || pJSDom.length === 0) return null;
    return pJSDom[0]?.pJS;
  }, []);

  // Schedule decay: after 10s of being above baseline, fade and cull excess particles
  const scheduleDecay = useCallback(() => {
    if (decayTimerRef.current) clearTimeout(decayTimerRef.current);

    decayTimerRef.current = setTimeout(() => {
      const pJS = getParticleSystem();
      if (!pJS) return;

      const particles = pJS.particles.array as any[];
      const baseline = 45;

      if (particles.length > baseline) {
        const excess = particles.length - baseline;
        
        // Remove excess particles one by one in staggered intervals
        for (let i = 0; i < excess; i++) {
          setTimeout(() => {
            const sys = getParticleSystem();
            if (!sys) return;
            const arr = sys.particles.array as any[];
            if (arr.length > baseline) {
              const p = arr[arr.length - 1];
              if (p) {
                // Fade out the particle smoothly before removal
                let opacity = p.opacity || 0.45;
                const fadeInterval = setInterval(() => {
                  opacity -= 0.05;
                  if (opacity <= 0) {
                    clearInterval(fadeInterval);
                    const idx = arr.indexOf(p);
                    if (idx > -1) {
                      arr.splice(idx, 1);
                    }
                  } else {
                    p.opacity = opacity;
                  }
                }, 50);
              }
            }
          }, i * (2000 / excess)); // Spread the fading/removal over 2 seconds
        }
      }
    }, 10000); // 10 seconds
  }, [getParticleSystem]);

  const initParticles = useCallback(() => {
    // cleanup old canvas
    const oldCanvas = document.querySelector("#particles-js canvas");
    if (oldCanvas) oldCanvas.remove();

    // @ts-ignore
    if (window.pJSDom?.length > 0) {
      // @ts-ignore
      window.pJSDom.forEach((p: any) => p.pJS.fn.vendors.destroypJS());
      // @ts-ignore
      window.pJSDom = [];
    }

    // Curated off-white accent colors to be subtle and premium
    const colors = {
      particles: "#f5f5f7",
      lines: "#e2e8f0",
      accent: "#cbd5e1",
    };

    // Monkeypatch window.addEventListener temporarily to wrap particles.js listeners
    const originalAddEventListener = window.addEventListener;
    // @ts-ignore
    window.addEventListener = function(type, listener, options) {
      if (type === 'mousemove' || type === 'pointermove' || type === 'touchmove' || type === 'click') {
        const wrappedListener = function(this: any, event: any) {
          if (event) {
            if (event.isSimulated) {
              return;
            }
            if (event.type === 'click') {
              const x = event.clientX;
              const y = event.clientY;
              const blockedContainers = document.querySelectorAll('.credentials-panel-content, .PortalModal');
              let isInsideBlockedArea = false;
              
              for (let i = 0; i < blockedContainers.length; i++) {
                const rect = blockedContainers[i].getBoundingClientRect();
                if (
                  x >= rect.left &&
                  x <= rect.right &&
                  y >= rect.top &&
                  y <= rect.bottom
                ) {
                  isInsideBlockedArea = true;
                  break;
                }
              }
              
              if (isInsideBlockedArea) {
                return; // Do not trigger particle push if click is inside the credentials card or modal
              }
            }
          }
          return listener.apply(this, arguments as any);
        };
        return originalAddEventListener.call(this, type, wrappedListener, options);
      }
      return originalAddEventListener.call(this, type, listener, options);
    };

    // @ts-ignore
    window.particlesJS("particles-js", {
      particles: {
        number: { value: 45, density: { enable: true, value_area: 800 } },
        color: { value: colors.particles },
        shape: { type: "circle", stroke: { width: 0.5, color: colors.accent } },
        opacity: {
          value: 0.45,
          random: true,
          anim: { enable: true, speed: 1, opacity_min: 0.15 },
        },
        size: {
          value: 2.5,
          random: true,
          anim: { enable: false },
        },
        line_linked: {
          enable: true,
          distance: 150,
          color: colors.lines,
          opacity: 0.15,
          width: 1.0,
        },
        move: { enable: true, speed: 2.2, random: true, out_mode: "bounce" },
      },
      interactivity: {
        detect_on: "window",
        events: {
          onhover: { enable: true, mode: "grab" },
          onclick: { enable: true, mode: "push" },
          resize: true,
        },
        modes: {
          grab: { distance: 220, line_linked: { opacity: 0.35 } },
          push: { particles_nb: 3 },
          repulse: { distance: 180, duration: 0.4 },
        },
      },
      retina_detect: false,
    });

    // Restore original addEventListener
    window.addEventListener = originalAddEventListener;

    // After init, attach a click listener to trigger decay scheduling
    const canvas = document.querySelector("#particles-js canvas");
    if (canvas) {
      canvas.addEventListener("click", () => scheduleDecay());
    }
    // Also listen globally so clicks anywhere on the page can trigger it
    window.addEventListener("click", scheduleDecay, { passive: true });
  }, [scheduleDecay]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js";
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      initParticles();
    };

    return () => {
      if (decayTimerRef.current) clearTimeout(decayTimerRef.current);
      window.removeEventListener("click", scheduleDecay);
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [initParticles, scheduleDecay]);

  return (
    <div
      id="particles-js"
      className={`
        w-full h-screen absolute top-0 left-0
        transition-colors duration-500
        bg-gradient-to-tr from-[#020202] via-[#08080a] to-[#121215]
        dark:from-[#000000] dark:via-[#040406] dark:to-[#0a0a0f]
      `}
      style={{ zIndex: 0 }}
    />
  );
}
